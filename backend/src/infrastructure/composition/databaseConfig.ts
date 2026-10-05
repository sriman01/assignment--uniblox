import { existsSync, readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

export type DatabaseConfig = {
  pool: PoolConfig;
  schema: string;
  label: string;
};

/** Hosts without a filesystem (e.g. Vercel, Netlify) store the PEM itself in the variable, sometimes with literal `\n`. */
function caCertificate(value: string): string {
  if (value.includes("-----BEGIN CERTIFICATE-----")) return value.replace(/\\n/g, "\n");
  if (!existsSync(value)) {
    throw new Error(
      `DB_SSL_CA is "${value.slice(0, 40)}", which is neither certificate text nor an existing file. ` +
        "On hosts without files (Vercel, Netlify), paste the whole certificate, including the BEGIN/END lines.",
    );
  }
  return readFileSync(value, "utf8");
}

/**
 * Returns `null` when DB_HOST is unset, which keeps the app on the in-memory store.
 * DB_SSL_CA: the PEM text itself, or a path to the PEM file.
 * DB_SSL_MODE: `verify-full` (default when DB_SSL_CA is set), `require` (default otherwise: encrypted, certificate
 * not verified), or `disable`.
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

  const sslMode = env.DB_SSL_MODE?.trim() || (env.DB_SSL_CA?.trim() ? "verify-full" : "require");
  let ssl: PoolConfig["ssl"];
  if (sslMode === "disable") {
    ssl = false;
  } else if (sslMode === "verify-full") {
    const ca = env.DB_SSL_CA?.trim();
    if (!ca) throw new Error("DB_SSL_MODE=verify-full needs DB_SSL_CA (the CA certificate text, or a path to it)");
    ssl = { ca: caCertificate(ca), rejectUnauthorized: true };
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
      // Units of work are serialized in-process, so more connections would sit idle against the provider's limit.
      max: 2,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      options: "-c TimeZone=UTC",
    },
    schema,
    label: `postgres ${host}:${port}/${database} (schema ${schema}, ssl ${sslMode})`,
  };
}
