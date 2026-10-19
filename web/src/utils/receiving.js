import { rackMatches } from "../data/receiving.js";
const whole = (value) => value !== "" && Number.isSafeInteger(Number(value)) && Number(value) >= 0;
const acceptedUnits = (row) => Number(row.received) - Number(row.damaged) - Number(row.rejected);
function inspectionSummary(rows) {
  return rows.reduce((sum, row) => ({ ordered: sum.ordered + Number(row.ordered), received: sum.received + Number(row.received), accepted: sum.accepted + acceptedUnits(row), damaged: sum.damaged + Number(row.damaged), rejected: sum.rejected + Number(row.rejected), short: sum.short + Math.max(0, Number(row.ordered) - Number(row.received)) }), { ordered: 0, received: 0, accepted: 0, damaged: 0, rejected: 0, short: 0 });
}
function validateInspection(draft, { allowZeroAccepted = false } = {}) {
  for (const row of draft.rows) {
    if (!["received", "damaged", "rejected"].every((key) => whole(row[key]))) return `${row.name}: quantities must be nonnegative whole numbers.`;
    if (Number(row.received) > row.ordered) return `${row.name}: received cannot exceed ordered in this demo.`;
    if (Number(row.damaged) + Number(row.rejected) > Number(row.received)) return `${row.name}: damaged plus rejected cannot exceed received.`;
  }
  const total = inspectionSummary(draft.rows);
  if (total.accepted <= 0 && !allowZeroAccepted) return "At least one accepted unit is needed to proceed with receiving.";
  if (allowZeroAccepted && total.received <= 0) return "Record at least one delivered unit.";
  if (total.damaged + total.rejected + total.short > 0 && (!draft.notes.trim() || !draft.evidence.length)) return "Add inspection notes and at least one evidence file for damaged, rejected or missing units.";
  return "";
}
function allocationSummary(draft) {
  let total = 0;
  const byRack = {};
  for (const row of draft.rows) for (const allocation of draft.allocations[row.sku] || []) {
    const qty = Number(allocation.quantity) || 0;
    total += qty;
    byRack[allocation.rack] = (byRack[allocation.rack] || 0) + qty;
  }
  return { total, byRack };
}
function validateAllocation(draft, racks, options = {}) {
  const inspectionError = validateInspection(draft, options);
  if (inspectionError) return inspectionError;
  for (const row of draft.rows) {
    let total = 0;
    for (const allocation of draft.allocations[row.sku] || []) {
      if (!whole(allocation.quantity)) return `${row.name}: allocation must be a nonnegative whole number.`;
      const rack = racks.find((value) => value.id === allocation.rack);
      if (!rack || !rackMatches(row.category, rack)) return `${row.name}: choose a rack in the correct zone.`;
      total += Number(allocation.quantity);
    }
    if (total !== acceptedUnits(row)) return `${row.name}: allocate exactly ${acceptedUnits(row)} accepted units (currently ${total}).`;
  }
  const { byRack } = allocationSummary(draft);
  for (const [id, quantity] of Object.entries(byRack)) {
    const rack = racks.find((value) => value.id === id);
    if (quantity > rack.capacity - rack.used) return `Rack ${id}: ${quantity} assigned, but only ${rack.capacity - rack.used} spaces available.`;
  }
  return "";
}
function receiveShipment({ shipment, draft, inventory, movements, racks, user, date, allowZeroAccepted = false }) {
  if (!["Arrived", "Inspecting"].includes(shipment.status) || shipment.receivingCompleted) return { error: "This shipment cannot be received again or is not ready for inspection." };
  if (shipment.issueResolution && (shipment.issue?.items || []).some((item) => {
    const row = draft.rows.find((row2) => row2.sku === item.sku);
    return !row || ["received", "damaged", "rejected"].some((key) => Number(row[key]) !== Number(item[key]));
  })) return { error: "Resolved issue quantities cannot be changed during receiving." };
  const error = validateAllocation(draft, racks, { allowZeroAccepted });
  if (error) return { error };
  const stockChanges = draft.rows.map((row) => {
    const before = inventory.find((item) => item.sku === row.sku)?.current || 0;
    const accepted = acceptedUnits(row);
    return {
      sku: row.sku,
      name: row.name,
      category: row.category,
      received: Number(row.received),
      accepted,
      damaged: Number(row.damaged),
      rejected: Number(row.rejected),
      short: Math.max(0, row.ordered - Number(row.received)),
      before,
      after: before + accepted,
      allocations: (draft.allocations[row.sku] || []).filter((item) => Number(item.quantity) > 0).map((item) => ({ rack: item.rack, quantity: Number(item.quantity) }))
    };
  });
  const updated = inventory.map((item) => ({ ...item })), newMovements = [...movements];
  for (const row of draft.rows) {
    const allocations = (draft.allocations[row.sku] || []).filter((item) => Number(item.quantity) > 0);
    if (!allocations.length) continue;
    let product = updated.find((item) => item.sku === row.sku);
    if (!product) {
      product = { sku: row.sku, name: row.name, category: row.category === "General" ? "Storage" : row.category, current: 0, reorder: 50, rack: allocations[0].rack, supplier: shipment.supplier, warehouse: shipment.warehouse || "Main Warehouse", barcode: "", updated: date };
      updated.push(product);
    }
    for (const allocation of allocations) {
      const before = product.current, change = Number(allocation.quantity);
      product.current += change;
      newMovements.push({ id: `receipt-${shipment.id}-${row.sku}-${allocation.id}`, sku: row.sku, category: row.category, date, type: "Inbound received", reference: shipment.id, before, change, after: product.current, rack: allocation.rack, user, reason: `Received from ${shipment.po}; accepted stock only`, warehouse: product.warehouse });
    }
    product.rack = [.../* @__PURE__ */ new Set([...(product.locations || [{ rack: product.rack }]).map((item) => item.rack), ...allocations.map((item) => item.rack)])].join(", ");
    product.locations = [...product.locations || [], ...allocations.map((item) => ({ rack: item.rack, quantity: Number(item.quantity), receipt: shipment.id }))];
    product.updated = date;
  }
  const { byRack } = allocationSummary(draft), summary = inspectionSummary(draft.rows);
  const dispositions = draft.rows.flatMap((row) => {
    const values = [];
    if (Number(row.damaged) > 0) {
      const choice = shipment.issueResolution?.choice || "quarantine";
      values.push({ sku: row.sku, name: row.name, quantity: Number(row.damaged), kind: choice === "restricted" ? "Restricted stock" : choice === "return" ? "Return stock" : "Quarantine stock", location: choice === "restricted" ? "R-01" : choice === "return" ? "Supplier return" : "Q-02", replacementRequested: choice === "replacement", reference: shipment.issueResolution?.reference || null });
    }
    if (Number(row.rejected) > 0) values.push({ sku: row.sku, name: row.name, quantity: Number(row.rejected), kind: "Return stock", location: "Supplier return" });
    return values;
  });
  return { inventory: updated, movements: newMovements, racks: racks.map((rack) => ({ ...rack, used: rack.used + (byRack[rack.id] || 0) })), shipment: { ...shipment, status: "Received", receivingCompleted: true, receipt: { ...draft, stockChanges, dispositions, summary, completedAt: date, user }, poStatus: summary.short ? "Partially Received" : "Closed" } };
}
export {
  acceptedUnits,
  allocationSummary,
  inspectionSummary,
  receiveShipment,
  validateAllocation,
  validateInspection
};
