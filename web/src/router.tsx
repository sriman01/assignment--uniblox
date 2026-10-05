import { createBrowserRouter } from "react-router";
import { api } from "./api";
import {
  AdminShell,
  CouponsPage,
  DashboardPage,
  InventoryPage,
  OrdersPage,
  ProductsPage,
  adminLayoutAction,
  adminLayoutLoader,
  couponsAction,
  couponsLoader,
  dashboardLoader,
  inventoryAction,
  inventoryLoader,
  ordersLoader,
  productsAction,
  productsLoader,
} from "./pages/admin";
import { accountAction, accountLoader, AccountPage } from "./pages/account";
import { adminSignInAction, adminSignInLoader, AdminSignInPage } from "./pages/adminSignIn";
import { cartAction, CartPage } from "./pages/cart";
import { catalogAction, catalogLoader, CatalogPage } from "./pages/catalog";
import { checkoutAction, checkoutLoader, CheckoutPage } from "./pages/checkout";
import { orderLoader, OrderPage } from "./pages/order";
import { signInAction, signInLoader, SignInPage } from "./pages/signIn";
import { RouteError, StoreShell } from "./shell";
import { clearCartId, readCartId } from "./storage";
import type { PricedCart } from "./types";

async function storeLoader() {
  const cartId = readCartId();
  let cart: PricedCart | null = null;
  if (cartId) {
    const loaded = await api.getCart(cartId);
    if (loaded.ok) {
      cart = loaded.data;
    } else if (loaded.error.code === "CART_NOT_FOUND") {
      clearCartId();
    } else {
      throw new Error(loaded.error.message);
    }
  }
  const [adminSession, customerSession] = await Promise.all([api.session(), api.customerSession()]);
  return {
    cart,
    adminSession: adminSession.ok ? adminSession.data : { signedIn: false },
    customerSession: customerSession.ok ? customerSession.data : { signedIn: false },
  };
}

export const router = createBrowserRouter([
  {
    id: "store",
    path: "/",
    loader: storeLoader,
    element: <StoreShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, loader: catalogLoader, action: catalogAction, element: <CatalogPage /> },
      { path: "cart", action: cartAction, element: <CartPage /> },
      { path: "checkout", loader: checkoutLoader, action: checkoutAction, element: <CheckoutPage /> },
      { path: "orders/:orderId", loader: orderLoader, element: <OrderPage /> },
      { path: "sign-in", loader: signInLoader, action: signInAction, element: <SignInPage /> },
      { path: "account", loader: accountLoader, action: accountAction, element: <AccountPage /> },
    ],
  },
  {
    path: "/admin/sign-in",
    loader: adminSignInLoader,
    action: adminSignInAction,
    element: <AdminSignInPage />,
  },
  {
    id: "admin",
    path: "/admin",
    loader: adminLayoutLoader,
    action: adminLayoutAction,
    element: <AdminShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, loader: dashboardLoader, element: <DashboardPage /> },
      { path: "products", loader: productsLoader, action: productsAction, element: <ProductsPage /> },
      { path: "orders", loader: ordersLoader, element: <OrdersPage /> },
      { path: "inventory", loader: inventoryLoader, action: inventoryAction, element: <InventoryPage /> },
      { path: "coupons", loader: couponsLoader, action: couponsAction, element: <CouponsPage /> },
    ],
  },
]);
