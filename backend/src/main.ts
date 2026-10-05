import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import type pg from "pg";
import type { CheckoutStorePort } from "./application/port/outgoing/CheckoutStorePort.js";
import { createCheckoutModule } from "./infrastructure/composition/createCheckoutModule.js";
import { createServerApp } from "./infrastructure/composition/createServerApp.js";
import { databaseConfigFromEnv } from "./infrastructure/composition/databaseConfig.js";
import { openDatabaseStore } from "./infrastructure/composition/openDatabaseStore.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const port = Number(process.env.PORT ?? 4000);
const database = databaseConfigFromEnv();
const sessionSecret = process.env.SESSION_SECRET?.trim() || undefined;

let store: CheckoutStorePort | undefined;
let pool: pg.Pool | undefined;
if (database) {
  try {
    ({ store, pool } = await openDatabaseStore(database));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const { app: api } = createCheckoutModule({ store, sessionSecret });
const app = createServerApp(api);

const server = serve({ fetch: app.fetch, hostname: "0.0.0.0", port }, () => {
  console.log(`storage: ${database ? database.label : "in-memory (data is lost on restart)"}`);
  if (!sessionSecret) console.log("sessions: SESSION_SECRET not set, so a restart signs everyone out");
  console.log(`checkout app listening on http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    void (pool?.end() ?? Promise.resolve()).finally(() => process.exit(0));
  });
}
