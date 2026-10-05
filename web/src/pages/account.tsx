import { Form, Link, redirect, useLoaderData } from "react-router";
import { api, unwrap } from "../api";
import { formatUsd } from "../money";
import type { Coupon, Customer, Order } from "../types";

export async function accountLoader() {
  const session = await api.customerSession();
  if (!session.ok || !session.data.signedIn || !session.data.customer) return redirect("/sign-in");
  const [orders, coupons] = await Promise.all([api.customerOrders(), api.customerCoupons()]);
  return {
    customer: session.data.customer,
    orders: unwrap(orders).items,
    coupons: unwrap(coupons).items,
  };
}

export async function accountAction() {
  await api.customerSignOut();
  return redirect("/");
}

export function AccountPage() {
  const { customer, orders, coupons } = useLoaderData() as {
    customer: Customer;
    orders: Order[];
    coupons: Coupon[];
  };
  return (
    <section>
      <div className="hero">
        <p className="eyebrow">My account</p>
        <h1>Hello, {customer.name}</h1>
        <p>{customer.email}</p>
        <Form method="post"><button className="btn-ghost">Sign out</button></Form>
      </div>
      <div className="layout">
        <div>
          <h2>Your orders</h2>
          {orders.length === 0 ? <p className="note">No orders yet. <Link to="/">Start shopping</Link>.</p> : orders.map((order) => (
            <Link className="line text-link" key={order.id} to={`/orders/${order.id}`}>
              <span><strong>{order.id}</strong><br /><small>{new Date(order.placedAt).toLocaleString()}</small></span>
              <span>{formatUsd(order.netCents)}</span>
            </Link>
          ))}
        </div>
        <aside className="summary">
          <h2>Your coupons</h2>
          {coupons.length === 0 ? (
            <p className="note">When your purchase is the store’s 5th, 10th, 15th… order, admin can issue the earned coupon here.</p>
          ) : coupons.map((coupon) => (
            <div className="line" key={coupon.code}>
              <span><strong>{coupon.code}</strong><br /><small>{coupon.percentOff}% off</small></span>
              <span>{coupon.status}</span>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
