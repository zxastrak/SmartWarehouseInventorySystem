const inboundSeed = [
  { id: "INB-2048", po: "PO-10032", supplier: "TechSupply", date: "2026-09-15", time: "09:30", items: 3, units: 120, reference: "DN-TS-091526-04", carrier: "Andi \xB7 N 9182 ABD", dock: "D-02", status: "Arrived", staff: "Naura" },
  { id: "INB-2047", po: "PO-10031", supplier: "SafeWork Ltd.", date: "2026-09-15", time: "11:00", endTime: "13:00", items: 7, units: 280, dock: "D-01", status: "Scheduled", staff: "Raka", approvedAt: "2026-09-14T09:12:00+07:00", scheduledAt: "2026-09-14T10:03:00+07:00", scheduledBy: "Naura", products: [
    { name: "Safety Helmet", code: "WH-7621", category: "PPE", quantity: 100 },
    { name: "Work Gloves", code: "WH-5544", category: "PPE", quantity: 80 },
    { name: "Safety Goggles", code: "WH-2390", category: "PPE", quantity: 40 },
    { name: "Reflective Vest", code: "WH-6702", category: "PPE", quantity: 30 },
    { name: "Additional PPE product 1 (demo)", code: "DEMO-PPE-01", category: "PPE", quantity: 10 },
    { name: "Additional PPE product 2 (demo)", code: "DEMO-PPE-02", category: "PPE", quantity: 10 },
    { name: "Additional PPE product 3 (demo)", code: "DEMO-PPE-03", category: "PPE", quantity: 10 }
  ] },
  { id: "INB-2046", po: "PO-10029", supplier: "BrightTools", date: "2026-09-15", time: "08:15", items: 3, units: 86, dock: "D-03", status: "Received", staff: "Naura" },
  { id: "INB-2045", po: "PO-10028", supplier: "StoragePlus", date: "2026-09-14", time: "15:40", items: 5, units: 150, dock: "D-02", status: "Inspecting", staff: "Idam" },
  { id: "INB-2044", po: "PO-10027", supplier: "LiftPro", date: "2026-09-14", time: "10:20", items: 2, units: 24, dock: "D-04", status: "Issue", staff: "Ocha" },
  { id: "INB-2043", po: "PO-10026", supplier: "MediSupply", date: "2026-09-13", time: "13:05", items: 6, units: 210, dock: "D-01", status: "Received", staff: "Naura" }
];
const extraStatuses = ["Scheduled", "Arrived", "Received", "Inspecting", "Issue", "Received"];
for (let i = 0; i < 12; i++) inboundSeed.push({ id: `INB-${2042 - i}`, po: `PO-${10025 - i}`, supplier: ["TechSupply", "SafeWork Ltd.", "BrightTools"][i % 3], date: `2026-09-${String(12 - Math.floor(i / 3)).padStart(2, "0")}`, time: "10:00", items: 3, units: 90 + i * 10, dock: `D-0${i % 4 + 1}`, status: extraStatuses[i % 6], staff: ["Naura", "Idam", "Ocha"][i % 3] });
const products = (rows) => rows.map(([name, code, quantity]) => ({ name, code, quantity }));
const purchaseOrders = [
  { id: "PO-10033", supplier: "PackRight Co.", approved: "2026-09-03", expected: "2026-09-06", total: 12480, status: "Approved", products: products([["Cardboard Box (L)", "PK-2101", 60], ["Packing Tape", "PK-2102", 50], ["Bubble Wrap Roll", "PK-2103", 40], ["Shipping Labels", "PK-2104", 30]]) },
  { id: "PO-10034", supplier: "SafeWork Ltd.", approved: "2026-09-03", expected: "2026-09-07", total: 18920, status: "Approved", products: products([["Safety Helmet", "SW-1101", 50], ["Work Gloves", "SW-1102", 60], ["Safety Vest", "SW-1103", 40], ["Safety Boots", "SW-1104", 30], ["Ear Protection", "SW-1105", 30], ["Safety Glasses", "SW-1106", 30], ["Face Shield", "SW-1107", 20]]) },
  { id: "PO-10035", supplier: "TechSupply", approved: "2026-09-04", expected: "2026-09-08", total: 8650, status: "Approved", products: products([["Wireless Scanner", "WH-3382", 30], ["LED Work Light", "WH-1209", 40], ["Extension Cord", "WH-6108", 20]]) }
];
const inboundStatuses = ["Arrived", "Scheduled", "Received", "Inspecting", "Issue"];
const orderUnits = (order) => order.products.reduce((sum, item) => sum + item.quantity, 0);
function inboundDate(date, long = false) {
  return new Intl.DateTimeFormat("en-US", { month: long ? "long" : "short", day: "numeric", ...long ? { year: "numeric" } : {} }).format(/* @__PURE__ */ new Date(`${date}T12:00:00`));
}
export {
  inboundDate,
  inboundSeed,
  inboundStatuses,
  orderUnits,
  purchaseOrders
};
