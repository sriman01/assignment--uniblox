import type { CheckoutStorePort } from "../port/outgoing/CheckoutStorePort.js";
import type { ClockPort } from "../port/outgoing/ClockPort.js";
import type { IdPort } from "../port/outgoing/IdPort.js";
import { ErrorCode, domainError, type DomainError } from "../../domain/errors.js";
import { discountForPercent, lineTotalCents } from "../../domain/money.js";
import type {
  Cart,
  CheckoutReceipt,
  Coupon,
  Order,
  PricedCart,
  Product,
  StoreState,
} from "../../domain/model.js";
import { dataResult, errorResult, type Result } from "../../domain/result.js";
import { priceCart } from "./pricing.js";

export class StorefrontService {
  constructor(
    private readonly store: CheckoutStorePort,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
  ) {}

  listProducts(): Promise<Result<Product[]>> {
    return this.store.transaction((state) => dataResult([...state.products.values()].map(copyProduct)));
  }

  getProduct(productId: string): Promise<Result<Product>> {
    return this.store.transaction((state) => {
      const product = state.products.get(productId);
      if (!product) {
        return errorResult(missingProduct(productId));
      }
      return dataResult(copyProduct(product));
    });
  }

  createCart(customerId: string | null = null): Promise<Result<PricedCart>> {
    return this.store.transaction((state) => {
      const now = this.clock.nowIso();
      const cart: Cart = {
        id: this.ids.next("crt"),
        customerId,
        status: "open",
        items: [],
        orderId: null,
        createdAt: now,
        updatedAt: now,
      };
      state.carts.set(cart.id, cart);
      return priceCart(state, cart.id);
    });
  }

  getCart(cartId: string): Promise<Result<PricedCart>> {
    return this.store.transaction((state) => priceCart(state, cartId));
  }

  addItem(cartId: string, productId: string, quantity: number): Promise<Result<PricedCart>> {
    return this.store.transaction((state) => {
      const cartResult = requireOpenCart(state, cartId);
      if (cartResult.success !== true) {
        return cartResult;
      }
      const quantityError = invalidQuantity(quantity);
      if (quantityError) {
        return errorResult(quantityError);
      }
      const product = state.products.get(productId);
      if (!product) {
        return errorResult(missingProduct(productId));
      }
      if (cartResult.data.items.some((item) => item.productId === productId)) {
        return errorResult(
          domainError(
            ErrorCode.ITEM_ALREADY_IN_CART,
            `${product.name} is already in this cart. Update the quantity instead.`,
            { cartId, productId },
          ),
        );
      }
      if (quantity > product.availableQuantity) {
        return errorResult(insufficientInventory(product, quantity));
      }

      cartResult.data.items.push({ productId, quantity });
      cartResult.data.updatedAt = this.clock.nowIso();
      return priceCart(state, cartId);
    });
  }

  updateItem(cartId: string, productId: string, quantity: number): Promise<Result<PricedCart>> {
    return this.store.transaction((state) => {
      const cartResult = requireOpenCart(state, cartId);
      if (cartResult.success !== true) {
        return cartResult;
      }
      const quantityError = invalidQuantity(quantity);
      if (quantityError) {
        return errorResult(quantityError);
      }
      const item = cartResult.data.items.find((entry) => entry.productId === productId);
      if (!item) {
        return errorResult(
          domainError(ErrorCode.ITEM_NOT_IN_CART, `Product ${productId} is not in this cart.`, { cartId, productId }),
        );
      }
      const product = state.products.get(productId);
      if (!product) {
        return errorResult(missingProduct(productId));
      }
      if (quantity > product.availableQuantity) {
        return errorResult(insufficientInventory(product, quantity));
      }

      item.quantity = quantity;
      cartResult.data.updatedAt = this.clock.nowIso();
      return priceCart(state, cartId);
    });
  }

