# Northline checkout

A checkout and rewards API for a small store, with a thin shop UI in front of it. The API is the part under test. The UI exists so the same flows can be clicked through.

Money is integer cents. Checkout is idempotent. Inventory and coupons stay consistent when requests overlap.
Entity IDs are RFC 4122 UUIDs. Stored and returned timestamps are branded ISO 8601 UTC datetimes such as `2026-10-05T04:30:00.000Z`.

## Run

```bash
cd checkout
npm install
npm test
npm run dev
```

- API in development: http://127.0.0.1:4000/api
- Shop: http://127.0.0.1:5173

If 5173 is already taken, Vite prints the port it actually used.

Production is one deployment and one server:

```bash
npm run build
npm start
```

Open http://localhost:4000. The same Node process serves the React application and all endpoints under `/api`. The `frontend` and `backend` directories are source-code boundaries, not separate deployable services.

`npm run dev:backend` and `npm run dev:frontend` remain available for independent hot-reload during development. `npm run typecheck` runs the TypeScript compiler.

### Storage

The server reads `.env` at startup (copy `.env.example`; `.env` is git-ignored).

- **`DB_HOST` set:** data lives in Postgres. On first start the server creates the tables and seeds the catalog, config, and demo customer; later starts keep existing data. Tables: `products`, `customers`, `carts`, `orders`, `coupons`, `idempotency_keys`, `store_config`.
- **`DB_HOST` empty:** data lives in memory, and a restart resets everything to the seed.

| Variable | Meaning |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | Connection |
| `DB_SSL_MODE` | `require` (default, encrypted), `verify-full` (also set `DB_SSL_CA` to the CA certificate path), or `disable` for a local database |
| `DB_SCHEMA` | Schema for the tables, default `public` |

If the database is configured but unreachable, the server exits instead of silently falling back to memory. The startup log prints which storage is in use. Customer and admin sessions stay in memory, so a restart signs everyone out.

`npm test` never touches the configured database. The in-memory tests run as before, and `postgresStore.test.ts` runs the Postgres adapter against an embedded PGlite instance.

## What is seeded

| Product | Id | Price | Inventory |
| --- | --- | --- | --- |
| Merino Blanket | `11111111-1111-4111-8111-111111111111` | $89.00 | 20 |
| Linen Sheet Set | `22222222-2222-4222-8222-222222222222` | $64.00 | 15 |
| Down Pillow | `33333333-3333-4333-8333-333333333333` | $42.00 | 8 |
| Wool Throw | `44444444-4444-4444-8444-444444444444` | $55.00 | 2 |
| Cedar Sachet | `55555555-5555-4555-8555-555555555555` | $12.00 | 40 |
| Travel Eye Mask | `66666666-6666-4666-8666-666666666666` | $18.00 | 1 |

Rewards are per customer. Every **5th** successful order *by the same signed-in customer* makes one **10%** coupon eligible for that customer. Orders placed without signing in never count. An administrator generates the coupon. Its code is `REWARD-<milestone>-<first 8 characters of the customer id>`, so Maya’s first one is `REWARD-5-77777777`. The coupon belongs to that customer.

Administrators can also create custom coupons for anyone or for one customer. They can change a coupon’s percentage, change who can use it, pause it, or delete it. A coupon that has been redeemed is locked, because it is part of an order’s receipt.

## Shop

The shop is a navy and teal storefront. It has a two-row header with search, wishlist, cart, and account indicators. The pages are Home, Products (`/products`, with category, availability, and sort filters), a product detail page (`/products/:productId`), Cart, Checkout, Receipt, Account, Wishlist, About us, and Contact us.

- **Add to cart** stays on the current page and opens the cart drawer. Adding a product that is already in the cart raises that line’s quantity, because the API keeps one line per product.
- **Sign in** works from the account dropdown in the header or from `/sign-in`. Either way you return to the page you were on. Checkout sends signed-out shoppers to sign in and brings them back to `/checkout` afterwards.
- **Wishlist** is saved in the browser (`localStorage`), so it lasts across reloads and syncs between tabs. The API has no wishlist. “Move to cart” adds the product to the cart and removes it from the wishlist.

Customer sign-in is at `/sign-in`:

- Email: `maya@assignment.test`
- Password: `sleepwell`

New shoppers can create an account at `/register`. There is also a link from the sign-in page and the header dropdown. Customers sign in before checkout. `/account` shows their order history, how close they are to their next coupon, and their coupons. Only the owning customer can redeem a customer coupon.

Admin sign-in is at `/admin/sign-in`:

- Email: `admin@assignment.test`
- Password: `assignment`

Opening `/admin` without an admin session redirects there. The admin console has a sidebar with Dashboard, Products, Inventory, Orders, and Coupons & rewards. The dashboard filters a date range, groups purchases by day, week, or month, and lists the top products. Product prices and stock are edited inline, one row at a time. Coupons & rewards has four parts:

