import { describe, expect, it } from "vitest";
import { ProductId } from "../src/domain/catalog.js";
import { createCart, createTestApp, errorCode, getJson, patchJson, postJson } from "./helpers.js";

async function checkout(
  app: ReturnType<typeof createTestApp>,
  cartId: string,
  key: string,
  couponCode?: string,
) {
  return postJson(app, `/carts/${cartId}/checkout`, couponCode ? { couponCode } : {}, {
    "Idempotency-Key": key,
  });
}

describe("checkout", () => {
  it("snapshots the price onto the order and leaves that snapshot alone when the catalog changes", async () => {
    const app = createTestApp();
    const cartId = await createCart(app);
    await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.downPillow, quantity: 2 });
    await patchJson(app, `/admin/products/${ProductId.downPillow}`, { unitPriceCents: 4500 });

    const placed = await checkout(app, cartId, "snapshot-key");
    expect(placed.status).toBe(201);
    expect(placed.json.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(String(placed.json.placedAt)).toISOString()).toBe(placed.json.placedAt);
    expect(placed.headers.get("Location")).toBe(`/orders/${String(placed.json.id)}`);
    expect(placed.json.grossCents).toBe(9000);
    expect(placed.json.discountCents).toBe(0);
    expect(placed.json.netCents).toBe(9000);
    expect((placed.json.lines as Array<{ unitPriceCents: number; name: string }>)[0]).toMatchObject({
      name: "Down Pillow",
      unitPriceCents: 4500,
      quantity: 2,
      lineTotalCents: 9000,
    });

    await patchJson(app, `/admin/products/${ProductId.downPillow}`, { unitPriceCents: 100 });
    const order = await getJson(app, `/orders/${String(placed.json.id)}`);
    expect(order.json.grossCents).toBe(9000);
    expect((order.json.lines as Array<{ unitPriceCents: number }>)[0]?.unitPriceCents).toBe(4500);

    const product = await getJson(app, `/products/${ProductId.downPillow}`);
    expect(product.json.availableQuantity).toBe(6);
  });

  it("returns the same order when the same checkout is retried", async () => {
    const app = createTestApp();
    const cartId = await createCart(app);
    await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.eyeMask, quantity: 1 });

    const first = await checkout(app, cartId, "retry-key");
    const second = await checkout(app, cartId, "retry-key");
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect(second.json.id).toBe(first.json.id);

    const again = await checkout(app, cartId, "a-different-key");
    expect(again.status).toBe(409);
    expect(errorCode(again.json)).toBe("CART_ALREADY_CHECKED_OUT");

    const product = await getJson(app, `/products/${ProductId.eyeMask}`);
    expect(product.json.availableQuantity).toBe(0);
  });

  it("refuses an empty cart and a checkout without an idempotency key", async () => {
    const app = createTestApp();
    const cartId = await createCart(app);
    const missingKey = await postJson(app, `/carts/${cartId}/checkout`, {});
    expect(missingKey.status).toBe(400);
    expect(errorCode(missingKey.json)).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const empty = await checkout(app, cartId, "empty-cart");
    expect(empty.status).toBe(409);
    expect(errorCode(empty.json)).toBe("CART_EMPTY");
  });

  it("does not consume a coupon or the cart when inventory is gone", async () => {
    const app = createTestApp();
    expect((await postJson(app, "/admin/coupons", { code: "SAVE10", percentOff: 10 })).status).toBe(201);

    const cartId = await createCart(app);
    await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.eyeMask, quantity: 1 });
    await patchJson(app, `/admin/products/${ProductId.eyeMask}`, { availableQuantity: 0 });

    const failed = await checkout(app, cartId, "failed-coupon", "SAVE10");
    expect(failed.status).toBe(409);
    expect(errorCode(failed.json)).toBe("INSUFFICIENT_INVENTORY");

    const coupons = await getJson(app, "/admin/coupons");
    expect(coupons.json.items).toEqual([
      expect.objectContaining({ code: "SAVE10", status: "available", redeemedOrderId: null }),
    ]);
    const cart = await getJson(app, `/carts/${cartId}`);
    expect(cart.json.status).toBe("open");

    await patchJson(app, `/admin/products/${ProductId.eyeMask}`, { availableQuantity: 1 });
    const recovered = await checkout(app, cartId, "failed-coupon", "save10");
    expect(recovered.status).toBe(201);
    expect(recovered.json.couponCode).toBe("SAVE10");
    expect(recovered.json.grossCents).toBe(1800);
    expect(recovered.json.discountCents).toBe(180);
    expect(recovered.json.netCents).toBe(1620);
  });

  it("lets only one of two overlapping checkouts take the last unit", async () => {
    const app = createTestApp();
    const cartA = await createCart(app);
    const cartB = await createCart(app);
    await postJson(app, `/carts/${cartA}/items`, { productId: ProductId.eyeMask, quantity: 1 });
    await postJson(app, `/carts/${cartB}/items`, { productId: ProductId.eyeMask, quantity: 1 });

    const [first, second] = await Promise.all([
      checkout(app, cartA, "race-a"),
      checkout(app, cartB, "race-b"),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failure = first.status === 409 ? first : second;
    expect(errorCode(failure.json)).toBe("INSUFFICIENT_INVENTORY");

    const product = await getJson(app, `/products/${ProductId.eyeMask}`);
    expect(product.json.availableQuantity).toBe(0);
    const orders = await getJson(app, "/admin/orders");
    expect(orders.json.items).toHaveLength(1);
  });

  it("treats overlapping retries with one key as a single order, and rejects that key on another cart", async () => {
    const app = createTestApp();
    const cartA = await createCart(app);
    const cartB = await createCart(app);
    await postJson(app, `/carts/${cartA}/items`, { productId: ProductId.woolThrow, quantity: 1 });
    await postJson(app, `/carts/${cartB}/items`, { productId: ProductId.woolThrow, quantity: 1 });

    const [first, second] = await Promise.all([
      checkout(app, cartA, "shared-key"),
      checkout(app, cartA, "shared-key"),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.json.id).toBe(second.json.id);

    const reused = await checkout(app, cartB, "shared-key");
    expect(reused.status).toBe(409);
    expect(errorCode(reused.json)).toBe("IDEMPOTENCY_KEY_REUSED");

    const product = await getJson(app, `/products/${ProductId.woolThrow}`);
    expect(product.json.availableQuantity).toBe(1);
    const cart = await getJson(app, `/carts/${cartB}`);
    expect(cart.json.status).toBe("open");
  });
});
