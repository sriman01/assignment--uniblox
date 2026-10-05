import { uuidFromString, type Uuid } from "../typeDefinitions";

const cartKey = "northline.cartId";
export const wishlistKey = "assignment.wishlist";

export function readCartId(): Uuid | null {
  const value = localStorage.getItem(cartKey);
  if (!value) return null;
  try {
    return uuidFromString(value);
  } catch {
    localStorage.removeItem(cartKey);
    return null;
  }
}

export function writeCartId(cartId: Uuid): void {
  localStorage.setItem(cartKey, cartId);
}

export function clearCartId(): void {
  localStorage.removeItem(cartKey);
}

export function checkoutIdempotencyKey(cartId: Uuid): string {
  const storageKey = `northline.idempotency.${cartId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  sessionStorage.setItem(storageKey, created);
  return created;
}

export function clearCheckoutIdempotencyKey(cartId: Uuid): void {
  sessionStorage.removeItem(`northline.idempotency.${cartId}`);
}

export function readWishlistIds(): Uuid[] {
  try {
    const stored = JSON.parse(localStorage.getItem(wishlistKey) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const ids = stored.flatMap((value) => {
      try {
        return typeof value === "string" ? [uuidFromString(value)] : [];
      } catch {
        return [];
      }
    });
    return [...new Set(ids)];
  } catch {
    localStorage.removeItem(wishlistKey);
    return [];
  }
}

export function writeWishlistIds(ids: Uuid[]): void {
  localStorage.setItem(wishlistKey, JSON.stringify([...new Set(ids)]));
}