- the reward settings;
- a form for creating a custom coupon;
- a table showing each customer’s progress, with a Generate button for customers who have reached a milestone;
- the full coupon list, where each unredeemed coupon can be edited, paused, or deleted.

To try it, sign in as Maya and place 5 orders. Then generate her coupon under Admin → Coupons & rewards. It appears on her account page and as a selectable coupon at checkout.

The HTTP admin API stays open without a cookie because the assignment explicitly says authorization is not required; the two sign-ins are browser workflow gates. A production system would enforce both at the API edge.

## API

All endpoint paths below are relative to `/api`.

Errors use one shape:

```json
{ "error": { "code": "INSUFFICIENT_INVENTORY", "message": "Only 1 unit of Travel Eye Mask is available.", "details": {} } }
```

| Status | When |
| --- | --- |
| 400 | Body is invalid, quantity is not a positive integer, or `Idempotency-Key` is missing |
| 401 | Wrong credentials (`INVALID_CREDENTIALS`) or a customer endpoint called without a session (`UNAUTHORIZED`) |
| 404 | Product, cart, order, coupon, customer, or cart line does not exist |
| 409 | Inventory, coupon, cart state, idempotency key, email, or coupon code conflicts |
| 201 | Cart, order, or coupon was created |
| 200 | Read, update, or an idempotent replay of a checkout |

### Catalog

`GET /products` → `{ "items": [ { "id", "name", "unitPriceCents", "availableQuantity" } ] }`

`GET /products/:productId`

### Carts

`POST /carts` → priced cart, `201`

`GET /carts/:cartId` → priced cart. `pricedAt` is always `current_catalog`. `grossCents` is the sum of current line totals.

`POST /carts/:cartId/items`

```json
{ "productId": "55555555-5555-4555-8555-555555555555", "quantity": 1 }
```

Adding a product that is already in the cart returns `409 ITEM_ALREADY_IN_CART`. A quantity above current inventory returns `409 INSUFFICIENT_INVENTORY` and does not change the cart.

`PATCH /carts/:cartId/items/:productId`

```json
{ "quantity": 2 }
```

`DELETE /carts/:cartId/items/:productId`

A checked-out cart rejects further item changes with `409 CART_ALREADY_CHECKED_OUT`.

### Checkout

`POST /carts/:cartId/checkout`

Header: `Idempotency-Key: <unique string for this attempt>`

```json
{ "couponCode": "REWARD-5-77777777" }
```

`couponCode` is optional. An empty body is a checkout without a coupon.

The first success returns `201` and `Location: /orders/:id`. The order freezes product name, unit price, quantity, line total, gross, discount, and net.

The same key and the same cart return `200` with `Idempotent-Replayed: true` and the original order. Inventory is not charged again. A different coupon on the replay is ignored.

The same key on a different cart returns `409 IDEMPOTENCY_KEY_REUSED`.

A new key on an already checked-out cart returns `409 CART_ALREADY_CHECKED_OUT` and includes `details.orderId`.

Other checkout failures: `CART_EMPTY`, `INSUFFICIENT_INVENTORY`, `COUPON_NOT_FOUND`, and `COUPON_UNAVAILABLE`. `COUPON_UNAVAILABLE` covers a coupon that is redeemed, paused, or owned by another customer. A failed checkout leaves the cart open and does not redeem a coupon. The customer is taken from the `customer_session` cookie. Without that cookie, the order is a guest order and does not count toward any customer’s rewards.

`GET /orders/:orderId`

### Customers

`POST /customer/register`

```json
{ "name": "Ravi Kumar", "email": "ravi@example.test", "password": "at-least-8-chars" }
```

Returns `201 { "signedIn": true, "customer": { "id", "name", "email" } }` and sets the `customer_session` cookie. Emails are case-insensitive. A duplicate email returns `409 EMAIL_TAKEN`. Passwords are stored as scrypt hashes.

`POST /customer/session` with `{ "email", "password" }` signs in. A wrong email or password returns `401 INVALID_CREDENTIALS`. `GET /customer/session` returns the current session, and `DELETE /customer/session` signs out.

The following endpoints need the session cookie and return `401 UNAUTHORIZED` without it:

- `GET /customer/orders` and `GET /customer/coupons` return `{ "items": [...] }`.
- `GET /customer/rewards` returns progress toward the customer’s next coupon:

```json
{ "ordersPlaced": 3, "everyNthOrder": 5, "discountPercent": 10, "eligibleMilestone": null, "nextMilestone": 5, "ordersUntilNextMilestone": 2, "couponsEarned": 0 }
```

### Administration

`GET /admin/config` → `{ "everyNthOrder": 5, "discountPercent": 10 }`

