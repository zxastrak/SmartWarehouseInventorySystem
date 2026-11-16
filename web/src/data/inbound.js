export const inboundSeed = [
  {
    id: "INB-1002",
    po: "PO-2024-001",
    supplier: "PT Elektronik Maju Jaya",
    date: new Date().toISOString().slice(0, 10),
    time: "10:00",
    dock: "D-01",
    status: "Arrived",
    carrier: "JNE Cargo",
    reference: "DN-88921",
    staff: "Staf Gudang",
    units: 20,
    items: 2,
    products: [
      { code: "SCAN-01", sku: "SCAN-01", name: "Barcode Scanner Wireless", ordered: 10, received: 10, category: "Electronics" },
      { code: "CBL-02", sku: "CBL-02", name: "USB-C Data Cable", ordered: 10, received: 10, category: "Accessories" }
    ]
  },
  {
    id: "INB-1003",
    po: "PO-2024-002",
    supplier: "CV Logistik Nusantara",
    date: new Date().toISOString().slice(0, 10),
    time: "14:00",
    dock: "D-02",
    status: "Scheduled",
    carrier: "SiCepat Cargo",
    reference: "DN-44120",
    staff: "Staf Gudang",
    units: 15,
    items: 1,
    products: [
      { code: "BOX-01", sku: "BOX-01", name: "Karton Box Heavy Duty", ordered: 15, received: 15, category: "General" }
    ]
  }
];

export const purchaseOrders = [];

export const inboundStatuses = ["Arrived", "Scheduled", "Received", "Inspecting", "Inspected", "Issue"];

export const orderUnits = (order) => (order.products || []).reduce((sum, item) => sum + item.quantity, 0);

export function inboundDate(date, long = false) {
  if (!date) return '-';
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat("en-US", {
    month: long ? "long" : "short",
    day: "numeric",
    ...(long ? { year: "numeric" } : {})
  }).format(parsed);
}
