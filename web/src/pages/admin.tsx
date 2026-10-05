import { Form, NavLink, Outlet, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { api, unwrap } from "../api";
import { formatUsd } from "../money";
import type { Coupon, Order, Product, SalesReport, StoreConfig } from "../types";

export async function adminLayoutLoader() {
  const session = await api.session();
  if (!session.ok || !session.data.signedIn) {
    return redirect("/admin/sign-in");
  }
  return { email: session.data.email ?? "admin" };
}

export async function adminLayoutAction({ request }: { request: Request }) {
  const form = await request.formData();
  if (form.get("intent") === "sign-out") {
    await api.signOut();
    return redirect("/admin/sign-in");
  }
  return null;
}

export function AdminShell() {
  const { email } = useLoaderData() as { email: string };

  return (
    <div className="admin">
      <aside className="sidebar">
        <strong className="wordmark" style={{ fontSize: 22, justifySelf: "start" }}>SleepyHug</strong>
        <p className="note">{email}</p>
        <NavLink to="/admin" end>Home</NavLink>
        <NavLink to="/admin/products">Products</NavLink>
        <NavLink to="/admin/orders">Orders</NavLink>
        <NavLink to="/admin/inventory">Inventory</NavLink>
        <NavLink to="/admin/coupons">Coupons</NavLink>
        <NavLink to="/">View shop</NavLink>
        <Form method="post" action="/admin">
          <button className="btn-ghost" type="submit" name="intent" value="sign-out">Sign out</button>
        </Form>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}

export async function dashboardLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get("from") ?? `${today.slice(0, 4)}-01-01`;
  const to = url.searchParams.get("to") ?? today;
  const group = url.searchParams.get("group") === "day" || url.searchParams.get("group") === "week"
    ? url.searchParams.get("group") as "day" | "week"
    : "month";
  const [report, config, orders] = await Promise.all([api.report(), api.config(), api.orders()]);
  const allOrders = unwrap(orders).items;
  const selected = allOrders.filter((order) => order.placedAt.slice(0, 10) >= from && order.placedAt.slice(0, 10) <= to);
  const periods = aggregateOrders(selected, group);
  return { report: unwrap(report), config: unwrap(config), from, to, group, periods, selectedOrders: selected.length };
}

export function DashboardPage() {
  const { report, config, from, to, group, periods, selectedOrders } = useLoaderData() as {
    report: SalesReport;
    config: StoreConfig;
    from: string;
    to: string;
    group: "day" | "week" | "month";
    periods: Array<{ label: string; orders: number; units: number; netCents: number }>;
    selectedOrders: number;
  };
  const max = Math.max(1, ...periods.map((period) => period.netCents));
  return (
    <section>
      <p className="eyebrow">Home</p>
      <h1>Store</h1>
      <p className="note">Every {config.everyNthOrder} successful orders, you can generate one {config.discountPercent}% coupon.</p>
      <div className="stats">
        <Stat label="Orders" value={String(report.successfullyPlacedOrders)} />
        <Stat label="Gross" value={formatUsd(report.grossRevenueCents)} />
        <Stat label="Discounts" value={formatUsd(report.totalDiscountsCents)} />
        <Stat label="Net" value={formatUsd(report.netRevenueCents)} />
      </div>
      <div className="panel">
        <h2>Purchases over time</h2>
        <form method="get" className="report-filters">
          <label className="field">From<input type="date" name="from" defaultValue={from} /></label>
          <label className="field">To<input type="date" name="to" defaultValue={to} /></label>
          <label className="field">Group
            <select name="group" defaultValue={group}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <button className="btn" type="submit">Apply</button>
        </form>
        <p className="note">{selectedOrders} orders in the selected range.</p>
        {periods.length === 0 ? <p className="note">No purchases in this range.</p> : (
          <div className="bars">
            {periods.map((period) => (
              <div className="bar-row" key={period.label}>
                <span>{period.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(period.netCents / max) * 100}%` }} /></div>
                <strong>{formatUsd(period.netCents)}</strong>
                <small>{period.orders} orders · {period.units} units</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export async function productsLoader() {
  return { products: unwrap(await api.products()).items };
}

export async function productsAction({ request }: { request: Request }) {
  const form = await request.formData();
  const productId = String(form.get("productId") ?? "");
  const unitPriceCents = Math.round(Number(form.get("price")) * 100);
  const response = await api.updateProduct(productId, { unitPriceCents });
  return response.ok ? { ok: true } : { error: response.error.message };
}

export function ProductsPage() {
  const { products } = useLoaderData() as { products: Product[] };
  const actionData = useActionData() as { error?: string; ok?: boolean } | undefined;
  return (
    <section>
      <h1>Products</h1>
      <p className="note">Product names and IDs are stable in this exercise. Prices can be changed here; existing orders keep their original snapshots.</p>
      {actionData?.ok ? <p className="ok">Product updated.</p> : null}
      {actionData?.error ? <p className="error">{actionData.error}</p> : null}
      <table>
        <thead><tr><th>Product</th><th>ID</th><th>Price</th><th></th></tr></thead>
        <tbody>{products.map((product) => (
          <tr key={product.id}>
            <td>{product.name}</td><td>{product.id}</td>
            <td colSpan={2}>
              <Form method="post" className="qty">
                <input type="hidden" name="productId" value={product.id} />
                <input name="price" type="number" min="0" step="0.01" defaultValue={(product.unitPriceCents / 100).toFixed(2)} />
                <button className="btn">Save</button>
              </Form>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}

export async function ordersLoader() {
  return { orders: unwrap(await api.orders()).items };
}

export function OrdersPage() {
  const { orders } = useLoaderData() as { orders: Order[] };
  return (
    <section>
      <h1>Orders</h1>
      {orders.length === 0 ? <p className="note">No orders yet.</p> : (
        <table>
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Gross</th><th>Discount</th><th>Net</th><th>Coupon</th></tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.customerId ?? "Guest/API"}</td>
                <td>{formatUsd(order.grossCents)}</td>
                <td>{formatUsd(order.discountCents)}</td>
                <td>{formatUsd(order.netCents)}</td>
                <td>{order.couponCode ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export async function inventoryLoader() {
  return { products: unwrap(await api.products()).items };
}

export async function inventoryAction({ request }: { request: Request }) {
  const form = await request.formData();
  const productId = String(form.get("productId") ?? "");
  const availableQuantity = Number(form.get("availableQuantity"));
  const updated = await api.updateProduct(productId, { availableQuantity });
  return updated.ok ? { ok: true } : { error: updated.error.message };
}

export function InventoryPage() {
  const { products } = useLoaderData() as { products: Product[] };
  const actionData = useActionData() as { error?: string; ok?: boolean } | undefined;
  const navigation = useNavigation();
  return (
    <section>
      <h1>Inventory</h1>
      <p className="note">Stock is checked again at checkout. Lowering it here can make an open cart fail instead of overselling.</p>
      {actionData?.error ? <p className="error">{actionData.error}</p> : null}
      {actionData?.ok ? <p className="ok">Inventory updated.</p> : null}
      <table>
        <thead>
          <tr><th>Product</th><th>Price</th><th>Available</th><th></th></tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{formatUsd(product.unitPriceCents)}</td>
              <td colSpan={2}>
                <Form method="post" className="qty">
                  <input type="hidden" name="productId" value={product.id} />
                  <input name="availableQuantity" type="number" min={0} defaultValue={product.availableQuantity} />
                  <button className="btn" type="submit" disabled={navigation.state !== "idle"}>Save</button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export async function couponsLoader() {
  const [coupons, config] = await Promise.all([api.coupons(), api.config()]);
  return { coupons: unwrap(coupons).items, config: unwrap(config) };
}

export async function couponsAction() {
  const result = await api.generateCoupon();
  return result.ok ? { code: result.data.code } : { error: result.error.message };
}

export function CouponsPage() {
  const { coupons, config } = useLoaderData() as { coupons: Coupon[]; config: StoreConfig };
  const actionData = useActionData() as { error?: string; code?: string } | undefined;
  const navigation = useNavigation();
  return (
    <section>
      <h1>Coupons</h1>
      <p className="note">Every {config.everyNthOrder} successful orders unlocks the next {config.discountPercent}% code. Generating it does not apply the discount. A shopper enters the code at checkout.</p>
      <Form method="post">
        <button className="btn" type="submit" disabled={navigation.state !== "idle"}>
          {navigation.state !== "idle" ? "Generating…" : "Generate next coupon"}
        </button>
      </Form>
      {actionData?.code ? <p className="ok">Generated {actionData.code}. Use it at checkout.</p> : null}
      {actionData?.error ? <p className="error">{actionData.error}</p> : null}
      {coupons.length === 0 ? <p className="note">None yet.</p> : (
        <table>
          <thead>
            <tr><th>Code</th><th>Customer</th><th>Milestone</th><th>Off</th><th>Status</th></tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.code}>
                <td>{coupon.code}</td>
                <td>{coupon.customerId ?? "Global/API"}</td>
                <td>{coupon.milestone}</td>
                <td>{coupon.percentOff}%</td>
                <td>{coupon.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function aggregateOrders(orders: Order[], group: "day" | "week" | "month") {
  const rows = new Map<string, { label: string; orders: number; units: number; netCents: number }>();
  for (const order of orders) {
    const date = new Date(order.placedAt);
    const label = group === "day"
      ? order.placedAt.slice(0, 10)
      : group === "month"
        ? order.placedAt.slice(0, 7)
        : weekLabel(date);
    const row = rows.get(label) ?? { label, orders: 0, units: 0, netCents: 0 };
    row.orders += 1;
    row.units += order.lines.reduce((sum, line) => sum + line.quantity, 0);
    row.netCents += order.netCents;
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function weekLabel(date: Date): string {
  const day = (date.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
  return `Week of ${monday.toISOString().slice(0, 10)}`;
}
