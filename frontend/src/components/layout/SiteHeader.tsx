import { useEffect, useRef, useState } from "react";
import { Form, Link, NavLink, useLocation, useSearchParams } from "react-router";
import { useWishlist } from "../../lib/wishlist";
import type { Customer } from "../../types";
import { AccountMenu } from "../store/AccountMenu";
import { useStoreUi } from "../store/StoreUi";
import { Icon } from "../ui/Icon";

const navigation = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "Products", end: false },
  { to: "/about", label: "About us", end: false },
  { to: "/contact", label: "Contact us", end: false },
];

type SiteHeaderProps = {
  cartCount: number;
  customer: Customer | null;
};

export function SiteHeader({ cartCount, customer }: SiteHeaderProps) {
  const wishlist = useWishlist();
  const { openCart } = useStoreUi();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanel = useRef<HTMLDivElement>(null);
  const query = location.pathname === "/products" ? searchParams.get("q") ?? "" : "";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) return;
    menuPanel.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const search = (
    <Form method="get" action="/products" className="search" role="search" key={query}>
      <Icon name="search" size={18} className="search__icon" />
      <input className="search__input" type="search" name="q" placeholder="Search for products" defaultValue={query} aria-label="Search products" />
      <button type="submit" className="search__button">Search</button>
    </Form>
  );

  return (
    <header className="site-header">
      <div className="site-header__patti" aria-hidden="true" />
      <div className="container site-header__shell">
        <button
          type="button"
          className="icon-button site-header__menu-toggle"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          aria-label="Open menu"
        >
          <Icon name="menu" size={22} />
        </button>

        <Link to="/" className="logo" aria-label="Assignment home">
          <span className="logo__mark">A</span>
          <span className="logo__text">
            <strong>Assignment</strong>
            <small>Sleep &amp; home store</small>
          </span>
        </Link>

        <div className="site-header__tools">
          <p className="site-header__promo">
            <Icon name="truck" size={16} /> Free shipping on every order · Earn milestone rewards
          </p>
          <div className="indicators">
            <Link to="/wishlist" className="indicator" aria-label={`Wishlist (${wishlist.ids.length})`}>
              <span className="indicator__icon">
                <Icon name="heart" size={22} />
                {wishlist.ids.length > 0 ? <span className="indicator__counter">{wishlist.ids.length}</span> : null}
              </span>
              <span className="indicator__label"><small>Saved</small><strong>Wishlist</strong></span>
            </Link>
            <button type="button" className="indicator" onClick={openCart} aria-label={`Cart (${cartCount})`}>
              <span className="indicator__icon">
                <Icon name="cart" size={22} />
                {cartCount > 0 ? <span className="indicator__counter">{cartCount}</span> : null}
              </span>
              <span className="indicator__label"><small>Your</small><strong>Cart</strong></span>
            </button>
            <AccountMenu customer={customer} />
          </div>
        </div>

        <div
          className={`site-header__backdrop${menuOpen ? " is-open" : ""}`}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
        <div
          className={`site-header__main${menuOpen ? " is-open" : ""}`}
          id="site-navigation"
          ref={menuPanel}
          tabIndex={-1}
        >
          <div className="site-header__drawer-head">
            <Link to="/" className="logo" aria-label="Assignment home">
              <span className="logo__mark">A</span>
              <span className="logo__text">
                <strong>Assignment</strong>
              </span>
            </Link>
            <button type="button" className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <Icon name="close" size={20} />
            </button>
          </div>
          <nav className="main-menu" aria-label="Main">
            <ul>
              {navigation.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className="main-menu__link">
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {search}
          <Link to="/products" className="btn btn--accent site-header__cta">
            Shop now
          </Link>
        </div>
      </div>
    </header>
  );
}
