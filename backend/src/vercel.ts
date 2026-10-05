import { getRequestListener } from "@hono/node-server";
import { createCheckoutModule } from "./infrastructure/composition/createCheckoutModule.js";
import { createApiApp } from "./infrastructure/composition/createServerApp.js";
import { databaseConfigFromEnv } from "./infrastructure/composition/databaseConfig.js";
import { openDatabaseStore } from "./infrastructure/composition/openDatabaseStore.js";

/**
 * Entry for the Vercel function that serves `/api/*` (bundled by scripts/build-vercel.mjs).
 * Instances come and go, so storage and sessions must not live in memory: both settings are required.
 */
const database = databaseConfigFromEnv();
if (!database) throw new Error("DB_HOST is not set; the Vercel deployment needs Postgres");
const sessionSecret = process.env.SESSION_SECRET?.trim();
if (!sessionSecret) throw new Error("SESSION_SECRET is not set; generate one with `openssl rand -hex 32`");

const { store } = await openDatabaseStore({ ...database, pool: { ...database.pool, max: 1 } });
const { app: api } = createCheckoutModule({ store, sessionSecret, secureCookies: true });

export default getRequestListener(createApiApp(api).fetch);