  removeItem(cartId: string, productId: string): Promise<Result<PricedCart>> {
    return this.store.transaction((state) => {
      const cartResult = requireOpenCart(state, cartId);
      if (cartResult.success !== true) {
        return cartResult;
      }
      const index = cartResult.data.items.findIndex((item) => item.productId === productId);
      if (index === -1) {
        return errorResult(
          domainError(ErrorCode.ITEM_NOT_IN_CART, `Product ${productId} is not in this cart.`, { cartId, productId }),
        );
      }
      cartResult.data.items.splice(index, 1);
      cartResult.data.updatedAt = this.clock.nowIso();
      return priceCart(state, cartId);
    });
  }

  checkout(
    cartId: string,
    idempotencyKey: string,
    couponCode: string | null,
    customerId: string | null = null,
  ): Promise<Result<CheckoutReceipt>> {
    return this.store.transaction((state) => {
      const key = idempotencyKey.trim();
      if (!key) {
        return errorResult(
          domainError(
            ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
            "Send an Idempotency-Key header so a retry cannot place a second order.",
          ),
        );
      }

      const existing = state.idempotency.get(key);
      if (existing) {
        if (existing.cartId !== cartId) {
          return errorResult(
            domainError(
              ErrorCode.IDEMPOTENCY_KEY_REUSED,
              "This Idempotency-Key was already used for a different cart.",
              { cartId, existingCartId: existing.cartId },
            ),
          );
        }
        const order = state.orders.get(existing.orderId);
        if (!order) {
          throw new Error(`idempotency record ${key} points at missing order ${existing.orderId}`);
        }
        return dataResult({ order: copyOrder(order), replayed: true });
      }

      const cartResult = requireOpenCart(state, cartId);
      if (cartResult.success !== true) {
        return cartResult;
      }
      const cart = cartResult.data;
      if (cart.items.length === 0) {
        return errorResult(domainError(ErrorCode.CART_EMPTY, "The cart is empty.", { cartId }));
      }

      const priced = priceCart(state, cartId);
      if (priced.success !== true) {
        return priced;
      }
      for (const item of priced.data.items) {
        if (item.quantity > item.availableQuantity) {
          return errorResult(
            domainError(
              ErrorCode.INSUFFICIENT_INVENTORY,
              `Only ${item.availableQuantity} unit${item.availableQuantity === 1 ? "" : "s"} of ${item.name} ${item.availableQuantity === 1 ? "is" : "are"} available.`,
              {
                productId: item.productId,
                name: item.name,
                requested: item.quantity,
                available: item.availableQuantity,
              },
            ),
          );
        }
      }

      const normalizedCode = couponCode?.trim().toUpperCase() ?? "";
      let percentOff = 0;
      let appliedCode: string | null = null;
      if (normalizedCode) {
        const coupon = state.coupons.get(normalizedCode);
        if (!coupon) {
          return errorResult(
            domainError(ErrorCode.COUPON_NOT_FOUND, `Coupon ${normalizedCode} does not exist.`, { couponCode: normalizedCode }),
          );
        }
        if (coupon.status !== "available") {
          return errorResult(
            domainError(ErrorCode.COUPON_UNAVAILABLE, `Coupon ${coupon.code} has already been redeemed.`, {
              couponCode: coupon.code,
              status: coupon.status,
            }),
          );
        }
        if (coupon.customerId !== null && coupon.customerId !== customerId) {
          return errorResult(
            domainError(ErrorCode.COUPON_UNAVAILABLE, `Coupon ${coupon.code} belongs to another customer.`, {
              couponCode: coupon.code,
            }),
          );
        }
        percentOff = coupon.percentOff;
        appliedCode = coupon.code;
      }

      const grossCents = priced.data.grossCents;
      const discountCents = discountForPercent(grossCents, percentOff);
      const netCents = grossCents - discountCents;
      if (netCents < 0) {
        throw new Error("net total went negative");
      }

      const orderId = this.ids.next("ord");
      const now = this.clock.nowIso();
      const order: Order = {
        id: orderId,
        cartId,
        customerId: customerId ?? cart.customerId,
        idempotencyKey: key,
        lines: priced.data.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: lineTotalCents(item.unitPriceCents, item.quantity),
        })),
        grossCents,
        discountCents,
        netCents,
        couponCode: appliedCode,
        placedAt: now,
      };

