import { useState } from "react";
import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import { openCartQuantities, type StoreData } from "../components/layout/StoreShell";
import { AddToCartButton } from "../components/store/AddToCartButton";
import { ProductCard } from "../components/store/ProductCard";
import { ProductImage } from "../components/store/ProductImage";
import { WishlistButton } from "../components/store/WishlistButton";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { StockBadge } from "../components/ui/StockBadge";
import { api, unwrap } from "../lib/api";
import { formatUsd } from "../lib/money";
import { productContent } from "../lib/productContent";
import { uuidFromString } from "../typeDefinitions";
import type { Product } from "../types";

export async function productLoader({ params }: { params: { productId?: string } }) {
  const productId = uuidFromString(params.productId ?? "");
  const [product, products] = await Promise.all([api.product(productId), api.products()]);
  return { product: unwrap(product), products: unwrap(products).items };
}

export function ProductPage() {
  const { product, products } = useLoaderData() as { product: Product; products: Product[] };
  return <ProductView key={product.id} product={product} products={products} />;
}

function ProductView({ product, products }: { product: Product; products: Product[] }) {
  const store = useRouteLoaderData("store") as StoreData;
  const inCart = openCartQuantities(store.cart);
  const content = productContent(product.id);
  const quantityInCart = inCart.get(product.id) ?? 0;
  const remaining = Math.max(0, product.availableQuantity - quantityInCart);
  const [quantity, setQuantity] = useState(1);
  const chosen = Math.min(Math.max(1, quantity), Math.max(1, remaining));
  const related = products.filter((item) => item.id !== product.id && productContent(item.id).category === content.category).slice(0, 4);

  return (
    <>
      <PageHeader
        title={product.name}
        breadcrumb={[
          { label: "Home", to: "/" },
          { label: "Products", to: "/products" },
          { label: content.category, to: `/products?category=${content.category}` },
          { label: product.name },
        ]}
      />
      <div className="container section">
        <div className="product-detail">
          <ProductImage productId={product.id} name={product.name} size="hero" />
          <div className="product-detail__info">
            <span className="eyebrow" style={{ marginBottom: 0 }}>{content.category}</span>
            <h2 className="product-detail__title">{product.name}</h2>
            <div className="product-detail__row">
              <span className="product-detail__price">{formatUsd(product.unitPriceCents)}</span>
              <StockBadge available={product.availableQuantity} />
            </div>
            <p className="product-detail__summary">{content.summary}</p>
            <ul className="feature-list">
              {content.details.map((detail) => (
                <li key={detail}><Icon name="check" size={18} />{detail}</li>
              ))}
            </ul>

            <div className="card product-detail__purchase">
              {quantityInCart > 0 ? (
                <p className="muted small">
                  You have {quantityInCart} in your cart. <Link to="/cart" className="text-link">View cart</Link>
                </p>
              ) : null}
              <div className="product-detail__row">
                <div className="stepper" aria-label="Quantity">
                  <button type="button" className="stepper__button" onClick={() => setQuantity(chosen - 1)} disabled={chosen <= 1} aria-label="Decrease quantity">
                    <Icon name="minus" size={16} />
                  </button>
                  <output className="stepper__value">{chosen}</output>
                  <button type="button" className="stepper__button" onClick={() => setQuantity(chosen + 1)} disabled={chosen >= remaining} aria-label="Increase quantity">
                    <Icon name="plus" size={16} />
                  </button>
                </div>
                <AddToCartButton
                  productId={product.id}
                  productName={product.name}
                  quantity={chosen}
                  disabled={remaining < 1}
                  label={product.availableQuantity > 0 && remaining < 1 ? "All available stock is in your cart" : "Add to cart"}
                  onAdded={() => setQuantity(1)}
                />
              </div>
              <WishlistButton productId={product.id} productName={product.name} variant="text" />
            </div>

            <div className="trust-list">
              <div className="trust-item"><Icon name="truck" size={20} />Free shipping</div>
              <div className="trust-item"><Icon name="shield" size={20} />Charged once, even on retry</div>
              <div className="trust-item"><Icon name="gift" size={20} />Counts toward rewards</div>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="container section" style={{ paddingTop: 0 }}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">You may also like</span>
              <h2>More in {content.category}</h2>
            </div>
          </div>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} quantityInCart={inCart.get(item.id) ?? 0} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
