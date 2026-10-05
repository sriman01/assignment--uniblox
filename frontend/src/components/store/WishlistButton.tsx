import { useWishlist } from "../../lib/wishlist";
import type { Uuid } from "../../typeDefinitions";
import { Icon } from "../ui/Icon";
import { useStoreUi } from "./StoreUi";

type WishlistButtonProps = {
  productId: Uuid;
  productName: string;
  variant?: "icon" | "text";
};

export function WishlistButton({ productId, productName, variant = "icon" }: WishlistButtonProps) {
  const wishlist = useWishlist();
  const { notify } = useStoreUi();
  const saved = wishlist.has(productId);

  function handleClick() {
    const added = wishlist.toggle(productId);
    notify(added ? `${productName} added to your wishlist` : `${productName} removed from your wishlist`);
  }

  const label = saved ? "Remove from wishlist" : "Add to wishlist";
  if (variant === "text") {
    return (
      <button
        type="button"
        className={`btn btn--outline wishlist-text${saved ? " is-saved" : ""}`}
        onClick={handleClick}
        aria-pressed={saved}
      >
        <Icon name="heart" size={18} filled={saved} />
        {saved ? "Saved to wishlist" : "Add to wishlist"}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`icon-toggle${saved ? " is-saved" : ""}`}
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={`${label}: ${productName}`}
      title={label}
    >
      <Icon name="heart" size={18} filled={saved} />
    </button>
  );
}
