import { Form, Link, useActionData, useNavigation, useRouteLoaderData } from "react-router";
import { api } from "../api";
import { formatUsd } from "../money";
import type { StoreData } from "../shell";
import { readCartId } from "../storage";

export async function cartAction({ request }: { request: Request }) {
  const cartId = readCartId();
  if (!cartId) {
    return { error: "Your cart is empty." };
  }
  const form = await request.formData();
  const productId = String(form.get("productId") ?? "");
  const intent = String(form.get("intent") ?? "");
  if (intent === "remove") {
    const removed = await api.removeItem(cartId, productId);
    return removed.ok ? null : { error: removed.error.message };
  }
  const quantity = Number(form.get("quantity"));
  const updated = await api.updateItem(cartId, productId, quantity);
  return updated.ok ? null : { error: updated.error.message };
}

export function CartPage() {
  const store = useRouteLoaderData("store") as StoreData;
  const actionData = useActionData() as { error?: string } | undefined;
  const cart = store.cart?.status === "open" ? store.cart : null;
  const navigation = useNavigation();

  if (!cart || cart.items.length === 0) {
    return (
      <section className="panel">
        <h1>Your cart is empty</h1>
        <p><Link to="/">Continue shopping</Link></p>
      </section>
    );
  }

  return (
    <section className="layout">
      <div>
        <h1>Cart</h1>
        {actionData?.error ? <p className="error">{actionData.error}</p> : null}
        <p className="note">These are current catalog prices. Checkout freezes them on the receipt.</p>
        {cart.items.map((item) => (
          <div className="line" key={item.productId}>
            <div>
              <h2>{item.name}</h2>
              <p className="note">{formatUsd(item.unitPriceCents)} each</p>
              {item.quantity > item.availableQuantity ? (
                <p className="error">Only {item.availableQuantity} available now.</p>
              ) : null}
              <Form method="post" className="qty">
                <input type="hidden" name="productId" value={item.productId} />
                <label>
                  Qty
                  <input key={item.quantity} name="quantity" type="number" min={1} defaultValue={item.quantity} />
                </label>
                <button className="btn" type="submit" name="intent" value="update" disabled={navigation.state !== "idle"}>Update</button>
                <button className="btn-ghost" type="submit" name="intent" value="remove" disabled={navigation.state !== "idle"}>Remove</button>
              </Form>
            </div>
            <strong>{formatUsd(item.lineTotalCents)}</strong>
          </div>
        ))}
      </div>
      <aside className="summary">
        <h2>Order summary</h2>
        <div className="total-row"><span>Subtotal</span><strong>{formatUsd(cart.grossCents)}</strong></div>
        <p className="note">Shipping is free. A coupon, if you have one, is applied on the next step.</p>
        <Link className="btn btn-full" to="/checkout">Checkout</Link>
      </aside>
    </section>
  );
}
