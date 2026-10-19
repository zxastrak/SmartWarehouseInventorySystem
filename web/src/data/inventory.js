import { completedReceivingSeed } from "./completedReceiving.js";
const rows = [
  ["Wireless Scanner", "WH-3382", "Electronics", 12, 50, "A-12", "TechSupply"],
  ["Safety Helmet", "WH-7621", "PPE", 28, 100, "B-04", "PPESupply"],
  ["LED Work Light", "WH-1209", "Electronics", 75, 100, "C-07", "TechSupply2"],
  ["Pallet Jack", "WH-4450", "Equipment", 8, 30, "A-03", "EqSupply"],
  ["Storage Bin (L)", "WH-7781", "Storage", 42, 150, "D-01", "StorageSupply"],
  ["Work Gloves", "WH-5544", "PPE", 320, 100, "B-12", "PPESupply2"],
  ["Extension Cord", "WH-6108", "Electronics", 106, 50, "C-02", "TechSupply3"],
  ["First Aid Kit", "WH-2210", "Safety", 53, 50, "B-08", "MediSupply"],
  ["Cable Ties (Pack)", "WH-9903", "Hardware", 210, 100, "D-05", "HardSupply"]
];
const extras = ["Barcode Printer", "Packing Tape", "Steel Shelf", "Safety Vest", "Pallet Wrap", "Hand Truck", "Box Cutter", "Label Roll", "Fire Extinguisher", "Shipping Box", "Ear Protection", "USB Scanner", "Plastic Pallet", "Safety Boots", "Tool Kit", "Digital Scale", "Rack Label", "Packing Foam"];
extras.forEach((name, index) => rows.push([name, `WH-${8e3 + index}`, ["Electronics", "PPE", "Equipment", "Storage", "Hardware", "Safety"][index % 6], index % 5 === 0 ? 0 : 50 + index * 8, 40, `E-${String(index + 1).padStart(2, "0")}`, "DemoSupply"]));
rows.push(["Barcode Labels", "LB-1021", "Accessories", 210, 100, "B-06", "TechSupply"], ["Scanner Charging Dock", "CD-4102", "Electronics", 8, 30, "A-15", "TechSupply"]);
rows.push(["Work Lamp Battery", "DEMO-BATTERY-01", "Electronics", 40, 50, "C-09", "BrightTools"]);
rows.push(["Medical Supply Box", "MD-BOX-01", "Safety", 2, 10, "D-01", "MediSupply"]);
const inventorySeed = rows.map(([name, sku, category, current, reorder, rack, supplier], index) => ({ name, sku, category, current, reorder, rack, supplier, warehouse: "Main Warehouse", barcode: index === 0 ? "85045678903" : String(85045678903 + index), updated: "2026-09-15T14:10" }));
const categories = ["Electronics", "PPE", "Equipment", "Storage", "Safety", "Hardware", "Accessories"];
function stockStatus(item) {
  if (item.current === 0) return "Out of Stock";
  if (item.current < Math.min(item.reorder, 15)) return "Critical";
  if (item.current < item.reorder) return "Low";
  return "In Stock";
}
const movementRows = [
  ["2026-09-01T08:15", "Inbound received", "PO-10018", 50, 30, "A-12", "Naura", "Purchase order received"],
  ["2026-09-03T13:30", "Stock adjustment", "ADJ-001", 80, -5, "A-12", "Naura", "Cycle count correction"],
  ["2026-09-05T16:08", "Outbound shipped", "SO-1179", 75, -25, "A-12", "Raka", "Customer order"],
  ["2026-09-10T10:00", "Outbound shipped", "SO-1180", 50, -50, "A-12", "Naura", "Customer order"],
  ["2026-09-12T14:10", "Inbound received", "PO-10029", 0, 20, "A-12", "Naura", "Purchase order received"],
  ["2026-09-15T09:25", "Rack transfer", "TR-0061", 20, 0, "B-04 \u2192 A-12", "Naura", "Storage optimization"],
  ["2026-09-15T11:42", "Outbound shipped", "SO-1187", 20, -8, "A-12", "Naura", "Customer order"]
];
const movementSeed = movementRows.map(([date, type, reference, before, change, rack, user, reason], index) => ({ id: `movement-${index}`, sku: "WH-3382", date, type, reference, before, change, after: before + change, rack, user, reason, warehouse: "Main Warehouse" }));
inventorySeed.slice(1).forEach((item, index) => {
  const historic = Object.values(completedReceivingSeed).flatMap((shipment) => shipment.receipt.stockChanges).find((row) => row.sku === item.sku);
  const opening = historic?.before ?? item.current;
  movementSeed.push({ id: `opening-${index}`, sku: item.sku, date: "2026-09-01T08:00", type: "Inbound received", reference: `OPEN-${index + 1}`, before: 0, change: opening, after: opening, rack: item.rack, user: "Naura", reason: "Demo opening receipt", warehouse: item.warehouse });
});
Object.entries(completedReceivingSeed).forEach(([id, shipment]) => shipment.receipt.stockChanges.forEach((row) => {
  movementSeed.push({ id: `historic-${id}-${row.sku}`, sku: row.sku, date: shipment.receipt.completedAt, type: "Inbound received", reference: id, before: row.before, change: row.accepted, after: row.after, rack: row.allocations.map((item) => item.rack).join(", "), user: shipment.receipt.user, reason: "Historical completed receiving (demo)", warehouse: "Main Warehouse" });
}));
const movementTypes = ["Inbound received", "Outbound shipped", "Rack transfer", "Stock adjustment"];
const movementColumns = [
  ["date", "Date & time"],
  ["type", "Movement type"],
  ["reference", "Reference"],
  ["category", "Product Type"],
  ["change", "Quantity"],
  ["rack", "Warehouse & rack"],
  ["user", "Created by"],
  ["reason", "Reason"],
  ["after", "Balance"]
];
export {
  categories,
  inventorySeed,
  movementColumns,
  movementSeed,
  movementTypes,
  stockStatus
};
