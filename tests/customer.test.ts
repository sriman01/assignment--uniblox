import { describe, expect, it } from "vitest";
import { ProductId } from "../src/domain/catalog.js";
import { createTestApp, errorCode, postJson } from "./helpers.js";

describe("customer account rewards", () => {
  it("tracks customer orders and restricts the earned milestone coupon to that customer", async () => {
    const app = createTestApp();
    const signIn = await postJson(app, "/customer/session", {
      email: "maya@sleepyhug.test",
      password: "sleepwell",
    });
    const cookie = signIn.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(cookie).toContain("customer_session=");

    for (let index = 1; index <= 5; index += 1) {
      const cartResponse = await app.request("/carts", { method: "POST", headers: { cookie } });
      const cart = await cartResponse.json() as { id: string };
      await postJson(app, `/carts/${cart.id}/items`, { productId: ProductId.cedarSachet, quantity: 1 });
      const checkout = await app.request(`/carts/${cart.id}/checkout`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json", "Idempotency-Key": `customer-${index}` },
        body: "{}",
      });
      expect(checkout.status).toBe(201);
    }

    const generated = await postJson(app, "/admin/coupons/generate");
    expect(generated.json).toMatchObject({ code: "MILESTONE-5", customerId: "cus_maya" });

    const anonymousCart = await postJson(app, "/carts");
    const anonymousId = String(anonymousCart.json.id);
    await postJson(app, `/carts/${anonymousId}/items`, { productId: ProductId.cedarSachet, quantity: 1 });
    const rejected = await postJson(
      app,
      `/carts/${anonymousId}/checkout`,
      { couponCode: "MILESTONE-5" },
      { "Idempotency-Key": "anonymous-coupon" },
    );
    expect(rejected.status).toBe(409);
    expect(errorCode(rejected.json)).toBe("COUPON_UNAVAILABLE");

    const orders = await app.request("/customer/orders", { headers: { cookie } });
    expect((await orders.json() as { items: unknown[] }).items).toHaveLength(5);
    const coupons = await app.request("/customer/coupons", { headers: { cookie } });
    expect(await coupons.json()).toEqual({
      items: [expect.objectContaining({ code: "MILESTONE-5", status: "available", customerId: "cus_maya" })],
    });
  });
});
