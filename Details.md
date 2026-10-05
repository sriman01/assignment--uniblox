# About Implemented Feature and Future Scope

## Invariants

- A product is never sold below zero available units.
- A cart is checked out at most once.
- A successful checkout charges inventory once and creates one order.
- Repeating that checkout with the same idempotency key returns that order and does not charge inventory again.
- An idempotency key belongs to one cart.
- A coupon is redeemed by at most one successful checkout.
- A checkout that fails does not redeem a coupon and does not check out the cart.
- A customer gets at most one coupon per milestone of their own orders. Guest orders never count.
- A redeemed coupon never changes and cannot be deleted. It is part of an order’s receipt.
- An order’s gross, discount, and net are frozen at placement. Later catalog edits do not change them.
- Discount is an integer number of cents, from zero through the gross. Net is `gross - discount` and is never negative.
- The report’s gross, discounts, net, unit counts, and coupon counts match the stored orders and coupons.
- Reading the report does not write.

## Decision: Require an idempotency key on checkout

**Context:** A client may retry checkout because it timed out, and two clicks may be in flight together.

**Options considered:**
- Treat any second checkout of a cart as a replay of the first.
- Accept an optional key and, when it is absent, return the existing order on a second try.
- Require a client key. The same key and cart replay the order. The same key and a different cart conflict. A new key on a finished cart conflicts and points at the existing order.

**Choice:** The key is required.

**Why:** A second request without a key might be a retry or an accidental second purchase. Those are different. The key makes the retry explicit. The same key cannot be reused to check out someone else’s cart. Overlapping requests with one key are serialized and become one order.

**Consequences:** Clients must store the key until they see the order. The shop keeps it in `sessionStorage` for that cart. A replay returns HTTP 200 and `Idempotent-Replayed: true`. The first success returns 201. A changed coupon on a replay does not rewrite the order.

## Decision: One in-process lock around the whole checkout

**Context:** Overlapping checkouts must not oversell a unit or redeem one coupon twice. The brief allows an in-memory store if the overlap behavior is real.

**Options considered:**
- No lock, and a comment that a database would sort it out later.
- A lock only around the inventory decrement, with the coupon updated afterward.
- One FIFO lock around the whole decision: read, decide, write inventory, coupon, order, cart, and idempotency record.

**Choice:** One lock for every unit of work. The service mutates state only after every check has passed, and only inside that callback.

**Why:** A gap between “coupon is free” and “coupon is redeemed” is the bug. The lock is not reentrant, so services do not call back into `transaction` while they hold it. The write path is synchronous, so the lock is not held across I/O.

**Consequences:** The in-memory lock is correct for one process. The Postgres store keeps the same contract across processes; see the next decision. Tests fire competing checkouts with `Promise.all` rather than only a happy path.

## Decision: Postgres behind the same unit-of-work port

**Context:** Data had to survive restarts, and the services were written against `CheckoutStorePort.transaction(work)`, where `work` runs alone and synchronously against the whole state.

**Options considered:**
- Rewrite every service method as hand-written SQL.
- Store the whole state as one JSON document.
- Keep the port. Each unit of work becomes one database transaction over normal tables.

**Choice:** `PostgresCheckoutStore` takes `pg_advisory_xact_lock`, loads every table in one query, runs the unchanged service code, diffs the rows before and after, and upserts or deletes only what changed, then commits.

**Why:**
- Checkout, coupon, and reward rules stay in one tested place.
- The advisory lock gives the same "runs alone" guarantee as the in-memory lock, and it also covers several API processes.
- A thrown error rolls the whole transaction back, which is safer than the in-memory store, where a throw midway could leave partial writes.
- Constraints back up the rules: non-negative stock, a unique email, a unique idempotency key, one coupon per earner and milestone, and foreign keys deferred to commit.

**Consequences:**
- Every request reads the full dataset and is serialized store-wide. That is fine at assignment scale, but not for a large catalog or heavy write traffic. The upgrade path is in "Several instances and a production database".
- A request costs a few round trips to the database, roughly 100 ms to the hosted instance.
- Sessions are not stored in the database. They are signed cookies; see the deferred list.

## Decision: Per-customer milestones, generated explicitly by an administrator

**Context:** Every nth successful order makes a discount available. The brief also says an administrator requests generation, and a coupon is supplied at checkout. It does not say whose orders are counted.

**Options considered:**
- A store-wide counter. The 5th order overall unlocks one coupon for whoever placed it.
- A per-customer counter where the coupon is issued automatically at checkout.
- A per-customer counter where an administrator generates the customer’s lowest unrewarded milestone.

**Choice:** A per-customer counter with admin generation, one milestone per request. The request can name a customer, or omit one to serve whoever reached an unrewarded milestone first. Codes are `REWARD-<milestone>-<customer id prefix>`. A suffix is added on the rare collision.

**Why:** A store-wide counter does not reward a customer’s own loyalty. Automatic issuance would skip the brief’s “administrator requests generation” step. “Already generated” is checked by scanning that customer’s milestone coupons for the earner and milestone, not by the code, so editing or reassigning a coupon cannot open a duplicate. A failed checkout does not burn the code.

