function auditSeed(movements) {
  return movements.map((row, index) => ({ id: `AUD-HIST-${index + 1}`, date: row.date, user: row.user || "System", module: "Inventory", action: row.type, reference: row.reference, status: "Success", severity: "Info", details: `${row.sku} \xB7 ${row.change > 0 ? "+" : ""}${row.change} units \xB7 ${row.reason}`, changes: [{ field: "Stock", before: row.before, after: row.after }, { field: "SKU", before: row.sku, after: row.sku }, { field: "Rack", before: row.rack, after: row.rack }], source: "Historical movement demo", warehouse: row.warehouse, authenticated: true }));
}
function newAuditEvent(values) {
  return { id: `AUD-${crypto.randomUUID()}`, date: (/* @__PURE__ */ new Date()).toISOString(), status: "Success", severity: "Info", changes: [], source: "Frontend session", authenticated: true, ...structuredClone(values) };
}
const auditSummary = (rows) => ({ total: rows.length, users: new Set(rows.filter((row) => row.authenticated !== false && row.user !== "System").map((row) => row.user)).size, warnings: rows.filter((row) => row.severity === "Warning").length, critical: rows.filter((row) => row.severity === "Critical").length });
function auditExportRows(rows) {
  return rows.map((row) => ({ ...row, date: row.date, changes: row.changes.map((change) => `${change.field}: ${change.before ?? "\u2014"} -> ${change.after ?? "\u2014"}`).join("; ") }));
}
export {
  auditExportRows,
  auditSeed,
  auditSummary,
  newAuditEvent
};
