import { Link } from "react-router";
import { productCategories } from "../../lib/productContent";
import { Icon } from "../ui/Icon";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Link to="/" className="logo logo--inverse" aria-label="Assignment home">
            <span className="logo__mark">A</span>
            <span className="logo__text">
              <strong>Assignment</strong>
              <small>Sleep &amp; home store</small>
            </span>
          </Link>
          <p>Thoughtful bedding and home essentials with transparent pricing, reliable checkout, and rewards earned from real orders.</p>
        </div>
        <div>
          <h3>Shop</h3>
          <ul>
            <li><Link to="/products">All products</Link></li>
            {productCategories.map((category) => (
              <li key={category}><Link to={`/products?category=${category}`}>{category}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Account</h3>
          <ul>
            <li><Link to="/account">My orders</Link></li>
            <li><Link to="/wishlist">Wishlist</Link></li>
            <li><Link to="/cart">Cart</Link></li>
            <li><Link to="/admin">Store admin</Link></li>
          </ul>
        </div>
        <div>
          <h3>Get in touch</h3>
          <ul className="site-footer__contact">
            <li><Icon name="mail" size={16} />hello@assignment.test</li>
            <li><Icon name="phone" size={16} />+1 (555) 010-2030</li>
            <li><Icon name="pin" size={16} />Mon–Fri, 9am–6pm</li>
          </ul>
          <Link to="/contact" className="btn btn--accent btn--sm">Contact us</Link>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container">
          <span>© {new Date().getFullYear()} Assignment. Demo storefront.</span>
          <span>Prices in USD · Checkout is simulated</span>
        </div>
      </div>
    </footer>
  );
}
