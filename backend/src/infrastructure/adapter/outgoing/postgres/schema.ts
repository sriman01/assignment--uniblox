/**
 * Idempotent DDL, run at startup inside the store's advisory lock.
 * Foreign keys are deferred so one unit of work can write its rows in any order.
 * `seq` keeps insertion order, which reward counting relies on.
 */
export function schemaSql(schema: string): string {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};

CREATE TABLE IF NOT EXISTS ${schema}.store_config (
  id smallint PRIMARY KEY CHECK (id = 1),
  every_nth_order integer NOT NULL CHECK (every_nth_order >= 1),
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS ${schema}.products (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id uuid PRIMARY KEY,
  name text NOT NULL,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  available_quantity integer NOT NULL CHECK (available_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS ${schema}.customers (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS ${schema}.carts (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id uuid PRIMARY KEY,
  customer_id uuid REFERENCES ${schema}.customers (id) DEFERRABLE INITIALLY DEFERRED,
  status text NOT NULL CHECK (status IN ('open', 'checked_out')),
  items jsonb NOT NULL,
  order_id uuid,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS ${schema}.orders (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  id uuid PRIMARY KEY,
  cart_id uuid NOT NULL UNIQUE REFERENCES ${schema}.carts (id) DEFERRABLE INITIALLY DEFERRED,
  customer_id uuid REFERENCES ${schema}.customers (id) DEFERRABLE INITIALLY DEFERRED,
  idempotency_key text NOT NULL UNIQUE,
  lines jsonb NOT NULL,
  gross_cents integer NOT NULL CHECK (gross_cents >= 0),
  discount_cents integer NOT NULL CHECK (discount_cents >= 0),
  net_cents integer NOT NULL CHECK (net_cents >= 0),
  coupon_code text,
  placed_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS ${schema}.coupons (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  code text PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('milestone', 'custom')),
  customer_id uuid REFERENCES ${schema}.customers (id) DEFERRABLE INITIALLY DEFERRED,
  earned_by_customer_id uuid REFERENCES ${schema}.customers (id) DEFERRABLE INITIALLY DEFERRED,
  milestone integer,
  percent_off integer NOT NULL CHECK (percent_off BETWEEN 0 AND 100),
  status text NOT NULL CHECK (status IN ('available', 'disabled', 'redeemed')),
  redeemed_order_id uuid REFERENCES ${schema}.orders (id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_one_per_milestone
  ON ${schema}.coupons (earned_by_customer_id, milestone)
  WHERE milestone IS NOT NULL;

CREATE TABLE IF NOT EXISTS ${schema}.idempotency_keys (
  seq bigint GENERATED ALWAYS AS IDENTITY,
  key text PRIMARY KEY,
  cart_id uuid NOT NULL REFERENCES ${schema}.carts (id) DEFERRABLE INITIALLY DEFERRED,
  order_id uuid NOT NULL REFERENCES ${schema}.orders (id) DEFERRABLE INITIALLY DEFERRED
);
`;
}
