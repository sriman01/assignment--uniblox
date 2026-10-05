# Decisions

Approximate time spent: about 6 hours, across several sessions. The backend and tests came first, then the shop and admin UI, then Postgres persistence and deployment.

This document follows the order of the brief:

- the invariants, and where each one is enforced;
- ambiguities and the semantics I picked;
- the material decisions;
- the transaction, concurrency, and idempotency strategy;
- money and rounding;
- the error model;
- what is implemented and what is deferred;
- scaling;
- future scope;
- how AI was used;
- the next two hours.

## Invariants

| Invariant | Where it is enforced |
| --- | --- |
| A product is never sold below zero available units. | `StorefrontService.checkout` checks stock before any write. In Postgres, `CHECK (available_quantity >= 0)` also applies. |
| A cart is checked out at most once. | `checkout` requires `status = open` and flips it in the same unit of work. In Postgres, `orders.cart_id` is `UNIQUE`. |
| A successful checkout charges inventory once and creates one order. | All checkout writes happen together in one `transaction` callback, after every check passes. |
| Repeating a checkout with the same idempotency key returns that order and does not charge inventory again. | Step 1 of `checkout`. In Postgres, `orders.idempotency_key` is `UNIQUE`. |
| An idempotency key belongs to one cart. | `checkout` returns `IDEMPOTENCY_KEY_REUSED` when the key belongs to another cart. |
| A coupon is redeemed by at most one successful checkout. | `checkout` requires `status = available` and sets `redeemed` in the same unit of work. |
| A checkout that fails does not redeem a coupon and does not check out the cart. | Validation never writes; the writes run only after every check passes. In Postgres, a thrown error rolls the whole transaction back. |
| A customer gets at most one coupon per milestone of their own orders. Guest orders never count. | `rewards.ts` (`rewardProgress`, `earliestEligibleMilestone`) and `AdminService.generateCoupon`. In Postgres, there is a unique index on `(earned_by_customer_id, milestone)`. |
| A redeemed coupon never changes and cannot be deleted. It is part of an order's receipt. | `AdminService.updateCoupon` and `deleteCoupon` return `COUPON_LOCKED`. |
| An order's gross, discount, and net are frozen at placement. | Order lines snapshot the name and unit cents. Catalog edits never touch orders. |
| Discount is an integer number of cents from zero through the gross. Net is `gross - discount`, never negative. | `domain/money.ts`. In Postgres, `CHECK (net_cents >= 0)` also applies. |
| The report matches the stored orders and coupons, and reading it does not write. | `AdminService.report` computes from orders and coupons inside a read-only callback. `report.test.ts` checks that repeated reports are identical. |

## Ambiguities and the semantics I picked

The brief leaves several questions open:

- when the price is fixed;
- who a coupon belongs to;
- whether the nth order is discounted itself;
- how a retry is recognized;
- what happens when stock changes mid-cart.

**Price and stock**

- The cart stores a product id and a quantity. Prices are read from the catalog when the cart is viewed and again at checkout, and the order stores the checkout price. I would rather show the price the customer is about to pay than surprise them with an old one. Reservation expiry was out of scope for the timebox.
- Adding to a cart refuses a quantity that is already above current stock, so a bad quantity never sits in the cart quietly. Stock can fall afterward, so checkout checks again.

**Milestones**

- "Every nth order" is counted per customer, not across the whole store. A customer's own nth, 2nth, and later successful orders make milestones eligible for that customer, and the coupon belongs to them. A store-wide counter rewards whoever happens to place the 5th order, which is a lottery rather than a loyalty reward.
- Guest orders, placed without a customer session, count toward no one.
- The milestone order itself is not discounted. An administrator generates the coupon, and a later checkout supplies the code. An order that uses a coupon still counts toward the customer's next milestone.
- The coupon stores the percentage from config at generation time. Milestones are evaluated against the current `n`. If `n` changes, multiples of the new `n` that the customer has already reached become eligible, and existing coupons are kept.

**Coupons**

- Administrators can also create custom coupons, either for one customer or for anyone (`customerId: null`). Guests can redeem an "anyone" coupon.
- Admins can edit an unredeemed coupon's percentage, change its owner, and pause or resume it.
- A milestone coupon records who earned it (`earnedByCustomerId`) separately from who may redeem it (`customerId`). Reassigning a coupon therefore never makes the original earner eligible for that milestone again.
- Deleting an unredeemed milestone coupon does make its milestone eligible again, because deletion means "this reward never happened". Pausing revokes a coupon without reissuing it.

