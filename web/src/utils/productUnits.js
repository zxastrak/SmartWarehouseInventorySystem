// DEMO PRODUCT MASTER: confirm these assignments with the team before integration.
// One SKU uses one stock unit. There is no box-to-pcs conversion in this frontend.
// Other seed SKUs default to pcs in stampDemoUnits; real records copy Inventory.unit.
const demoUnitOverrides = { "MD-BOX-01": "box", "WH-9903": "pack" };
function unitOf(product) {
  if (!product) return "Not recorded";
  return product.unit || demoUnitOverrides[product.sku || product.code] || "Not recorded";
}
function stampDemoUnits(value) {
  if (!value || typeof value !== "object") return value;
  if ((value.sku || value.code) && value.name && !value.unit) {
    value.unit = demoUnitOverrides[value.sku || value.code] || "pcs";
  }
  Object.values(value).forEach((child) => {
    if (child && typeof child === "object") stampDemoUnits(child);
  });
  return value;
}
function quantitySummary(rows = [], quantity = "quantity") {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const amount = Number(typeof quantity === "function" ? quantity(row) : row[quantity]);
    if (!Number.isFinite(amount)) continue;
    const unit = unitOf(row);
    groups.set(unit, (groups.get(unit) || 0) + amount);
  }
  const entries = [...groups].filter(([, amount]) => amount !== 0);
  if (!entries.length) return groups.size === 1 ? `0 ${[...groups.keys()][0]}` : "0";
  return entries.map(([unit, amount]) => `${amount.toLocaleString("en-US")} ${unit}`).join(" + ");
}
function shipmentQuantity(shipment) {
  if (!shipment) return "Not recorded";
  if (shipment.products?.length) return quantitySummary(shipment.products);
  return `${Number(shipment.units || 0).toLocaleString("en-US")} (unit not recorded)`;
}
export {
  demoUnitOverrides,
  quantitySummary,
  shipmentQuantity,
  stampDemoUnits,
  unitOf
};
