import type { ErrorCode } from "../../../../domain/errors.js";

const statusByCode = {
  VALIDATION_ERROR: 400,
  INVALID_QUANTITY: 400,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  PRODUCT_NOT_FOUND: 404,
  CART_NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  COUPON_NOT_FOUND: 404,
  ITEM_NOT_IN_CART: 404,
  INSUFFICIENT_INVENTORY: 409,
  ITEM_ALREADY_IN_CART: 409,
  CART_ALREADY_CHECKED_OUT: 409,
  CART_EMPTY: 409,
  COUPON_UNAVAILABLE: 409,
  NO_ELIGIBLE_MILESTONE: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
} as const satisfies Record<ErrorCode, 400 | 404 | 409>;

export function statusFor(code: ErrorCode): 400 | 404 | 409 {
  return statusByCode[code];
}
