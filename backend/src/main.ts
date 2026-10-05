import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import pg from "pg";
import type { CheckoutStorePort } from "./application/port/outgoing/CheckoutStorePort.js";
import { createSeedState } from "./domain/catalog.js";
import { PostgresCheckoutStore } from "./infrastructure/adapter/outgoing/postgres/PostgresCheckoutStore.js";
import { ScryptPasswordHasher } from "./infrastructure/adapter/outgoing/ScryptPasswordHasher.js";
import { SystemClock } from "./infrastructure/adapter/outgoing/SystemClock.js";
import { createCheckoutModule, demoCustomers } from "./infrastructure/composition/createCheckoutModule.js";
import { createServerApp } from "./infrastructure/composition/createServerApp.js";
import { databaseConfigFromEnv } from "./infrastructure/composition/databaseConfig.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const port = Number(process.env.PORT ?? 4000);
const database = databaseConfigFromEnv();

let store: CheckoutStorePort | undefined;
let pool: pg.Pool | undefined;
if (database) {
  pool = new pg.Pool(database.pool);
  pool.on("error", (error) => console.error("postgres idle client error:", error.message));
  try {
    store = await PostgresCheckoutStore.open(pool, {
      schema: database.schema,
      seed: () => createSeedState({ customers: demoCustomers(new ScryptPasswordHasher(), new SystemClock()) }),
    });
  } catch (error) {
    console.error(`could not open ${database.label}:`, error instanceof Error ? error.message : error);
    await pool.end();
    process.exit(1);
  }
}

const { app: api } = createCheckoutModule({ store });
const app = createServerApp(api);

const server = serve({ fetch: app.fetch, hostname: "0.0.0.0", port }, () => {
  console.log(`storage: ${database ? database.label : "in-memory (data is lost on restart)"}`);
  console.log(`checkout app listening on http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    void (pool?.end() ?? Promise.resolve()).finally(() => process.exit(0));
  });
}
