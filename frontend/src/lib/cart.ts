import type { PricedCart } from "../types";
import { uuidFromString } from "../typeDefinitions";
import { api } from "./api";
import { clearCartId, readCartId, writeCartId } from "./storage";

export type CartMutationResult = { ok: true; productId: string; quantity: number } | { ok: false; error: string };

async function openCart(): Promise<{ ok: true; cart: PricedCart } | { ok: false; error: string }> {
  const existing = readCartId();
  if (existing) {
    const cart = await api.getCart(existing);
    if (cart.ok && cart.data.status === "open") {
      return { ok: true, cart: cart.data };
    }
    clearCartId();
  }
  const created = await api.createCart();
  if (!created.ok) {
    return { ok: false, error: created.error.message };
  }
  writeCartId(created.data.id);
  return { ok: true, cart: created.data };
}

export async function addToCartAction({ request }: { request: Request }): Promise<CartMutationResult> {
  const form = await request.formData();
  let productId;
  try {
    productId = uuidFromString(String(form.get("productId") ?? ""));
  } catch {
    return { ok: false, error: "That product could not be found." };
  }
  const requested = Number(form.get("quantity") ?? 1);
  if (!Number.isInteger(requested) || requested < 1) {
    return { ok: false, error: "Choose a quantity of at least 1." };
  }

  const opened = await openCart();
  if (!opened.ok) {
    return opened;
  }
  const existing = opened.cart.items.find((item) => item.productId === productId);
  const result = existing
    ? await api.updateItem(opened.cart.id, productId, existing.quantity + requested)
    : await api.addItem(opened.cart.id, productId, requested);
  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }
  const line = result.data.items.find((item) => item.productId === productId);
  return { ok: true, productId, quantity: line?.quantity ?? requested };
}
