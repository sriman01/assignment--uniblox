import { describe, expect, it } from "vitest";
import { ProductId } from "../src/domain/catalog.js";
import { createCart, createTestApp, errorCode, getJson, postJson } from "./helpers.js";

async function placeCedar(app: ReturnType<typeof createTestApp>, key: string, couponCode?: string) {
  const cartId = await createCart(app);
  const added = await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.cedarSachet, quantity: 1 });
  expect(added.status).toBe(200);
  return postJson(app, `/carts/${cartId}/checkout`, couponCode ? { couponCode } : {}, {
    "Idempotency-Key": key,
  });
}

describe("coupons", () => {
  it("generates one coupon per reached milestone and will not generate the same milestone twice", async () => {
    const app = createTestApp();
    const tooSoon = await postJson(app, "/admin/coupons/generate");
    expect(tooSoon.status).toBe(409);
    expect(errorCode(tooSoon.json)).toBe("NO_ELIGIBLE_MILESTONE");

    for (let index = 1; index <= 4; index += 1) {
      expect((await placeCedar(app, `order-${index}`)).status).toBe(201);
    }
    expect((await postJson(app, "/admin/coupons/generate")).status).toBe(409);

    expect((await placeCedar(app, "order-5")).status).toBe(201);
    const generated = await postJson(app, "/admin/coupons/generate");
    expect(generated.status).toBe(201);
    expect(generated.json).toMatchObject({ code: "MILESTONE-5", milestone: 5, percentOff: 10, status: "available" });
    expect((await postJson(app, "/admin/coupons/generate")).status).toBe(409);

    for (let index = 6; index <= 10; index += 1) {
      expect((await placeCedar(app, `order-${index}`)).status).toBe(201);
    }
    const second = await postJson(app, "/admin/coupons/generate");
    expect(second.json).toMatchObject({ code: "MILESTONE-10", milestone: 10, status: "available" });
  });

  it("redeems a coupon once, even when two checkouts compete for it", async () => {
    const app = createTestApp({ config: { everyNthOrder: 1, discountPercent: 10 } });
    expect((await placeCedar(app, "unlock")).status).toBe(201);
    expect((await postJson(app, "/admin/coupons/generate")).status).toBe(201);

    const cartA = await createCart(app);
    const cartB = await createCart(app);
    await postJson(app, `/carts/${cartA}/items`, { productId: ProductId.merinoBlanket, quantity: 1 });
    await postJson(app, `/carts/${cartB}/items`, { productId: ProductId.linenSheet, quantity: 1 });

    const [first, second] = await Promise.all([
      postJson(app, `/carts/${cartA}/checkout`, { couponCode: "MILESTONE-1" }, { "Idempotency-Key": "coupon-a" }),
      postJson(app, `/carts/${cartB}/checkout`, { couponCode: "MILESTONE-1" }, { "Idempotency-Key": "coupon-b" }),
    ]);
    const winner = first.status === 201 ? first : second;
    const loser = first.status === 201 ? second : first;
    expect(winner.status).toBe(201);
    expect(winner.json.couponCode).toBe("MILESTONE-1");
    expect(winner.json.discountCents).toBe(Math.floor(Number(winner.json.grossCents) * 10 / 100));
    expect(Number(winner.json.netCents)).toBe(Number(winner.json.grossCents) - Number(winner.json.discountCents));
    expect(loser.status).toBe(409);
    expect(errorCode(loser.json)).toBe("COUPON_UNAVAILABLE");

    const loserCartId = loser === first ? cartA : cartB;
    const loserCart = await getJson(app, `/carts/${loserCartId}`);
    expect(loserCart.json.status).toBe("open");

    const withoutCoupon = await postJson(app, `/carts/${loserCartId}/checkout`, {}, { "Idempotency-Key": "coupon-loser-retry" });
    expect(withoutCoupon.status).toBe(201);
    expect(withoutCoupon.json.couponCode).toBeNull();

    const coupons = await getJson(app, "/admin/coupons");
    expect(coupons.json.items).toEqual([
      expect.objectContaining({ code: "MILESTONE-1", status: "redeemed", redeemedOrderId: winner.json.id }),
    ]);
  });

  it("floors a 10 percent discount and allows a 100 percent discount to reach zero, never below", async () => {
    const app = createTestApp({
      config: { everyNthOrder: 1, discountPercent: 10 },
      products: [{ id: "prd_odd", name: "Odd Price", unitPriceCents: 1234, availableQuantity: 5 }],
    });
    const unlock = await createCart(app);
    await postJson(app, `/carts/${unlock}/items`, { productId: "prd_odd", quantity: 1 });
    await postJson(app, `/carts/${unlock}/checkout`, {}, { "Idempotency-Key": "odd-1" });
    await postJson(app, "/admin/coupons/generate");

    const cartId = await createCart(app);
    await postJson(app, `/carts/${cartId}/items`, { productId: "prd_odd", quantity: 1 });
    const discounted = await postJson(app, `/carts/${cartId}/checkout`, { couponCode: "MILESTONE-1" }, {
      "Idempotency-Key": "odd-2",
    });
    expect(discounted.json).toMatchObject({ grossCents: 1234, discountCents: 123, netCents: 1111 });

    const full = createTestApp({
      config: { everyNthOrder: 1, discountPercent: 100 },
      products: [{ id: "prd_free", name: "Freebie", unitPriceCents: 2500, availableQuantity: 5 }],
    });
    const seed = await createCart(full);
    await postJson(full, `/carts/${seed}/items`, { productId: "prd_free", quantity: 1 });
    await postJson(full, `/carts/${seed}/checkout`, {}, { "Idempotency-Key": "free-1" });
    await postJson(full, "/admin/coupons/generate");
    const redeemed = await createCart(full);
    await postJson(full, `/carts/${redeemed}/items`, { productId: "prd_free", quantity: 1 });
    const zero = await postJson(full, `/carts/${redeemed}/checkout`, { couponCode: "MILESTONE-1" }, {
      "Idempotency-Key": "free-2",
    });
    expect(zero.json).toMatchObject({ grossCents: 2500, discountCents: 2500, netCents: 0 });
  });
});
