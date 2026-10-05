import type { ApiError, Coupon, Customer, Order, PricedCart, Product, SalesReport, StoreConfig } from "./types";

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: ApiError };
type ApiResult<T> = Ok<T> | Err;

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "The checkout API is not running on port 4000." } };
  }

  const json = (await response.json()) as T & { error?: ApiError };
  if (!response.ok) {
    return {
      ok: false,
      error: json.error ?? { code: "REQUEST_FAILED", message: `Request failed with status ${response.status}.` },
    };
  }
  return { ok: true, data: json };
}

export const api = {
  products: () => request<{ items: Product[] }>("/products"),
  createCart: () => request<PricedCart>("/carts", { method: "POST" }),
  getCart: (cartId: string) => request<PricedCart>(`/carts/${cartId}`),
  addItem: (cartId: string, productId: string, quantity: number) =>
    request<PricedCart>(`/carts/${cartId}/items`, {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    }),
  updateItem: (cartId: string, productId: string, quantity: number) =>
    request<PricedCart>(`/carts/${cartId}/items/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  removeItem: (cartId: string, productId: string) =>
    request<PricedCart>(`/carts/${cartId}/items/${productId}`, { method: "DELETE" }),
  checkout: (cartId: string, idempotencyKey: string, couponCode: string) =>
    request<Order>(`/carts/${cartId}/checkout`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(couponCode ? { couponCode } : {}),
    }),
  getOrder: (orderId: string) => request<Order>(`/orders/${orderId}`),
  customerSession: () => request<{ signedIn: boolean; customer?: Customer }>("/customer/session"),
  customerSignIn: (email: string, password: string) =>
    request<{ signedIn: boolean; customer: Customer }>("/customer/session", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  customerSignOut: () => request<{ signedIn: boolean }>("/customer/session", { method: "DELETE" }),
  customerOrders: () => request<{ items: Order[] }>("/customer/orders"),
  customerCoupons: () => request<{ items: Coupon[] }>("/customer/coupons"),
  session: () => request<{ signedIn: boolean; email?: string }>("/admin/session"),
  signIn: (email: string, password: string) =>
    request<{ signedIn: boolean; email: string }>("/admin/session", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => request<{ signedIn: boolean }>("/admin/session", { method: "DELETE" }),
  updateProduct: (productId: string, patch: { availableQuantity?: number; unitPriceCents?: number }) =>
    request<Product>(`/admin/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  config: () => request<StoreConfig>("/admin/config"),
  report: () => request<SalesReport>("/admin/reports"),
  coupons: () => request<{ items: Coupon[] }>("/admin/coupons"),
  orders: () => request<{ items: Order[] }>("/admin/orders"),
  generateCoupon: () => request<Coupon>("/admin/coupons/generate", { method: "POST" }),
};

export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
}
