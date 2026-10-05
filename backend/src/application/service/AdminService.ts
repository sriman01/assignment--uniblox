import type { CheckoutStorePort } from "../port/outgoing/CheckoutStorePort.js";
import type { ClockPort } from "../port/outgoing/ClockPort.js";
import type { IdPort } from "../port/outgoing/IdPort.js";
import { ErrorCode, domainError, type DomainError } from "../../domain/errors.js";
import { isSafeUnitPrice } from "../../domain/money.js";
import type {
  Coupon,
  CustomerRewardSummary,
  Order,
  Product,
  SalesReport,
  StoreConfig,
  StoreState,
} from "../../domain/model.js";
import { dataResult, errorResult, type Result } from "../../domain/result.js";
import {
  copyCoupon,
  couponCodePattern,
  earliestEligibleMilestone,
  milestoneCouponCode,
  normalizeCouponCode,
  rewardProgress,
} from "../../domain/rewards.js";
import type { Uuid } from "../../domain/typeDefinitions.js";
import { missingCustomer, publicCustomer } from "./CustomerService.js";

export class AdminService {
  constructor(
    private readonly store: CheckoutStorePort,
    private readonly clock: ClockPort,
    private readonly ids: IdPort,
  ) {}

  getConfig(): Promise<Result<StoreConfig>> {
    return this.store.transaction((state) => dataResult({ ...state.config }));
  }

  updateConfig(config: StoreConfig): Promise<Result<StoreConfig>> {
    return this.store.transaction((state) => {
      if (!Number.isInteger(config.everyNthOrder) || config.everyNthOrder < 1 || config.everyNthOrder > 1_000_000) {
        return errorResult(
          domainError(ErrorCode.VALIDATION_ERROR, "Order milestone must be a whole number from 1 to 1000000.", {
            everyNthOrder: config.everyNthOrder,
          }),
        );
      }
      if (!Number.isInteger(config.discountPercent) || config.discountPercent < 0 || config.discountPercent > 100) {
        return errorResult(
          domainError(ErrorCode.VALIDATION_ERROR, "Discount percentage must be a whole number from 0 to 100.", {
            discountPercent: config.discountPercent,
          }),
        );
      }
      state.config = { ...config };
      return dataResult({ ...state.config });
    });
  }

