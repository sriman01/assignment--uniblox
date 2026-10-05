# Northline checkout

A checkout and rewards API for a small store, with a thin shop UI in front of it. The API is the part under test. The UI exists so the same flows can be clicked through.

Money is integer cents. Checkout is idempotent. Inventory and coupons stay consistent when requests overlap.

## Run

```bash
cd checkout
npm install
npm test
npm run dev
```

- API: http://127.0.0.1:4000
- Shop: http://127.0.0.1:5173

If 5173 is already taken, Vite prints the port it actually used.

`npm start` runs the API only. `npm run typecheck` runs the TypeScript compiler.

The store is in memory. Restarting the API clears carts, orders, coupons, and inventory back to the seed.

## What is seeded

| Product | Id | Price | Inventory |
| --- | --- | --- | --- |
| Merino Blanket | `prd_merino_blanket` | $89.00 | 20 |
| Linen Sheet Set | `prd_linen_sheet` | $64.00 | 15 |
| Down Pillow | `prd_down_pillow` | $42.00 | 8 |
| Wool Throw | `prd_wool_throw` | $55.00 | 2 |
| Cedar Sachet | `prd_cedar_sachet` | $12.00 | 40 |
| Travel Eye Mask | `prd_eye_mask` | $18.00 | 1 |

Rewards: every **5th** successful order makes one **10%** coupon eligible. An administrator has to generate it. The code is `MILESTONE-5`, then `MILESTONE-10`, and so on.

## Shop

The shop follows the SleepyHug storefront: brown announcement bar, centered wordmark, product cards, cart with an order summary, and checkout beside the payment box.

Customer sign-in is at `/sign-in`:

- Email: `maya@sleepyhug.test`
- Password: `sleepwell`

Customers sign in before checkout. `/account` shows their order history and coupons. The shopper whose purchase is the store’s 5th, 10th, 15th… successful order owns that milestone coupon after admin generates it; another customer cannot redeem it.

Admin sign-in is at `/admin/sign-in`:

- Email: `admin@sleepyhug.test`
- Password: `sleepyhug`

Opening `/admin` without an admin session redirects there. Admin has Dashboard, Products, Orders, Inventory, and Coupons. The dashboard filters a date range and groups purchases by day, week, or month. Product prices and stock can be edited independently.

The coupon for every 5th order is generated under Admin → Coupons. Paste `MILESTONE-5` into checkout.

The HTTP admin API stays open without a cookie because the assignment explicitly says authorization is not required; the two sign-ins are browser workflow gates. A production system would enforce both at the API edge.

## API

Errors use one shape:

```json
{ "error": { "code": "INSUFFICIENT_INVENTORY", "message": "Only 1 unit of Travel Eye Mask is available.", "details": {} } }
```

| Status | When |
| --- | --- |
| 400 | Body is invalid, quantity is not a positive integer, or `Idempotency-Key` is missing |
| 404 | Product, cart, order, coupon, or cart line does not exist |
| 409 | Inventory, coupon, cart state, or idempotency key conflicts |
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
{ "productId": "prd_cedar_sachet", "quantity": 1 }
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
{ "couponCode": "MILESTONE-5" }
```

`couponCode` is optional. An empty body is a checkout without a coupon.

The first success returns `201` and `Location: /orders/:id`. The order freezes product name, unit price, quantity, line total, gross, discount, and net.

The same key and the same cart return `200` with `Idempotent-Replayed: true` and the original order. Inventory is not charged again. A different coupon on the replay is ignored.

The same key on a different cart returns `409 IDEMPOTENCY_KEY_REUSED`.

A new key on an already checked-out cart returns `409 CART_ALREADY_CHECKED_OUT` and includes `details.orderId`.

Other checkout failures: `CART_EMPTY`, `INSUFFICIENT_INVENTORY`, `COUPON_NOT_FOUND`, `COUPON_UNAVAILABLE`. A failed checkout leaves the cart open and does not redeem a coupon.

`GET /orders/:orderId`

### Administration

`GET /admin/config` → `{ "everyNthOrder": 5, "discountPercent": 10 }`

`POST /admin/coupons/generate`

Creates the oldest milestone that has been reached and does not already have a coupon. Before the 5th, 10th, 15th… order, the response is `409 NO_ELIGIBLE_MILESTONE`.

`GET /admin/coupons` → `{ "items": [ ... ] }`

`GET /admin/orders` → `{ "items": [ ... ] }`

`GET /admin/reports`

```json
{
  "purchasedQuantityByProduct": [{ "productId": "prd_cedar_sachet", "name": "Cedar Sachet", "quantity": 3 }],
  "grossRevenueCents": 0,
  "totalDiscountsCents": 0,
  "netRevenueCents": 0,
  "coupons": { "generated": 0, "available": 0, "redeemed": 0 },
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
curl -s -X POST http://127.0.0.1:4000/carts
curl -s -X POST http://127.0.0.1:4000/carts/CART_ID/items \
  -H 'content-type: application/json' \
  -d '{"productId":"prd_cedar_sachet","quantity":1}'
curl -s -X POST http://127.0.0.1:4000/carts/CART_ID/checkout \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: demo-1' \
  -d '{}'
```

Repeat the checkout command. The second response is the same order, with `Idempotent-Replayed: true`.

## Layout

The split follows the Vesta service shape: domain rules, outgoing ports, application services, an incoming HTTP adapter, and outgoing adapters behind those ports.

```
src/domain                         money, errors, catalog, result
src/application/port/outgoing      store, clock, and id ports
src/application/service            cart, checkout, coupons, report
src/infrastructure/adapter/incoming/http
src/infrastructure/adapter/outgoing   in-memory store and lock
src/infrastructure/composition     wires one module
web                                Vite + React Router shop
```

Design choices and the things left undone are in `DECISIONS.md`.
