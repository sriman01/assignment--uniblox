import { Form, Link, useLoaderData, useRouteLoaderData, useSubmit } from "react-router";
import { openCartQuantities, type StoreData } from "../components/layout/StoreShell";
import { ProductCard } from "../components/store/ProductCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { api, unwrap } from "../lib/api";
import { productCategories, productContent, type ProductCategory } from "../lib/productContent";
import type { Product } from "../types";

type Sort = "featured" | "price-asc" | "price-desc" | "name";
type Availability = "all" | "in-stock";

type CatalogData = {
  all: Product[];
  products: Product[];
  query: string;
  category: ProductCategory | null;
  sort: Sort;
  availability: Availability;
};

export async function catalogLoader({ request }: { request: Request }): Promise<CatalogData> {
  const url = new URL(request.url);
  const all = unwrap(await api.products()).items;
  const query = (url.searchParams.get("q") ?? "").trim();
  const requestedCategory = url.searchParams.get("category");
  const category = productCategories.find((value) => value === requestedCategory) ?? null;
  const requestedSort = url.searchParams.get("sort");
  const sort: Sort = requestedSort === "price-asc" || requestedSort === "price-desc" || requestedSort === "name" ? requestedSort : "featured";
  const availability: Availability = url.searchParams.get("availability") === "in-stock" ? "in-stock" : "all";

  const needle = query.toLowerCase();
  const products = all
    .filter((product) => !needle || product.name.toLowerCase().includes(needle) || productContent(product.id).summary.toLowerCase().includes(needle))
    .filter((product) => !category || productContent(product.id).category === category)
    .filter((product) => availability === "all" || product.availableQuantity > 0);
  if (sort === "price-asc") products.sort((a, b) => a.unitPriceCents - b.unitPriceCents);
  if (sort === "price-desc") products.sort((a, b) => b.unitPriceCents - a.unitPriceCents);
  if (sort === "name") products.sort((a, b) => a.name.localeCompare(b.name));

  return { all, products, query, category, sort, availability };
}

function catalogHref(data: CatalogData, change: Partial<Record<"q" | "category" | "sort" | "availability", string | null>>): string {
  const params = new URLSearchParams();
  const values = {
    q: data.query || null,
    category: data.category,
    sort: data.sort === "featured" ? null : data.sort,
    availability: data.availability === "all" ? null : data.availability,
    ...change,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `/products?${search}` : "/products";
}

export function CatalogPage() {
  const data = useLoaderData() as CatalogData;
  const store = useRouteLoaderData("store") as StoreData;
  const submit = useSubmit();
  const inCart = openCartQuantities(store.cart);
  const { all, products, query, category, sort, availability } = data;
  const title = category ?? (query ? `Results for “${query}”` : "All products");

  return (
    <>
      <PageHeader
        title={title}
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Products", to: category || query ? "/products" : undefined }, ...(category ? [{ label: category }] : [])]}
        description="Bedding, pillows, and home essentials. Prices and stock are live until you check out."
      />
      <div className="container section--tight">
        <div className="catalog-layout">
          <aside className="card filters" aria-label="Filters">
            <div className="filters__group">
              <h3>Category</h3>
              <Link to={catalogHref(data, { category: null })} className={`filter-link${category === null ? " is-active" : ""}`}>
                All products <span>{all.length}</span>
              </Link>
              {productCategories.map((value) => (
                <Link key={value} to={catalogHref(data, { category: value })} className={`filter-link${category === value ? " is-active" : ""}`}>
                  {value} <span>{all.filter((product) => productContent(product.id).category === value).length}</span>
                </Link>
              ))}
            </div>
            <div className="filters__group">
              <h3>Availability</h3>
              <Link to={catalogHref(data, { availability: null })} className={`filter-link${availability === "all" ? " is-active" : ""}`}>
                Show all
              </Link>
              <Link to={catalogHref(data, { availability: "in-stock" })} className={`filter-link${availability === "in-stock" ? " is-active" : ""}`}>
                In stock only <span>{all.filter((product) => product.availableQuantity > 0).length}</span>
              </Link>
            </div>
          </aside>

          <div>
            <div className="catalog-toolbar">
              <div className="active-filters">
                <span className="muted">{products.length} product{products.length === 1 ? "" : "s"}</span>
                {query ? (
                  <Link className="filter-chip" to={catalogHref(data, { q: null })} aria-label={`Clear search ${query}`}>
                    “{query}” <Icon name="close" size={12} />
                  </Link>
                ) : null}
                {category ? (
                  <Link className="filter-chip" to={catalogHref(data, { category: null })} aria-label={`Clear category ${category}`}>
                    {category} <Icon name="close" size={12} />
                  </Link>
                ) : null}
              </div>
              <Form method="get" onChange={(event) => submit(event.currentTarget)}>
                {query ? <input type="hidden" name="q" value={query} /> : null}
                {category ? <input type="hidden" name="category" value={category} /> : null}
                {availability !== "all" ? <input type="hidden" name="availability" value={availability} /> : null}
                <label htmlFor="sort" className="muted small">Sort by</label>
                <select id="sort" name="sort" className="select" defaultValue={sort}>
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="name">Name</option>
                </select>
                <noscript><button className="btn btn--outline btn--sm" type="submit">Apply</button></noscript>
              </Form>
            </div>

            {products.length === 0 ? (
              <EmptyState
                icon="search"
                title="No products match"
                message="Try a different search term or clear your filters."
                action={<Link className="btn btn--primary" to="/products">Clear filters</Link>}
              />
            ) : (
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} quantityInCart={inCart.get(product.id) ?? 0} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
