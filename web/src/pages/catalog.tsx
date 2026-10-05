import { Form, useActionData, useLoaderData, useNavigation, useRouteLoaderData } from "react-router";
import { api, unwrap } from "../api";
import { formatUsd } from "../money";
import type { StoreData } from "../shell";
import { clearCartId, readCartId, writeCartId } from "../storage";
import type { Product } from "../types";

const swatches: Record<string, string> = {
  prd_merino_blanket: "#d8c7aa",
  prd_linen_sheet: "#f4efe6",
  prd_down_pillow: "#ffffff",
  prd_wool_throw: "#6d5d4a",
  prd_cedar_sachet: "#c4a574",
  prd_eye_mask: "#2c2a28",
};

const groups: Record<string, string> = {
  prd_merino_blanket: "Bedding",
  prd_linen_sheet: "Bedding",
  prd_wool_throw: "Bedding",
  prd_down_pillow: "Pillows",
  prd_eye_mask: "Pillows",
  prd_cedar_sachet: "Home",
};

export async function catalogLoader() {
  return { products: unwrap(await api.products()).items };
}

export async function catalogAction({ request }: { request: Request }) {
  const form = await request.formData();
  const productId = String(form.get("productId") ?? "");
  const cart = await openCart();
  if (!cart.ok) {
    return { error: cart.error };
  }
  const added = await api.addItem(cart.cartId, productId, 1);
  if (!added.ok) {
    return { error: added.error.message };
  }
  return { added: productId };
}

async function openCart(): Promise<{ ok: true; cartId: string } | { ok: false; error: string }> {
  const existing = readCartId();
  if (existing) {
    const cart = await api.getCart(existing);
    if (cart.ok && cart.data.status === "open") {
      return { ok: true, cartId: existing };
    }
    clearCartId();
  }
  const created = await api.createCart();
  if (!created.ok) {
    return { ok: false, error: created.error.message };
  }
  writeCartId(created.data.id);
  return { ok: true, cartId: created.data.id };
}

export function CatalogPage() {
  const { products } = useLoaderData() as { products: Product[] };
  const store = useRouteLoaderData("store") as StoreData;
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();
  const pendingProduct = navigation.formData?.get("productId");
  const inCart = new Set(store.cart?.status === "open" ? store.cart.items.map((item) => item.productId) : []);

  return (
    <section>
      <div className="hero">
        <p className="eyebrow">Sleep, made quieter</p>
        <h1>Bedding, pillows, and the small things around them.</h1>
        <p>Prices stay live until checkout. The receipt keeps the price you were charged. Rewards work like the store coupon: every 5th order can earn 10% off.</p>
      </div>
      {actionData?.error ? <p className="error">{actionData.error}</p> : null}
      <div className="grid">
        {products.map((product) => (
          <article className="card" key={product.id}>
            <div className="swatch" style={{ background: swatches[product.id] ?? "#f6f6f6" }} />
            <div className="card-body">
              <p className="eyebrow">{groups[product.id] ?? "Shop"}</p>
              <h2>{product.name}</h2>
              <div className="card-actions">
                <strong className="price">{formatUsd(product.unitPriceCents)}</strong>
                <span className={product.availableQuantity <= 2 ? "stock low" : "stock"}>{stockLabel(product)}</span>
              </div>
              {inCart.has(product.id) ? (
                <span className="chip">In cart</span>
              ) : (
                <Form method="post">
                  <input type="hidden" name="productId" value={product.id} />
                  <button className="btn btn-full" type="submit" disabled={product.availableQuantity < 1 || pendingProduct === product.id}>
                    {pendingProduct === product.id ? "Adding…" : "Add to cart"}
                  </button>
                </Form>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function stockLabel(product: Product): string {
  if (product.availableQuantity <= 0) return "Sold out";
  if (product.availableQuantity <= 2) return `Only ${product.availableQuantity} left`;
  return `${product.availableQuantity} in stock`;
}
