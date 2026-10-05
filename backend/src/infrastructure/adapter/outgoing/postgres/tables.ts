import type {
  Cart,
  CartItem,
  CartStatus,
  Coupon,
  CouponSource,
  CouponStatus,
  Customer,
  IdempotencyRecord,
  Order,
  OrderLine,
  Product,
  StoreConfig,
  StoreState,
} from "../../../../domain/model.js";
import { iso8601DateTimeFromString, uuidFromString, type Iso8601DateTime, type Uuid } from "../../../../domain/typeDefinitions.js";

type Row = Record<string, unknown>;

export type TableSpec = {
  table: string;
  key: string;
  keyType: "uuid" | "text" | "smallint";
  columns: ReadonlyArray<readonly [name: string, sqlType: string]>;
  rows(state: StoreState): Map<string, Row>;
};

function iso(value: unknown): Iso8601DateTime {
  return iso8601DateTimeFromString(new Date(String(value)).toISOString());
}

function uuidOrNull(value: unknown): Uuid | null {
  return value === null || value === undefined ? null : uuidFromString(String(value));
}

function rowsOf<K extends string | number, E>(entries: Map<K, E>, toRow: (entity: E, key: K) => Row): Map<string, Row> {
  const rows = new Map<string, Row>();
  for (const [key, entity] of entries) rows.set(String(key), toRow(entity, key));
  return rows;
}

export const tables: TableSpec[] = [
  {
    table: "store_config",
    key: "id",
    keyType: "smallint",
    columns: [
      ["id", "smallint"],
      ["every_nth_order", "integer"],
      ["discount_percent", "integer"],
    ],
    rows: (state) =>
      new Map([["1", { id: 1, every_nth_order: state.config.everyNthOrder, discount_percent: state.config.discountPercent }]]),
  },
  {
    table: "products",
    key: "id",
    keyType: "uuid",
    columns: [
      ["id", "uuid"],
      ["name", "text"],
      ["unit_price_cents", "integer"],
      ["available_quantity", "integer"],
    ],
    rows: (state) =>
      rowsOf(state.products, (product) => ({
        id: product.id,
        name: product.name,
        unit_price_cents: product.unitPriceCents,
        available_quantity: product.availableQuantity,
      })),
  },
  {
    table: "customers",
    key: "id",
    keyType: "uuid",
    columns: [
      ["id", "uuid"],
      ["name", "text"],
      ["email", "text"],
      ["password_hash", "text"],
      ["created_at", "timestamptz"],
    ],
    rows: (state) =>
      rowsOf(state.customers, (customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        password_hash: customer.passwordHash,
        created_at: customer.createdAt,
      })),
  },
  {
    table: "carts",
    key: "id",
    keyType: "uuid",
    columns: [
      ["id", "uuid"],
      ["customer_id", "uuid"],
      ["status", "text"],
      ["items", "jsonb"],
      ["order_id", "uuid"],
      ["created_at", "timestamptz"],
      ["updated_at", "timestamptz"],
    ],
    rows: (state) =>
      rowsOf(state.carts, (cart) => ({
        id: cart.id,
        customer_id: cart.customerId,
        status: cart.status,
        items: cart.items,
        order_id: cart.orderId,
        created_at: cart.createdAt,
        updated_at: cart.updatedAt,
      })),
  },
  {
    table: "orders",
    key: "id",
    keyType: "uuid",
    columns: [
      ["id", "uuid"],
      ["cart_id", "uuid"],
      ["customer_id", "uuid"],
      ["idempotency_key", "text"],
      ["lines", "jsonb"],
      ["gross_cents", "integer"],
      ["discount_cents", "integer"],
      ["net_cents", "integer"],
      ["coupon_code", "text"],
      ["placed_at", "timestamptz"],
    ],
    rows: (state) =>
      rowsOf(state.orders, (order) => ({
        id: order.id,
        cart_id: order.cartId,
        customer_id: order.customerId,
        idempotency_key: order.idempotencyKey,
        lines: order.lines,
        gross_cents: order.grossCents,
        discount_cents: order.discountCents,
        net_cents: order.netCents,
        coupon_code: order.couponCode,
        placed_at: order.placedAt,
      })),
  },
  {
    table: "coupons",
    key: "code",
    keyType: "text",
    columns: [
      ["code", "text"],
      ["source", "text"],
      ["customer_id", "uuid"],
      ["earned_by_customer_id", "uuid"],
      ["milestone", "integer"],
      ["percent_off", "integer"],
      ["status", "text"],
      ["redeemed_order_id", "uuid"],
      ["created_at", "timestamptz"],
      ["updated_at", "timestamptz"],
    ],
    rows: (state) =>
      rowsOf(state.coupons, (coupon) => ({
        code: coupon.code,
        source: coupon.source,
        customer_id: coupon.customerId,
        earned_by_customer_id: coupon.earnedByCustomerId,
        milestone: coupon.milestone,
        percent_off: coupon.percentOff,
        status: coupon.status,
        redeemed_order_id: coupon.redeemedOrderId,
        created_at: coupon.createdAt,
        updated_at: coupon.updatedAt,
      })),
  },
  {
    table: "idempotency_keys",
    key: "key",
    keyType: "text",
    columns: [
      ["key", "text"],
      ["cart_id", "uuid"],
      ["order_id", "uuid"],
    ],
    rows: (state) => rowsOf(state.idempotency, (record, key) => ({ key, cart_id: record.cartId, order_id: record.orderId })),
  },
];

