import { Link, NavLink, Outlet, useRouteError, useRouteLoaderData } from "react-router";
import type { Customer, PricedCart } from "./types";

export type StoreData = {
  cart: PricedCart | null;
  adminSession: { signedIn: boolean; email?: string };
  customerSession: { signedIn: boolean; customer?: Customer };
};

export function StoreShell() {
  const data = useRouteLoaderData("store") as StoreData;
  const count = data.cart?.status === "open" ? data.cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  return (
    <div>
      <div className="topbar">Free shipping · Every 5th order earns 10% off · Admin sign-in is on the right</div>
      <header className="site-header">
        <div className="header-row">
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/cart">Cart</NavLink>
          </nav>
          <Link to="/" className="wordmark">SleepyHug</Link>
          <div className="header-tools">
            <Link className="icon-link" to={data.customerSession.signedIn ? "/account" : "/sign-in"}>
              {data.customerSession.signedIn ? data.customerSession.customer?.name ?? "Account" : "Sign in"}
            </Link>
            <Link className="icon-link" to="/cart" aria-label="Cart">
              Cart {count > 0 ? <span className="badge">{count}</span> : null}
            </Link>
          </div>
        </div>
      </header>
      <main className="wrap">
        <Outlet />
      </main>
    </div>
  );
}

export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="wrap">
      <h1>Couldn’t load this page</h1>
      <p className="error">{message}</p>
      <p><Link to="/">Back to the shop</Link></p>
    </div>
  );
}
