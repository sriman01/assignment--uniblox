import type { Iso8601DateTime, Uuid } from "./typeDefinitions";

export type Product = {
  id: Uuid;
  name: string;
  unitPriceCents: number;
  availableQuantity: number;
};

export type PricedCartItem = {
  productId: Uuid;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  availableQuantity: number;
};

export type PricedCart = {
  id: Uuid;
  status: "open" | "checked_out";
  items: PricedCartItem[];
  grossCents: number;
  orderId: Uuid | null;
  pricedAt: "current_catalog";
};

export type Customer = {
  id: Uuid;
  name: string;
  email: string;
};

export type OrderLine = {
  productId: Uuid;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type Order = {
  id: Uuid;
  cartId: Uuid;
  customerId: Uuid | null;
  idempotencyKey: string;
  lines: OrderLine[];
  grossCents: number;
  discountCents: number;
  netCents: number;
  couponCode: string | null;
  placedAt: Iso8601DateTime;
};

export type CouponStatus = "available" | "disabled" | "redeemed";

export type Coupon = {
  code: string;
  source: "milestone" | "custom";
  customerId: Uuid | null;
  earnedByCustomerId: Uuid | null;
  milestone: number | null;
  percentOff: number;
  status: CouponStatus;
  redeemedOrderId: Uuid | null;
  createdAt: Iso8601DateTime;
  updatedAt: Iso8601DateTime;
};

export type RewardProgress = {
  ordersPlaced: number;
  everyNthOrder: number;
  discountPercent: number;
  eligibleMilestone: number | null;
  nextMilestone: number;
  ordersUntilNextMilestone: number;
  couponsEarned: number;
};

export type CustomerRewardSummary = Customer & RewardProgress & { createdAt: Iso8601DateTime };

export type StoreConfig = {
  everyNthOrder: number;
  discountPercent: number;
};

export type SalesReport = {
  purchasedQuantityByProduct: Array<{ productId: Uuid; name: string; quantity: number }>;
  grossRevenueCents: number;
  totalDiscountsCents: number;
  netRevenueCents: number;
  coupons: { generated: number; available: number; disabled: number; redeemed: number };
  successfullyPlacedOrders: number;
};

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};
