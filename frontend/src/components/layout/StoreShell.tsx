import { Link, Outlet, useRouteError, useRouteLoaderData } from "react-router";
import { WishlistProvider } from "../../lib/wishlist";
import type { Customer, PricedCart } from "../../types";
import { CartDrawer } from "../store/CartDrawer";
import { StoreUiProvider } from "../store/StoreUi";
import { EmptyState } from "../ui/EmptyState";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export type StoreData = {
  cart: PricedCart | null;
  adminSession: { signedIn: boolean; email?: string };
  customerSession: { signedIn: boolean; customer?: Customer };
};

export function openCartQuantities(cart: PricedCart | null): Map<string, number> {
  return new Map(cart?.status === "open" ? cart.items.map((item) => [item.productId, item.quantity]) : []);
}

export function StoreShell() {
  const data = useRouteLoaderData("store") as StoreData;
  const count = data.cart?.status === "open" ? data.cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const customer = data.customerSession.signedIn ? data.customerSession.customer ?? null : null;

  return (
    <WishlistProvider>
      <StoreUiProvider>
        <div className="site">
          <a className="skip-link" href="#main">Skip to content</a>
          <SiteHeader cartCount={count} customer={customer} />
          <main className="site__body" id="main">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
        <CartDrawer cart={data.cart} />
      </StoreUiProvider>
    </WishlistProvider>
  );
}

export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="container section">
      <EmptyState
        icon="refresh"
        title="We couldn’t load this page"
        message={message}
        action={<Link className="btn btn--primary" to="/">Back to the shop</Link>}
      />
    </div>
  );
}
