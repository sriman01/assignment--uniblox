import { describe, expect, it } from "vitest";
import { ProductId } from "../src/domain/catalog.js";
import { createCart, createTestApp, deleteJson, errorCode, getJson, patchJson, postJson } from "./helpers.js";

describe("carts", () => {
  it("rejects unknown products and quantities that are not positive integers", async () => {
    const app = createTestApp();
    const cartId = await createCart(app);

    const missing = await postJson(app, `/carts/${cartId}/items`, {
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      quantity: 1,
    });
    expect(missing.status).toBe(404);
    expect(errorCode(missing.json)).toBe("PRODUCT_NOT_FOUND");

    const zero = await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.cedarSachet, quantity: 0 });
    expect(zero.status).toBe(400);
    expect(errorCode(zero.json)).toBe("INVALID_QUANTITY");

    const fraction = await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.cedarSachet, quantity: 1.5 });
    expect(fraction.status).toBe(400);
    expect(errorCode(fraction.json)).toBe("INVALID_QUANTITY");

    const cart = await getJson(app, `/carts/${cartId}`);
    expect(cart.json.items).toEqual([]);
  });

  it("does not add more units than are currently available", async () => {
    const app = createTestApp();
    const cartId = await createCart(app);
    const added = await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.eyeMask, quantity: 2 });
    expect(added.status).toBe(409);
    expect(errorCode(added.json)).toBe("INSUFFICIENT_INVENTORY");

    const cart = await getJson(app, `/carts/${cartId}`);
    expect(cart.json.items).toEqual([]);
    const product = await getJson(app, `/products/${ProductId.eyeMask}`);
    expect(product.json.availableQuantity).toBe(1);
  });

  it("updates and removes items, and prices the cart from the current catalog", async () => {
    const app = createTestApp();
    const cartId = await createCart(app);
    await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.woolThrow, quantity: 1 });

    const priced = await patchJson(app, `/admin/products/${ProductId.woolThrow}`, { unitPriceCents: 6000 });
    expect(priced.status).toBe(200);

    const updated = await patchJson(app, `/carts/${cartId}/items/${ProductId.woolThrow}`, { quantity: 2 });
    expect(updated.status).toBe(200);
    expect(updated.json.grossCents).toBe(12000);
    expect((updated.json.items as Array<{ unitPriceCents: number }>)[0]?.unitPriceCents).toBe(6000);

    const removed = await deleteJson(app, `/carts/${cartId}/items/${ProductId.woolThrow}`);
    expect(removed.status).toBe(200);
    expect(removed.json.grossCents).toBe(0);
  });
});
