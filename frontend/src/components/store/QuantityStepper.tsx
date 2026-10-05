import { useEffect } from "react";
import { useFetcher } from "react-router";
import type { Uuid } from "../../typeDefinitions";
import { Icon } from "../ui/Icon";
import { useStoreUi } from "./StoreUi";

type CartActionResult = { error?: string } | null;

function useCartFetcher() {
  const fetcher = useFetcher<CartActionResult>();
  const { notify } = useStoreUi();
  const error = fetcher.state === "idle" ? fetcher.data?.error : undefined;
  useEffect(() => {
    if (error) notify(error, "error");
  }, [error, fetcher.data, notify]);
  return fetcher;
}

type QuantityStepperProps = {
  productId: Uuid;
  productName: string;
  quantity: number;
  max: number;
};

export function QuantityStepper({ productId, productName, quantity, max }: QuantityStepperProps) {
  const fetcher = useCartFetcher();
  const pending = fetcher.formData ? Number(fetcher.formData.get("quantity")) : null;
  const shown = pending !== null && Number.isFinite(pending) ? pending : quantity;
  return (
    <fetcher.Form method="post" action="/cart" className="stepper" aria-label={`Quantity for ${productName}`}>
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        name="quantity"
        value={shown - 1}
        className="stepper__button"
        disabled={shown <= 1 || fetcher.state !== "idle"}
        aria-label={`Decrease ${productName} quantity`}
      >
        <Icon name="minus" size={16} />
      </button>
      <output className="stepper__value" aria-live="polite">{shown}</output>
      <button
        type="submit"
        name="quantity"
        value={shown + 1}
        className="stepper__button"
        disabled={shown >= max || fetcher.state !== "idle"}
        aria-label={`Increase ${productName} quantity`}
      >
        <Icon name="plus" size={16} />
      </button>
    </fetcher.Form>
  );
}

export function RemoveFromCartButton({ productId, productName, compact = false }: { productId: Uuid; productName: string; compact?: boolean }) {
  const fetcher = useCartFetcher();
  return (
    <fetcher.Form method="post" action="/cart">
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        name="intent"
        value="remove"
        className={compact ? "icon-button icon-button--sm" : "icon-button"}
        disabled={fetcher.state !== "idle"}
        aria-label={`Remove ${productName} from cart`}
        title="Remove"
      >
        <Icon name={compact ? "close" : "trash"} size={compact ? 14 : 18} />
      </button>
    </fetcher.Form>
  );
}
