import { typeOf } from "./productTypes.js";
import { acceptedUnits, inspectionSummary } from "./receiving.js";
function completedRecord(shipment, movements = []) {
  const receipt = shipment.receipt;
  if (!receipt) return null;
  const items = receipt.stockChanges || (receipt.rows || []).map((row) => {
    const history = movements.filter((entry) => entry.reference === shipment.id && entry.sku === row.sku && entry.type === "Inbound received");
    return {
      sku: row.sku,
      name: row.name,
      category: row.category,
      received: Number(row.received),
      accepted: acceptedUnits(row),
      damaged: Number(row.damaged),
      rejected: Number(row.rejected),
      short: Math.max(0, row.ordered - Number(row.received)),
      before: history[0]?.before ?? null,
      after: history.at(-1)?.after ?? null,
      allocations: (receipt.allocations?.[row.sku] || []).filter((value) => Number(value.quantity) > 0).map((value) => ({ rack: value.rack, quantity: Number(value.quantity) }))
    };
  });
  const summary = receipt.summary || inspectionSummary(receipt.rows || []);
  return { items, summary, dispositions: receipt.dispositions || [], resolution: shipment.issueResolution || null, completedAt: receipt.completedAt, user: receipt.user, notes: receipt.notes || "", evidence: receipt.evidence || [], poStatus: shipment.poStatus || "Not recorded" };
}
function completedTime(value) {
  if (!value) return "Not recorded";
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + "+07:00";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  const options = { timeZone: "Asia/Jakarta" };
  const day = new Intl.DateTimeFormat("en-US", { ...options, month: "short", day: "numeric", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { ...options, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day} \xB7 ${time}`;
}
function downloadReceivingReport(shipment, record, warehouseName) {
  if (!record?.items.length) throw new Error("A detailed receiving record is not available for this sample shipment.");
  const header = ["Inbound ID", "Purchase order", "Supplier", "Warehouse", "Completed (Jakarta)", "Received by", "SKU", "Product", "Product Type", "Received", "Accepted", "Damaged", "Rejected", "Missing", "Rack allocation", "Stock before", "Stock after", "PO status", "Inspection notes", "Evidence filenames", "Resolution", "Resolution reference", "Excluded stock disposition", "Notification request"];
  const rows = record.items.map((item) => [shipment.id, shipment.po, shipment.supplier, warehouseName, completedTime(record.completedAt), record.user || "Not recorded", item.sku, item.name, typeOf(item), item.received, item.accepted, item.damaged, item.rejected, item.short, item.allocations.map((value) => `${value.rack}: ${value.quantity}`).join("; "), item.before ?? "Not recorded", item.after ?? "Not recorded", record.poStatus, record.notes, record.evidence.map((file) => file.name).join("; "), record.resolution?.title || "", record.resolution?.reference || "", record.dispositions.filter((value) => value.sku === item.sku).map((value) => `${value.kind} ${value.location}: ${value.quantity}`).join("; "), record.resolution?.notificationStatus || "Not requested"]);
  const escape = (value) => {
    let text = String(value ?? "");
    if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `susuno-receiving-${shipment.id}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
export {
  completedRecord,
  completedTime,
  downloadReceivingReport
};