**Discount, payment, and retries**

- One discount is applied to the order gross, then floored. It is not rounded per line, because per-line flooring drifts from the order total.
- Checkout is the payment, since there is no payment provider. If checkout returns an order, it is paid. There is no authorized-but-not-captured state.
- `Idempotency-Key` is required. Without it, a timeout retry and a second click cannot be told apart.

**Accounts**

- Customers can register. Emails are case-insensitive and unique, and passwords are scrypt-hashed. Sessions are HMAC-signed cookies, which is enough to attribute orders to accounts.

## Decision: Fix price and stock at checkout

**Context:** A product's price or available quantity can change after it is added to a cart.

**Options considered:**
- Reserve inventory and lock the price when the item is added, with a hold that expires.
- Keep the cart as product id plus quantity, price it from the live catalog, and accept or refuse the sale at checkout.

**Choice:** Live catalog price, stock rechecked at checkout, and a snapshot on the order.

**Why:** A hold needs an expiry, a sweeper, and a rule for who gets the last unit while several carts hold it. The failure that matters is overselling, and checkout is where the sale happens. The order then keeps enough to explain the charge after the catalog moves.

**Consequences:** Two open carts can both contain the last unit. Only one checkout succeeds, and the other cart stays open and editable. If the price changes in between, the cart view can show a price the receipt does not. The cart response says so with `pricedAt: current_catalog`.

## Decision: Integer cents, discount floored once

**Context:** The total must not pick up binary floating-point error, and a percentage discount must not go negative or invent a fraction of a cent.

**Options considered:**
- IEEE floats, or a decimal library.
- Integer minor units, with the discount `floor(gross * percent / 100)` applied once to the gross and clamped to `[0, gross]`.

**Choice:** Integer cents and one floored discount.

**Why:** 10% of $9.99 is `floor(999 * 10 / 100) = 99` cents, not a float near `0.999`. Flooring favors the customer by at most one cent and is deterministic. A 100% coupon yields a net of zero, not a negative one. Non-integer values are rejected before any arithmetic.

**Consequences:** Currency is USD cents only, and rounding is customer-favorable rather than banker's rounding. Totals that would leave the safe integer range are rejected rather than rounded as floats.

## Decision: Require an idempotency key on checkout

**Context:** A client may retry checkout because it timed out, and two clicks may be in flight together.

**Options considered:**
- Treat any second checkout of a cart as a replay of the first.
- Accept an optional key, and when it is absent, return the existing order on a second try.
- Require a client key. The same key and cart replay the order. The same key with a different cart conflicts. A new key on a finished cart conflicts and points at the existing order.

**Choice:** The key is required.

**Why:** A second request without a key might be a retry or an accidental second purchase, and those are different. The key makes the retry explicit, and it cannot be reused to check out someone else's cart. Overlapping requests with one key are serialized and become one order.

**Consequences:**
- Clients must store the key until they see the order. The shop keeps it in `sessionStorage` for that cart.
- The first success returns 201. A replay returns 200 with `Idempotent-Replayed: true`.
- A changed coupon on a replay does not rewrite the order.

## Decision: One lock around the whole checkout

**Context:** Overlapping checkouts must not oversell a unit or redeem one coupon twice. The brief allows an in-memory store if the overlap behavior is real.

**Options considered:**
- No lock, and a comment that a database would sort it out later.
- A lock only around the inventory decrement, with the coupon updated afterward.
- One FIFO lock around the whole decision: read, decide, then write inventory, coupon, order, cart, and idempotency record.

**Choice:** One lock for every unit of work. The service mutates state only after every check has passed, and only inside that callback.

**Why:** A gap between "the coupon is free" and "the coupon is redeemed" is the bug. The lock is not reentrant, so services never call back into `transaction` while holding it. The work itself is synchronous, so the in-memory lock is never held across I/O.

**Consequences:** The in-memory lock is correct for one process. The Postgres store keeps the same contract across processes; see the next decision. Tests fire competing checkouts with `Promise.all` rather than only a happy path.

## Decision: Postgres behind the same unit-of-work port

**Context:** Data had to survive restarts, and the services were written against `CheckoutStorePort.transaction(work)`, where `work` runs alone and synchronously against the whole state.

**Options considered:**
- Rewrite every service method as hand-written SQL.
- Store the whole state as one JSON document.
- Keep the port, and make each unit of work one database transaction over normal tables.

