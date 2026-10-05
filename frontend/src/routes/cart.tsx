import { Link, useRouteLoaderData } from "react-router";
import type { StoreData } from "../components/layout/StoreShell";
import { ProductImage } from "../components/store/ProductImage";
import { QuantityStepper, RemoveFromCartButton } from "../components/store/QuantityStepper";
import { WishlistButton } from "../components/store/WishlistButton";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { api } from "../lib/api";
import { formatUsd } from "../lib/money";
import { readCartId } from "../lib/storage";
import { uuidFromString } from "../typeDefinitions";

export async function cartAction({ request }: { request: Request }) {
  const cartId = readCartId();
  if (!cartId) {
    return { error: "Your cart is empty." };
  }
  const form = await request.formData();
  const productId = uuidFromString(String(form.get("productId") ?? ""));
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
  const cart = store.cart?.status === "open" ? store.cart : null;
  const items = cart?.items ?? [];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const stockProblem = items.some((item) => item.quantity > item.availableQuantity);

  return (
    <>
      <PageHeader title="Shopping cart" breadcrumb={[{ label: "Home", to: "/" }, { label: "Cart" }]} />
      <div className="container section">
        {!cart || items.length === 0 ? (
          <EmptyState
            icon="cart"
            title="Your cart is empty"
            message="Looks like you haven’t added anything yet. Explore the collection to find something you love."
            action={<Link className="btn btn--primary" to="/products">Start shopping</Link>}
          />
        ) : (
          <div className="cart-layout">
            <div>
              {stockProblem ? (
                <Alert tone="error">Some items now have less stock than your cart. Lower those quantities before checking out.</Alert>
              ) : null}
              <div className="card cart-table">
                <table className="data-table responsive-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th className="num">Total</th>
                      <th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.productId}>
                        <td>
                          <div className="cart-product">
                            <Link to={`/products/${item.productId}`}>
                              <ProductImage productId={item.productId} name={item.name} size="thumb" />
                            </Link>
                            <div className="cart-product__meta">
                              <Link to={`/products/${item.productId}`} className="cart-product__name">{item.name}</Link>
                              <span className="muted">{formatUsd(item.unitPriceCents)} each</span>
                              {item.quantity > item.availableQuantity ? (
                                <span className="form-error">Only {item.availableQuantity} available now</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <QuantityStepper
                            productId={item.productId}
                            productName={item.name}
                            quantity={item.quantity}
                            max={Math.max(item.availableQuantity, 1)}
                          />
                        </td>
                        <td className="num"><strong>{formatUsd(item.lineTotalCents)}</strong></td>
                        <td>
                          <div className="wishlist-actions">
                            <WishlistButton productId={item.productId} productName={item.name} />
                            <RemoveFromCartButton productId={item.productId} productName={item.name} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cart-footer-actions">
                <Link to="/products" className="text-link"><Icon name="chevronRight" size={16} style={{ transform: "rotate(180deg)" }} />Continue shopping</Link>
                <span className="muted small">Prices shown are current catalog prices.</span>
              </div>
            </div>

            <aside className="card order-summary">
              <h2>Order summary</h2>
              <div className="summary-row"><span>Items ({count})</span><span>{formatUsd(cart.grossCents)}</span></div>
              <div className="summary-row"><span>Shipping</span><span className="badge badge--success">Free</span></div>
              <div className="summary-row"><span>Coupon</span><span className="muted">Applied at checkout</span></div>
              <div className="summary-row summary-row--total"><span>Subtotal</span><strong>{formatUsd(cart.grossCents)}</strong></div>
              <Link
                to="/checkout"
                className="btn btn--accent btn--block btn--lg"
                aria-disabled={stockProblem}
                onClick={(event) => {
                  if (stockProblem) event.preventDefault();
                }}
              >
                Proceed to checkout <Icon name="arrowRight" size={18} />
              </Link>
              <p className="order-summary__note"><Icon name="lock" size={16} />Your total is locked in when the order is placed. Retrying never creates a second order.</p>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
