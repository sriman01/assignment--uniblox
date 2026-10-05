import { describe, expect, it } from "vitest";
import { discountForPercent, lineTotalCents } from "../src/domain/money.js";

describe("money", () => {
  it("floors fractional cents and never discounts more than the gross", () => {
    expect(discountForPercent(999, 10)).toBe(99);
    expect(discountForPercent(1234, 10)).toBe(123);
    expect(discountForPercent(1000, 100)).toBe(1000);
    expect(discountForPercent(1000, 0)).toBe(0);
    expect(discountForPercent(0, 10)).toBe(0);
  });

  it("rejects values that cannot be represented exactly", () => {
    expect(() => discountForPercent(10.5, 10)).toThrow(/non-negative integer/);
    expect(() => discountForPercent(1000, 10.5)).toThrow(/percent/);
    expect(() => discountForPercent(1000, 101)).toThrow(/percent/);
    expect(() => lineTotalCents(100, 0)).toThrow(/quantity/);
  });
});
