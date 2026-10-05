import { useLoaderData } from "react-router";
import { api, unwrap } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import { formatUsd } from "../../lib/money";
import type { CustomerRewardSummary, Order } from "../../types";

export async function ordersLoader() {
  const [orders, customers] = await Promise.all([api.orders(), api.customers()]);
  return { orders: unwrap(orders).items, customers: unwrap(customers).items };
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function OrdersRoute() {
  const { orders, customers } = useLoaderData() as { orders: Order[]; customers: CustomerRewardSummary[] };
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const sorted = [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const withCoupon = orders.filter((order) => order.couponCode).length;
  const net = orders.reduce((sum, order) => sum + order.netCents, 0);
  const average = orders.length > 0 ? Math.round(net / orders.length) : 0;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Orders</h1>
          <p>Every successfully placed order. Each line keeps the price that was charged at checkout.</p>
        </div>
      </div>

      <div className="admin-stats admin-stats--3">
        <StatCard icon="receipt" label="Total orders" value={String(orders.length)} />
        <StatCard icon="chart" label="Average order value" value={formatUsd(average)} />
        <StatCard icon="gift" label="Orders with a coupon" value={String(withCoupon)} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon="receipt" title="No orders yet" message="Orders placed from the storefront will appear here." />
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th><th>Placed</th><th>Customer</th><th>Items</th>
                  <th className="num">Gross</th><th className="num">Discount</th><th className="num">Net</th><th>Coupon</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => (
                  <tr key={order.id}>
                    <td><span className="code-pill">#{order.id.slice(0, 8).toUpperCase()}</span></td>
                    <td className="muted">{dateFormat.format(new Date(order.placedAt))}</td>
                    <td>
                      {order.customerId
                        ? <strong>{customerNames.get(order.customerId) ?? `${order.customerId.slice(0, 8)}…`}</strong>
                        : <span className="badge badge--neutral">Guest / API</span>}
                    </td>
                    <td>{order.lines.reduce((sum, line) => sum + line.quantity, 0)}</td>
                    <td className="num">{formatUsd(order.grossCents)}</td>
                    <td className="num">{order.discountCents > 0 ? `−${formatUsd(order.discountCents)}` : "—"}</td>
                    <td className="num"><strong>{formatUsd(order.netCents)}</strong></td>
                    <td>{order.couponCode ? <span className="badge badge--success">{order.couponCode}</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
