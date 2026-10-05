import { describe, expect, it } from "vitest";
import { ProductId } from "../src/domain/catalog.js";
import { uuidFromString } from "../src/domain/typeDefinitions.js";
import {
  createCart,
  createTestApp,
  deleteJson,
  errorCode,
  getJson,
  patchJson,
  placeOrder,
  postJson,
  registerShopper,
  signInMaya,
} from "./helpers.js";

const mayaCode = (milestone: number) => `REWARD-${milestone}-77777777`;

describe("milestone coupons", () => {
  it("counts milestones per customer and ignores guest orders", async () => {
    const app = createTestApp();
    const maya = await signInMaya(app);
    const ravi = await registerShopper(app, "Ravi", "ravi@example.test");

    for (let index = 1; index <= 5; index += 1) {
      expect((await placeOrder(app, `guest-${index}`)).status).toBe(201);
    }
    for (let index = 1; index <= 4; index += 1) {
      expect((await placeOrder(app, `maya-${index}`, { shopper: maya })).status).toBe(201);
    }
    expect((await placeOrder(app, "ravi-1", { shopper: ravi })).status).toBe(201);

    const none = await postJson(app, "/admin/coupons/generate");
    expect(none.status).toBe(409);
    expect(errorCode(none.json)).toBe("NO_ELIGIBLE_MILESTONE");
    expect((await postJson(app, "/admin/coupons/generate", { customerId: ravi.id })).status).toBe(409);

    expect((await placeOrder(app, "maya-5", { shopper: maya })).status).toBe(201);
    const customers = await getJson(app, "/admin/customers");
    expect(customers.json.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: maya.id, ordersPlaced: 5, eligibleMilestone: 5, couponsEarned: 0 }),
      expect.objectContaining({ id: ravi.id, ordersPlaced: 1, eligibleMilestone: null, ordersUntilNextMilestone: 4 }),
    ]));

    const generated = await postJson(app, "/admin/coupons/generate", { customerId: maya.id });
    expect(generated.status).toBe(201);
    expect(generated.json).toMatchObject({
      code: mayaCode(5),
      source: "milestone",
      customerId: maya.id,
      earnedByCustomerId: maya.id,
      milestone: 5,
      percentOff: 10,
      status: "available",
    });
    expect((await postJson(app, "/admin/coupons/generate", { customerId: maya.id })).status).toBe(409);
    expect((await postJson(app, "/admin/coupons/generate")).status).toBe(409);

    const rewards = await getJson(app, "/customer/rewards", { cookie: maya.cookie });
    expect(rewards.json).toMatchObject({ ordersPlaced: 5, eligibleMilestone: null, nextMilestone: 10, couponsEarned: 1 });

    const stolen = await placeOrder(app, "ravi-steal", { shopper: ravi, couponCode: mayaCode(5) });
    expect(stolen.status).toBe(409);
    expect(errorCode(stolen.json)).toBe("COUPON_UNAVAILABLE");
    const used = await placeOrder(app, "maya-use", { shopper: maya, couponCode: mayaCode(5).toLowerCase() });
    expect(used.status).toBe(201);
    expect(used.json.couponCode).toBe(mayaCode(5));
  });

  it("serves the earliest unrewarded milestone when no customer is named, and applies config changes to future coupons", async () => {
    const app = createTestApp({ config: { everyNthOrder: 2, discountPercent: 25 } });
    const maya = await signInMaya(app);
    const ravi = await registerShopper(app, "Ravi", "ravi@example.test");

    await placeOrder(app, "r1", { shopper: ravi });
    await placeOrder(app, "m1", { shopper: maya });
    await placeOrder(app, "r2", { shopper: ravi });
    await placeOrder(app, "m2", { shopper: maya });

    const first = await postJson(app, "/admin/coupons/generate");
    expect(first.json).toMatchObject({ customerId: ravi.id, milestone: 2, percentOff: 25 });

    expect((await patchJson(app, "/admin/config", { everyNthOrder: 2, discountPercent: 40 })).status).toBe(200);
    const second = await postJson(app, "/admin/coupons/generate");
    expect(second.json).toMatchObject({ code: mayaCode(2), customerId: maya.id, milestone: 2, percentOff: 40 });
    expect((await postJson(app, "/admin/coupons/generate")).status).toBe(409);

    expect((await patchJson(app, "/admin/config", { everyNthOrder: 0, discountPercent: 101 })).status).toBe(400);
    expect((await getJson(app, "/admin/config")).json).toEqual({ everyNthOrder: 2, discountPercent: 40 });
  });

  it("redeems a coupon once, even when two checkouts compete for it", async () => {
    const app = createTestApp({ config: { everyNthOrder: 1, discountPercent: 10 } });
    const maya = await signInMaya(app);
    expect((await placeOrder(app, "unlock", { shopper: maya })).status).toBe(201);
    expect((await postJson(app, "/admin/coupons/generate", { customerId: maya.id })).status).toBe(201);

    const cartA = await createCart(app, maya.cookie);
    const cartB = await createCart(app, maya.cookie);
    await postJson(app, `/carts/${cartA}/items`, { productId: ProductId.merinoBlanket, quantity: 1 });
    await postJson(app, `/carts/${cartB}/items`, { productId: ProductId.linenSheet, quantity: 1 });

    const headers = (key: string) => ({ cookie: maya.cookie, "Idempotency-Key": key });
    const [first, second] = await Promise.all([
      postJson(app, `/carts/${cartA}/checkout`, { couponCode: mayaCode(1) }, headers("coupon-a")),
      postJson(app, `/carts/${cartB}/checkout`, { couponCode: mayaCode(1) }, headers("coupon-b")),
    ]);
    const winner = first.status === 201 ? first : second;
    const loser = first.status === 201 ? second : first;
    expect(winner.status).toBe(201);
    expect(winner.json.couponCode).toBe(mayaCode(1));
    expect(winner.json.discountCents).toBe(Math.floor(Number(winner.json.grossCents) * 10 / 100));
    expect(loser.status).toBe(409);
    expect(errorCode(loser.json)).toBe("COUPON_UNAVAILABLE");

    const loserCartId = loser === first ? cartA : cartB;
    expect((await getJson(app, `/carts/${loserCartId}`)).json.status).toBe("open");
    const retry = await postJson(app, `/carts/${loserCartId}/checkout`, {}, headers("coupon-loser-retry"));
    expect(retry.status).toBe(201);
    expect(retry.json.couponCode).toBeNull();

    const coupons = await getJson(app, "/admin/coupons");
    expect(coupons.json.items).toEqual([
      expect.objectContaining({ code: mayaCode(1), status: "redeemed", redeemedOrderId: winner.json.id }),
    ]);
  });
});

