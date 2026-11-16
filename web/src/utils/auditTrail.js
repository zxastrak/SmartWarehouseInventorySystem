function auditSeed() {
  return [];
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
