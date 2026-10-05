const cartKey = "northline.cartId";

export function readCartId(): string | null {
  return localStorage.getItem(cartKey);
}

export function writeCartId(cartId: string): void {
  localStorage.setItem(cartKey, cartId);
}

export function clearCartId(): void {
  localStorage.removeItem(cartKey);
}

export function checkoutIdempotencyKey(cartId: string): string {
  const storageKey = `northline.idempotency.${cartId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  sessionStorage.setItem(storageKey, created);
  return created;
}

export function clearCheckoutIdempotencyKey(cartId: string): void {
  sessionStorage.removeItem(`northline.idempotency.${cartId}`);
}
