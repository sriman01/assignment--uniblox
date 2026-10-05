import type { CheckoutStorePort } from "../port/outgoing/CheckoutStorePort.js";
import type { ClockPort } from "../port/outgoing/ClockPort.js";
import { couponCodeForMilestone } from "../../domain/catalog.js";
import { ErrorCode, domainError } from "../../domain/errors.js";
import { isSafeUnitPrice } from "../../domain/money.js";
import type { Coupon, Order, Product, SalesReport, StoreConfig } from "../../domain/model.js";
import { dataResult, errorResult, type Result } from "../../domain/result.js";

export class AdminService {
  constructor(
    private readonly store: CheckoutStorePort,
    private readonly clock: ClockPort,
  ) {}

  getConfig(): Promise<Result<StoreConfig>> {
    return this.store.transaction((state) => dataResult({ ...state.config }));
  }

  updateProduct(
    productId: string,
    patch: { unitPriceCents?: number; availableQuantity?: number },
  ): Promise<Result<Product>> {
    return this.store.transaction((state) => {
      const product = state.products.get(productId);
      if (!product) {
        return errorResult(domainError(ErrorCode.PRODUCT_NOT_FOUND, `Product ${productId} does not exist.`, { productId }));
      }
      if (patch.unitPriceCents !== undefined) {
        if (!isSafeUnitPrice(patch.unitPriceCents)) {
          return errorResult(
            domainError(ErrorCode.VALIDATION_ERROR, "Unit price must be a whole number of cents from 0 to 10000000000.", {
              unitPriceCents: patch.unitPriceCents,
            }),
          );
        }
        product.unitPriceCents = patch.unitPriceCents;
      }
      if (patch.availableQuantity !== undefined) {
        if (!Number.isInteger(patch.availableQuantity) || patch.availableQuantity < 0 || patch.availableQuantity > 1_000_000) {
          return errorResult(
            domainError(ErrorCode.VALIDATION_ERROR, "Available quantity must be a whole number from 0 to 1000000.", {
              availableQuantity: patch.availableQuantity,
            }),
          );
        }
        product.availableQuantity = patch.availableQuantity;
      }
      return dataResult({ ...product });
    });
  }

  generateCoupon(): Promise<Result<Coupon>> {
    return this.store.transaction((state) => {
      const placed = state.orders.size;
      const { everyNthOrder, discountPercent } = state.config;
      let nextMilestone: number | null = null;
      for (let milestone = everyNthOrder; milestone <= placed; milestone += everyNthOrder) {
        if (!state.coupons.has(couponCodeForMilestone(milestone))) {
          nextMilestone = milestone;
          break;
        }
      }
      if (nextMilestone === null) {
        return errorResult(
          domainError(
            ErrorCode.NO_ELIGIBLE_MILESTONE,
            `No unrewarded milestone is eligible. A coupon becomes available every ${everyNthOrder} successful orders, and ${placed} have been placed.`,
            { everyNthOrder, successfullyPlacedOrders: placed },
          ),
        );
      }

      const coupon: Coupon = {
        code: couponCodeForMilestone(nextMilestone),
        customerId: [...state.orders.values()][nextMilestone - 1]?.customerId ?? null,
        milestone: nextMilestone,
        percentOff: discountPercent,
        status: "available",
        redeemedOrderId: null,
        createdAt: this.clock.nowIso(),
      };
      state.coupons.set(coupon.code, coupon);
      return dataResult({ ...coupon });
    });
  }

  listCoupons(): Promise<Result<Coupon[]>> {
    return this.store.transaction((state) => dataResult([...state.coupons.values()].map((coupon) => ({ ...coupon }))));
  }

  listOrders(): Promise<Result<Order[]>> {
    return this.store.transaction((state) =>
      dataResult([...state.orders.values()].map((order) => ({ ...order, lines: order.lines.map((line) => ({ ...line })) }))),
    );
  }

  report(): Promise<Result<SalesReport>> {
    return this.store.transaction((state) => {
      const quantities = new Map<string, { productId: string; name: string; quantity: number }>();
      for (const product of state.products.values()) {
        quantities.set(product.id, { productId: product.id, name: product.name, quantity: 0 });
      }

      let grossRevenueCents = 0;
      let totalDiscountsCents = 0;
      let netRevenueCents = 0;
      for (const order of state.orders.values()) {
        grossRevenueCents += order.grossCents;
        totalDiscountsCents += order.discountCents;
        netRevenueCents += order.netCents;
        for (const line of order.lines) {
          const current = quantities.get(line.productId) ?? {
            productId: line.productId,
            name: line.name,
            quantity: 0,
          };
          current.quantity += line.quantity;
          quantities.set(line.productId, current);
        }
      }

      if (grossRevenueCents - totalDiscountsCents !== netRevenueCents) {
        throw new Error("report revenue does not reconcile");
      }

      const coupons = [...state.coupons.values()];
      const available = coupons.filter((coupon) => coupon.status === "available").length;
      const redeemed = coupons.filter((coupon) => coupon.status === "redeemed").length;
      if (available + redeemed !== coupons.length) {
        throw new Error("coupon counts do not reconcile");
      }

      return dataResult({
        purchasedQuantityByProduct: [...quantities.values()],
        grossRevenueCents,
        totalDiscountsCents,
        netRevenueCents,
        coupons: {
          generated: coupons.length,
          available,
          redeemed,
        },
        successfullyPlacedOrders: state.orders.size,
      });
    });
  }
}