**Choice:** `PostgresCheckoutStore` does the following in one database transaction:
1. Take `pg_advisory_xact_lock`.
2. Load every table in one query.
3. Run the unchanged service code.
4. Diff the rows before and after, and upsert or delete only what changed.
5. Commit.

**Why:**
- Checkout, coupon, and reward rules stay in one tested place.
- The advisory lock gives the same "runs alone" guarantee as the in-memory lock, and it also covers several API processes.
- A thrown error rolls the whole transaction back. That is safer than the in-memory store, where a throw midway could leave partial writes.
- Database constraints back up the rules: non-negative stock, a unique email, a unique idempotency key, one coupon per earner and milestone, and foreign keys deferred to commit.

**Consequences:**
- Every request reads the full dataset and is serialized store-wide. That is fine at assignment scale, but not for a large catalog or heavy write traffic. The upgrade path is under "Multiple instances and production scale".
- A request costs a few round trips to the database, roughly 100 ms to the hosted instance.
- Tests run the same adapter against an embedded PGlite database, so `npm test` never needs private credentials.

## Decision: Per-customer milestones, generated explicitly by an administrator

**Context:** Every nth successful order makes a discount available, an administrator requests generation, and a coupon is supplied at checkout. The brief does not say whose orders are counted.

**Options considered:**
- A store-wide counter, where the 5th order overall unlocks one coupon for whoever placed it.
- A per-customer counter, with the coupon issued automatically at checkout.
- A per-customer counter, where an administrator generates the customer's lowest unrewarded milestone.

**Choice:** A per-customer counter with admin generation, one milestone per request. The request can name a customer, or omit one to serve whoever reached an unrewarded milestone first. Codes are `REWARD-<milestone>-<customer id prefix>`, with a suffix added on the rare collision.

**Why:**
- A store-wide counter does not reward a customer's own loyalty.
- Automatic issuance would skip the brief's "administrator requests generation" step.
- "Already generated" is checked by earner and milestone, not by code, so editing or reassigning a coupon cannot open a duplicate.
- A failed checkout does not burn the code.

**Consequences:**
- Nobody receives a coupon until an administrator generates it. The admin page lists every customer's progress, with a Generate button when a customer is eligible.
- Guest orders do not earn coupons. To keep coupons usable without an account, the admin can create an "anyone" custom coupon.
- When two checkouts race for one code, one pays the discounted total. The other gets `COUPON_UNAVAILABLE` and keeps an open cart.
- An admin pause racing a checkout goes through the same lock. Either the order redeems the coupon and the pause gets `COUPON_LOCKED`, or the pause wins and the checkout gets `COUPON_UNAVAILABLE`. A test runs both orderings.

## Decision: Ports-and-adapters layering, with plain REST at the edge

**Context:** The checkout rules need to be testable without an HTTP server or a database, and the API still has to be small, with explicit status codes.

**Options considered:**
- A flat router with the rules written inside the route handlers.
- POST-only RPC-style routes behind authentication guards.
- Domain, outgoing ports, application services, an incoming HTTP adapter, and outgoing adapters, with REST verbs and status codes at the edge and `Result` with `success` for expected failures.

**Choice:** The layered module, with ordinary HTTP at the edge.

**Why:** The layering is what keeps the checkout rules testable without the server, and lets the storage change without touching them. RPC routes and auth guards add machinery the brief does not ask for; it wants a small HTTP API and says authentication is not required.

**Consequences:** Expected failures return a `code` and a status, and unexpected failures still throw. Swapping the store from memory to Postgres touched no service code.

## Decision: Signed-cookie sessions, so the app runs on serverless hosts

**Context:** Customer and admin sessions began as in-memory maps. On Vercel or Netlify each request can land on a different instance, so in-memory sessions would sign people out at random.

**Options considered:**
- A sessions table in Postgres.
- Stateless HMAC-signed cookies.
- Keeping in-memory sessions and deploying only to a single long-running server.

