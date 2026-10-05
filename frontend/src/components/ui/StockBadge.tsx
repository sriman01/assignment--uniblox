export const lowStockThreshold = 3;

export function StockBadge({ available }: { available: number }) {
  if (available <= 0) {
    return <span className="badge badge--danger">Sold out</span>;
  }
  if (available <= lowStockThreshold) {
    return <span className="badge badge--warning">Only {available} left</span>;
  }
  return <span className="badge badge--success">In stock</span>;
}
