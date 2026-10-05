import { createBrowserRouter } from "react-router";
import { api } from "./lib/api";
import { AppSplash } from "./components/layout/AppSplash";
import { RouteError, StoreShell } from "./components/layout/StoreShell";
import { AboutPage } from "./routes/about";
import { accountAction, accountLoader, AccountPage } from "./routes/account";
import { adminSignInAction, adminSignInLoader, AdminSignInPage } from "./routes/adminSignIn";
import { cartAction, CartPage } from "./routes/cart";
import { catalogLoader, CatalogPage } from "./routes/catalog";
import { checkoutAction, checkoutLoader, CheckoutPage } from "./routes/checkout";
import { contactAction, ContactPage } from "./routes/contact";
import { couponsAction, couponsLoader, CouponsRoute } from "./routes/admin/coupons";
import { dashboardLoader, DashboardRoute } from "./routes/admin/dashboard";
import { inventoryAction, inventoryLoader, InventoryRoute } from "./routes/admin/inventory";
import { adminLayoutAction, adminLayoutLoader, AdminLayout } from "./routes/admin/layout";
import { ordersLoader, OrdersRoute } from "./routes/admin/orders";
import { productsAction, productsLoader, ProductsRoute } from "./routes/admin/products";
import { homeLoader, HomePage } from "./routes/home";
import { NotFoundPage } from "./routes/notFound";
import { orderLoader, OrderPage } from "./routes/order";
import { productLoader, ProductPage } from "./routes/product";
import { registerAction, registerLoader, RegisterPage } from "./routes/register";
import { signInAction, signInLoader, SignInPage } from "./routes/signIn";
import { wishlistLoader, WishlistPage } from "./routes/wishlist";
import { addToCartAction } from "./lib/cart";
import { clearCartId, readCartId } from "./lib/storage";
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
    HydrateFallback: AppSplash,
    element: <StoreShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, loader: homeLoader, element: <HomePage /> },
      { path: "products", loader: catalogLoader, element: <CatalogPage /> },
      { path: "products/:productId", loader: productLoader, element: <ProductPage />, errorElement: <NotFoundPage /> },
      { path: "about", element: <AboutPage /> },
      { path: "contact", action: contactAction, element: <ContactPage /> },
      { path: "wishlist", loader: wishlistLoader, element: <WishlistPage /> },
      { path: "cart/add", action: addToCartAction },
      { path: "cart", action: cartAction, element: <CartPage /> },
      { path: "checkout", loader: checkoutLoader, action: checkoutAction, element: <CheckoutPage /> },
      { path: "orders/:orderId", loader: orderLoader, element: <OrderPage /> },
      { path: "sign-in", loader: signInLoader, action: signInAction, element: <SignInPage /> },
      { path: "register", loader: registerLoader, action: registerAction, element: <RegisterPage /> },
      { path: "account", loader: accountLoader, action: accountAction, element: <AccountPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "/admin/sign-in",
    loader: adminSignInLoader,
    action: adminSignInAction,
    HydrateFallback: AppSplash,
    element: <AdminSignInPage />,
  },
  {
    id: "admin",
    path: "/admin",
    loader: adminLayoutLoader,
    action: adminLayoutAction,
    HydrateFallback: AppSplash,
    element: <AdminLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, loader: dashboardLoader, element: <DashboardRoute /> },
      { path: "products", loader: productsLoader, action: productsAction, element: <ProductsRoute /> },
      { path: "orders", loader: ordersLoader, element: <OrdersRoute /> },
      { path: "inventory", loader: inventoryLoader, action: inventoryAction, element: <InventoryRoute /> },
      { path: "coupons", loader: couponsLoader, action: couponsAction, element: <CouponsRoute /> },
    ],
  },
]);