/** One statement that returns every table as a JSON array, in insertion order. */
export function loadStateSql(schema: string): string {
  const columns = tables
    .filter((spec) => spec.table !== "store_config")
    .map(
      (spec) =>
        `(SELECT coalesce(jsonb_agg(to_jsonb(t) - 'seq' ORDER BY t.seq), '[]'::jsonb) FROM ${schema}.${spec.table} t) AS ${spec.table}`,
    );
  columns.push(`(SELECT to_jsonb(t) FROM ${schema}.store_config t WHERE t.id = 1) AS store_config`);
  return `SELECT ${columns.join(",\n  ")}`;
}

type LoadedRow = Record<(typeof tables)[number]["table"], unknown>;

export function stateFromRow(row: LoadedRow): StoreState {
  const list = (name: string) => (row[name] ?? []) as Row[];
  const config = row.store_config as Row | null;
  if (!config) throw new Error("store_config is missing; the database was not seeded");

  const storeConfig: StoreConfig = {
    everyNthOrder: Number(config.every_nth_order),
    discountPercent: Number(config.discount_percent),
  };

  const products = new Map<Uuid, Product>();
  for (const r of list("products")) {
    const id = uuidFromString(String(r.id));
    products.set(id, {
      id,
      name: String(r.name),
      unitPriceCents: Number(r.unit_price_cents),
      availableQuantity: Number(r.available_quantity),
    });
  }

  const customers = new Map<Uuid, Customer>();
  for (const r of list("customers")) {
    const id = uuidFromString(String(r.id));
    customers.set(id, {
      id,
      name: String(r.name),
      email: String(r.email),
      passwordHash: String(r.password_hash),
      createdAt: iso(r.created_at),
    });
  }

  const carts = new Map<Uuid, Cart>();
  for (const r of list("carts")) {
    const id = uuidFromString(String(r.id));
    carts.set(id, {
      id,
      customerId: uuidOrNull(r.customer_id),
      status: r.status as CartStatus,
      items: (r.items as Array<{ productId: string; quantity: number }>).map(
        (item): CartItem => ({ productId: uuidFromString(item.productId), quantity: Number(item.quantity) }),
      ),
      orderId: uuidOrNull(r.order_id),
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
    });
  }

  const orders = new Map<Uuid, Order>();
  for (const r of list("orders")) {
    const id = uuidFromString(String(r.id));
    orders.set(id, {
      id,
      cartId: uuidFromString(String(r.cart_id)),
      customerId: uuidOrNull(r.customer_id),
      idempotencyKey: String(r.idempotency_key),
      lines: (r.lines as Array<Omit<OrderLine, "productId"> & { productId: string }>).map((line) => ({
        productId: uuidFromString(line.productId),
        name: line.name,
        quantity: Number(line.quantity),
        unitPriceCents: Number(line.unitPriceCents),
        lineTotalCents: Number(line.lineTotalCents),
      })),
      grossCents: Number(r.gross_cents),
      discountCents: Number(r.discount_cents),
      netCents: Number(r.net_cents),
      couponCode: r.coupon_code === null ? null : String(r.coupon_code),
      placedAt: iso(r.placed_at),
    });
  }

  const coupons = new Map<string, Coupon>();
  for (const r of list("coupons")) {
    const code = String(r.code);
    coupons.set(code, {
      code,
      source: r.source as CouponSource,
      customerId: uuidOrNull(r.customer_id),
      earnedByCustomerId: uuidOrNull(r.earned_by_customer_id),
      milestone: r.milestone === null ? null : Number(r.milestone),
      percentOff: Number(r.percent_off),
      status: r.status as CouponStatus,
      redeemedOrderId: uuidOrNull(r.redeemed_order_id),
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
    });
  }

  const idempotency = new Map<string, IdempotencyRecord>();
  for (const r of list("idempotency_keys")) {
    idempotency.set(String(r.key), {
      cartId: uuidFromString(String(r.cart_id)),
      orderId: uuidFromString(String(r.order_id)),
    });
  }

  return { products, carts, orders, coupons, customers, idempotency, config: storeConfig };
}