      const requested = new Map<string, number>();
      for (const line of order.lines) {
        requested.set(line.productId, (requested.get(line.productId) ?? 0) + line.quantity);
      }
      for (const [productId, quantity] of requested) {
        const product = state.products.get(productId);
        if (!product || product.availableQuantity < quantity) {
          throw new Error("inventory changed inside the checkout transaction");
        }
      }
      for (const [productId, quantity] of requested) {
        const product = state.products.get(productId);
        if (!product) {
          throw new Error("product disappeared inside the checkout transaction");
        }
        product.availableQuantity -= quantity;
      }
      if (appliedCode) {
        const coupon = state.coupons.get(appliedCode);
        if (!coupon || coupon.status !== "available") {
          throw new Error("coupon changed inside the checkout transaction");
        }
        coupon.status = "redeemed";
        coupon.redeemedOrderId = orderId;
      }
      state.orders.set(orderId, order);
      cart.status = "checked_out";
      cart.orderId = orderId;
      cart.updatedAt = now;
      state.idempotency.set(key, { cartId, orderId });

      return dataResult({ order: copyOrder(order), replayed: false });
    });
  }

  getOrder(orderId: string): Promise<Result<Order>> {
    return this.store.transaction((state) => {
      const order = state.orders.get(orderId);
      if (!order) {
        return errorResult(domainError(ErrorCode.ORDER_NOT_FOUND, `Order ${orderId} does not exist.`, { orderId }));
      }
      return dataResult(copyOrder(order));
    });
  }

  listCustomerOrders(customerId: string): Promise<Result<Order[]>> {
    return this.store.transaction((state) =>
      dataResult(
        [...state.orders.values()]
          .filter((order) => order.customerId === customerId)
          .map(copyOrder)
          .reverse(),
      ),
    );
  }

  listCustomerCoupons(customerId: string): Promise<Result<Coupon[]>> {
    return this.store.transaction((state) =>
      dataResult(
        [...state.coupons.values()]
          .filter((coupon) => coupon.customerId === customerId)
          .map((coupon) => ({ ...coupon })),
      ),
    );
  }
}

function requireOpenCart(state: StoreState, cartId: string): Result<Cart> {
  const cart = state.carts.get(cartId);
  if (!cart) {
    return errorResult(domainError(ErrorCode.CART_NOT_FOUND, `Cart ${cartId} does not exist.`, { cartId }));
  }
  if (cart.status === "checked_out") {
    return errorResult(
      domainError(ErrorCode.CART_ALREADY_CHECKED_OUT, "This cart has already been checked out.", {
        cartId,
        orderId: cart.orderId,
      }),
    );
  }
  return dataResult(cart);
}

function invalidQuantity(quantity: number): DomainError | null {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return domainError(ErrorCode.INVALID_QUANTITY, "Quantity must be a whole number of at least 1.", { quantity });
  }
  return null;
}

function missingProduct(productId: string): DomainError {
  return domainError(ErrorCode.PRODUCT_NOT_FOUND, `Product ${productId} does not exist.`, { productId });
}

function insufficientInventory(product: Product, requested: number): DomainError {
  return domainError(
    ErrorCode.INSUFFICIENT_INVENTORY,
    `Only ${product.availableQuantity} unit${product.availableQuantity === 1 ? "" : "s"} of ${product.name} ${product.availableQuantity === 1 ? "is" : "are"} available.`,
    {
      productId: product.id,
      name: product.name,
      requested,
      available: product.availableQuantity,
    },
  );
}

function copyProduct(product: Product): Product {
  return { ...product };
}

function copyOrder(order: Order): Order {
  return { ...order, lines: order.lines.map((line) => ({ ...line })) };
}
