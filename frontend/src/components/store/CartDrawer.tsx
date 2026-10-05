import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { formatUsd } from "../../lib/money";
import type { PricedCart } from "../../types";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { ProductImage } from "./ProductImage";
import { RemoveFromCartButton } from "./QuantityStepper";
import { useStoreUi } from "./StoreUi";

export function CartDrawer({ cart }: { cart: PricedCart | null }) {
  const { cartOpen, closeCart } = useStoreUi();
  const location = useLocation();
  const panel = useRef<HTMLDivElement>(null);
  const items = cart?.status === "open" ? cart.items : [];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    closeCart();
  }, [location.pathname, closeCart]);

  useEffect(() => {
    if (!cartOpen) return;
    panel.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [cartOpen, closeCart]);

  return (
    <div className={`drawer${cartOpen ? " is-open" : ""}`} aria-hidden={!cartOpen} inert={!cartOpen}>
      <div className="drawer__backdrop" onClick={closeCart} />
      <div className="drawer__panel" role="dialog" aria-modal="true" aria-label="Shopping cart" tabIndex={-1} ref={panel}>
        <div className="drawer__header">
          <h2>Your cart <span className="muted">({count})</span></h2>
          <button type="button" className="icon-button" onClick={closeCart} aria-label="Close cart">
            <Icon name="close" size={20} />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="drawer__body">
            <EmptyState
              icon="cart"
              title="Your cart is empty"
              message="Browse the collection and add something you love."
              action={<Link className="btn btn--primary" to="/products">Shop products</Link>}
            />
          </div>
        ) : (
          <>
            <ul className="drawer__body dropcart">
              {items.map((item) => (
                <li className="dropcart__item" key={item.productId}>
                  <Link to={`/products/${item.productId}`} className="dropcart__image">
                    <ProductImage productId={item.productId} name={item.name} size="thumb" />
                  </Link>
                  <div className="dropcart__info">
                    <Link to={`/products/${item.productId}`} className="dropcart__name">{item.name}</Link>
                    <span className="muted">{item.quantity} × {formatUsd(item.unitPriceCents)}</span>
                    {item.quantity > item.availableQuantity ? (
                      <span className="form-error">Only {item.availableQuantity} available</span>
                    ) : null}
                  </div>
                  <RemoveFromCartButton productId={item.productId} productName={item.name} compact />
                </li>
              ))}
            </ul>
            <div className="drawer__footer">
              <div className="summary-row summary-row--total">
                <span>Subtotal</span>
                <strong>{formatUsd(cart?.grossCents ?? 0)}</strong>
              </div>
              <p className="muted small">Shipping is free. Coupons are applied at checkout.</p>
              <div className="drawer__actions">
                <Link to="/cart" className="btn btn--outline">View cart</Link>
                <Link to="/checkout" className="btn btn--accent">Checkout</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
