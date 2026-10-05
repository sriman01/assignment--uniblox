import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSeedState, ProductId } from "../src/domain/catalog.js";
import { PostgresCheckoutStore } from "../src/infrastructure/adapter/outgoing/postgres/PostgresCheckoutStore.js";
import { ScryptPasswordHasher } from "../src/infrastructure/adapter/outgoing/ScryptPasswordHasher.js";
import { SystemClock } from "../src/infrastructure/adapter/outgoing/SystemClock.js";
import { createCheckoutModule, demoCustomers } from "../src/infrastructure/composition/createCheckoutModule.js";
import { deleteJson, errorCode, getJson, patchJson, placeOrder, postJson, registerShopper, signInMaya, type Json } from "./helpers.js";

const schema = "checkout_test";
const port = 55_000 + Math.floor(Math.random() * 5_000);

let db: PGlite;
let server: PGLiteSocketServer;
const pools: pg.Pool[] = [];

/** PGlite is a single session, so each boot stops the previous "process" and gets a one-connection pool. */
async function bootApp() {
  for (const previous of pools.splice(0)) await previous.end();
  const pool = new pg.Pool({ host: "127.0.0.1", port, user: "postgres", database: "postgres", max: 1, options: "-c TimeZone=UTC" });
  pools.push(pool);
  const store = await PostgresCheckoutStore.open(pool, {
    schema,
    seed: () => createSeedState({ customers: demoCustomers(new ScryptPasswordHasher(), new SystemClock()) }),
  });
  return { app: createCheckoutModule({ store }).app, store, pool };
}

beforeAll(async () => {
  db = await PGlite.create();
  server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();
});

afterAll(async () => {
  for (const pool of pools) await pool.end();
  await server?.stop();
  await db?.close();
});

describe("postgres store", () => {
  it("persists orders, customers, coupons and config across a restart", async () => {
    const first = await bootApp();
    const maya = await signInMaya(first.app);
    await registerShopper(first.app, "Ravi", "ravi@example.test");
    for (let index = 1; index <= 5; index += 1) {
      expect((await placeOrder(first.app, `pg-maya-${index}`, { shopper: maya })).status).toBe(201);
    }
    expect((await placeOrder(first.app, "pg-guest-1")).status).toBe(201);
    const generated = await postJson(first.app, "/admin/coupons/generate", { customerId: maya.id });
    expect(generated.status).toBe(201);
    expect((await postJson(first.app, "/admin/coupons", { code: "KEEP15", percentOff: 15, customerId: null })).status).toBe(201);
    expect((await postJson(first.app, "/admin/coupons", { code: "DROPME", percentOff: 5, customerId: null })).status).toBe(201);
    expect((await deleteJson(first.app, "/admin/coupons/DROPME")).status).toBe(200);
    expect((await patchJson(first.app, "/admin/config", { everyNthOrder: 3, discountPercent: 20 })).status).toBe(200);
    const reportBefore = (await getJson(first.app, "/admin/reports")).json;

    const second = await bootApp();
    expect((await getJson(second.app, "/admin/reports")).json).toEqual(reportBefore);
    expect((await getJson(second.app, "/admin/config")).json).toEqual({ everyNthOrder: 3, discountPercent: 20 });
    const coupons = ((await getJson(second.app, "/admin/coupons")).json.items as Json[]).map((coupon) => coupon.code);
    expect(coupons).toEqual(expect.arrayContaining([generated.json.code, "KEEP15"]));
    expect(coupons).not.toContain("DROPME");

    const products = (await getJson(second.app, "/products")).json.items as Json[];
    expect(products.find((product) => product.id === ProductId.cedarSachet)?.availableQuantity).toBe(34);

    const mayaAgain = await signInMaya(second.app);
    expect((await getJson(second.app, "/customer/rewards", { cookie: mayaAgain.cookie })).json).toMatchObject({
      ordersPlaced: 5,
      couponsEarned: 1,
    });
    const ravi = await postJson(second.app, "/customer/session", { email: "ravi@example.test", password: "password123" });
    expect(ravi.status).toBe(200);

    const replay = await placeOrder(second.app, "pg-maya-1", { shopper: mayaAgain });
    expect(replay.status).toBe(409);
    expect(errorCode(replay.json)).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("lets exactly one of many concurrent checkouts take the last unit", async () => {
    const { app } = await bootApp();
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, index) => placeOrder(app, `pg-mask-${index}`, { productId: ProductId.eyeMask })),
    );
    expect(attempts.filter((attempt) => attempt.status === 201)).toHaveLength(1);
    expect(attempts.filter((attempt) => errorCode(attempt.json) === "INSUFFICIENT_INVENTORY")).toHaveLength(7);
  });

  it("rolls back everything when a unit of work throws", async () => {
    const { store } = await bootApp();
    await expect(
      store.transaction((state) => {
        state.config.everyNthOrder = 99;
        state.coupons.clear();
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const after = await store.transaction((state) => ({ config: { ...state.config }, coupons: state.coupons.size }));
    expect(after.config.everyNthOrder).toBe(3);
    expect(after.coupons).toBeGreaterThan(0);
  });
});
