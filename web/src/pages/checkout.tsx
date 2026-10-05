import { Form, Link, redirect, useActionData, useNavigation, useRouteLoaderData } from "react-router";
import { api } from "../api";
import { formatUsd } from "../money";
import type { StoreData } from "../shell";
import { checkoutIdempotencyKey, clearCartId, clearCheckoutIdempotencyKey, readCartId } from "../storage";

export async function checkoutLoader() {
  const session = await api.customerSession();
  return session.ok && session.data.signedIn ? null : redirect("/sign-in");
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
  const store = useRouteLoaderData("store") as StoreData;
  const cart = store.cart?.status === "open" ? store.cart : null;
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();

  if (!cart || cart.items.length === 0) {
    return (
      <section className="panel">
        <h1>Nothing to check out</h1>
        <p><Link to="/">Continue shopping</Link></p>
      </section>
    );
  }

  return (
    <section className="layout">
      <div>
        <h1>Checkout</h1>
        <p className="note">Placing the order is the payment. A retry of this attempt will not create a second order.</p>
        {cart.items.map((item) => (
          <div className="line" key={item.productId}>
            <span>{item.name} × {item.quantity}</span>
            <span>{formatUsd(item.lineTotalCents)}</span>
          </div>
        ))}
      </div>
      <Form method="post" className="summary">
        <h2>Payment</h2>
        <label className="field" htmlFor="couponCode">
          Coupon code
          <input id="couponCode" name="couponCode" placeholder="MILESTONE-5" autoComplete="off" />
        </label>
        <div className="total-row"><span>Subtotal</span><strong>{formatUsd(cart.grossCents)}</strong></div>
        <p className="note">Discount is calculated when the code is valid. The receipt shows gross, discount, and total.</p>
        {actionData?.error ? <p className="error">{actionData.error}</p> : null}
        <button className="btn btn-full" type="submit" disabled={navigation.state !== "idle"}>
          {navigation.state !== "idle" ? "Placing order…" : "Place order"}
        </button>
      </Form>
    </section>
  );
}
