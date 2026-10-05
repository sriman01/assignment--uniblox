import type { Pool, PoolClient, QueryResult } from "pg";
import type { CheckoutStorePort } from "../../../../application/port/outgoing/CheckoutStorePort.js";
import type { StoreState } from "../../../../domain/model.js";
import { AsyncLock } from "../AsyncLock.js";
import { schemaSql } from "./schema.js";
import { changeStatements, loadStateSql, snapshot, stateFromRow } from "./tables.js";

/** Shared by every process using the same database, so units of work never interleave. */
const advisoryLockKey = 4_242_001;

export type PostgresStoreOptions = {
  schema: string;
  /** Initial state written once, when the schema has no store_config row yet. */
  seed: () => StoreState;
};

/**
 * Each unit of work is one database transaction: take the advisory lock, load the state,
 * run the synchronous work, then write back only the rows that changed.
 * If the work throws or a write fails, the transaction rolls back and nothing is persisted.
 */
export class PostgresCheckoutStore implements CheckoutStorePort {
  private readonly lock = new AsyncLock();
  private readonly loadSql: string;

  private constructor(
    private readonly pool: Pool,
    private readonly schema: string,
  ) {
    this.loadSql = loadStateSql(schema);
  }

  static async open(pool: Pool, options: PostgresStoreOptions): Promise<PostgresCheckoutStore> {
    if (!/^[a-z_][a-z0-9_]*$/.test(options.schema)) {
      throw new Error(`Invalid schema name: ${options.schema}`);
    }
    const store = new PostgresCheckoutStore(pool, options.schema);
    await store.withClient(async (client) => {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [advisoryLockKey]);
      await client.query(schemaSql(options.schema));
      const seeded = await client.query(`SELECT 1 FROM ${options.schema}.store_config WHERE id = 1`);
      if (seeded.rowCount === 0) {
        for (const statement of changeStatements(options.schema, snapshot(null), options.seed())) {
          await client.query(statement.text, statement.values);
        }
      }
      await client.query("COMMIT");
    });
    return store;
  }

  transaction<T>(work: (state: StoreState) => T): Promise<T> {
    return this.lock.run(() =>
      this.withClient(async (client) => {
        const results = (await client.query(
          `BEGIN; SELECT pg_advisory_xact_lock(${advisoryLockKey}); ${this.loadSql}`,
        )) as unknown as QueryResult[];
        const state = stateFromRow(results[2].rows[0]);
        const before = snapshot(state);
        const value = work(state);
        for (const statement of changeStatements(this.schema, before, state)) {
          await client.query(statement.text, statement.values);
        }
        await client.query("COMMIT");
        return value;
      }),
    );
  }

  private async withClient<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      const value = await run(client);
      client.release();
      return value;
    } catch (error) {
      const rolledBack = await client.query("ROLLBACK").then(
        () => true,
        () => false,
      );
      client.release(rolledBack ? undefined : true);
      throw error;
    }
  }
}
