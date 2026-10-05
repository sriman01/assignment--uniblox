import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import type { CartMutationResult } from "../../lib/cart";
import type { Uuid } from "../../typeDefinitions";
import { Icon } from "../ui/Icon";
import { useStoreUi } from "./StoreUi";

type AddToCartButtonProps = {
  productId: Uuid;
  productName: string;
  disabled?: boolean;
  quantity?: number;
  label?: string;
  variant?: "full" | "icon";
  inCart?: boolean;
  onAdded?: () => void;
};

export function AddToCartButton({
  productId,
  productName,
  disabled = false,
  quantity = 1,
  label = "Add to cart",
  variant = "full",
  inCart = false,
  onAdded,
}: AddToCartButtonProps) {
  const fetcher = useFetcher<CartMutationResult>();
  const { notify, openCart } = useStoreUi();
  const handled = useRef<CartMutationResult | undefined>(undefined);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) {
      notify(`${productName} added to your cart`);
      openCart();
      onAdded?.();
    } else {
      notify(fetcher.data.error, "error");
    }
  }, [fetcher.state, fetcher.data, notify, openCart, onAdded, productName]);

  return (
    <fetcher.Form method="post" action="/cart/add" className={variant === "icon" ? "add-to-cart add-to-cart--icon" : "add-to-cart"}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value={quantity} />
      {variant === "icon" ? (
        <button
          type="submit"
          className={`cart-icon-button${inCart ? " is-added" : ""}`}
          disabled={disabled || busy}
          aria-label={`Add ${productName} to cart`}
          title="Add to cart"
        >
          <Icon name="cart" size={20} />
          {inCart ? (
            <span className="cart-icon-button__tick">
              <Icon name="check" size={10} strokeWidth={3} />
            </span>
          ) : null}
        </button>
      ) : (
        <button type="submit" className="btn btn--primary btn--block" disabled={disabled || busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="cart" size={18} />}
          {disabled ? "Sold out" : busy ? "Adding…" : label}
        </button>
      )}
    </fetcher.Form>
  );
}
