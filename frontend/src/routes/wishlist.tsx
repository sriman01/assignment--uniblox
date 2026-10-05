import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import { openCartQuantities, type StoreData } from "../components/layout/StoreShell";
import { AddToCartButton } from "../components/store/AddToCartButton";
import { ProductImage } from "../components/store/ProductImage";
import { useStoreUi } from "../components/store/StoreUi";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { StockBadge } from "../components/ui/StockBadge";
import { api, unwrap } from "../lib/api";
import { formatUsd } from "../lib/money";
import { productContent } from "../lib/productContent";
import { useWishlist } from "../lib/wishlist";
import type { Product } from "../types";

export async function wishlistLoader() {
  return { products: unwrap(await api.products()).items };
}

export function WishlistPage() {
  const { products } = useLoaderData() as { products: Product[] };
  const store = useRouteLoaderData("store") as StoreData;
  const wishlist = useWishlist();
  const { notify } = useStoreUi();
  const inCart = openCartQuantities(store.cart);
  const saved = wishlist.ids.flatMap((id) => products.filter((product) => product.id === id));

  return (
    <>
      <PageHeader
        title="Wishlist"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Wishlist" }]}
        description={saved.length > 0 ? `${saved.length} saved item${saved.length === 1 ? "" : "s"}. Saved on this device.` : undefined}
      />
      <div className="container section">
        {saved.length === 0 ? (
          <EmptyState
            icon="heart"
            title="Your wishlist is empty"
            message="Tap the heart on any product to save it here for later."
            action={<Link className="btn btn--primary" to="/products">Browse products</Link>}
          />
        ) : (
          <div className="card">
            <table className="data-table responsive-table wishlist-table">
              <thead>
                <tr><th>Product</th><th>Stock status</th><th className="num">Price</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {saved.map((product) => {
                  const quantityInCart = inCart.get(product.id) ?? 0;
                  const canAdd = product.availableQuantity > quantityInCart;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="cart-product">
                          <Link to={`/products/${product.id}`}><ProductImage productId={product.id} name={product.name} size="thumb" /></Link>
                          <div className="cart-product__meta">
                            <span className="product-card__meta">{productContent(product.id).category}</span>
                            <Link to={`/products/${product.id}`} className="cart-product__name">{product.name}</Link>
                          </div>
                        </div>
                      </td>
                      <td><StockBadge available={product.availableQuantity} /></td>
                      <td className="num"><strong>{formatUsd(product.unitPriceCents)}</strong></td>
                      <td>
                        <div className="wishlist-actions">
                          <AddToCartButton
                            productId={product.id}
                            productName={product.name}
                            disabled={!canAdd}
                            label="Move to cart"
                            onAdded={() => wishlist.remove(product.id)}
                          />
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => {
                              wishlist.remove(product.id);
                              notify(`${product.name} removed from your wishlist`);
                            }}
                            aria-label={`Remove ${product.name} from wishlist`}
                            title="Remove"
                          >
                            <Icon name="close" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
