import { Form, Link, redirect, useLoaderData } from "react-router";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { api, unwrap } from "../lib/api";
import { formatUsd } from "../lib/money";
import { safeRedirectPath, signInPath } from "../lib/redirect";
import type { Coupon, CouponStatus, Customer, Order, RewardProgress } from "../types";

export async function accountLoader() {
  const session = await api.customerSession();
  if (!session.ok || !session.data.signedIn || !session.data.customer) return redirect(signInPath("/account"));
  const [orders, coupons, rewards] = await Promise.all([api.customerOrders(), api.customerCoupons(), api.customerRewards()]);
  return {
    customer: session.data.customer,
    orders: unwrap(orders).items,
    coupons: unwrap(coupons).items,
    rewards: unwrap(rewards),
  };
}

export async function accountAction({ request }: { request: Request }) {
  const form = await request.formData();
  await api.customerSignOut();
  const redirectTo = safeRedirectPath(form.get("redirectTo"), "/");
  return redirect(redirectTo.startsWith("/account") || redirectTo.startsWith("/checkout") ? "/" : redirectTo);
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const couponBadge: Record<CouponStatus, { label: string; tone: string }> = {
  available: { label: "Available", tone: "badge--success" },
  disabled: { label: "Paused by store", tone: "badge--warning" },
  redeemed: { label: "Redeemed", tone: "badge--neutral" },
};

export function AccountPage() {
  const { customer, orders, coupons, rewards } = useLoaderData() as {
    customer: Customer;
    orders: Order[];
    coupons: Coupon[];
    rewards: RewardProgress;
  };
  const progress = rewards.eligibleMilestone !== null
    ? 100
    : ((rewards.everyNthOrder - rewards.ordersUntilNextMilestone) / rewards.everyNthOrder) * 100;
  const sortedOrders = [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const spent = orders.reduce((sum, order) => sum + order.netCents, 0);
  const saved = orders.reduce((sum, order) => sum + order.discountCents, 0);
  const available = coupons.filter((coupon) => coupon.status === "available");

  return (
    <>
      <PageHeader title="My account" breadcrumb={[{ label: "Home", to: "/" }, { label: "My account" }]} />
      <div className="container section account-layout">
        <aside className="card account-sidebar">
          <div className="customer-box">
            <span className="avatar">{customer.name.slice(0, 1)}</span>
            <div>
              <strong>{customer.name}</strong>
              <span className="muted small">{customer.email}</span>
            </div>
          </div>
          <nav className="account-nav">
            <a href="#orders"><Icon name="receipt" size={18} />Order history</a>
            <a href="#coupons"><Icon name="gift" size={18} />My coupons</a>
            <Link to="/wishlist"><Icon name="heart" size={18} />Wishlist</Link>
            <Link to="/cart"><Icon name="cart" size={18} />Cart</Link>
          </nav>
          <Form method="post">
            <button className="btn btn--outline btn--block" type="submit"><Icon name="logout" size={18} />Sign out</button>
          </Form>
        </aside>

        <div className="account-content">
          <div className="stats-grid">
            <StatCard icon="receipt" label="Orders placed" value={String(orders.length)} />
            <StatCard icon="chart" label="Total spent" value={formatUsd(spent)} hint={saved > 0 ? `You saved ${formatUsd(saved)}` : undefined} />
            <StatCard icon="gift" label="Coupons available" value={String(available.length)} />
          </div>

          <section className="card reward-progress">
            <div className="card__body">
              <div className="reward-progress__head">
                <span className="usp__icon"><Icon name="gift" size={22} /></span>
                <div>
                  <h2>Your rewards</h2>
                  <p className="muted">
                    Every {rewards.everyNthOrder} order{rewards.everyNthOrder === 1 ? "" : "s"} you place earns a {rewards.discountPercent}% coupon.
                  </p>
                </div>
              </div>
              <div className="reward-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Progress to your next reward">
                <div className="reward-progress__fill" style={{ clipPath: `inset(0 ${100 - progress}% 0 0 round 999px)` }} />
              </div>
              <p className="reward-progress__note">
                {rewards.eligibleMilestone !== null
                  ? `You reached order #${rewards.eligibleMilestone}! Your coupon will appear below as soon as the store issues it.`
                  : `${rewards.ordersPlaced} order${rewards.ordersPlaced === 1 ? "" : "s"} placed · ${rewards.ordersUntilNextMilestone} more until your next coupon.`}
              </p>
            </div>
          </section>

          <section className="card" id="orders">
            <div className="card__header"><h2>Order history</h2></div>
            {sortedOrders.length === 0 ? (
              <div className="card__body">
                <EmptyState icon="receipt" title="No orders yet" message="When you place an order it will appear here with its receipt." action={<Link className="btn btn--primary" to="/products">Start shopping</Link>} />
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table responsive-table">
                  <thead>
                    <tr><th>Order</th><th>Date</th><th>Items</th><th className="num">Total</th><th><span className="sr-only">View</span></th></tr>
                  </thead>
                  <tbody>
                    {sortedOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong className="mono">#{order.id.slice(0, 8).toUpperCase()}</strong>
                          {order.couponCode ? <div><span className="badge badge--success">{order.couponCode}</span></div> : null}
                        </td>
                        <td>{dateFormat.format(new Date(order.placedAt))}</td>
                        <td>{order.lines.reduce((sum, line) => sum + line.quantity, 0)}</td>
                        <td className="num"><strong>{formatUsd(order.netCents)}</strong></td>
                        <td className="num"><Link to={`/orders/${order.id}`} className="btn btn--outline btn--sm">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card" id="coupons">
            <div className="card__header">
              <h2>My coupons</h2>
              <span className="muted small">{available.length} available</span>
            </div>
            {coupons.length === 0 ? (
              <div className="card__body">
                <EmptyState icon="gift" title="No coupons yet" message="Coupons you earn from your orders, or receive from the store, appear here." />
              </div>
            ) : (
              <div className="coupon-grid">
                {coupons.map((coupon) => (
                  <div className={`coupon-card${coupon.status !== "available" ? " coupon-card--redeemed" : ""}`} key={coupon.code}>
                    <span className={`badge ${couponBadge[coupon.status].tone}`}>{couponBadge[coupon.status].label}</span>
                    <span className="coupon-card__percent">{coupon.percentOff}% off</span>
                    <span className="coupon-card__code">{coupon.code}</span>
                    <span className="muted small">
                      {coupon.source === "milestone" && coupon.milestone !== null
                        ? `Earned on your order #${coupon.milestone}`
                        : "A gift from the store"}
                    </span>
                    {coupon.status === "available" ? <Link to="/checkout" className="text-link small">Use at checkout <Icon name="arrowRight" size={14} /></Link> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
