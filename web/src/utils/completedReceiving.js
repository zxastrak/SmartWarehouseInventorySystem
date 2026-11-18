import { typeOf } from "./productTypes.js";
import { acceptedUnits, inspectionSummary } from "./receiving.js";
function completedRecord(shipment, movements = [], inventory = []) {
  if (!shipment) return null;
  let receipt = shipment.receipt;
  if (!receipt) {
    if (Array.isArray(shipment.products) && shipment.products.length > 0) {
      const rows = shipment.products.map((p) => {
        const sku = p.sku || p.code;
        const history = movements.filter((entry) => entry.reference === shipment.id && entry.sku === sku && entry.type === "Inbound received");
        const rec = p.received != null ? Number(p.received) : Number(p.ordered || p.quantity || 0);
        const dam = Number(p.damaged || 0);
        const rej = Number(p.rejected || 0);
        const ord = Number(p.ordered || p.quantity || 0);
        const invMatch = inventory.find((i) => i.sku === sku || i.code === sku);
        const assignedRack = p.rack || invMatch?.rack || (invMatch?.zone ? `${invMatch.zone} - Staging` : "Staging Dok (Pending Putaway)");
        return {
          sku,
          name: p.name,
          category: p.category || "",
          rack: assignedRack,
          received: rec,
          accepted: Math.max(0, rec - dam - rej),
          damaged: dam,
          rejected: rej,
          short: Math.max(0, ord - rec),
          before: history[0]?.before ?? null,
          after: history.at(-1)?.after ?? null,
          allocations: [{ rack: assignedRack, quantity: Math.max(0, rec - dam - rej) }],
        };
      });
      const totalRec = rows.reduce((s, r) => s + r.received, 0);
      const totalAcc = shipment.accepted_units != null && Number(shipment.accepted_units) > 0
        ? Number(shipment.accepted_units)
        : rows.reduce((s, r) => s + r.accepted, 0);
      receipt = {
        completedAt: shipment.completed_at || shipment.completedAt || shipment.date,
        user: shipment.inspector || shipment.staff || "Warehouse Manager",
        notes: shipment.notes || "",
        evidence: shipment.evidence_url ? [{ name: shipment.evidence_url }] : [],
        stockChanges: rows,
        summary: {
          ordered: rows.reduce((s, r) => s + (Number(r.ordered) || Number(r.received)), 0),
          received: totalRec,
          accepted: totalAcc,
          damaged: rows.reduce((s, r) => s + r.damaged, 0),
          rejected: rows.reduce((s, r) => s + r.rejected, 0),
          short: rows.reduce((s, r) => s + r.short, 0),
        },
        dispositions: [],
      };
    } else {
      return null;
    }
  }
  const items = receipt.stockChanges || (receipt.rows || []).map((row) => {
    const history = movements.filter((entry) => entry.reference === shipment.id && entry.sku === row.sku && entry.type === "Inbound received");
    const invMatch = inventory.find((i) => i.sku === row.sku || i.code === row.sku);
    const assignedRack = row.rack || invMatch?.rack || (receipt.allocations?.[row.sku]?.[0]?.rack) || "Staging Dok (Pending Putaway)";
    return {
      sku: row.sku,
      name: row.name,
      category: row.category,
      rack: assignedRack,
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
function formatProcessDuration(startVal, endVal) {
  if (!startVal || !endVal) return "-";
  const startNorm = /(?:Z|[+-]\d\d:\d\d)$/.test(startVal) ? startVal : startVal + "+07:00";
  const endNorm = /(?:Z|[+-]\d\d:\d\d)$/.test(endVal) ? endVal : endVal + "+07:00";
  const start = new Date(startNorm);
  const end = new Date(endNorm);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return "-";
  const diffMinutes = Math.round((end - start) / 60000);
  if (diffMinutes < 1) return "< 1 menit";
  if (diffMinutes < 60) return `${diffMinutes} menit`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return mins > 0 ? `${hours} jam ${mins} mnt` : `${hours} jam`;
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
  formatProcessDuration,
  downloadReceivingReport
};
