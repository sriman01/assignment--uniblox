# Decisions

Approximate implementation and verification time in this session: 1 hour.

## Invariants

- A product is never sold below zero available units.
- A cart is checked out at most once.
- A successful checkout charges inventory once and creates one order.
- Repeating that checkout with the same idempotency key returns that order and does not charge inventory again.
- An idempotency key belongs to one cart.
- A coupon is redeemed by at most one successful checkout.
- A checkout that fails does not redeem a coupon and does not check out the cart.
- An order’s gross, discount, and net are frozen at placement. Later catalog edits do not change them.
- Discount is an integer number of cents, from zero through the gross. Net is `gross - discount` and is never negative.
- The report’s gross, discounts, net, unit counts, and coupon counts match the stored orders and coupons.
- Reading the report does not write.

## Ambiguities and the semantics I picked

The brief does not say when the price is fixed, who a coupon belongs to, whether the nth order itself is discounted, or how a retry is recognized.

- The cart stores product id and quantity. Prices are read from the catalog when the cart is viewed and again at checkout. The order stores the checkout price. I would rather show the price the customer is about to pay than surprise them with an old one, and I would rather not build reservation expiry in this timebox.
- Adding to a cart still refuses a quantity that is already above current stock, so a bad quantity never sits in the cart quietly. Stock can fall afterward. Checkout checks again.
- The UI has one demo customer account. When the milestone order belongs to a customer, the generated coupon belongs to that customer and other customers cannot redeem it. Anonymous API orders produce a global coupon to retain the assignment's authentication-free API behavior.
- The nth successful order makes a milestone eligible. It does not discount itself. An administrator generates `MILESTONE-n`, and a later checkout supplies that code. An order that uses a coupon still counts toward the next milestone.
- The coupon stores the percent from config at generation time.
- One discount is applied to the order gross, then floored. It is not rounded per line, because per-line flooring drifts from the order total.
- Checkout with no payment provider is the payment. If checkout returns an order, it is paid. There is no authorized-but-not-captured state.
- `Idempotency-Key` is required. Without it, a timeout and a second click cannot be told apart.

## Decision: Fix price and stock at checkout

**Context:** A product’s price or available quantity can change after it is added to a cart.

**Options considered:**
- Reserve inventory and lock the price when the item is added, with a hold that expires.
- Keep the cart as product id plus quantity, price it from the live catalog, and accept or refuse the sale at checkout.

**Choice:** Live catalog price, rechecked stock, snapshot on the order.

**Why:** A hold needs an expiry, a sweeper, and a rule for who gets the last unit while several carts hold it. The failure that matters is overselling, and checkout is where the sale happens. The order then keeps enough to explain the charge after the catalog moves.

**Consequences:** Two open carts can both contain the last unit. Only one checkout succeeds. The other stays open and can be edited. The cart view can show a price that the eventual receipt does not, if the price changes in between. That is stated on the cart page as `pricedAt: current_catalog`.

## Decision: Integer cents, discount floored once

**Context:** The total must not pick up binary floating-point error, and a percent discount must not go negative or invent a fraction of a cent.

**Options considered:**
- IEEE floats, or a decimal library.
- Integer minor units, with the discount `floor(gross * percent / 100)` applied once to the gross and clamped to `[0, gross]`.

**Choice:** Integer cents and one floored discount.

**Why:** `10% of $9.99` is `floor(999 * 10 / 100) = 99` cents, not a float near `0.999`. Flooring favors the customer by at most one cent and is deterministic. A 100% coupon yields a zero net, not a negative one. Values that are not integers are rejected before arithmetic.

**Consequences:** Currency is USD cents only. Rounding is customer-favorable and not banker’s rounding. Very large totals that would leave the safe integer range are rejected rather than rounded in float.

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

**Consequences:** This is correct for one process. It does not coordinate two API processes. See the scale section. Tests fire competing checkouts with `Promise.all` rather than only a happy path.

## Decision: Generate coupons explicitly, one milestone at a time

**Context:** Every nth successful order makes a discount available. The brief also says an administrator requests generation, and a coupon is supplied at checkout.

**Options considered:**
- Automatically attach the discount to the nth order.
- Generate every eligible milestone in one call.
- Generate the oldest missing milestone when an administrator asks, and only if the order count has reached it.

**Choice:** One explicit coupon per request, oldest milestone first. Codes are `MILESTONE-5`, `MILESTONE-10`, and so on.

**Why:** Generation and redemption are separate in the brief. Auto-applying the discount would hide that, and it would discount an order the shopper has already paid. A stable code makes the “already generated” check obvious. A failed checkout does not burn the code, so the next attempt can use it.

**Consequences:** Nobody receives a coupon until an administrator generates it. The shop’s admin page is that action. Two checkouts racing for one code: one pays the discounted total, the other gets `COUPON_UNAVAILABLE` and keeps an open cart.

## Decision: Keep Vesta’s layering, not Vesta’s HTTP style

