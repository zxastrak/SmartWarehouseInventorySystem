import { purchaseOrders as inboundOrders } from "./inbound.js";
const item = (name, code, quantity, unitPrice) => ({ name, code, quantity, unitPrice, received: null });
const purchaseOrderStatuses = ["Pending", "Approved", "In Transit", "Partially Received", "Overdue", "Received", "Rejected"];
const purchaseOrderSeed = [
  { id: "PO-2026-0918", supplier: "TechSupply", status: "Pending", expected: "2026-09-30", created: "2026-09-20", requestedBy: "Naura", reference: "AI Restock Plan", notes: "Urgent stock replenishment", terms: "Net 30", currency: "IDR", products: [item("Wireless Scanner", "WH-3382", 100, 125e4)] },
  { id: "PO-2026-0917", supplier: "PPESupply", status: "Approved", expected: "2026-09-30", products: [item("Safety Helmet", "WH-7621", 100, 2e5), item("Work Gloves", "WH-5544", 100, 85e3), item("Safety Vest", "WH-8003", 100, 1e5), item("Safety Boots", "WH-8013", 50, 15e4), item("Ear Protection", "WH-8010", 50, 5e4)] },
  { id: "PO-2026-0916", supplier: "EqSupply", status: "In Transit", expected: "2026-09-30", products: [item("Pallet Jack", "WH-4450", 20, 15e5), item("Hand Truck", "WH-8005", 5, 4e5)] },
  { id: "PO-2026-0915", supplier: "MediSupply", status: "Partially Received", expected: "2026-09-15", products: [item("First Aid Kit", "WH-2210", 100, 1e5), item("Work Gloves", "WH-5544", 100, 2e4), ...["Safety Vest", "Safety Boots", "Safety Helmet", "Ear Protection", "Packing Tape", "Box Cutter"].map((name, i) => item(name, ["WH-8003", "WH-8013", "WH-7621", "WH-8010", "WH-8001", "WH-8006"][i], 20, 5e4))] },
  { id: "PO-2026-0914", supplier: "HardSupply", status: "Overdue", expected: "2026-09-15", products: [item("Cable Ties (Pack)", "WH-9903", 100, 6e4), item("Tool Kit", "WH-8014", 20, 3e5), item("Rack Label", "WH-8016", 100, 6e4), item("Box Cutter", "WH-8006", 100, 6e4)] },
  { id: "PO-2026-0913", supplier: "TechSupply", status: "Partially Received", expected: "2026-09-15", products: [item("Wireless Scanner", "WH-3382", 5, 125e4), item("LED Work Light", "WH-1209", 15, 25e4), item("Extension Cord", "WH-6108", 20, 15e4)] }
].map((order, index) => ({ created: "2026-09-20", requestedBy: ["Naura", "Raka", "Dimas"][index % 3], reference: "", notes: "", terms: "Net 30", currency: "IDR", deliverTo: "Main Warehouse \xB7 WH-01", sampleItems: index !== 0, approved: order.status === "Approved" ? "2026-09-20" : null, ...order }));
purchaseOrderSeed.push(...inboundOrders.map((order) => ({ ...order, created: order.approved, requestedBy: "Naura", terms: "Net 30", currency: "USD", reference: "Existing inbound demo", notes: "Original item prices are not provided.", deliverTo: "Main Warehouse \xB7 WH-01" })));
purchaseOrderSeed.forEach((order) => {
  if (order.currency === "IDR") order.total = order.products.reduce((sum, item2) => sum + item2.quantity * item2.unitPrice, 0);
  if (order.status === "Pending") order.products = order.products.map((item2) => ({ ...item2, received: 0 }));
});
const ppe = purchaseOrderSeed.find((row) => row.id === "PO-2026-0917");
Object.assign(ppe, { created: "2026-09-18", expected: "2026-09-29", approved: "2026-09-19", sampleItems: false, products: [{ name: "Safety Helmet", code: "WH-7621", quantity: 100, unitPrice: 485e3, received: 0 }], decision: { status: "Approved", user: "Warehouse Manager", date: "2026-09-19T09:15:00+07:00" } });
const equipment = purchaseOrderSeed.find((row) => row.id === "PO-2026-0916");
Object.assign(equipment, { created: "2026-09-18", approved: "2026-09-19", sampleItems: true, products: [{ name: "Pallet Jack", code: "WH-4450", quantity: 1, unitPrice: 2e7, received: 0 }, { name: "Hand Truck", code: "WH-8005", quantity: 1, unitPrice: 12e6, received: 0 }], delivery: { tracking: "EQ-TRK-3049", carrier: "EqSupply Logistics", sentAt: "2026-09-19T09:22:00+07:00", isDemo: true } });
const partial = purchaseOrderSeed.find((row) => row.id === "PO-2026-0915");
Object.assign(partial, { created: "2026-09-10", approved: "2026-09-11", sampleItems: true, products: [{ name: "First Aid Kit", code: "WH-2210", quantity: 4, unitPrice: 25e5, received: 3 }, { name: "Medical Supply Box", code: "MD-BOX-01", quantity: 4, unitPrice: 2e6, received: 2 }], receipts: [{ id: "HIST-PO-0915", shipmentId: null, date: "2026-09-15T16:20:00+07:00", user: "Naura", units: 5, isHistorical: true, notes: "Historical sample receipt", stockChanges: [] }] });
const late = purchaseOrderSeed.find((row) => row.id === "PO-2026-0914");
Object.assign(late, { expected: "2026-09-24", sampleItems: true, notes: "Shipment delayed during preparation", products: [{ name: "Extension Cord", code: "WH-6108", quantity: 2, unitPrice: 6e6, received: 0 }, { name: "Cable Ties (Pack)", code: "WH-9903", quantity: 2, unitPrice: 6e6, received: 0 }] });
purchaseOrderSeed.find((row) => row.id === "PO-2026-0913").receiptQuantitiesUnknown = true;
for (const order of purchaseOrderSeed) if (order.currency === "IDR") order.total = order.products.reduce((sum, item2) => sum + item2.quantity * item2.unitPrice, 0);
export {
  purchaseOrderSeed,
  purchaseOrderStatuses
};