**Choice:** Signed cookies (`payload.signature`, HMAC-SHA256 with `SESSION_SECRET`). Each one carries the session kind, subject, and expiry, and lasts 7 days, with `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS.

**Why:** Any instance can verify a cookie without a database round trip or a new table, and the brief does not require authentication. A tampered cookie, or a customer cookie presented as an admin session, is rejected. `sessionTokens.test.ts` covers this.

**Consequences:**
- Sessions survive restarts and work across instances.
- Signing out clears the cookie, but a copied token stays valid until it expires. There is no server-side revocation; see the deferred list.

## Transaction, concurrency, and idempotency

`transaction` runs its callback alone. The in-memory store does this with a process lock, and the Postgres store with an advisory lock inside one database transaction. Checkout does this in order:

1. If the idempotency key already exists for this cart, return that order.
2. If it exists for another cart, conflict.
3. Require an open, non-empty cart.
4. Price every line from the current catalog, and refuse if any quantity exceeds stock.
5. Resolve the coupon, if any. Refuse when it is missing, paused, already redeemed, or owned by another customer.
6. Compute gross, discount, and net.
7. Decrement stock, redeem the coupon, insert the order, mark the cart checked out, and store the key.

Steps 1–6 do not write; step 7 runs only after they pass. The checks are repeated immediately before the writes, so a logic bug fails closed instead of publishing a half-updated order. In Postgres a throw also rolls back.

The tests exercise competing and repeated operations, not just happy paths:

- concurrent checkouts for the last unit;
- concurrent redemptions of one coupon;
- duplicate checkouts with one idempotency key;
- an admin pause racing a checkout;
- the same flows against Postgres, through PGlite.

## Money and rounding

- All persisted amounts are integer cents.
- A line total is `unitPriceCents * quantity`.
- The discount is `floor(grossCents * percent / 100)`, applied once and never greater than the gross.
- Example: a 1234-cent gross at 10% gives a 123-cent discount and a 1111-cent net. A 100% coupon nets zero.

## Error model

- Expected domain failures are values, not exceptions. The HTTP adapter maps their codes to 400, 401, 404, or 409.
- The body is `{ error: { code, message, details } }`. Zod validation failures use `VALIDATION_ERROR`, and unknown routes return `NOT_FOUND`.
- A missing idempotency key has its own code, so a client can tell it apart from a bad quantity.
- `COUPON_LOCKED` is separate from `COUPON_UNAVAILABLE`, so an admin client can tell "you can't edit this" apart from a shopper being told "you can't use this".

## Implemented and deferred

Implemented:

- Catalog, carts, checkout with idempotency, orders, and the report.
- Per-customer milestone coupons, plus admin-managed custom coupons that can be edited, paused, reassigned, and deleted until redeemed.
- Customer registration and sign-in, with signed-cookie sessions.
- Admin price and stock edits, and configurable `n` and `x`.
- Postgres persistence, with an in-memory fallback when no database is configured.
- Deployment as a single Node server, or on Vercel or Netlify as a static site plus one API function.
- Focused tests, including overlapping checkouts, coupon races, and Postgres restart and rollback tests.
- A small shop and admin UI that demonstrate the backend behavior.

Deferred:

- Password reset, server-side session revocation, and API authorization. Sessions are stateless 7-day cookies. The admin API stays open, as the brief allows.
- A real payment authorizer. Checkout success is payment success.
- Coupon expiry and stacking. One coupon may be supplied per checkout.
- SKUs and size or colour variants. The brief defines a product as ID, name, current price, and inventory; see "Future scope".
- Tax, shipping, and refunds.
- Inventory holds and price locks.
- Row-level locking. The Postgres store serializes all work behind one advisory lock.
- A CI pipeline and a performance suite. The tests cover the invariants I was unwilling to get wrong, not throughput.

## Multiple instances and production scale

The Postgres store is already durable and safe across processes, but it serializes everything behind one lock and reads the full state. To scale, narrow each transaction to the rows it touches:

- Lock product rows with `SELECT … FOR UPDATE`, and decrement stock with an `available_quantity >= requested` check.
- Insert the idempotency key in the same transaction as the order, relying on its unique constraint. On a conflict, re-read the original order when the cart matches, and return `IDEMPOTENCY_KEY_REUSED` when it does not.
- Redeem a coupon with a conditional update from `status = available` to `redeemed`, affecting one row. Zero rows updated means another transaction took it.
- Keep snapshotting order lines, so a later price update does not rewrite history.
- Keep the report a read of orders and coupons, never a counter that increments on read. At larger scale, add precomputed aggregates or a read replica.

That needs repository-style ports (load this cart, lock these products) instead of the whole-state callback. The service methods would change shape, but not their rules. Connection pooling (PgBouncer or the provider's pooler) becomes necessary once many serverless instances connect at once.

## Future scope

### Product variants and SKU-level inventory

Today a product is the thing that is priced and stocked. With variants, the product becomes the thing that is browsed, and the SKU becomes the thing that is sold.

**Model**

- **`Product`** keeps the shared fields: `id`, `name`, description, and images. It also declares its option axes, for example `options: [{ name: "size", values: ["S", "M", "L"] }, { name: "color", values: ["Navy", "Sand"] }]`.
- **`Sku`** is one sellable combination: `{ id, productId, code, attributes, unitPriceCents, availableQuantity }`.
  - `code` looks like `MERINO-NAVY-L`.
  - `attributes` holds the chosen values as parameters, for example `{ size: "L", color: "Navy" }`. Any axis works, such as material or length, without a schema change.
- In Postgres, a `skus` table has a `jsonb` `attributes` column with a unique index on `(product_id, attributes)`, so one combination cannot exist twice. It also gets `CHECK (available_quantity >= 0)`, the same guarantee products have now.

**Where stock and price live**

- Inventory and price move from the product to the SKU. A product's "in stock" and "from $X" are derived from its SKUs.
- Cart items and order lines reference `skuId`. Order lines also snapshot the SKU code and attributes, next to the name and cents they already store, so a renamed or retired variant does not rewrite history.

**What stays the same**

- Checkout runs the same steps, keyed by SKU instead of product: price each line, refuse when a quantity exceeds that SKU's stock, then decrement that SKU's stock inside the same unit of work.
- The overlap guarantees carry over unchanged. Two shoppers racing for the last Navy L get one order and one `INSUFFICIENT_INVENTORY`, while Sand M is unaffected.

**What changes**

- **Admin inventory:** stock and price are edited per SKU. Variants can be added or retired, but never deleted once ordered.
- **Product page:** a picker shows each option axis. Combinations that don't exist or are out of stock are disabled.
- **Report:** quantity is reported per product, with a per-SKU breakdown.
- **Migration:** each existing product becomes one product with a single default SKU that carries its current price and stock.

### Other next steps

- **Coupon expiry and rules:** an `expiresAt` date, a minimum order value, and an explicit no-stacking rule, all checked in step 5 of checkout.
- **Payments:** a `PaymentPort` with a fake adapter. Checkout would authorize before step 7 and capture after commit, adding a `pending_payment` order state.
- **Session revocation:** a short-lived signed cookie plus a server-side session table, so signing out or a password change ends every session.
- **Admin authorization:** protect `/admin` API routes with the admin session, not only the UI.
- **Row-level locking:** as described under "Multiple instances and production scale".

## How AI was used

Cursor drafted much of this module from the brief and from a ports-and-adapters layout I specified: domain, ports, incoming and outgoing adapters, and `Result`. I reviewed and ran everything, and redirected it several times:

- **Coupon semantics.** The first version counted every nth order store-wide and issued one coupon to whoever placed it. I rejected that as a lottery, not a loyalty reward, and redirected it to per-customer milestones. Guests don't count, admins generate per customer, and admins can edit, pause, reassign, or delete unredeemed coupons. That change reshaped the domain model (`earnedByCustomerId` versus `customerId`) and most of the coupon tests.
- **HTTP style.** It suggested POST-only RPC-style routes behind authentication guards. The brief asks for a small HTTP API and says auth is not required, so the edge stays REST with status codes, and `/admin` is marked as administrative.
- **Cart holds.** It suggested reserving stock when an item is added to the cart. That needs expiry and a sweeper I would not finish honestly in the timebox, and it fits "price and availability may change before checkout" poorly. Checkout-time checks plus the single lock are the rule actually enforced.
- **Repository history.** It committed on my behalf. I removed those commits, so the history reflects my own increments.
- **Deployment bugs.** I deployed to Vercel and Netlify myself and fed back real failures: a missing output directory, a secrets-scan false positive, and a 502 caused by a CA certificate whose line breaks the dashboard had collapsed. Each fix was checked against the live database before I pushed it.

I also kept the shop small. The UI stores the idempotency key and renders the receipt; it does not reimplement the rules.

## Another two hours

1. Run the overlapping-checkout tests against two API processes sharing the real Postgres instance. PGlite is single-session, so the current Postgres tests prove correctness, not cross-process locking.
2. Move checkout to row-level locks, so unrelated carts stop waiting on each other, and measure the change.
3. Protect the admin API with the admin session, which is the most obvious gap if this went beyond a demo.
