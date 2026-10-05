import { Link, useLoaderData } from "react-router";
import { api, unwrap } from "../api";
import { formatUsd } from "../money";
import type { Order } from "../types";

export async function orderLoader({ params }: { params: { orderId?: string } }) {
  return unwrap(await api.getOrder(params.orderId ?? ""));
}

export function OrderPage() {
  const order = useLoaderData() as Order;
  const placed = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.placedAt));

  return (
    <section className="summary" style={{ maxWidth: 640 }}>
      <p className="eyebrow">Order confirmed</p>
      <h1>Thank you</h1>
      <p className="note">{order.id} · {placed} · Paid</p>
      {order.lines.map((line) => (
        <div className="line" key={line.productId}>
          <span>{line.name} × {line.quantity}<br /><small className="note">{formatUsd(line.unitPriceCents)} each</small></span>
          <span>{formatUsd(line.lineTotalCents)}</span>
        </div>
      ))}
      <div className="total-row"><span>Subtotal</span><span>{formatUsd(order.grossCents)}</span></div>
      <div className="total-row"><span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span><span>{formatUsd(order.discountCents)}</span></div>
      <div className="total-row due"><span>Total</span><strong>{formatUsd(order.netCents)}</strong></div>
      <p><Link to="/">Continue shopping</Link></p>
    </section>
  );
}
