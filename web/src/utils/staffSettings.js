import { staffRoles } from "../data/staff.js";
const managementRoutes = { Dashboard: "dashboard", Inventory: "inventory", Inbound: "inbound", Outbound: "outbound", "AI Insight": "ai-insight", "Purchase Orders": "purchase-orders", Reports: "reports", "Audit Trail": "audit-trail", "Staff Management": "staff-management", Settings: "settings" };
const defaultPreferences = {
  notifications: { enabled: true, inApp: true, email: true, critical: true, approvals: true, shipments: true, staff: false },
  security: { twoStep: false, loginAlerts: true, idleMinutes: 30 },
  warehouse: { name: "Main Warehouse", rackSort: "asc", lowThreshold: "reorder", predictionDays: 7, approvalRequired: true, allowPartial: true },
  appearance: { theme: "light", language: "en-US", timeZone: "Asia/Jakarta", dateFormat: "medium", numberLocale: "id-ID" }
};
const staffStatus = (row) => row.suspended ? "Suspended" : row.requirePasswordChange ? "Pending" : "Active";
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
function managementDate(value, regional = {}, withTime = false) {
  if (!value) return "Not signed in";
  const options = { timeZone: regional.timeZone || "Asia/Jakarta", year: "numeric", month: regional.dateFormat === "numeric" ? "2-digit" : "short", day: regional.dateFormat === "numeric" ? "2-digit" : "numeric" };
  if (withTime) Object.assign(options, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = new Intl.DateTimeFormat(regional.language || "en-US", options).formatToParts(new Date(value));
  const part = (key) => parts.find((row) => row.type === key)?.value || "";
  const date = regional.dateFormat === "numeric" ? `${part("day")}/${part("month")}/${part("year")}` : `${part("day")} ${part("month")} ${part("year")}`;
  return withTime ? date + `, ${part("hour")}:${part("minute")}` : date;
}
function validateStaff(draft, records, warehouses) {
  const errors = {};
  if (draft.fullName.trim().length < 2) errors.fullName = "Enter at least 2 characters.";
  if (!staffRoles.includes(draft.role)) errors.role = "Choose a staff role.";
  const contact = draft.contact.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && !/^\+?[\d\s().-]{8,25}$/.test(contact)) errors.contact = "Enter an email or a valid phone number.";
  else if (!contact.includes("@") && !/^\+?\d{8,15}$/.test(contact.replace(/[\s().-]/g, ""))) errors.contact = "Use 8\u201315 phone digits.";
  if (!warehouses.some((name) => name.toLowerCase() === draft.warehouse.trim().toLowerCase())) errors.warehouse = "Enter a registered warehouse name.";
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(draft.username.trim())) errors.username = "Use 3\u201330 letters, numbers, dots, hyphens, or underscores.";
  if (records.some((row) => row.username.toLowerCase() === draft.username.trim().toLowerCase())) errors.username = "This username is already used.";
  if (records.some((row) => row.contact.toLowerCase() === contact.toLowerCase())) errors.contact = "This contact is already used.";
  if (!strongPassword(draft.password)) errors.password = "Use at least 10 characters, including a letter, number, and symbol.";
  return errors;
}
const strongPassword = (value) => value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^\w\s]/.test(value) && !/[\s]/.test(value);
function generateTemporaryPassword() {
  const pick = (chars2) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return chars2[values[0] % chars2.length];
  };
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*";
  const output = ["A", "a", "8", "!"];
  for (let i = 0; i < 10; i++) output.push(pick(chars));
  for (let i = output.length - 1; i > 0; i--) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const j = values[0] % (i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output.join("");
}
function validateProfile(draft) {
  const errors = {};
  if (draft.fullName.trim().length < 2) errors.fullName = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = "Enter a valid email.";
  if (draft.phone.trim() && !/^\+?\d{8,15}$/.test(draft.phone.replace(/[\s().-]/g, ""))) errors.phone = "Use 8\u201315 phone digits.";
  return errors;
}
export {
  defaultPreferences,
  generateTemporaryPassword,
  initials,
  managementDate,
  managementRoutes,
  staffStatus,
  strongPassword,
  validateProfile,
  validateStaff
};
