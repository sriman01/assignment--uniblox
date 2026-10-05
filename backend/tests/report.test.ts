import { describe, expect, it } from "vitest";
import { ProductId } from "../src/domain/catalog.js";
import type { Uuid } from "../src/domain/typeDefinitions.js";
import { createCart, createTestApp, getJson, postJson } from "./helpers.js";

describe("reports", () => {
  it("reconciles with orders and coupons and does not change state when read twice", async () => {
    const app = createTestApp({ config: { everyNthOrder: 1, discountPercent: 10 } });
    const before = await getJson(app, "/products");

    const firstCart = await createCart(app);
    await postJson(app, `/carts/${firstCart}/items`, { productId: ProductId.cedarSachet, quantity: 2 });
    await postJson(app, `/carts/${firstCart}/items`, { productId: ProductId.woolThrow, quantity: 1 });
    const first = await postJson(app, `/carts/${firstCart}/checkout`, {}, { "Idempotency-Key": "report-1" });
    expect(first.status).toBe(201);

    await postJson(app, "/admin/coupons", { code: "REPORT10", percentOff: 10 });
    const secondCart = await createCart(app);
    await postJson(app, `/carts/${secondCart}/items`, { productId: ProductId.cedarSachet, quantity: 1 });
    const second = await postJson(app, `/carts/${secondCart}/checkout`, { couponCode: "REPORT10" }, {
      "Idempotency-Key": "report-2",
    });
    expect(second.status).toBe(201);

    const report = await getJson(app, "/admin/reports");
    const again = await getJson(app, "/admin/reports");
    expect(again.json).toEqual(report.json);

    const gross = Number(first.json.grossCents) + Number(second.json.grossCents);
    const discounts = Number(second.json.discountCents);
    expect(report.json).toMatchObject({
      grossRevenueCents: gross,
      totalDiscountsCents: discounts,
      netRevenueCents: gross - discounts,
      successfullyPlacedOrders: 2,
      coupons: { generated: 1, available: 0, disabled: 0, redeemed: 1 },
    });
    expect(Number(report.json.grossRevenueCents) - Number(report.json.totalDiscountsCents)).toBe(
      Number(report.json.netRevenueCents),
    );

    const quantities = report.json.purchasedQuantityByProduct as Array<{ productId: string; quantity: number }>;
    expect(quantities.find((row) => row.productId === ProductId.cedarSachet)?.quantity).toBe(3);
    expect(quantities.find((row) => row.productId === ProductId.woolThrow)?.quantity).toBe(1);
    expect(quantities.find((row) => row.productId === ProductId.eyeMask)?.quantity).toBe(0);

    const orders = await getJson(app, "/admin/orders");
    expect(orders.json.items).toHaveLength(2);
    const after = await getJson(app, "/products");
    const beforeItems = before.json.items as Array<{ id: Uuid; availableQuantity: number }>;
    const afterItems = after.json.items as Array<{ id: Uuid; availableQuantity: number }>;
    expect(afterItems.find((item) => item.id === ProductId.cedarSachet)?.availableQuantity).toBe(
      (beforeItems.find((item) => item.id === ProductId.cedarSachet)?.availableQuantity ?? 0) - 3,
    );
    expect(after.json).not.toEqual(before.json);
    expect(again.status).toBe(200);
  });
});
