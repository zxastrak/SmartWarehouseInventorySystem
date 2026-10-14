import { stockStatus } from "../data/inventory.js";

export function parseDate(value) {
  const text = String(value);
  if (/(Z|[+-]\d{2}:\d{2})$/.test(text)) return new Date(text);
  return new Date(
    (text.length === 10 ? `${text}T00:00:00` : text) + "+07:00"
  );
}

export const dateKey = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(parseDate(value));

export const todayKey = () => dateKey(new Date().toISOString());

export const readableDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }).format(parseDate(value));

export function periodBounds(period, records, custom = {}) {
  const today = todayKey();
  if (period === "custom") {
    return { start: custom.start, end: custom.end };
  }
  if (period === "today") return { start: today, end: today };
  if (period === "month") {
    return { start: today.slice(0, 7) + "-01", end: today };
  }
  const dates = records.map((row) => dateKey(row.date)).sort();
  return { start: dates[0] || today, end: today };
}

export function inventoryReport(items) {
  return items.map((item) => ({
    ...item,
    status: stockStatus(item),
    value:
      Number.isFinite(item.unitCost) &&
      item.unitCost >= 0 &&
      item.costCurrency === "IDR"
        ? item.current * item.unitCost
        : null,
  }));
}

export function inventorySummary(rows) {
  const healthy = rows.filter((r) => r.status === "In Stock").length;
  const zero = rows.filter((r) => r.status === "Out of Stock").length;

  return {
    count: rows.length,
    healthy,
    zero,
    low: rows.length - healthy - zero,
    value: rows.every((r) => r.value !== null)
      ? rows.reduce((sum, r) => sum + r.value, 0)
      : null,
    categories: new Set(rows.map((r) => r.category)).size,
  };
}

export function movementSummary(rows) {
  const adjustments = rows.filter((r) => r.type === "Stock adjustment");

  return {
    inbound: rows
      .filter((r) => r.type === "Inbound received")
      .reduce((sum, r) => sum + Math.max(0, r.change), 0),
    outbound: rows
      .filter((r) => r.type === "Outbound shipped")
      .reduce((sum, r) => sum + Math.abs(Math.min(0, r.change)), 0),
    adjustment: adjustments.reduce((sum, r) => sum + r.change, 0),
    adjustmentRecords: adjustments.length,
  };
}

export function movementChart(rows) {
  const dates = [...new Set(rows.map((r) => dateKey(r.date)))].sort();

  return dates.map((date) => {
    const totals = movementSummary(
      rows.filter((r) => dateKey(r.date) === date)
    );
    return { date, inbound: totals.inbound, outbound: totals.outbound };
  });
}

export function supplierReport(orders) {
  return [...new Set(orders.map((r) => r.supplier))].map((supplier) => {
    const selected = orders.filter((r) => r.supplier === supplier);
    const known = selected.filter(
      (r) =>
        !r.receiptQuantitiesUnknown &&
        r.products.every((item) => item.received != null)
    );
    const received = known.reduce(
      (sum, r) =>
        sum + r.products.reduce((total, item) => total + item.received, 0),
      0
    );
    const ordered = known.reduce(
      (sum, r) =>
        sum + r.products.reduce((total, item) => total + item.quantity, 0),
      0
    );

    return {
      supplier,
      orders: selected.length,
      received,
      ordered,
      fulfilment: ordered ? +(received / ordered * 100).toFixed(1) : null,
      completed: selected.filter((r) => r.status === "Received").length,
      unknown: selected.length - known.length,
    };
  });
}
