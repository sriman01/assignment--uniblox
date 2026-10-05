import type { Iso8601DateTime, Uuid } from "./typeDefinitions.js";

export type Product = {
  id: Uuid;
  name: string;
  unitPriceCents: number;
  availableQuantity: number;
};

export type CartItem = {
  productId: Uuid;
  quantity: number;
};

export type CartStatus = "open" | "checked_out";

export type Cart = {
  id: Uuid;
  customerId: Uuid | null;
  status: CartStatus;
  items: CartItem[];
  orderId: Uuid | null;
  createdAt: Iso8601DateTime;
  updatedAt: Iso8601DateTime;
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
  status: CartStatus;
  items: PricedCartItem[];
  grossCents: number;
  orderId: Uuid | null;
  pricedAt: "current_catalog";
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

export type CheckoutReceipt = {
  order: Order;
  replayed: boolean;
};

export type CouponStatus = "available" | "disabled" | "redeemed";

export type CouponSource = "milestone" | "custom";

export type Coupon = {
  code: string;
  source: CouponSource;
  /** Who may redeem it. `null` means any shopper. */
  customerId: Uuid | null;
  /** The customer whose orders earned this milestone. Never changes, even if the coupon is reassigned. */
  earnedByCustomerId: Uuid | null;
  milestone: number | null;
  percentOff: number;
  status: CouponStatus;
  redeemedOrderId: Uuid | null;
  createdAt: Iso8601DateTime;
  updatedAt: Iso8601DateTime;
};

export type Customer = {
  id: Uuid;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Iso8601DateTime;
};

export type PublicCustomer = {
  id: Uuid;
  name: string;
  email: string;
};

export type RewardProgress = {
  ordersPlaced: number;
  everyNthOrder: number;
  discountPercent: number;
  /** Lowest reached milestone that has no coupon yet. */
  eligibleMilestone: number | null;
  nextMilestone: number;
  ordersUntilNextMilestone: number;
  couponsEarned: number;
};

export type CustomerRewardSummary = PublicCustomer & RewardProgress & { createdAt: Iso8601DateTime };

export type StoreConfig = {
  everyNthOrder: number;
  discountPercent: number;
};

export type SalesReport = {
  purchasedQuantityByProduct: Array<{
    productId: Uuid;
    name: string;
    quantity: number;
  }>;
  grossRevenueCents: number;
  totalDiscountsCents: number;
  netRevenueCents: number;
  coupons: {
    generated: number;
    available: number;
    disabled: number;
    redeemed: number;
  };
  successfullyPlacedOrders: number;
};

export type IdempotencyRecord = {
  cartId: Uuid;
  orderId: Uuid;
};

export type StoreState = {
  products: Map<Uuid, Product>;
  carts: Map<Uuid, Cart>;
  orders: Map<Uuid, Order>;
  coupons: Map<string, Coupon>;
  customers: Map<Uuid, Customer>;
  idempotency: Map<string, IdempotencyRecord>;
  config: StoreConfig;
};
