// Clean inventory state ready for API data
export const inventorySeed = [];

export const categories = [
  "Electronics",
  "PPE",
  "Equipment",
  "Storage",
  "Safety",
  "Hardware",
  "Accessories"
];

export function stockStatus(item) {
  if (!item || item.current === 0) return "Out of Stock";
  if (item.current < Math.min(item.reorder || 10, 15)) return "Critical";
  if (item.current < (item.reorder || 10)) return "Low";
  return "In Stock";
}

export const movementSeed = [];

export const movementTypes = [
  "Inbound received",
  "Outbound shipped",
  "Rack transfer",
  "Stock adjustment"
];

export const movementColumns = [
  ["date", "Date & time"],
  ["type", "Movement type"],
  ["reference", "Reference"],
  ["change", "Quantity"],
  ["rack", "Warehouse & rack"],
  ["user", "Created by"],
  ["reason", "Reason"],
  ["after", "Balance"]
];
