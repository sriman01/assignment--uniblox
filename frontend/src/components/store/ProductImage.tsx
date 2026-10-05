import { useState } from "react";
import { productContent } from "../../lib/productContent";

type ProductImageProps = {
  productId: string;
  name: string;
  size?: "thumb" | "card" | "hero";
};

export function ProductImage({ productId, name, size = "card" }: ProductImageProps) {
  const content = productContent(productId);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`product-image product-image--${size}`} style={{ background: content.tint }}>
      {failed ? (
        <span className="product-image__fallback">{name.slice(0, 1)}</span>
      ) : (
        <img src={content.image} alt={name} loading="lazy" onError={() => setFailed(true)} />
      )}
    </div>
  );
}
