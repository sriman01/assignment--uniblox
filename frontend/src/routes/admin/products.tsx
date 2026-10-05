import { useFetcher, useLoaderData } from "react-router";
import { api, unwrap } from "../../lib/api";
import { RowStatus } from "../../components/admin/RowStatus";
import { ProductImage } from "../../components/store/ProductImage";
import { formatUsd } from "../../lib/money";
import { productContent } from "../../lib/productContent";
import type { Product } from "../../types";
import { uuidFromString } from "../../typeDefinitions";

export async function productsLoader() {
  return { products: unwrap(await api.products()).items };
}

export async function productsAction({ request }: { request: Request }) {
  const form = await request.formData();
  const productId = uuidFromString(String(form.get("productId") ?? ""));
  const unitPriceCents = Math.round(Number(form.get("price")) * 100);
  const response = await api.updateProduct(productId, { unitPriceCents });
  return response.ok ? { ok: true } : { error: response.error.message };
}

export function ProductsRoute() {
  const { products } = useLoaderData() as { products: Product[] };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Products</h1>
          <p>Change prices here. Open carts see the new price right away. Orders that were already placed keep the price on their receipt.</p>
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th>Category</th><th>Product ID</th><th className="num">Current price</th><th className="num">New price</th></tr>
            </thead>
            <tbody>
              {products.map((product) => <ProductRow key={product.id} product={product} />)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ProductRow({ product }: { product: Product }) {
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
      <td><span className="badge badge--navy">{productContent(product.id).category}</span></td>
      <td><span className="mono muted">{product.id.slice(0, 8)}…</span></td>
      <td className="num"><strong>{formatUsd(product.unitPriceCents)}</strong></td>
      <td>
        <fetcher.Form method="post" className="inline-form">
          <input type="hidden" name="productId" value={product.id} />
          <label className="input-prefix">
            <span>$</span>
            <input
              className="input input--sm"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={(product.unitPriceCents / 100).toFixed(2)}
              aria-label={`New price for ${product.name}`}
              required
            />
          </label>
          <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <RowStatus saving={saving} data={fetcher.data} />
        </fetcher.Form>
      </td>
    </tr>
  );
}