`PATCH /admin/config`

```json
{ "everyNthOrder": 5, "discountPercent": 10 }
```

Updates the reward interval and percentage used by future coupon generation. Both values are whole numbers: the interval is at least 1 and the percentage is from 0 through 100. Existing coupons retain the percentage captured when they were generated.

`GET /admin/customers` returns `{ "items": [...] }`. Each item is a customer (`id`, `name`, `email`, `createdAt`) together with the same progress fields as `/customer/rewards`.

`POST /admin/coupons/generate`

```json
{ "customerId": "77777777-7777-4777-8777-777777777777" }
```

This issues the named customer’s lowest milestone that has been reached but has no coupon yet. Milestones are counted only over that customer’s own orders. The body is optional. Without `customerId`, the customer whose unrewarded milestone order was placed earliest is served first. If nothing is eligible, the response is `409 NO_ELIGIBLE_MILESTONE`. An unknown customer returns `404 CUSTOMER_NOT_FOUND`.

`POST /admin/coupons` creates a custom coupon and returns `201`:

```json
{ "code": "WELCOME15", "percentOff": 15, "customerId": null }
```

- `code` is optional. It is stored in upper case and must be 3 to 32 letters, digits, or dashes. When it is left out, a `GIFT-XXXXXXXX` code is generated. A code that already exists returns `409 COUPON_CODE_TAKEN`.
- `percentOff` is a whole number from 1 to 100.
- `customerId: null` means any shopper, including guests, can redeem the coupon.

`PATCH /admin/coupons/:code` changes one or more fields:

```json
{ "percentOff": 20, "customerId": null, "status": "disabled" }
```

`status` is `available` or `disabled`. `DELETE /admin/coupons/:code` returns `{ "code", "deleted": true }`.

Rules for editing and deleting:

- A redeemed coupon returns `409 COUPON_LOCKED` for both edit and delete.
- Reassigning a milestone coupon does not let its original earner generate that milestone again.
- Deleting an unredeemed milestone coupon makes that milestone eligible again.

`GET /admin/coupons` → `{ "items": [ { "code", "source": "milestone" | "custom", "customerId", "earnedByCustomerId", "milestone", "percentOff", "status": "available" | "disabled" | "redeemed", "redeemedOrderId", "createdAt", "updatedAt" } ] }`

`GET /admin/orders` → `{ "items": [ ... ] }`

`GET /admin/reports`

```json
{
  "purchasedQuantityByProduct": [{ "productId": "55555555-5555-4555-8555-555555555555", "name": "Cedar Sachet", "quantity": 3 }],
  "grossRevenueCents": 0,
  "totalDiscountsCents": 0,
  "netRevenueCents": 0,
  "coupons": { "generated": 0, "available": 0, "disabled": 0, "redeemed": 0 },
  "successfullyPlacedOrders": 0
}
```

Gross, discounts, and net are summed from placed orders, not from current prices. Reading the report does not change anything. `grossRevenueCents - totalDiscountsCents = netRevenueCents`.

`PATCH /admin/products/:productId`

```json
{ "unitPriceCents": 4500, "availableQuantity": 4 }
```

This is how a price or stock change between “add to cart” and checkout is exercised. Open carts are not rewritten. The next cart view uses the new price. Checkout fails if the quantity is no longer in stock.

## Example

```bash
curl -s -X POST http://127.0.0.1:4000/api/carts
curl -s -X POST http://127.0.0.1:4000/api/carts/CART_ID/items \
  -H 'content-type: application/json' \
  -d '{"productId":"55555555-5555-4555-8555-555555555555","quantity":1}'
curl -s -X POST http://127.0.0.1:4000/api/carts/CART_ID/checkout \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: demo-1' \
  -d '{}'
```

Repeat the checkout command. The second response is the same order, with `Idempotent-Replayed: true`.

## Layout

The split follows the Vesta service shape: domain rules, outgoing ports, application services, an incoming HTTP adapter, and outgoing adapters behind those ports.

```
backend/src/domain                         money, errors, catalog, result
backend/src/application/port/outgoing      store, clock, and id ports
backend/src/application/service            cart, checkout, coupons, report
backend/src/infrastructure/adapter/incoming/http
backend/src/infrastructure/adapter/outgoing   in-memory store, Postgres store, lock, clock, ids, hashing
backend/src/infrastructure/composition     wires one module
backend/tests                              API and domain tests
frontend/src/routes                       React Router route modules and admin route group
frontend/src/components                   layout, store, admin, and shared UI components
frontend/src/lib                          API client, cart action, wishlist, money, and storage helpers
frontend/src/styles                       design tokens, storefront, and admin styles
frontend/public/images                    local product artwork
frontend/src/router.tsx                   application route composition
```

Design choices and the things left undone are in `DECISIONS.md`.