**Consequences:**
- Nobody receives a coupon until an administrator generates it. The admin page lists every customer’s progress and shows a Generate button when a customer is eligible.
- Guest API orders no longer earn coupons. To keep coupons usable without authentication, the admin can create an “anyone” custom coupon.
- Two checkouts racing for one code: one pays the discounted total, and the other gets `COUPON_UNAVAILABLE` and keeps an open cart.
- An admin pause racing a checkout goes through the same lock. Either the order redeems the coupon and the pause gets `COUPON_LOCKED`, or the pause wins and the checkout gets `COUPON_UNAVAILABLE`. A test runs both orderings.

## Decision: Keep Vesta’s layering, not Vesta’s HTTP style

**Context:** The service should be recognizable as the same kind of module we use in Vesta, and it still has to be a small API with explicit status codes.

**Options considered:**
- POST-only routes, authentication guards, and workspace scope, matching Pluto controllers.
- A flat Express router with the rules in the handlers.
- Domain, outgoing ports, application services, an incoming HTTP adapter, and outgoing adapters. REST verbs and status codes at the edge. `Result` with `success` for expected failures.

**Choice:** The layered module, with ordinary HTTP at the edge and small signed-cookie browser sessions for the demo customer/admin workflows.

**Why:** The layering is what keeps checkout rules testable without the server. Vesta’s all-POST admin routes and capability guards assume a platform this exercise does not have. The assignment says authentication is not required, so the demo sessions gate browser routes without pretending to be production authorization.

**Consequences:** Expected failures return a `code` and a status. Unexpected failures still throw. The admin UI redirects to `/admin/sign-in`, but direct admin API calls remain open as allowed by the brief.

## Transaction, concurrency, and idempotency

`transaction` runs the callback alone. The in-memory store does it with a process lock, and the Postgres store with an advisory lock inside one database transaction. Checkout does this in order:

1. If the idempotency key already exists for this cart, return that order.
2. If it exists for another cart, conflict.
3. Require an open, non-empty cart.
4. Price every line from the current catalog and refuse if any quantity exceeds stock.
5. Resolve the coupon, if any. Refuse when it is missing, paused, already redeemed, or owned by another customer.
6. Compute gross, discount, and net.
7. Decrement stock, redeem the coupon, insert the order, mark the cart checked out, and store the key.

Steps 1–6 do not write. Step 7 runs only after they pass. A thrown error after a write would be a defect; the checks are repeated immediately before the writes so a logic bug fails closed instead of publishing a half-updated order. The lock makes the “repeated check” redundant against other requests. It is there so the write block stays obviously all-or-nothing.

## Money and rounding

All persisted amounts are integer cents. Line total is `unitPriceCents * quantity`. Discount is `floor(grossCents * percent / 100)`, applied once, and never greater than the gross. Example: 1234 cents at 10% discounts 123 cents, net 1111. A 100% coupon nets zero.


## Implemented and deferred

Implemented:

- Catalog, carts, checkout, idempotency, and the report.
- Customer registration and sign-in.
- Per-customer milestone coupons, plus admin-managed custom coupons that can be edited, paused, and deleted.
- Admin price and stock edits.
- Focused tests, including overlapping checkouts and a pause-versus-checkout race.
- A small shop.


## Future scope: product variants and SKU-level inventory

Today a product is the thing that is priced and stocked. With variants, the product becomes the thing that is browsed, and the SKU becomes the thing that is sold.

**Model**

- **`Product`** keeps the shared fields: `id`, `name`, description, and images. It also declares its option axes, for example `options: [{ name: "size", values: ["S", "M", "L"] }, { name: "color", values: ["Navy", "Sand"] }]`.
- **`Sku`** is one sellable combination: `{ id, productId, code, attributes, unitPriceCents, availableQuantity }`.
  - `code` looks like `MERINO-NAVY-L`.
  - `attributes` holds the chosen values as parameters, for example `{ size: "L", color: "Navy" }`. Any axis works, such as material or length, without a schema change.
- In Postgres, a `skus` table with a `jsonb` `attributes` column carries a unique index on `(product_id, attributes)`, so one combination cannot exist twice. It also gets `CHECK (available_quantity >= 0)`, the same guarantee products have now.

**Where stock and price live**

- Inventory and price move from the product to the SKU. A product's "in stock" and "from $X" are derived from its SKUs.
- Cart items and order lines reference `skuId`. Order lines also snapshot the SKU code and attributes, next to the name and cents they already store, so a renamed or retired variant does not rewrite history.

**What stays the same**

- Checkout runs the same steps, keyed by SKU instead of product: price each line, refuse when quantity exceeds that SKU's stock, then decrement that SKU's stock inside the same unit of work.
- The overlap guarantees carry over unchanged. Two shoppers racing for the last Navy L get one order and one `INSUFFICIENT_INVENTORY`, while Sand M is unaffected.

**What changes**

- **Admin inventory:** stock and price are edited per SKU. Variants are added or retired, but never deleted once ordered.
- **Product page:** a picker shows each option axis. Combinations that don't exist or are out of stock are disabled.
- **Report:** quantity is reported per product, with a per-SKU breakdown.
- **Migration:** each existing product becomes one product with a single default SKU that carries its current price and stock.


## Another two hours

I would run the overlapping checkout tests against two API processes sharing the real Postgres instance (PGlite is single-session), then move checkout to row-level locks so unrelated carts stop waiting on each other.
