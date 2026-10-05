import { Link } from "react-router";
import { formatUsd } from "../../lib/money";
import { productContent } from "../../lib/productContent";
import type { Product } from "../../types";
import { StockBadge } from "../ui/StockBadge";
import { AddToCartButton } from "./AddToCartButton";
import { ProductImage } from "./ProductImage";
import { WishlistButton } from "./WishlistButton";

type ProductCardProps = {
  product: Product;
  quantityInCart: number;
};

export function ProductCard({ product, quantityInCart }: ProductCardProps) {
  const content = productContent(product.id);
  const soldOut = product.availableQuantity < 1;
  const atLimit = quantityInCart >= product.availableQuantity;

  return (
    <article className="product-card">
      <div className="product-card__actions">
        <WishlistButton productId={product.id} productName={product.name} />
      </div>
      <Link to={`/products/${product.id}`} className="product-card__media" aria-label={product.name}>
        <ProductImage productId={product.id} name={product.name} />
      </Link>
      <div className="product-card__info">
        <span className="product-card__meta">{content.category}</span>
        <Link to={`/products/${product.id}`} className="product-card__name">
          {product.name}
        </Link>
        <StockBadge available={product.availableQuantity} />
      </div>
      <div className="product-card__footer">
        <div className="product-card__price-row">
          <strong className="product-card__price">{formatUsd(product.unitPriceCents)}</strong>
          {quantityInCart > 0 ? <span className="product-card__in-cart">{quantityInCart} in cart</span> : null}
        </div>
        <AddToCartButton
          productId={product.id}
          productName={product.name}
          disabled={soldOut || atLimit}
          label={atLimit && !soldOut ? "Max in cart" : quantityInCart > 0 ? "Add another" : "Add to cart"}
          inCart={quantityInCart > 0}
        />
      </div>
    </article>
  );
}
