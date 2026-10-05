const MAX_UNIT_PRICE_CENTS = 100_000_000_00;

export function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

export function lineTotalCents(unitPriceCents: number, quantity: number): number {
  assertNonNegativeInteger(unitPriceCents, "unitPriceCents");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("quantity must be a positive integer");
  }
  if (unitPriceCents > Number.MAX_SAFE_INTEGER / quantity) {
    throw new Error("line total exceeds exact integer range");
  }
  return unitPriceCents * quantity;
}

/**
 * Percentage discount in minor units.
 * Fractional cents are floored, so the customer is never charged a partial cent.
 * The result is clamped to the gross, so the net total cannot go negative.
 */
export function discountForPercent(grossCents: number, percent: number): number {
  assertNonNegativeInteger(grossCents, "grossCents");
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error("percent must be an integer from 0 to 100");
  }
  if (grossCents > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error("grossCents exceeds exact integer range");
  }
  const discount = Math.floor((grossCents * percent) / 100);
  if (discount < 0 || discount > grossCents) {
    throw new Error("discount escaped its bounds");
  }
  return discount;
}

export function isSafeUnitPrice(unitPriceCents: number): boolean {
  return Number.isInteger(unitPriceCents) && unitPriceCents >= 0 && unitPriceCents <= MAX_UNIT_PRICE_CENTS;
}
