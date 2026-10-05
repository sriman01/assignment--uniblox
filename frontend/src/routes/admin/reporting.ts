import type { Order } from "../../types";

export type ReportGroup = "day" | "week" | "month";
export type ReportPeriod = { label: string; orders: number; units: number; netCents: number };

export function aggregateOrders(orders: Order[], group: ReportGroup): ReportPeriod[] {
  const rows = new Map<string, ReportPeriod>();
  for (const order of orders) {
    const date = new Date(order.placedAt);
    const label = group === "day"
      ? order.placedAt.slice(0, 10)
      : group === "month"
        ? order.placedAt.slice(0, 7)
        : weekLabel(date);
    const row = rows.get(label) ?? { label, orders: 0, units: 0, netCents: 0 };
    row.orders += 1;
    row.units += order.lines.reduce((sum, line) => sum + line.quantity, 0);
    row.netCents += order.netCents;
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function weekLabel(date: Date): string {
  const day = (date.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
  return `Week of ${monday.toISOString().slice(0, 10)}`;
}