  updateProduct(
    productId: Uuid,
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

  /**
   * Issues the milestone coupon a customer has earned with their own orders.
   * Without a customer id, the customer whose unrewarded milestone order came first is served.
   */
  generateCoupon(customerId: Uuid | null = null): Promise<Result<Coupon>> {
    return this.store.transaction((state) => {
      const { everyNthOrder, discountPercent } = state.config;
      let target: { customerId: Uuid; milestone: number } | null;
      if (customerId) {
        if (!state.customers.has(customerId)) return errorResult(missingCustomer(customerId));
        const progress = rewardProgress(state, customerId);
        if (progress.eligibleMilestone === null) {
          return errorResult(
            domainError(
              ErrorCode.NO_ELIGIBLE_MILESTONE,
              `This customer has no unrewarded milestone. A coupon is earned every ${everyNthOrder} orders, and they have placed ${progress.ordersPlaced}.`,
              { customerId, everyNthOrder, ordersPlaced: progress.ordersPlaced, ordersUntilNextMilestone: progress.ordersUntilNextMilestone },
            ),
          );
        }
        target = { customerId, milestone: progress.eligibleMilestone };
      } else {
        target = earliestEligibleMilestone(state);
        if (!target) {
          return errorResult(
            domainError(
              ErrorCode.NO_ELIGIBLE_MILESTONE,
              `No customer has an unrewarded milestone. A customer earns a coupon every ${everyNthOrder} of their own orders.`,
              { everyNthOrder },
            ),
          );
        }
      }

      const now = this.clock.nowIso();
      const coupon: Coupon = {
        code: milestoneCouponCode(state, target.customerId, target.milestone),
        source: "milestone",
        customerId: target.customerId,
        earnedByCustomerId: target.customerId,
        milestone: target.milestone,
        percentOff: discountPercent,
        status: "available",
        redeemedOrderId: null,
        createdAt: now,
        updatedAt: now,
      };
      state.coupons.set(coupon.code, coupon);
      return dataResult(copyCoupon(coupon));
    });
  }

  createCoupon(input: { code?: string; percentOff: number; customerId: Uuid | null }): Promise<Result<Coupon>> {
    return this.store.transaction((state) => {
      const percentError = invalidPercent(input.percentOff);
      if (percentError) return errorResult(percentError);
      if (input.customerId && !state.customers.has(input.customerId)) {
        return errorResult(missingCustomer(input.customerId));
      }

      let code: string;
      if (input.code !== undefined && input.code.trim() !== "") {
        code = normalizeCouponCode(input.code);
        if (!couponCodePattern.test(code)) {
          return errorResult(
            domainError(
              ErrorCode.VALIDATION_ERROR,
              "Coupon code must be 3 to 32 letters, digits, or dashes, starting with a letter or digit.",
              { code },
            ),
          );
        }
        if (state.coupons.has(code)) {
          return errorResult(domainError(ErrorCode.COUPON_CODE_TAKEN, `Coupon ${code} already exists.`, { code }));
        }
      } else {
        do {
          code = `GIFT-${this.ids.next().slice(0, 8).toUpperCase()}`;
        } while (state.coupons.has(code));
      }

      const now = this.clock.nowIso();
      const coupon: Coupon = {
        code,
        source: "custom",
        customerId: input.customerId,
        earnedByCustomerId: null,
        milestone: null,
        percentOff: input.percentOff,
        status: "available",
        redeemedOrderId: null,
        createdAt: now,
        updatedAt: now,
      };
      state.coupons.set(code, coupon);
      return dataResult(copyCoupon(coupon));
    });
  }

  /** Redeemed coupons are part of an order's receipt and cannot change. */
  updateCoupon(
    rawCode: string,
    patch: { percentOff?: number; customerId?: Uuid | null; status?: "available" | "disabled" },
  ): Promise<Result<Coupon>> {
    return this.store.transaction((state) => {
      const found = editableCoupon(state, rawCode);
      if (found.success !== true) return found;
      const coupon = found.data;
      if (patch.percentOff !== undefined) {
        const percentError = invalidPercent(patch.percentOff);
        if (percentError) return errorResult(percentError);
      }
      if (patch.customerId && !state.customers.has(patch.customerId)) {
        return errorResult(missingCustomer(patch.customerId));
      }

      if (patch.percentOff !== undefined) coupon.percentOff = patch.percentOff;
      if (patch.customerId !== undefined) coupon.customerId = patch.customerId;
      if (patch.status !== undefined) coupon.status = patch.status;
      coupon.updatedAt = this.clock.nowIso();
      return dataResult(copyCoupon(coupon));
    });
  }

  /** Deleting an unredeemed milestone coupon makes that milestone eligible again. */
  deleteCoupon(rawCode: string): Promise<Result<{ code: string; deleted: true }>> {
    return this.store.transaction((state) => {
      const found = editableCoupon(state, rawCode);
      if (found.success !== true) return found;
      state.coupons.delete(found.data.code);
      return dataResult({ code: found.data.code, deleted: true as const });
    });
  }

  listCoupons(): Promise<Result<Coupon[]>> {
    return this.store.transaction((state) => dataResult([...state.coupons.values()].map(copyCoupon)));
  }

  listCustomers(): Promise<Result<CustomerRewardSummary[]>> {
    return this.store.transaction((state) =>
      dataResult(
        [...state.customers.values()].map((customer) => ({
          ...publicCustomer(customer),
          createdAt: customer.createdAt,
          ...rewardProgress(state, customer.id),
        })),
      ),
    );
  }

  listOrders(): Promise<Result<Order[]>> {
    return this.store.transaction((state) =>
      dataResult([...state.orders.values()].map((order) => ({ ...order, lines: order.lines.map((line) => ({ ...line })) }))),
    );
  }

  report(): Promise<Result<SalesReport>> {
    return this.store.transaction((state) => {
      const quantities = new Map<Uuid, { productId: Uuid; name: string; quantity: number }>();
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
      const disabled = coupons.filter((coupon) => coupon.status === "disabled").length;
      const redeemed = coupons.filter((coupon) => coupon.status === "redeemed").length;
      if (available + disabled + redeemed !== coupons.length) {
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
          disabled,
          redeemed,
        },
        successfullyPlacedOrders: state.orders.size,
      });
    });
  }
}

function invalidPercent(percentOff: number): DomainError | null {
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) {
    return domainError(ErrorCode.VALIDATION_ERROR, "Discount percentage must be a whole number from 1 to 100.", {
      percentOff,
    });
  }
  return null;
}

function editableCoupon(state: StoreState, rawCode: string): Result<Coupon> {
  const code = normalizeCouponCode(rawCode);
  const coupon = state.coupons.get(code);
  if (!coupon) {
    return errorResult(domainError(ErrorCode.COUPON_NOT_FOUND, `Coupon ${code} does not exist.`, { code }));
  }
  if (coupon.status === "redeemed") {
    return errorResult(
      domainError(ErrorCode.COUPON_LOCKED, `Coupon ${code} was redeemed on an order and can no longer change.`, {
        code,
        redeemedOrderId: coupon.redeemedOrderId,
      }),
    );
  }
  return dataResult(coupon);
}
