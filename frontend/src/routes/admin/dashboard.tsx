import { Form, Link, useLoaderData } from "react-router";
import { api, unwrap } from "../../lib/api";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { StatCard } from "../../components/ui/StatCard";
import { formatUsd } from "../../lib/money";
import type { CustomerRewardSummary, SalesReport, StoreConfig } from "../../types";
import { aggregateOrders, type ReportGroup, type ReportPeriod } from "./reporting";

export async function dashboardLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get("from") ?? `${today.slice(0, 4)}-01-01`;
  const to = url.searchParams.get("to") ?? today;
  const requestedGroup = url.searchParams.get("group");
  const group: ReportGroup = requestedGroup === "day" || requestedGroup === "week" ? requestedGroup : "month";
  const [report, config, orders, customers] = await Promise.all([api.report(), api.config(), api.orders(), api.customers()]);
  const selected = unwrap(orders).items.filter(
    (order) => order.placedAt.slice(0, 10) >= from && order.placedAt.slice(0, 10) <= to,
  );
  return {
    report: unwrap(report),
    config: unwrap(config),
    customers: unwrap(customers).items,
    from,
    to,
    group,
    periods: aggregateOrders(selected, group),
    selectedOrders: selected.length,
  };
}

export function DashboardRoute() {
  const { report, config, customers, from, to, group, periods, selectedOrders } = useLoaderData() as {
    report: SalesReport;
    config: StoreConfig;
    customers: CustomerRewardSummary[];
    from: string;
    to: string;
    group: ReportGroup;
    periods: ReportPeriod[];
    selectedOrders: number;
  };
  const max = Math.max(1, ...periods.map((period) => period.netCents));
  const topProducts = [...report.purchasedQuantityByProduct].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const topMax = Math.max(1, ...topProducts.map((product) => product.quantity));
  const readyCustomers = customers.filter((customer) => customer.eligibleMilestone !== null).length;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Dashboard</h1>
          <p>Sales, discounts, and reward activity across every successfully placed order.</p>
        </div>
      </div>

      <div className="admin-stats">
        <StatCard icon="receipt" label="Orders placed" value={String(report.successfullyPlacedOrders)} />
        <StatCard icon="chart" label="Gross revenue" value={formatUsd(report.grossRevenueCents)} />
        <StatCard icon="tag" label="Discounts given" value={formatUsd(report.totalDiscountsCents)} />
        <StatCard icon="box" label="Net revenue" value={formatUsd(report.netRevenueCents)} />
      </div>

      <div className="admin-grid">
        <section className="card">
          <div className="card__header">
            <h2>Purchases over time</h2>
            <span className="muted small">{selectedOrders} order{selectedOrders === 1 ? "" : "s"} in range</span>
          </div>
          <div className="card__body" style={{ display: "grid", gap: 24 }}>
            <Form method="get" className="report-filters">
              <label className="field">
                <span className="field__label">From</span>
                <input className="input input--sm" type="date" name="from" defaultValue={from} />
              </label>
              <label className="field">
                <span className="field__label">To</span>
                <input className="input input--sm" type="date" name="to" defaultValue={to} />
              </label>
              <label className="field">
                <span className="field__label">Group by</span>
                <select className="select input--sm" name="group" defaultValue={group}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </label>
              <button className="btn btn--primary btn--sm" type="submit">Apply</button>
            </Form>
            {periods.length === 0 ? (
              <EmptyState icon="chart" title="No purchases in this range" message="Try a wider date range or place an order from the storefront." />
            ) : (
              <div className="chart">
                {periods.map((period) => (
                  <div className="chart-row" key={period.label}>
                    <span className="chart-row__label">
                      {period.label}
                      <small>{period.orders} orders · {period.units} units</small>
                    </span>
                    <div className="chart-row__track">
                      <div className="chart-row__fill" style={{ width: `${(period.netCents / max) * 100}%` }} />
                    </div>
                    <span className="chart-row__value">{formatUsd(period.netCents)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div style={{ display: "grid", gap: 24 }}>
          <section className="card">
            <div className="card__header">
              <h2>Reward program</h2>
              <Link to="/admin/coupons" className="btn btn--outline btn--sm">Configure</Link>
            </div>
            <div className="card__body">
              <dl className="detail-list">
                <div><dt>Coupon milestone</dt><dd>Every {config.everyNthOrder} orders per customer</dd></div>
                <div><dt>Discount</dt><dd>{config.discountPercent}% off</dd></div>
                <div><dt>Registered customers</dt><dd>{customers.length}</dd></div>
                <div><dt>Customers ready for a coupon</dt><dd>{readyCustomers}</dd></div>
                <div><dt>Coupons total</dt><dd>{report.coupons.generated}</dd></div>
                <div><dt>Available / paused / redeemed</dt><dd>{report.coupons.available} / {report.coupons.disabled} / {report.coupons.redeemed}</dd></div>
              </dl>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <h2>Top products</h2>
              <Icon name="sparkle" size={18} />
            </div>
            <div className="card__body">
              {topProducts.length === 0 ? (
                <p className="muted">No products sold yet.</p>
              ) : (
                <ol className="rank-list">
                  {topProducts.map((product, index) => (
                    <li key={product.productId}>
                      <span className="rank-list__pos">{index + 1}</span>
                      <span className="rank-list__name">{product.name}</span>
                      <strong>{product.quantity} sold</strong>
                      <span className="rank-list__bar"><span style={{ width: `${(product.quantity / topMax) * 100}%` }} /></span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
