import { cleanText, normaliseType, typeOf } from "./productTypes.js";
const poTotal = (order) => order.products.every((item) => Number.isFinite(item.unitPrice)) ? order.products.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) : Number(order.total) || 0;
const poMoney = (value, currency = "IDR") => new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const poDate = (date) => date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Jakarta" }).format(/* @__PURE__ */ new Date(date + "T00:00:00+07:00")) : "Not recorded";
const poToday = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(/* @__PURE__ */ new Date());
function decidePurchaseOrder(order, status, user, date) {
  if (!order || order.status !== "Pending" || !["Approved", "Rejected"].includes(status)) return { error: "Only Pending orders can be approved or rejected once." };
  return { order: { ...order, status, approved: status === "Approved" ? poToday() : null, decision: { status, user, date } } };
}
function createPurchaseOrder({ values, orders, inventory, user, date }) {
  if (!cleanText(values.supplier) || cleanText(values.supplier).length > 80) return { error: "Enter a supplier name (up to 80 characters)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.expected) || Number.isNaN((/* @__PURE__ */ new Date(values.expected + "T00:00:00Z")).getTime()) || (/* @__PURE__ */ new Date(values.expected + "T00:00:00Z")).toISOString().slice(0, 10) !== values.expected || values.expected < poToday()) return { error: "Enter a valid expected date today or later." };
  if (!values.products?.length) return { error: "Add at least one product." };
  const seen = /* @__PURE__ */ new Set(), products = [];
  const catalog = [...inventory.map((item) => ({ ...item, code: item.sku })), ...orders.flatMap((order) => order.products)];
  for (const row of values.products) {
    const code = cleanText(row.code), canonical = catalog.find((item) => item.code?.toLowerCase() === code.toLowerCase());
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,39}$/.test(code)) return { error: "Enter a valid SKU (2\u201340 letters, numbers, dots, underscores or hyphens)." };
    if (seen.has(code.toLowerCase())) return { error: "Each SKU may appear only once in this purchase order." };
    seen.add(code.toLowerCase());
    const enteredName = cleanText(row.name), category = normaliseType(row.category || canonical?.category);
    if (!category || category.length > 60) return { error: "Enter a product type, e.g. Electronics." };
    if (canonical?.category && normaliseType(canonical.category).toLowerCase() !== category.toLowerCase()) return { error: `${code}: the registered product type is ${canonical.category}. Change the master product in Inventory if needed.` };
    if (canonical && enteredName && ![canonical.name, canonical.code, canonical.name + " \xB7 " + canonical.code].some((value) => cleanText(value).toLowerCase() === enteredName.toLowerCase())) return { error: `${code}: this SKU belongs to ${canonical.name}. Use its name or enter a new unique SKU.` };
    const name = canonical?.name || enteredName;
    if (!name || name.length < 2 || name.length > 100) return { error: "Enter a product name (2\u2013100 characters)." };
    const quantity = Number(row.quantity), unitPrice = Number(row.unitPrice);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || row.quantity === "" || !Number.isSafeInteger(unitPrice) || unitPrice <= 0 || row.unitPrice === "") return { error: "Quantity and unit price must be positive whole numbers." };
    if (!Number.isSafeInteger(quantity * unitPrice)) return { error: "Order amount is too large." };
    products.push({ name, code: canonical?.code || code.toUpperCase(), category, quantity, unitPrice, received: 0 });
  }
  const total = products.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  if (!Number.isSafeInteger(total)) return { error: "Order amount is too large." };
  let sequence = 1, id;
  const prefix = `PO-${poToday().replaceAll("-", "")}-`;
  do {
    id = prefix + String(sequence++).padStart(3, "0");
  } while (orders.some((order) => order.id === id));
  return { order: { id, supplier: values.supplier.trim(), created: poToday(), expected: values.expected, status: "Pending", products, total, currency: "IDR", terms: values.terms?.trim() || "Net 30", reference: values.reference?.trim() || "", notes: values.notes?.trim() || "", requestedBy: user, deliverTo: values.deliverTo || "Main Warehouse" } };
}
function downloadPurchaseOrder(order) {
  const quote = (value) => '"' + String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const columns = ["PO", "Supplier", "Status", "Expected", "Currency", "Product", "SKU", "Product Type", "Quantity", "Unit price", "Subtotal", "Order total", "Item data source"];
  const rows = order.products.map((item) => [order.id, order.supplier, order.status, order.expected, order.currency, item.name, item.code, typeOf(item), item.quantity, item.unitPrice ?? "Not provided", item.unitPrice == null ? "Not provided" : item.quantity * item.unitPrice, poTotal(order), order.sampleItems ? "Sample item breakdown" : "Frontend order record"]);
  const url = URL.createObjectURL(new Blob(["\uFEFF" + [columns, ...rows].map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
  link.href = url;
  link.download = `susuno-${order.id}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
export {
  createPurchaseOrder,
  decidePurchaseOrder,
  downloadPurchaseOrder,
  poDate,
  poMoney,
  poToday,
  poTotal
};
