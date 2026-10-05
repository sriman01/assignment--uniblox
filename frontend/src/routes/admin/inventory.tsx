import { useFetcher, useLoaderData } from "react-router";
import { api, unwrap } from "../../lib/api";
import { ProductImage } from "../../components/store/ProductImage";
import { StatCard } from "../../components/ui/StatCard";
import { lowStockThreshold, StockBadge } from "../../components/ui/StockBadge";
import { formatUsd } from "../../lib/money";
import type { Product } from "../../types";
import { uuidFromString } from "../../typeDefinitions";
import { RowStatus } from "../../components/admin/RowStatus";

export async function inventoryLoader() {
  return { products: unwrap(await api.products()).items };
}

export async function inventoryAction({ request }: { request: Request }) {
  const form = await request.formData();
  const productId = uuidFromString(String(form.get("productId") ?? ""));
  const availableQuantity = Number(form.get("availableQuantity"));
  const updated = await api.updateProduct(productId, { availableQuantity });
  return updated.ok ? { ok: true } : { error: updated.error.message };
}

export function InventoryRoute() {
  const { products } = useLoaderData() as { products: Product[] };
  const units = products.reduce((sum, product) => sum + product.availableQuantity, 0);
  const low = products.filter((product) => product.availableQuantity > 0 && product.availableQuantity <= lowStockThreshold).length;
  const soldOut = products.filter((product) => product.availableQuantity === 0).length;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Inventory</h1>
          <p>Stock is checked again at checkout. If you lower it here, an open cart will fail at checkout instead of overselling.</p>
        </div>
      </div>

      <div className="admin-stats admin-stats--3">
        <StatCard icon="box" label="Units in stock" value={String(units)} />
        <StatCard icon="refresh" label="Low stock items" value={String(low)} />
        <StatCard icon="warehouse" label="Sold out items" value={String(soldOut)} />
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th className="num">Price</th><th>Status</th><th className="num">Available quantity</th></tr>
            </thead>
            <tbody>
              {products.map((product) => <InventoryRow key={product.id} product={product} />)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function InventoryRow({ product }: { product: Product }) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const saving = fetcher.state !== "idle";

  return (
    <tr>
      <td>
        <div className="admin-product">
          <ProductImage productId={product.id} name={product.name} size="thumb" />
          <strong>{product.name}</strong>
        </div>
      </td>
      <td className="num">{formatUsd(product.unitPriceCents)}</td>
      <td><StockBadge available={product.availableQuantity} /></td>
      <td>
        <fetcher.Form method="post" className="inline-form">
          <input type="hidden" name="productId" value={product.id} />
          <input
            className="input input--sm"
            name="availableQuantity"
            type="number"
            min={0}
            step={1}
            defaultValue={product.availableQuantity}
            aria-label={`Available quantity for ${product.name}`}
            required
          />
          <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Update"}
          </button>
          <RowStatus saving={saving} data={fetcher.data} />
        </fetcher.Form>
      </td>
    </tr>
  );
}
