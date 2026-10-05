import type {
  ApiError,
  Coupon,
  Customer,
  CustomerRewardSummary,
  Order,
  PricedCart,
  Product,
  RewardProgress,
  SalesReport,
  StoreConfig,
} from "../types";
import type { Uuid } from "../typeDefinitions";

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
  product: (productId: Uuid) => request<Product>(`/products/${productId}`),
  createCart: () => request<PricedCart>("/carts", { method: "POST" }),
  getCart: (cartId: Uuid) => request<PricedCart>(`/carts/${cartId}`),
  addItem: (cartId: Uuid, productId: Uuid, quantity: number) =>
    request<PricedCart>(`/carts/${cartId}/items`, {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    }),
  updateItem: (cartId: Uuid, productId: Uuid, quantity: number) =>
    request<PricedCart>(`/carts/${cartId}/items/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  removeItem: (cartId: Uuid, productId: Uuid) =>
    request<PricedCart>(`/carts/${cartId}/items/${productId}`, { method: "DELETE" }),
  checkout: (cartId: Uuid, idempotencyKey: string, couponCode: string) =>
    request<Order>(`/carts/${cartId}/checkout`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(couponCode ? { couponCode } : {}),
    }),
  getOrder: (orderId: Uuid) => request<Order>(`/orders/${orderId}`),
  customerSession: () => request<{ signedIn: boolean; customer?: Customer }>("/customer/session"),
  customerSignIn: (email: string, password: string) =>
    request<{ signedIn: boolean; customer: Customer }>("/customer/session", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  customerRegister: (registration: { name: string; email: string; password: string }) =>
    request<{ signedIn: boolean; customer: Customer }>("/customer/register", {
      method: "POST",
      body: JSON.stringify(registration),
    }),
  customerSignOut: () => request<{ signedIn: boolean }>("/customer/session", { method: "DELETE" }),
  customerOrders: () => request<{ items: Order[] }>("/customer/orders"),
  customerCoupons: () => request<{ items: Coupon[] }>("/customer/coupons"),
  customerRewards: () => request<RewardProgress>("/customer/rewards"),
  session: () => request<{ signedIn: boolean; email?: string }>("/admin/session"),
  signIn: (email: string, password: string) =>
    request<{ signedIn: boolean; email: string }>("/admin/session", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => request<{ signedIn: boolean }>("/admin/session", { method: "DELETE" }),
  updateProduct: (productId: Uuid, patch: { availableQuantity?: number; unitPriceCents?: number }) =>
    request<Product>(`/admin/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  config: () => request<StoreConfig>("/admin/config"),
  updateConfig: (config: StoreConfig) =>
    request<StoreConfig>("/admin/config", {
      method: "PATCH",
      body: JSON.stringify(config),
    }),
  report: () => request<SalesReport>("/admin/reports"),
  coupons: () => request<{ items: Coupon[] }>("/admin/coupons"),
  orders: () => request<{ items: Order[] }>("/admin/orders"),
  customers: () => request<{ items: CustomerRewardSummary[] }>("/admin/customers"),
  generateCoupon: (customerId?: Uuid) =>
    request<Coupon>("/admin/coupons/generate", {
      method: "POST",
      body: JSON.stringify(customerId ? { customerId } : {}),
    }),
  createCoupon: (coupon: { code?: string; percentOff: number; customerId: Uuid | null }) =>
    request<Coupon>("/admin/coupons", { method: "POST", body: JSON.stringify(coupon) }),
  updateCoupon: (
    code: string,
    patch: { percentOff?: number; customerId?: Uuid | null; status?: "available" | "disabled" },
  ) =>
    request<Coupon>(`/admin/coupons/${encodeURIComponent(code)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteCoupon: (code: string) =>
    request<{ code: string; deleted: true }>(`/admin/coupons/${encodeURIComponent(code)}`, { method: "DELETE" }),
};

export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
}