**Context:** The service should be recognizable as the same kind of module we use in Vesta, and it still has to be a small API with explicit status codes.

**Options considered:**
- POST-only routes, authentication guards, and workspace scope, matching Pluto controllers.
- A flat Express router with the rules in the handlers.
- Domain, outgoing ports, application services, an incoming HTTP adapter, and outgoing adapters. REST verbs and status codes at the edge. `Result` with `success` for expected failures.

**Choice:** The layered module, with ordinary HTTP at the edge and small in-memory browser sessions for the demo customer/admin workflows.

**Why:** The layering is what keeps checkout rules testable without the server. Vesta’s all-POST admin routes and capability guards assume a platform this exercise does not have. The assignment says authentication is not required, so the demo sessions gate browser routes without pretending to be production authorization.

**Consequences:** Expected failures return a `code` and a status. Unexpected failures still throw. The admin UI redirects to `/admin/sign-in`, but direct admin API calls remain open as allowed by the brief.

## Transaction, concurrency, and idempotency

Inside one process, `InMemoryCheckoutStore.transaction` runs the callback alone. Checkout does this in order:

1. If the idempotency key already exists for this cart, return that order.
2. If it exists for another cart, conflict.
3. Require an open, non-empty cart.
4. Price every line from the current catalog and refuse if any quantity exceeds stock.
5. Resolve the coupon, if any, and refuse when it is missing or already redeemed.
6. Compute gross, discount, and net.
7. Decrement stock, redeem the coupon, insert the order, mark the cart checked out, and store the key.

Steps 1–6 do not write. Step 7 runs only after they pass. A thrown error after a write would be a defect; the checks are repeated immediately before the writes so a logic bug fails closed instead of publishing a half-updated order. The lock makes the “repeated check” redundant against other requests. It is there so the write block stays obviously all-or-nothing.

## Money and rounding

All persisted amounts are integer cents. Line total is `unitPriceCents * quantity`. Discount is `floor(grossCents * percent / 100)`, applied once, and never greater than the gross. Example: 1234 cents at 10% discounts 123 cents, net 1111. A 100% coupon nets zero.

## Error model

Expected domain failures are values, not exceptions. The HTTP adapter maps codes to 400, 404, or 409. The body is `{ error: { code, message, details } }`. Validation from Zod uses `VALIDATION_ERROR`. A missing idempotency key is its own code so a client can tell it apart from a bad quantity. Unknown routes return `NOT_FOUND`.

## Implemented and deferred

Implemented: catalog, carts, checkout, idempotency, coupons, report, admin price and stock edits, focused tests including overlapping checkouts, and a small shop.

Deferred:

- Production authentication, password hashing, registration, reset, and API authorization. The demo has fixed in-memory customer/admin sessions.
- A real payment authorizer. Checkout success is payment success.
- Coupon expiry and stacking. Customer ownership is implemented; one coupon may be supplied per checkout.
- SKUs and color/size variants. The assignment defines a product as ID, name, current price, and inventory; variant-level inventory is outside its scope and would dilute the concurrency work the exercise weights most heavily.
- Tax, shipping, and refunds.
- Inventory holds and price locks.
- More than one API process, or a durable database.
- A CI pipeline and a performance suite. The tests cover the invariants I was unwilling to get wrong, not throughput.

## Several instances and a production database

Replace the in-memory lock with one database transaction:

- Lock product rows with `SELECT … FOR UPDATE` while decrementing a `available_quantity >= requested` check.
- Unique constraint on the idempotency key. Insert it in the same transaction as the order. A conflict re-reads the original order when the cart matches, and returns `IDEMPOTENCY_KEY_REUSED` when it does not.
- Coupon redemption is a conditional update: `status = available` to `redeemed`, one row. Zero rows updated means the other transaction took it.
- Order lines store the snapshotted name and cents so a later price update does not rewrite history.
- The report is a read of orders and coupons, not a counter that increments on read.

Two processes then share one set of invariants. The service methods stay the same. The outgoing adapter changes from `InMemoryCheckoutStore` to that transaction.

## How AI was used

Cursor drafted this module from the brief and from the Vesta layout (domain, ports, incoming and outgoing adapters, `Result`).

I rejected two suggestions that would have made the submission worse. One was to copy Pluto’s POST-only managed routes and authentication guards. This exercise asks for a small HTTP API and says not to implement auth, so the edge is REST with status codes and `/admin` called out as administrative. The other was to reserve stock when an item is added to the cart, which is closer to a full commerce hold. That needs expiry and a sweeper I would not finish honestly here, and it is a poorer fit for “price and availability may change before checkout.” Checkout-time checks plus the single lock are the rule that is actually enforced.

I also kept the shop small. SleepyHug’s React Router and Vite setup is the UI stack, not a second storefront to rebuild. The UI stores the idempotency key and renders the receipt; it does not reimplement the rules.

## Another two hours

I would put the same transaction behind Postgres and rerun the overlapping checkout tests against two processes, to show the unique idempotency key and the conditional coupon update doing the work the in-memory lock does now.