describe("admin coupon management", () => {
  it("creates custom coupons with unique codes for anyone or one customer", async () => {
    const app = createTestApp();
    const maya = await signInMaya(app);

    const open = await postJson(app, "/admin/coupons", { code: " welcome15 ", percentOff: 15 });
    expect(open.status).toBe(201);
    expect(open.json).toMatchObject({ code: "WELCOME15", source: "custom", customerId: null, milestone: null, percentOff: 15 });
    const duplicate = await postJson(app, "/admin/coupons", { code: "WELCOME15", percentOff: 5 });
    expect(duplicate.status).toBe(409);
    expect(errorCode(duplicate.json)).toBe("COUPON_CODE_TAKEN");
    expect((await postJson(app, "/admin/coupons", { code: "BAD CODE", percentOff: 5 })).status).toBe(400);
    expect((await postJson(app, "/admin/coupons", { percentOff: 0 })).status).toBe(400);
    expect((await postJson(app, "/admin/coupons", { percentOff: 101 })).status).toBe(400);
    const unknownCustomer = await postJson(app, "/admin/coupons", {
      percentOff: 5,
      customerId: "12345678-1234-4234-8234-123456789012",
    });
    expect(errorCode(unknownCustomer.json)).toBe("CUSTOMER_NOT_FOUND");

    const generatedCode = await postJson(app, "/admin/coupons", { percentOff: 20, customerId: maya.id });
    expect(generatedCode.status).toBe(201);
    expect(String(generatedCode.json.code)).toMatch(/^GIFT-[0-9A-F]{8}$/);

    const guest = await placeOrder(app, "guest-welcome", { couponCode: "welcome15" });
    expect(guest.status).toBe(201);
    expect(guest.json.couponCode).toBe("WELCOME15");
    const guestGift = await placeOrder(app, "guest-gift", { couponCode: String(generatedCode.json.code) });
    expect(errorCode(guestGift.json)).toBe("COUPON_UNAVAILABLE");
    const mayaGift = await getJson(app, "/customer/coupons", { cookie: maya.cookie });
    expect(mayaGift.json.items).toEqual([expect.objectContaining({ code: generatedCode.json.code })]);
  });

  it("edits, disables, reassigns, and deletes unredeemed coupons, and locks redeemed ones", async () => {
    const app = createTestApp({ config: { everyNthOrder: 1, discountPercent: 10 } });
    const maya = await signInMaya(app);
    const ravi = await registerShopper(app, "Ravi", "ravi@example.test");
    await placeOrder(app, "earn", { shopper: maya });
    await postJson(app, "/admin/coupons/generate", { customerId: maya.id });
    const code = mayaCode(1);

    const edited = await patchJson(app, `/admin/coupons/${code}`, { percentOff: 50 });
    expect(edited.json).toMatchObject({ percentOff: 50, status: "available" });

    expect((await patchJson(app, `/admin/coupons/${code}`, { status: "disabled" })).json).toMatchObject({ status: "disabled" });
    const blocked = await placeOrder(app, "while-disabled", { shopper: maya, couponCode: code });
    expect(errorCode(blocked.json)).toBe("COUPON_UNAVAILABLE");
    expect((await getJson(app, "/admin/reports")).json.coupons).toEqual({ generated: 1, available: 0, disabled: 1, redeemed: 0 });

    await patchJson(app, `/admin/coupons/${code}`, { status: "available", customerId: ravi.id });
    expect(errorCode((await placeOrder(app, "maya-after-move", { shopper: maya, couponCode: code })).json)).toBe("COUPON_UNAVAILABLE");
    const customers = await getJson(app, "/admin/customers");
    expect(customers.json.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: maya.id, ordersPlaced: 1, couponsEarned: 1, eligibleMilestone: null }),
    ]));
    expect((await postJson(app, "/admin/coupons/generate", { customerId: maya.id })).status).toBe(409);

    const redeemed = await placeOrder(app, "ravi-redeems", { shopper: ravi, couponCode: code, productId: ProductId.merinoBlanket });
    expect(redeemed.json).toMatchObject({ grossCents: 8900, discountCents: 4450, netCents: 4450, couponCode: code });
    const locked = await patchJson(app, `/admin/coupons/${code}`, { percentOff: 5 });
    expect(locked.status).toBe(409);
    expect(errorCode(locked.json)).toBe("COUPON_LOCKED");
    expect(errorCode((await deleteJson(app, `/admin/coupons/${code}`)).json)).toBe("COUPON_LOCKED");

    await placeOrder(app, "earn-2", { shopper: maya });
    await postJson(app, "/admin/coupons/generate", { customerId: maya.id });
    const second = mayaCode(2);
    expect((await deleteJson(app, `/admin/coupons/${second}`)).json).toEqual({ code: second, deleted: true });
    expect((await getJson(app, "/admin/coupons")).json.items).toEqual([expect.objectContaining({ code })]);
    const regenerated = await postJson(app, "/admin/coupons/generate", { customerId: maya.id });
    expect(regenerated.json).toMatchObject({ code: second, milestone: 2 });
    expect((await deleteJson(app, "/admin/coupons/NOPE-1")).status).toBe(404);
  });

  it("never lets a disable and a checkout both win on the same coupon", async () => {
    for (let round = 0; round < 10; round += 1) {
      const app = createTestApp();
      await postJson(app, "/admin/coupons", { code: "RACE", percentOff: 10 });
      const cartId = await createCart(app);
      await postJson(app, `/carts/${cartId}/items`, { productId: ProductId.cedarSachet, quantity: 1 });
      const checkout = postJson(app, `/carts/${cartId}/checkout`, { couponCode: "RACE" }, { "Idempotency-Key": `race-${round}` });
      const disable = patchJson(app, "/admin/coupons/RACE", { status: "disabled" });
      const [order, patch] = round % 2 === 0 ? await Promise.all([checkout, disable]) : (await Promise.all([disable, checkout])).reverse();

      const coupon = ((await getJson(app, "/admin/coupons")).json.items as Array<{ status: string }>)[0];
      if (order.status === 201) {
        expect(patch.status).toBe(409);
        expect(coupon?.status).toBe("redeemed");
      } else {
        expect(errorCode(order.json)).toBe("COUPON_UNAVAILABLE");
        expect(patch.status).toBe(200);
        expect(coupon?.status).toBe("disabled");
      }
    }
  });

  it("floors a 10 percent discount and allows a 100 percent discount to reach zero, never below", async () => {
    const oddProductId = uuidFromString("88888888-8888-4888-8888-888888888888");
    const app = createTestApp({
      products: [{ id: oddProductId, name: "Odd Price", unitPriceCents: 1234, availableQuantity: 5 }],
    });
    await postJson(app, "/admin/coupons", { code: "TEN", percentOff: 10 });
    await postJson(app, "/admin/coupons", { code: "FREE", percentOff: 100 });

    const discounted = await placeOrder(app, "odd-1", { productId: oddProductId, couponCode: "TEN" });
    expect(discounted.json).toMatchObject({ grossCents: 1234, discountCents: 123, netCents: 1111 });
    const zero = await placeOrder(app, "odd-2", { productId: oddProductId, couponCode: "FREE" });
    expect(zero.json).toMatchObject({ grossCents: 1234, discountCents: 1234, netCents: 0 });
  });
});
