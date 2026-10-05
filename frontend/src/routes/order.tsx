import { Link, useLoaderData } from "react-router";
import { ProductImage } from "../components/store/ProductImage";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { api, unwrap } from "../lib/api";
import { formatUsd } from "../lib/money";
import type { Order } from "../types";
import { uuidFromString } from "../typeDefinitions";

export async function orderLoader({ params }: { params: { orderId?: string } }) {
  return unwrap(await api.getOrder(uuidFromString(params.orderId ?? "")));
}

export function OrderPage() {
  const order = useLoaderData() as Order;
  const placed = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.placedAt));
  const units = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <PageHeader title="Order confirmed" breadcrumb={[{ label: "Home", to: "/" }, { label: "My orders", to: "/account" }, { label: "Order" }]} />
      <div className="container section receipt">
        <section className="card receipt__hero">
          <span className="receipt__check"><Icon name="check" size={32} strokeWidth={2.5} /></span>
          <h1>Thank you for your order!</h1>
          <p>Your payment was successful and your order has been placed.</p>
          <div className="receipt__meta">
            <div className="meta-item"><span>Order number</span><strong className="mono">{order.id.slice(0, 8).toUpperCase()}</strong></div>
            <div className="meta-item"><span>Date</span><strong>{placed}</strong></div>
            <div className="meta-item"><span>Total</span><strong>{formatUsd(order.netCents)}</strong></div>
            <div className="meta-item"><span>Payment</span><strong><span className="badge badge--success">Paid</span></strong></div>
          </div>
        </section>

        <section className="card">
          <div className="card__header"><h2>Order details</h2><span className="muted small">{units} item{units === 1 ? "" : "s"}</span></div>
          <table className="data-table responsive-table receipt__lines">
            <thead>
              <tr><th>Product</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.productId}>
                  <td>
                    <div className="cart-product">
                      <ProductImage productId={line.productId} name={line.name} size="thumb" />
                      <span className="cart-product__name">{line.name}</span>
                    </div>
                  </td>
                  <td className="num">{formatUsd(line.unitPriceCents)}</td>
                  <td className="num">× {line.quantity}</td>
                  <td className="num"><strong>{formatUsd(line.lineTotalCents)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="receipt__totals">
            <div className="summary-row"><span>Subtotal</span><span>{formatUsd(order.grossCents)}</span></div>
            <div className="summary-row"><span>Shipping</span><span>Free</span></div>
            <div className={`summary-row${order.discountCents > 0 ? " summary-row--discount" : ""}`}>
              <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
              <span>{order.discountCents > 0 ? `−${formatUsd(order.discountCents)}` : formatUsd(0)}</span>
            </div>
            <div className="summary-row summary-row--total"><span>Total paid</span><strong>{formatUsd(order.netCents)}</strong></div>
          </div>
        </section>

        <p className="muted small" style={{ textAlign: "center" }}>
          Prices on this receipt are frozen at the moment of purchase. Reference <span className="mono">{order.id}</span>
        </p>
        <div className="receipt__actions">
          <Link to="/account" className="btn btn--outline">View my orders</Link>
          <Link to="/products" className="btn btn--primary">Continue shopping</Link>
        </div>
      </div>
    </>
  );
}
