const stockItems = [
  { code: "1111", name: "Wireless Scanner", rack: "A-12", current: 12, reorder: 50, days: 4, status: "Critical" },
  { code: "2222", name: "Safety Helmet", rack: "B-04", current: 28, reorder: 100, days: 6, status: "Low" },
  { code: "3333", name: "LED Work Light", rack: "C-07", current: 35, reorder: 100, days: 7, status: "Low" },
  { code: "4444", name: "Pallet Jack", rack: "A-03", current: 8, reorder: 30, days: 3, status: "Critical" }
];
const stockHistory = [
  { day: "Aug 10", incoming: 300, outgoing: 120 },
  { day: "Aug 11", incoming: 350, outgoing: 220 },
  { day: "Aug 12", incoming: 330, outgoing: 340 },
  { day: "Aug 13", incoming: 350, outgoing: 300 },
  { day: "Aug 14", incoming: 570, outgoing: 310 },
  { day: "Aug 15", incoming: 610, outgoing: 370 },
  { day: "Aug 16", incoming: 710, outgoing: 310 },
  { day: "Aug 17", incoming: 770, outgoing: 700 },
  { day: "Aug 18", incoming: 620, outgoing: 1e3 },
  { day: "Aug 19", incoming: 590, outgoing: 880 },
  { day: "Aug 20", incoming: 680, outgoing: 680 },
  { day: "Aug 21", incoming: 670, outgoing: 450 },
  { day: "Aug 22", incoming: 730, outgoing: 340 },
  { day: "Aug 23", incoming: 892, outgoing: 420 }
];
const metrics = [
  { label: "Total Items", value: "1,000", trend: "+8%", icon: "box", tone: "green" },
  { label: "In Stock", value: "500", trend: "+12%", icon: "box", tone: "green" },
  { label: "Low Stock", value: "365", trend: "+12%", icon: "warning", tone: "rose" },
  { label: "Out of Stock", value: "47", trend: "+67%", icon: "close", tone: "rose" }
];
export {
  metrics,
  stockHistory,
  stockItems
};
