export const rackSeed = [
  { id: "A-12", zone: "Electronics", capacity: 100, used: 62 },
  { id: "A-14", zone: "Electronics", capacity: 100, used: 76 },
  { id: "A-15", zone: "Electronics", capacity: 100, used: 60 },
  { id: "A-18", zone: "Electronics", capacity: 100, used: 96 },
  { id: "B-06", zone: "Accessories", capacity: 100, used: 18 },
  { id: "D-01", zone: "General", capacity: 200, used: 20 },
  { id: "B-04", zone: "PPE", capacity: 500, used: 180 }
];
export const scannerShipmentProducts = [
  { sku: "WH-3382", name: "Wireless Scanner", category: "Electronics", ordered: 50 },
  { sku: "LB-1021", name: "Barcode Labels", category: "Accessories", ordered: 50 },
  { sku: "CD-4102", name: "Scanner Charging Dock", category: "Electronics", ordered: 20 }
];
export function shipmentProducts(shipment, inventory) {
  if (shipment.id === "INB-2048") return scannerShipmentProducts.map((row) => ({ ...row }));
  if (shipment.products) return shipment.products.map((row) => ({ sku: row.code, name: row.name, ordered: row.quantity, category: row.category || inventory.find((item) => item.sku === row.code)?.category || (/scanner|light|cord/i.test(row.name) ? "Electronics" : /label|tape/i.test(row.name) ? "Accessories" : "General") }));
  const count = shipment.items;
  return Array.from({ length: count }, (_, index) => ({ sku: `${shipment.id}-${index + 1}`, name: `${shipment.supplier} item ${index + 1}`, category: "General", ordered: Math.floor(shipment.units / count) + (index < shipment.units % count ? 1 : 0) }));
}
export function rackMatches(category, rack) {
  return rack.zone === (category === "Electronics" ? "Electronics" : category === "Accessories" ? "Accessories" : category === "PPE" ? "PPE" : "General");
}
export function newReceivingDraft(shipment, inventory, racks) {
  const rows = shipmentProducts(shipment, inventory).map((row) => ({ ...row, received: row.ordered, damaged: 0, rejected: 0 }));
  return { stage: "inspect", rows, defaultRack: (racks.find(rack => rackMatches(rows[0]?.category, rack)) || racks[0]).id,
 notes: "", evidence: [], allocations: Object.fromEntries(rows.map((row) => [row.sku, [{ id: `${row.sku}-first`, rack: (racks.find((rack) => rackMatches(row.category, rack)) || racks[0]).id, quantity: 0 }]])), savedAt: null };
}
