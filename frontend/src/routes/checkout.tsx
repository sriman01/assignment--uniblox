import { useState } from "react";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation, useRouteLoaderData } from "react-router";
import type { StoreData } from "../components/layout/StoreShell";
import { ProductImage } from "../components/store/ProductImage";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { api } from "../lib/api";
import { formatUsd } from "../lib/money";
import { signInPath } from "../lib/redirect";
import { checkoutIdempotencyKey, clearCartId, clearCheckoutIdempotencyKey, readCartId } from "../lib/storage";
import type { Coupon, Customer } from "../types";

export async function checkoutLoader() {
  const session = await api.customerSession();
  if (!session.ok || !session.data.signedIn || !session.data.customer) {
    return redirect(signInPath("/checkout"));
  }
  const coupons = await api.customerCoupons();
  return {
    customer: session.data.customer,
    coupons: coupons.ok ? coupons.data.items.filter((coupon) => coupon.status === "available") : [],
  };
}

export async function checkoutAction({ request }: { request: Request }) {
  const cartId = readCartId();
  if (!cartId) {
    return { error: "Your cart is empty." };
  }
  const form = await request.formData();
  const couponCode = String(form.get("couponCode") ?? "").trim();
  const key = checkoutIdempotencyKey(cartId);
  const result = await api.checkout(cartId, key, couponCode);
  if (!result.ok && result.error.code === "CART_ALREADY_CHECKED_OUT") {
    const orderId = result.error.details?.orderId;
    clearCheckoutIdempotencyKey(cartId);
    clearCartId();
    if (typeof orderId === "string" && orderId) {
      return redirect(`/orders/${orderId}`);
    }
  }
  if (!result.ok) {
    return { error: result.error.message };
  }
  clearCheckoutIdempotencyKey(cartId);
  clearCartId();
  return redirect(`/orders/${result.data.id}`);
}

export function CheckoutPage() {
  const { customer, coupons } = useLoaderData() as { customer: Customer; coupons: Coupon[] };
  const store = useRouteLoaderData("store") as StoreData;
  const cart = store.cart?.status === "open" ? store.cart : null;
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();
  const [couponCode, setCouponCode] = useState("");
  const submitting = navigation.state === "submitting";

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <PageHeader title="Checkout" breadcrumb={[{ label: "Home", to: "/" }, { label: "Checkout" }]} />
        <div className="container section">
          <EmptyState
            icon="cart"
            title="Nothing to check out"
            message="Your cart is empty. Add a few things and come back here to place your order."
            action={<Link className="btn btn--primary" to="/products">Shop products</Link>}
          />
        </div>
      </>
    );
  }

  const normalized = couponCode.trim().toUpperCase();
  const matched = coupons.find((coupon) => coupon.code === normalized);
  const estimatedDiscount = matched ? Math.floor((cart.grossCents * matched.percentOff) / 100) : 0;
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <PageHeader
        title="Checkout"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Cart", to: "/cart" }, { label: "Checkout" }]}
        description="Review your order and apply a coupon. Placing the order completes payment."
      />
      <Form method="post" className="container section checkout-layout">
        <div>
          <section className="card checkout-step">
            <div className="card__header"><span className="step-number">1</span><h2>Customer</h2></div>
            <div className="card__body customer-box">
              <span className="avatar">{customer.name.slice(0, 1)}</span>
              <div>
                <strong>{customer.name}</strong>
                <span className="muted">{customer.email}</span>
              </div>
            </div>
          </section>

          <section className="card checkout-step">
            <div className="card__header"><span className="step-number">2</span><h2>Items ({count})</h2></div>
            <div className="card__body">
              <ul className="checkout-items">
                {cart.items.map((item) => (
                  <li key={item.productId}>
                    <ProductImage productId={item.productId} name={item.name} size="thumb" />
                    <div className="checkout-items__name">
                      <strong>{item.name}</strong>
                      <span className="muted small">{item.quantity} × {formatUsd(item.unitPriceCents)}</span>
                    </div>
                    <strong>{formatUsd(item.lineTotalCents)}</strong>
                  </li>
                ))}
              </ul>
              <Link to="/cart" className="text-link small">Edit cart</Link>
            </div>
          </section>

          <section className="card checkout-step">
            <div className="card__header"><span className="step-number">3</span><h2>Coupon</h2></div>
            <div className="card__body">
              {coupons.length > 0 ? (
                <>
                  <p className="muted small" style={{ marginBottom: 10 }}>Your available coupons</p>
                  <div className="coupon-options">
                    {coupons.map((coupon) => (
                      <button
                        type="button"
                        key={coupon.code}
                        className={`coupon-chip${normalized === coupon.code ? " is-selected" : ""}`}
                        onClick={() => setCouponCode(normalized === coupon.code ? "" : coupon.code)}
                        aria-pressed={normalized === coupon.code}
                      >
                        <Icon name="tag" size={16} />{coupon.code} · {coupon.percentOff}% off
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted small" style={{ marginBottom: 12 }}>You have no coupons yet. Milestone orders earn them.</p>
              )}
              <label className="field" htmlFor="couponCode" style={{ marginBottom: 0 }}>
                <span className="field__label">Coupon code</span>
                <div className="coupon-input">
                  <input
                    id="couponCode"
                    name="couponCode"
                    className="input"
                    placeholder="e.g. MILESTONE-5"
                    autoComplete="off"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                  />
                  {couponCode ? (
                    <button type="button" className="btn btn--outline" onClick={() => setCouponCode("")}>Clear</button>
                  ) : null}
                </div>
                <span className="field__hint">The discount is validated when you place the order.</span>
              </label>
            </div>
          </section>
        </div>

        <aside className="card order-summary">
          <h2>Payment summary</h2>
          <div className="summary-row"><span>Subtotal</span><span>{formatUsd(cart.grossCents)}</span></div>
          <div className="summary-row"><span>Shipping</span><span className="badge badge--success">Free</span></div>
          {matched ? (
            <div className="summary-row summary-row--discount">
              <span>Discount ({matched.code}, est.)</span><span>−{formatUsd(estimatedDiscount)}</span>
            </div>
          ) : normalized ? (
            <div className="summary-row"><span>Coupon {normalized}</span><span className="muted">Checked on order</span></div>
          ) : null}
          <div className="summary-row summary-row--total"><span>Total</span><strong>{formatUsd(cart.grossCents - estimatedDiscount)}</strong></div>
          {actionData?.error ? <Alert tone="error">{actionData.error}</Alert> : null}
          <button className="btn btn--accent btn--block btn--lg" type="submit" disabled={submitting}>
            {submitting ? <span className="spinner" aria-hidden="true" /> : <Icon name="lock" size={18} />}
            {submitting ? "Placing order…" : "Place order"}
          </button>
          <p className="secure-note"><Icon name="shield" size={16} />Retrying this order will never charge you twice.</p>
        </aside>
      </Form>
    </>
  );
}
