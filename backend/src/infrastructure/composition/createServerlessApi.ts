import type { Hono } from "hono";
import { createCheckoutModule } from "./createCheckoutModule.js";
import { createApiApp } from "./createServerApp.js";
import { databaseConfigFromEnv } from "./databaseConfig.js";
import { openDatabaseStore } from "./openDatabaseStore.js";

/**
 * The API for serverless hosts (Vercel, Netlify). Instances come and go, so storage and sessions
 * must not live in memory: Postgres and SESSION_SECRET are required.
 */
export async function createServerlessApi(): Promise<Hono> {
  const database = databaseConfigFromEnv();
  if (!database) throw new Error("DB_HOST is not set; serverless deployments need Postgres");
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!sessionSecret) throw new Error("SESSION_SECRET is not set; generate one with `openssl rand -hex 32`");

  const { store } = await openDatabaseStore({ ...database, pool: { ...database.pool, max: 1 } });
  const { app: api } = createCheckoutModule({ store, sessionSecret, secureCookies: true });
  return createApiApp(api);
}
