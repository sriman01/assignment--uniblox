import type { Coupon, RewardProgress, StoreState } from "./model.js";
import type { Uuid } from "./typeDefinitions.js";

export const couponCodePattern = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function milestoneCouponCode(state: StoreState, customerId: Uuid, milestone: number): string {
  const base = `REWARD-${milestone}-${customerId.slice(0, 8).toUpperCase()}`;
  let code = base;
  for (let suffix = 2; state.coupons.has(code); suffix += 1) {
    code = `${base}-${suffix}`;
  }
  return code;
}

function rewardedMilestones(state: StoreState, customerId: Uuid): Set<number> {
  const milestones = new Set<number>();
  for (const coupon of state.coupons.values()) {
    if (coupon.source === "milestone" && coupon.earnedByCustomerId === customerId && coupon.milestone !== null) {
      milestones.add(coupon.milestone);
    }
  }
  return milestones;
}

export function customerOrderCount(state: StoreState, customerId: Uuid): number {
  let count = 0;
  for (const order of state.orders.values()) {
    if (order.customerId === customerId) count += 1;
  }
  return count;
}

/** Milestones are counted per customer. Orders without a signed-in customer never count. */
export function rewardProgress(state: StoreState, customerId: Uuid): RewardProgress {
  const { everyNthOrder, discountPercent } = state.config;
  const ordersPlaced = customerOrderCount(state, customerId);
  const rewarded = rewardedMilestones(state, customerId);
  let eligibleMilestone: number | null = null;
  for (let milestone = everyNthOrder; milestone <= ordersPlaced; milestone += everyNthOrder) {
    if (!rewarded.has(milestone)) {
      eligibleMilestone = milestone;
      break;
    }
  }
  const nextMilestone = eligibleMilestone ?? (Math.floor(ordersPlaced / everyNthOrder) + 1) * everyNthOrder;
  return {
    ordersPlaced,
    everyNthOrder,
    discountPercent,
    eligibleMilestone,
    nextMilestone,
    ordersUntilNextMilestone: Math.max(0, nextMilestone - ordersPlaced),
    couponsEarned: rewarded.size,
  };
}

/** The customer whose unrewarded milestone order was placed first, so admin generation is first come, first served. */
export function earliestEligibleMilestone(state: StoreState): { customerId: Uuid; milestone: number } | null {
  const { everyNthOrder } = state.config;
  const counts = new Map<Uuid, number>();
  const rewarded = new Map<Uuid, Set<number>>();
  for (const order of state.orders.values()) {
    if (order.customerId === null) continue;
    const count = (counts.get(order.customerId) ?? 0) + 1;
    counts.set(order.customerId, count);
    if (count % everyNthOrder !== 0) continue;
    let milestones = rewarded.get(order.customerId);
    if (!milestones) {
      milestones = rewardedMilestones(state, order.customerId);
      rewarded.set(order.customerId, milestones);
    }
    if (!milestones.has(count)) return { customerId: order.customerId, milestone: count };
  }
  return null;
}

export function copyCoupon(coupon: Coupon): Coupon {
  return { ...coupon };
}
