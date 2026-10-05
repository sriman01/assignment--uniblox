export type Product = {
  id: string;
  name: string;
  unitPriceCents: number;
  availableQuantity: number;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CartStatus = "open" | "checked_out";

export type Cart = {
  id: string;
  customerId: string | null;
  status: CartStatus;
  items: CartItem[];
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
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
  status: CartStatus;
  items: PricedCartItem[];
  grossCents: number;
  orderId: string | null;
  pricedAt: "current_catalog";
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

export type CheckoutReceipt = {
  order: Order;
  replayed: boolean;
};

export type CouponStatus = "available" | "redeemed";

export type Coupon = {
  code: string;
  customerId: string | null;
  milestone: number;
  percentOff: number;
  status: CouponStatus;
  redeemedOrderId: string | null;
  createdAt: string;
};

export type StoreConfig = {
  everyNthOrder: number;
  discountPercent: number;
};

export type SalesReport = {
  purchasedQuantityByProduct: Array<{
    productId: string;
    name: string;
    quantity: number;
  }>;
  grossRevenueCents: number;
  totalDiscountsCents: number;
  netRevenueCents: number;
  coupons: {
    generated: number;
    available: number;
    redeemed: number;
  };
  successfullyPlacedOrders: number;
};

export type IdempotencyRecord = {
  cartId: string;
  orderId: string;
};

export type StoreState = {
  products: Map<string, Product>;
  carts: Map<string, Cart>;
  orders: Map<string, Order>;
  coupons: Map<string, Coupon>;
  idempotency: Map<string, IdempotencyRecord>;
  config: StoreConfig;
};
