import { stockStatus } from "../data/inventory.js";
const dateKey = (value) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(parseDate(value));
function parseDate(value) {
  return new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : (value.length === 10 ? value + "T00:00:00" : value) + "+07:00");
}
const todayKey = () => dateKey((/* @__PURE__ */ new Date()).toISOString());
const readableDate = (value) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(parseDate(value));
function periodBounds(period, records, custom = {}) {
  const today = todayKey();
  if (period === "custom") return { start: custom.start, end: custom.end };
  if (period === "today") return { start: today, end: today };
  if (period === "month") return { start: today.slice(0, 7) + "-01", end: today };
  const dates = records.map((row) => dateKey(row.date)).sort();
  return { start: dates[0] || today, end: today };
}
function inventoryReport(items) {
  return items.map((item) => ({ ...item, status: stockStatus(item), value: Number.isFinite(item.unitCost) && item.unitCost >= 0 && item.costCurrency === "IDR" ? item.current * item.unitCost : null }));
}
function inventorySummary(rows) {
  const healthy = rows.filter((row) => row.status === "In Stock").length, zero = rows.filter((row) => row.status === "Out of Stock").length;
  return { count: rows.length, healthy, zero, low: rows.length - healthy - zero, value: rows.every((row) => row.value !== null) ? rows.reduce((sum, row) => sum + row.value, 0) : null, categories: new Set(rows.map((row) => row.category)).size };
}
function movementSummary(rows) {
  return { inbound: rows.filter((row) => row.type === "Inbound received").reduce((sum, row) => sum + Math.max(0, row.change), 0), outbound: rows.filter((row) => row.type === "Outbound shipped").reduce((sum, row) => sum + Math.abs(Math.min(0, row.change)), 0), adjustment: rows.filter((row) => row.type === "Stock adjustment").reduce((sum, row) => sum + row.change, 0), adjustmentRecords: rows.filter((row) => row.type === "Stock adjustment").length };
}
function movementChart(rows) {
  const dates = [...new Set(rows.map((row) => dateKey(row.date)))].sort();
  return dates.map((date) => {
    const totals = movementSummary(rows.filter((row) => dateKey(row.date) === date));
    return { date, inbound: totals.inbound, outbound: totals.outbound };
  });
}
function supplierReport(orders) {
  return [...new Set(orders.map((row) => row.supplier))].map((supplier) => {
    const selected = orders.filter((row) => row.supplier === supplier), known = selected.filter((row) => !row.receiptQuantitiesUnknown && row.products.every((item) => item.received != null)), received = known.reduce((sum, row) => sum + row.products.reduce((sum2, item) => sum2 + item.received, 0), 0), ordered = known.reduce((sum, row) => sum + row.products.reduce((sum2, item) => sum2 + item.quantity, 0), 0);
    return { supplier, orders: selected.length, received, ordered, fulfilment: ordered ? +(received / ordered * 100).toFixed(1) : null, completed: selected.filter((row) => row.status === "Received").length, unknown: selected.length - known.length };
  });
}
export {
  dateKey,
  inventoryReport,
  inventorySummary,
  movementChart,
  movementSummary,
  parseDate,
  periodBounds,
  readableDate,
  supplierReport,
  todayKey
};
