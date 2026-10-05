# Northline checkout

A checkout and rewards API for a small store, with a thin shop and admin UI in front of it. The API is the part under test. The UI exists so the same flows can be clicked through.

- Money is integer cents.
- Checkout is idempotent: a retried request returns the same order and never charges inventory twice.
- Inventory and coupons stay consistent when requests overlap.
- Every nth order *by the same customer* earns that customer a coupon, which an administrator generates.
- Entity IDs are RFC 4122 UUIDs. Timestamps are ISO 8601 UTC, such as `2026-10-05T04:30:00.000Z`.

Design decisions, invariants, trade-offs, and what was deferred are in [`DECISIONS.md`](DECISIONS.md).

## Run

Requires Node 22 or later. No database, account, or credentials are needed: with no `.env`, the app runs on an in-memory store seeded with demo data.

```bash
git clone https://github.com/sriman01/assignment--uniblox.git
cd assignment--uniblox
npm install
npm test
npm run dev
```

- API: http://127.0.0.1:4000/api
- Shop: http://127.0.0.1:5173 (if that port is taken, Vite prints the one it used)

To run it the way production does, as one server:

```bash
npm run build
npm start
```

Open http://localhost:4000. One Node process serves the React app and every endpoint under `/api`. The `frontend` and `backend` directories are source boundaries, not separate services.

| Script | What it does |
| --- | --- |
| `npm run dev` | API and Vite dev server together, with hot reload |
| `npm test` | All tests, including the Postgres adapter against embedded PGlite |
| `npm run typecheck` | TypeScript compiler, no output |
| `npm run build` / `npm start` | Build the UI, then serve UI and API from one process |
| `npm run build:vercel` / `npm run build:netlify` | Build for a serverless host; see below |

## How it works

- **Layers.** Domain rules (`backend/src/domain`) and application services (`backend/src/application/service`) depend only on ports. HTTP and storage are adapters around them, so the same checkout code runs on the in-memory store, on Postgres, and inside a serverless function.
- **One unit of work per request.** Every service call runs inside `CheckoutStorePort.transaction(work)`, which runs alone. The in-memory store uses a FIFO lock. The Postgres store uses one database transaction holding `pg_advisory_xact_lock`, so it is also safe across several processes, and a thrown error rolls everything back.
- **Checkout** checks everything first: idempotency key, cart state, stock at the current price, and the coupon. It writes only after every check has passed: stock, coupon, order, cart, and key, all in the same unit of work.
- **Sessions** are HMAC-signed cookies, so any instance can verify them without shared memory.

## Storage

The server reads `.env` at startup. Copy `.env.example` to create one; `.env` is git-ignored.

- **`DB_HOST` empty or unset:** data lives in memory, and a restart resets it to the seed.
- **`DB_HOST` set:** data lives in Postgres. On first start the server creates the tables and seeds the catalog, config, and demo customer. Later starts keep existing data. The tables are `products`, `customers`, `carts`, `orders`, `coupons`, `idempotency_keys`, and `store_config`.

| Variable | Meaning |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | Connection |
| `DB_SSL_CA` | The CA certificate: a file path locally, or the PEM text itself on hosts without files (Vercel, Netlify) |
| `DB_SSL_MODE` | Optional. `verify-full` is the default when `DB_SSL_CA` is set. Otherwise the default is `require` (encrypted, certificate not checked). `disable` is for a local database |
| `DB_SCHEMA` | Schema for the tables, default `public` |
| `SESSION_SECRET` | At least 32 characters; signs the session cookies (`openssl rand -hex 32`) |

If the database is configured but unreachable, the server exits instead of silently falling back to memory. The startup log prints which storage is in use.

Customer and admin sessions are HMAC-signed cookies that last 7 days, so any server instance can verify them. Without `SESSION_SECRET`, each process makes up a random secret, and a restart signs everyone out.

## Deploy

