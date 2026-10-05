import pg from "pg";
import { createSeedState } from "../../domain/catalog.js";
import { PostgresCheckoutStore } from "../adapter/outgoing/postgres/PostgresCheckoutStore.js";
import { ScryptPasswordHasher } from "../adapter/outgoing/ScryptPasswordHasher.js";
import { SystemClock } from "../adapter/outgoing/SystemClock.js";
import { demoCustomers } from "./createCheckoutModule.js";
import type { DatabaseConfig } from "./databaseConfig.js";

/** Creates the pool, makes sure the schema exists, and seeds an empty database. Ends the pool if that fails. */
export async function openDatabaseStore(database: DatabaseConfig): Promise<{ store: PostgresCheckoutStore; pool: pg.Pool }> {
  const pool = new pg.Pool(database.pool);
  pool.on("error", (error) => console.error("postgres idle client error:", error.message));
  try {
    const store = await PostgresCheckoutStore.open(pool, {
      schema: database.schema,
      seed: () => createSeedState({ customers: demoCustomers(new ScryptPasswordHasher(), new SystemClock()) }),
    });
    return { store, pool };
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw new Error(`could not open ${database.label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