export type Snapshot = Map<string, Map<string, string>>;

export function snapshot(state: StoreState | null): Snapshot {
  const result: Snapshot = new Map();
  for (const spec of tables) {
    const rows = new Map<string, string>();
    if (state) {
      for (const [key, row] of spec.rows(state)) rows.set(key, JSON.stringify(row));
    }
    result.set(spec.table, rows);
  }
  return result;
}

export type Statement = { text: string; values: unknown[] };

/** The upserts and deletes that turn `before` into `after`. */
export function changeStatements(schema: string, before: Snapshot, after: StoreState): Statement[] {
  const statements: Statement[] = [];
  for (const spec of tables) {
    const previous = before.get(spec.table) ?? new Map<string, string>();
    const current = spec.rows(after);
    const changed: Row[] = [];
    for (const [key, row] of current) {
      if (previous.get(key) !== JSON.stringify(row)) changed.push(row);
    }
    const removed = [...previous.keys()].filter((key) => !current.has(key));

    if (changed.length > 0) statements.push({ text: upsertSql(schema, spec), values: [JSON.stringify(changed)] });
    if (removed.length > 0) {
      statements.push({
        text: `DELETE FROM ${schema}.${spec.table} WHERE ${spec.key} = ANY($1::${spec.keyType}[])`,
        values: [removed],
      });
    }
  }
  return statements;
}

function upsertSql(schema: string, spec: TableSpec): string {
  const names = spec.columns.map(([name]) => name);
  const definitions = spec.columns.map(([name, type]) => `${name} ${type}`).join(", ");
  const updates = names
    .filter((name) => name !== spec.key)
    .map((name) => `${name} = EXCLUDED.${name}`)
    .join(", ");
  return `INSERT INTO ${schema}.${spec.table} (${names.join(", ")})
SELECT ${names.join(", ")}
FROM ROWS FROM (jsonb_to_recordset($1::jsonb) AS (${definitions})) WITH ORDINALITY AS r (${names.join(", ")}, ord)
ORDER BY ord
ON CONFLICT (${spec.key}) DO UPDATE SET ${updates}`;
}
