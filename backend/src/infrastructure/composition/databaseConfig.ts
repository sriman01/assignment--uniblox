import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

export type DatabaseConfig = {
  pool: PoolConfig;
  schema: string;
  label: string;
};

/**
 * Returns `null` when DB_HOST is unset, which keeps the app on the in-memory store.
 * DB_SSL_MODE: `require` (default: encrypted, certificate not verified), `verify-full` (needs DB_SSL_CA), or `disable`.
 */
export function databaseConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DatabaseConfig | null {
  const host = env.DB_HOST?.trim();
  if (!host) return null;

  const missing = ["DB_NAME", "DB_USERNAME", "DB_PASSWORD"].filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`DB_HOST is set but ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing`);
  }

  const port = Number(env.DB_PORT?.trim() || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DB_PORT must be a port number, got ${env.DB_PORT}`);
  }

  const schema = env.DB_SCHEMA?.trim() || "public";
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
    throw new Error(`DB_SCHEMA must be a lowercase identifier, got ${schema}`);
  }

  const sslMode = env.DB_SSL_MODE?.trim() || "require";
  let ssl: PoolConfig["ssl"];
  if (sslMode === "disable") {
    ssl = false;
  } else if (sslMode === "verify-full") {
    const caPath = env.DB_SSL_CA?.trim();
    if (!caPath) throw new Error("DB_SSL_MODE=verify-full needs DB_SSL_CA (path to the CA certificate)");
    ssl = { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  } else if (sslMode === "require") {
    ssl = { rejectUnauthorized: false };
  } else {
    throw new Error(`DB_SSL_MODE must be require, verify-full or disable, got ${sslMode}`);
  }

  const database = env.DB_NAME!.trim();
  return {
    pool: {
      host,
      port,
      database,
      user: env.DB_USERNAME!.trim(),
      password: env.DB_PASSWORD!,
      ssl,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      options: "-c TimeZone=UTC",
    },
    schema,
    label: `postgres ${host}:${port}/${database} (schema ${schema}, ssl ${sslMode})`,
  };
}