Vercel and Netlify serve static files from a CDN and run the API as serverless functions; neither keeps a long-running Node server. So each has a small entry file (`backend/src/vercel.ts`, `backend/src/netlify.ts`) that wraps the same Hono app, and a build script that bundles it with esbuild into one function. Data and sessions cannot live in memory there, so a database and `SESSION_SECRET` are required.

### Vercel

`vercel.json` runs `npm run build:vercel`. That builds the React app and writes Vercel's Build Output layout to `.vercel/output`:

- `static/` holds the React app, served from the CDN.
- `functions/api.func` is one Node function that serves every `/api/*` route.
- Routing sends any other path to `index.html`, so page refreshes work.

To deploy:

1. Import the repo in Vercel. The project settings in `vercel.json` override the dashboard preset, so no framework or output directory needs choosing.
2. Add these environment variables:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
   - `DB_SSL_CA`: the full text of the CA certificate. Vercel has no file upload.
   - `SESSION_SECRET`
3. Deploy, then check `/api/health` and `/api/products`.

The function refuses to start without `DB_HOST` or `SESSION_SECRET`.

### Netlify

`netlify.toml` sets everything up:

- It runs `npm run build:netlify`, which builds the React app and bundles the API into `netlify-functions/api.mjs`.
- It publishes `frontend/dist`.
- It rewrites `/api/*` to the function, and every other path to `index.html`.

Set the same environment variables as for Vercel. Don't set `PORT`, which nothing uses there. Netlify's secrets scan fails a build when a variable's value also appears in the repo. `netlify.toml` excludes the non-secret settings (`PORT`, `DB_PORT`, `DB_SSL_MODE`, `DB_SCHEMA`) from that scan.

## Tests

`npm test` runs 29 tests with Vitest. It never touches the configured database: the service tests use the in-memory store, and `postgresStore.test.ts` runs the Postgres adapter against an embedded PGlite instance.

The tests concentrate on competing and repeated operations, not only happy paths:

- two overlapping checkouts for the last unit: exactly one succeeds;
- two checkouts racing for one coupon: it is redeemed once;
- overlapping retries with one idempotency key become one order, and that key is rejected on another cart;
- an admin pausing a coupon while a checkout redeems it: exactly one of them wins, in either order;
- a failed checkout leaves the coupon and cart untouched;
- order prices stay frozen after catalog changes;
- the report reconciles with orders and coupons, and reading it twice changes nothing;
- Postgres: data survives a restart, many concurrent checkouts sell the last unit once, and a throw rolls back everything.

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

- **Add to cart** stays on the current page and opens the cart drawer. The API keeps one line per product, so when the product is already in the cart, the shop raises that line’s quantity with `PATCH` instead of adding a second line.
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

The split follows a ports-and-adapters shape: domain rules, outgoing ports, application services, an incoming HTTP adapter, and outgoing adapters behind those ports.

```
backend/src/domain                         money, errors, catalog, result
backend/src/application/port/outgoing      store, clock, and id ports
backend/src/application/service            storefront (cart, checkout), customers, admin (coupons, report)
backend/src/infrastructure/adapter/incoming/http
backend/src/infrastructure/adapter/outgoing   in-memory store, Postgres store, lock, clock, ids, hashing
backend/src/infrastructure/composition     wires one module; database config and startup
backend/src/main.ts                        long-running Node server (npm start)
backend/src/vercel.ts                      Vercel function entry, bundled by scripts/build-vercel.mjs
backend/src/netlify.ts                     Netlify function entry, bundled by scripts/build-netlify.mjs
backend/tests                              API and domain tests
frontend/src/routes                       React Router route modules and admin route group
frontend/src/components                   layout, store, admin, and shared UI components
frontend/src/lib                          API client, cart action, wishlist, money, and storage helpers
frontend/src/styles                       design tokens, storefront, and admin styles
frontend/public/images                    local product artwork
frontend/src/router.tsx                   application route composition
scripts/                                  serverless build scripts for Vercel and Netlify
```

Design choices and the things left undone are in [`DECISIONS.md`](DECISIONS.md).
