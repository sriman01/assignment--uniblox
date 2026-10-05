export type Product = {
  id: string;
  name: string;
  unitPriceCents: number;
  availableQuantity: number;
};

export type PricedCartItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  availableQuantity: number;
};

export type PricedCart = {
  id: string;
  status: "open" | "checked_out";
  items: PricedCartItem[];
  grossCents: number;
  orderId: string | null;
  pricedAt: "current_catalog";
};

export type Customer = {
  id: string;
  name: string;
  email: string;
};

export type OrderLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type Order = {
  id: string;
  cartId: string;
  customerId: string | null;
  idempotencyKey: string;
  lines: OrderLine[];
  grossCents: number;
  discountCents: number;
  netCents: number;
  couponCode: string | null;
  placedAt: string;
};

export type Coupon = {
  code: string;
  customerId: string | null;
  milestone: number;
  percentOff: number;
  status: "available" | "redeemed";
  redeemedOrderId: string | null;
  createdAt: string;
};

export type StoreConfig = {
  everyNthOrder: number;
  discountPercent: number;
};

export type SalesReport = {
  purchasedQuantityByProduct: Array<{ productId: string; name: string; quantity: number }>;
  grossRevenueCents: number;
  totalDiscountsCents: number;
  netRevenueCents: number;
  coupons: { generated: number; available: number; redeemed: number };
  successfullyPlacedOrders: number;
};

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};
