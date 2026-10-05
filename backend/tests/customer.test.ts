import { describe, expect, it } from "vitest";
import { createTestApp, errorCode, getJson, placeOrder, postJson, registerShopper, signInMaya } from "./helpers.js";

describe("customer accounts", () => {
  it("registers a customer, signs them in, and rejects duplicate emails and bad passwords", async () => {
    const app = createTestApp();
    const ravi = await registerShopper(app, "Ravi Kumar", "Ravi@Example.test");
    expect(ravi.cookie).toContain("customer_session=");

    const session = await getJson(app, "/customer/session", { cookie: ravi.cookie });
    expect(session.json).toEqual({
      signedIn: true,
      customer: { id: ravi.id, name: "Ravi Kumar", email: "ravi@example.test" },
    });

    const duplicate = await postJson(app, "/customer/register", { name: "Other", email: "ravi@example.test", password: "password123" });
    expect(duplicate.status).toBe(409);
    expect(errorCode(duplicate.json)).toBe("EMAIL_TAKEN");
    expect((await postJson(app, "/customer/register", { name: "Short", email: "short@example.test", password: "short" })).status).toBe(400);
    expect((await postJson(app, "/customer/register", { name: "Bad", email: "not-an-email", password: "password123" })).status).toBe(400);

    const wrong = await postJson(app, "/customer/session", { email: "ravi@example.test", password: "wrong-password" });
    expect(wrong.status).toBe(401);
    expect(errorCode(wrong.json)).toBe("INVALID_CREDENTIALS");
    const again = await postJson(app, "/customer/session", { email: "RAVI@example.test", password: "password123" });
    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ signedIn: true, customer: { id: ravi.id } });
  });

  it("keeps each customer's orders and rewards separate", async () => {
    const app = createTestApp({ config: { everyNthOrder: 3, discountPercent: 10 } });
    const maya = await signInMaya(app);
    const ravi = await registerShopper(app, "Ravi", "ravi@example.test");
    await placeOrder(app, "m1", { shopper: maya });
    await placeOrder(app, "m2", { shopper: maya });
    await placeOrder(app, "r1", { shopper: ravi });

    const mayaOrders = await getJson(app, "/customer/orders", { cookie: maya.cookie });
    expect(mayaOrders.json.items).toHaveLength(2);
    expect((await getJson(app, "/customer/rewards", { cookie: maya.cookie })).json).toMatchObject({
      ordersPlaced: 2,
      everyNthOrder: 3,
      nextMilestone: 3,
      ordersUntilNextMilestone: 1,
      eligibleMilestone: null,
    });
    expect((await getJson(app, "/customer/rewards", { cookie: ravi.cookie })).json).toMatchObject({
      ordersPlaced: 1,
      ordersUntilNextMilestone: 2,
    });
    expect((await getJson(app, "/customer/rewards")).status).toBe(401);
  });
});
