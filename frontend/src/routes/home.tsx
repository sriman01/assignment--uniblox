import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import { openCartQuantities, type StoreData } from "../components/layout/StoreShell";
import { ProductCard } from "../components/store/ProductCard";
import { ProductImage } from "../components/store/ProductImage";
import { Icon, type IconName } from "../components/ui/Icon";
import { api, unwrap } from "../lib/api";
import { productCategories, productContent } from "../lib/productContent";
import type { Product } from "../types";

export async function homeLoader() {
  return { products: unwrap(await api.products()).items };
}

const promises: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: "truck", title: "Free shipping", text: "On every order, no minimum" },
  { icon: "gift", title: "Milestone rewards", text: "Coupons earned from real orders" },
  { icon: "shield", title: "Reliable checkout", text: "Never charged twice on retry" },
  { icon: "refresh", title: "Live stock", text: "What you see is what we have" },
];

export function HomePage() {
  const { products } = useLoaderData() as { products: Product[] };
  const store = useRouteLoaderData("store") as StoreData;
  const inCart = openCartQuantities(store.cart);
  const featured = products.slice(0, 4);
  const heroProducts = products.slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div>
            <span className="eyebrow">New season essentials</span>
            <h1>Sleep better. <span>Live calmer.</span></h1>
            <p className="hero__lead">
              Bedding, pillows, and small home comforts with honest prices, live stock, and rewards you earn simply by shopping.
            </p>
            <div className="hero__actions">
              <Link to="/products" className="btn btn--accent btn--lg">Shop the collection <Icon name="arrowRight" size={18} /></Link>
              <Link to="/about" className="btn btn--outline-light btn--lg">Our story</Link>
            </div>
            <div className="hero__stats">
              <div><strong>{products.length}</strong><span>Curated products</span></div>
              <div><strong>$0</strong><span>Shipping, always</span></div>
              <div><strong>1×</strong><span>Charge per order</span></div>
            </div>
          </div>
          <div className="hero__visual" aria-hidden="true">
            {heroProducts.map((product) => (
              <div className="hero__tile" key={product.id}>
                <ProductImage productId={product.id} name={product.name} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="usp-strip">
        <div className="container usp-grid">
          {promises.map((item) => (
            <div className="usp" key={item.title}>
              <span className="usp__icon"><Icon name={item.icon} size={22} /></span>
              <div><strong>{item.title}</strong><span>{item.text}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Shop by category</span>
              <h2>Find your kind of comfort</h2>
            </div>
            <Link to="/products" className="text-link">View all <Icon name="arrowRight" size={16} /></Link>
          </div>
          <div className="category-grid">
            {productCategories.map((category) => {
              const sample = products.find((product) => productContent(product.id).category === category);
              const count = products.filter((product) => productContent(product.id).category === category).length;
              return (
                <Link to={`/products?category=${category}`} className="category-tile" key={category}>
                  {sample ? <ProductImage productId={sample.id} name={category} /> : null}
                  <div>
                    <h3>{category}</h3>
                    <span>{count} product{count === 1 ? "" : "s"} <Icon name="arrowRight" size={16} /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Bestsellers</span>
              <h2>Featured products</h2>
              <p>Prices are live until checkout. Your receipt keeps the price you paid.</p>
            </div>
            <Link to="/products" className="text-link">Shop all <Icon name="arrowRight" size={16} /></Link>
          </div>
          <div className="product-grid">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} quantityInCart={inCart.get(product.id) ?? 0} />
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container rewards-banner">
          <div>
            <span className="eyebrow">Rewards</span>
            <h2>Shopping that pays you back</h2>
            <p>Every few orders you place earns you a discount coupon. Create an account so your orders count, then apply the coupon at checkout.</p>
            <div className="hero__actions" style={{ marginTop: 24 }}>
              <Link to="/register" className="btn btn--light">Create an account</Link>
              <Link to="/account" className="btn btn--light">View my coupons</Link>
            </div>
          </div>
          <div className="reward-steps">
            <div className="reward-step"><b>1</b><strong>Sign in & shop</strong><span>Each order counts toward your own next reward.</span></div>
            <div className="reward-step"><b>2</b><strong>Reach your milestone</strong><span>Your Nth order earns a coupon in your account.</span></div>
            <div className="reward-step"><b>3</b><strong>Save at checkout</strong><span>Apply your code for a percentage off.</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
