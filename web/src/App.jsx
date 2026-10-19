import { typeOf, withProductTypes, cleanText } from "./utils/productTypes.js";
import React, { useEffect, useState, useRef } from "react";
import SignUp from "./pages/SignUp.jsx";
import SignIn from "./pages/SignIn.jsx";
import WarehouseSetup from "./pages/WarehouseSetup.jsx";
import SecuritySetup from "./pages/SecuritySetup.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetLinkSent from "./pages/ResetLinkSent.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import PasswordUpdated from "./pages/PasswordUpdated.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Inbound from "./pages/Inbound.jsx";
import Outbound from "./pages/Outbound.jsx";
import AIInsight from "./pages/AIInsight.jsx";
import PurchaseOrders from "./pages/PurchaseOrders.jsx";
import Reports from "./pages/Reports.jsx";
import AuditTrail from "./pages/AuditTrail.jsx";
import { auditSeed, newAuditEvent } from "./utils/auditTrail.js";
import { receivePurchaseOrder, revisePurchaseOrder, recordPOReceipt, poReceivingTotals } from "./utils/purchaseOrderReceiving.js";
import { purchaseOrderSeed } from "./data/purchaseOrders.js";
import { decidePurchaseOrder, createPurchaseOrder } from "./utils/purchaseOrders.js";
import { newFulfillmentDraft, validatePicked, validatePacked, shipOutbound } from "./utils/outboundFulfillment.js";
import { outboundSeed, readyToShipDraftSeed, packingDraftSeed } from "./data/outbound.js";
import { resolveOutboundIssue } from "./utils/outboundIssues.js";
import { createOutboundRecord, validateOutboundItems } from "./utils/outbound.js";
import StaffManagement from "./pages/StaffManagement.jsx";
import Settings from "./pages/Settings.jsx";
import SessionVerification from "./components/SessionVerification.jsx";
import { staffSeed, staffRoles } from "./data/staff.js";
import { defaultPreferences, validateStaff, validateProfile, strongPassword } from "./utils/staffSettings.js";
import "./styles/staffSettings.css";
import { rackSeed } from "./data/receiving.js";
import { receiveShipment, inspectionSummary } from "./utils/receiving.js";
import { inboundIssueSeed } from "./data/inboundIssues.js";
import { resolveInboundIssue } from "./utils/inboundIssues.js";
import { completedReceivingSeed } from "./data/completedReceiving.js";
import { inboundSeed } from "./data/inbound.js";
import StockMovementReports from "./pages/StockMovementReports.jsx";
import { inventorySeed, movementSeed } from "./data/inventory.js";
function App() {
  const [step, setStep] = useState("signin");
  const [inventoryRequest, setInventoryRequest] = useState(null);
  const [inboundRequest, setInboundRequest] = useState(null);
  const [poRequest, setPoRequest] = useState(null);
  const [reportOrigin, setReportOrigin] = useState(null);
  const [auditEvents, setAuditEvents] = useState(() => auditSeed(movementSeed));
  const failedSignIns = useRef({});
  function logEvent(values) {
    setAuditEvents((current) => [newAuditEvent({ user: manager?.fullName || "Naura", warehouse: warehouse?.warehouseName || "Main Warehouse", ...values }), ...current]);
  }
  function auditExport(module) {
    return (values) => logEvent({ module, ...values });
  }
  function openAuditReference(event) {
    if (staffAccounts.some((row) => row.id === event.reference)) {
      setStaffRequest(event.reference);
      setStep("staff-management");
      return true;
    }
    if (poOrders.some((row) => row.id === event.reference)) {
      setPoRequest(event.reference);
      setStep("purchase-orders");
      return true;
    }
    if (shipments.some((row) => row.id === event.reference)) {
      setInboundRequest(event.reference);
      setStep("inbound");
      return true;
    }
    if (inventoryItems.some((row) => row.sku === event.reference)) {
      setInventoryRequest({ sku: event.reference, kind: "report" });
      setStep("inventory");
      return true;
    }
    return false;
  }
  function navigatePage(next) {
    if (["settings", "settings-profile", "staff-management"].includes(next)) setManagementVisit((value) => value + 1);
    setInventoryRequest(null);
    setInboundRequest(null);
    setPoRequest(null);
    setReportOrigin(null);
    setStaffRequest(null);
    setSettingsView(next === "settings-profile" ? "profile" : "home");
    setStep(next === "settings-profile" ? "settings" : next);
  }
  function openPOInbound(po) {
    setInboundRequest(shipments.find((row) => row.po === po && !row.receivingCompleted && row.status !== "Received")?.id || null);
    setStep("inbound");
  }
  function receivePO(id, draft) {
    const order = poOrders.find((row) => row.id === id);
    if (order && !preferences.warehouse.allowPartial) {
      const accepted = order.products.reduce((sum, item) => sum + (draft.conditions[item.code] === "Good condition" ? Number(draft.quantities[item.code]) || 0 : 0), 0);
      if (accepted < poReceivingTotals(order).remaining) return { error: "Partial PO receipts are disabled in Warehouse Preferences. Receive all remaining accepted units or enable partial receipt." };
    }
    const result = receivePurchaseOrder({ order: poOrders.find((row) => row.id === id), draft, shipments, inventory: inventoryItems, movements, racks, user: manager?.fullName || "Naura", date: (/* @__PURE__ */ new Date()).toISOString() });
    if (result.error) return result;
    setInventoryItems(result.inventory);
    setMovements(result.movements);
    setRacks(result.racks);
    setShipments((current) => [result.shipment, ...current]);
    setPoOrders((current) => current.map((row) => row.id === id ? result.order : row));
    logEvent({ module: "Purchase Orders", action: "Goods received", reference: id, details: `${result.order.receipts.at(-1).units} accepted units \xB7 ${result.shipment.id}`, severity: result.shipment.receipt.dispositions.length ? "Warning" : "Info", changes: [{ field: "PO status", before: poOrders.find((row) => row.id === id)?.status, after: result.order.status }, ...result.shipment.receipt.stockChanges.map((row) => ({ field: row.sku, before: row.before, after: row.after })), { field: "Movement reference", before: "Not posted", after: result.shipment.id }] });
    return result;
  }
  function revisePO(id, values) {
    const result = revisePurchaseOrder(poOrders.find((row) => row.id === id), values, manager?.fullName || "Naura", (/* @__PURE__ */ new Date()).toISOString());
    if (!result.error) {
      setPoOrders((current) => current.map((row) => row.id === id ? result.order : row));
      logEvent({ module: "Purchase Orders", action: "Delivery updated", reference: id, status: "Updated", details: values.notes, changes: [{ field: "Expected date", before: poOrders.find((row) => row.id === id)?.expected, after: result.order.expected }, { field: "PO status", before: poOrders.find((row) => row.id === id)?.status, after: result.order.status }] });
    }
    return result;
  }
  function reviewInsight(request) {
    if (!inventoryItems.some((item) => item.sku === request.sku)) return;
    setInventoryRequest(request);
    setStep("inventory");
  }
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  const [manager, setManager] = useState(null);
  const [warehouse, setWarehouse] = useState(null);
  const [security, setSecurity] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [resetExpiresAt, setResetExpiresAt] = useState(0);
  const [staffAccounts, setStaffAccounts] = useState(() => structuredClone(staffSeed));
  const [preferences, setPreferences] = useState(() => structuredClone(defaultPreferences));
  const [staffRequest, setStaffRequest] = useState(null);
  const [settingsView, setSettingsView] = useState("home");
  const [managementVisit, setManagementVisit] = useState(0);
  const [warehouseDirectory, setWarehouseDirectory] = useState([{ warehouseName: "Main Warehouse", warehouseCode: "WH-01", city: "Malang" }]);
  const [authenticated, setAuthenticated] = useState(false);
  const [otherSessions, setOtherSessions] = useState([{ id: "demo-mobile", name: "SUSUNO Manager Mobile", description: "Android \xB7 Example session" }]);
  const [passwordChangedAt, setPasswordChangedAt] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => (/* @__PURE__ */ new Date()).toISOString());
  const demoCredentials = useRef({ email: "naura@gmail.com", password: "Susuno123!" });
  const effectiveManager = { fullName: "Naura", email: demoCredentials.current.email, phone: "+62 812 3456 7890", jobTitle: "Warehouse Manager", ...manager };
  const effectiveWarehouse = warehouseDirectory.find((row) => row.warehouseName === preferences.warehouse.name) || { warehouseName: "Main Warehouse", warehouseCode: "WH-01", city: "Malang", ...warehouse };
  const assignedWarehouses = [...new Set(warehouseDirectory.map((row) => row.warehouseName))];
  useEffect(() => {
    if (!authenticated || !["staff-management", "settings"].includes(step)) {
      delete document.documentElement.dataset.susunoTheme;
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.susunoTheme = preferences.appearance.theme === "system" ? media.matches ? "dark" : "light" : preferences.appearance.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [authenticated, preferences.appearance.theme, step]);
  useEffect(() => {
    if (!authenticated) return;
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => signOut("idle"), preferences.security.idleMinutes * 6e4);
    };
    arm();
    const events = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((name) => window.addEventListener(name, arm, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, arm));
    };
  }, [authenticated, preferences.security.idleMinutes]);
  function createStaff(draft) {
    draft = { ...draft, warehouse: assignedWarehouses.find((name) => name.toLowerCase() === draft.warehouse.trim().toLowerCase()) || draft.warehouse.trim() };
    const errors = validateStaff(draft, staffAccounts, assignedWarehouses);
    if (Object.keys(errors).length) return { error: Object.values(errors)[0] };
    const record = { id: "STF-" + crypto.randomUUID(), fullName: draft.fullName.trim(), contact: draft.contact.trim(), role: draft.role, username: draft.username.trim(), warehouse: draft.warehouse, warehouseCode: warehouseDirectory.find((row) => row.warehouseName === draft.warehouse)?.warehouseCode || "WH-01", createdAt: (/* @__PURE__ */ new Date()).toISOString(), createdBy: effectiveManager.fullName, lastLogin: null, passwordChangedAt: null, requirePasswordChange: true, suspended: false };
    setStaffAccounts((current) => [record, ...current]);
    logEvent({ module: "Staff Management", action: "Staff account created", reference: record.id, details: record.fullName + " \xB7 " + record.role, changes: [{ field: "Account status", before: "Not created", after: "Pending" }, { field: "Username", before: "Not assigned", after: record.username }] });
    return { staff: record };
  }
  function editStaff(id, values) {
    values = { ...values, warehouse: assignedWarehouses.find((name) => name.toLowerCase() === values.warehouse.trim().toLowerCase()) || values.warehouse.trim() };
    const row = staffAccounts.find((item) => item.id === id);
    if (!row) return { error: "Staff account not found." };
    if (!staffRoles.includes(values.role) || !assignedWarehouses.includes(values.warehouse)) return { error: "Choose a valid role and warehouse." };
    const changes = ["role", "warehouse"].filter((key) => row[key] !== values[key]).map((key) => ({ field: key, before: row[key], after: values[key] }));
    if (!changes.length) return { unchanged: true };
    setStaffAccounts((current) => current.map((item) => item.id === id ? { ...item, ...values, warehouseCode: warehouseDirectory.find((row2) => row2.warehouseName === values.warehouse)?.warehouseCode || "WH-01" } : item));
    logEvent({ module: "Staff Management", action: "Staff assignment updated", reference: id, details: row.fullName, changes });
    return {};
  }
  function resetStaff(id) {
    const row = staffAccounts.find((item) => item.id === id);
    if (!row || row.suspended) return { error: "Reactivate this staff account before resetting its credential." };
    setStaffAccounts((current) => current.map((item) => item.id === id ? { ...item, requirePasswordChange: true, temporaryIssuedAt: (/* @__PURE__ */ new Date()).toISOString() } : item));
    logEvent({ module: "Staff Management", action: "Temporary password reset", reference: id, details: row.fullName + " \xB7 New demo credential issued; value not recorded", changes: [{ field: "Password change required", before: row.requirePasswordChange, after: true }] });
    return {};
  }
  function suspendStaff(id, suspended) {
    const row = staffAccounts.find((item) => item.id === id);
    if (!row) return { error: "Staff account not found." };
    if (row.suspended === suspended) return { unchanged: true };
    setStaffAccounts((current) => current.map((item) => item.id === id ? { ...item, suspended } : item));
    logEvent({ module: "Staff Management", action: suspended ? "Staff access suspended" : "Staff access reactivated", reference: id, details: row.fullName, changes: [{ field: "Suspended", before: row.suspended, after: suspended }] });
    return {};
  }
  function saveManagerProfile(values) {
    const errors = validateProfile(values);
    if (Object.keys(errors).length) return { error: Object.values(errors)[0] };
    const next = { fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim(), jobTitle: values.jobTitle.trim(), photo: values.photo || null };
    const changes = ["fullName", "email", "phone", "jobTitle"].filter((key) => effectiveManager[key] !== next[key]).map((key) => ({ field: key, before: effectiveManager[key], after: next[key] }));
    if ((effectiveManager.photo || null) !== next.photo) changes.push({ field: "Profile photo", before: effectiveManager.photo ? "Set" : "Not set", after: next.photo ? "Updated" : "Removed" });
    if (!changes.length) return { unchanged: true };
    setManager((current) => ({ ...current, ...next }));
    demoCredentials.current.email = next.email;
    setLoginEmail(next.email);
    logEvent({ module: "Settings", action: "Manager profile updated", reference: "MGR-001", details: "Manager profile updated for this frontend session", changes });
    return {};
  }
  function savePreferences(group, values) {
    if (group === "warehouse") values = { ...values, name: assignedWarehouses.find((name) => name.toLowerCase() === values.name.trim().toLowerCase()) || values.name.trim() };
    if (!["warehouse", "notifications", "security", "appearance"].includes(group)) return { error: "Unknown preferences section." };
    const current = preferences[group];
    if (Object.keys(current).some((key) => !(key in values))) return { error: "Preferences are incomplete." };
    if (group === "warehouse" && (!assignedWarehouses.includes(values.name) || !["asc", "desc"].includes(values.rackSort) || !["reorder", "critical"].includes(values.lowThreshold) || ![7, 14, 30].includes(values.predictionDays))) return { error: "Choose valid warehouse preferences." };
    if (group === "security" && ![15, 30, 60].includes(values.idleMinutes)) return { error: "Choose a supported idle timeout." };
    if (group === "appearance" && (!["light", "dark", "system"].includes(values.theme) || !["en-US", "id-ID"].includes(values.language) || !["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"].includes(values.timeZone) || !["medium", "numeric"].includes(values.dateFormat) || !["id-ID", "en-US"].includes(values.numberLocale))) return { error: "Choose valid appearance and regional preferences." };
    const changes = Object.keys(current).filter((key) => current[key] !== values[key]).map((key) => ({ field: key, before: current[key], after: values[key] }));
    if (!changes.length) return { unchanged: true };
    setPreferences((old) => ({ ...old, [group]: { ...values } }));
    logEvent({ module: "Settings", action: group === "security" && changes.some((row) => row.field === "twoStep") ? "Two-step verification updated" : "Preferences updated", reference: group, details: group + " preferences saved for this frontend session", changes });
    return {};
  }
  function changeManagerPassword(current, next) {
    if (current !== demoCredentials.current.password) return { error: "The current demo password is incorrect." };
    if (!strongPassword(next) || next === current) return { error: "Choose a different password with at least 10 characters, a letter, number, and symbol." };
    demoCredentials.current.password = next;
    setPasswordChangedAt((/* @__PURE__ */ new Date()).toISOString());
    logEvent({ module: "Settings", action: "Password changed", reference: "MGR-001", details: "Demo manager credential updated; password values are not recorded", changes: [] });
    return {};
  }
  function revokeOtherSessions() {
    if (!otherSessions.length) return;
    setOtherSessions([]);
    logEvent({ module: "Settings", action: "Demo sessions removed", reference: "Session", details: "Sample mobile session removed. No external device contacted", changes: [] });
  }
  function finishSignIn() {
    setAuthenticated(true);
    setSessionStartedAt((/* @__PURE__ */ new Date()).toISOString());
    setStep("dashboard");
    logEvent({ module: "Authentication", action: "Signed in", reference: "Session", details: preferences.security.twoStep ? "Demo two-step sign-in completed" : "Demo manager signed in successfully" });
  }
  const [inventoryItems, setInventoryItems] = useState(() => inventorySeed.map((item) => ({ ...item })));
  const [movements, setMovements] = useState(() => movementSeed.map((row) => ({ ...row, category: inventorySeed.find((item) => item.sku === row.sku)?.category })));
  const [reportReference, setReportReference] = useState(null);
  const [reportSku, setReportSku] = useState(null);
  const [shipments, setShipments] = useState(() => withProductTypes(inboundSeed.map((row) => ({ ...row, ...completedReceivingSeed[row.id], ...inboundIssueSeed[row.id] })), inventorySeed));
  const [poOrders, setPoOrders] = useState(() => withProductTypes(purchaseOrderSeed, inventorySeed));
  function decidePO(id, status) {
    const result = decidePurchaseOrder(poOrders.find((row) => row.id === id), status, manager?.fullName || "Naura", (/* @__PURE__ */ new Date()).toISOString());
    if (!result.error) {
      setPoOrders((current) => current.map((row) => row.id === id ? result.order : row));
      logEvent({ module: "Purchase Orders", action: `Order ${status.toLowerCase()}`, reference: id, details: `Decision recorded: ${status}`, changes: [{ field: "PO status", before: "Pending", after: status }] });
    }
    return result;
  }
  function createPO(values) {
    const result = createPurchaseOrder({ values, orders: poOrders, inventory: inventoryItems, user: manager?.fullName || "Naura", date: (/* @__PURE__ */ new Date()).toISOString() });
    if (!result.error) {
      setPoOrders((current) => [result.order, ...current]);
      logEvent({ module: "Purchase Orders", action: "Order created", reference: result.order.id, details: `${result.order.supplier} \xB7 Pending approval`, changes: [{ field: "PO status", before: "Not created", after: "Pending" }] });
    }
    return result;
  }
  const [outboundShipments, setOutboundShipments] = useState(() => withProductTypes(outboundSeed, inventorySeed));
  const [outboundDrafts, setOutboundDrafts] = useState(() => structuredClone({ ...readyToShipDraftSeed, ...packingDraftSeed }));
  function createOutbound(draft) {
    const result = createOutboundRecord({ draft, shipments: outboundShipments, inventory: inventoryItems, user: manager?.fullName || "Naura", date: (/* @__PURE__ */ new Date()).toISOString() });
    if (result.error) return result;
    setOutboundShipments((current) => [result.shipment, ...current]);
    logEvent({ module: "Outbound", action: "Outbound created", reference: result.shipment.id, details: `${result.shipment.units} units scheduled`, changes: [{ field: "Status", before: "Not created", after: "Scheduled" }] });
    return result;
  }
  function startOutboundPicking(id) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || shipment.status !== "Scheduled") return { error: "Only Scheduled shipments can start picking." };
    const error = validateOutboundItems(shipment.products, inventoryItems);
    if (error) return { error };
    const updated = { ...shipment, status: "Picking", pickingStartedAt: (/* @__PURE__ */ new Date()).toISOString() };
    setOutboundShipments((current) => current.map((row) => row.id === id ? updated : row));
    setOutboundDrafts((current) => ({ ...current, [id]: current[id] || newFulfillmentDraft(updated) }));
    logEvent({ module: "Outbound", action: "Picking started", reference: id, details: "Scheduled order started picking", changes: [{ field: "Status", before: shipment.status, after: updated.status }] });
    return { shipment: updated };
  }
  function saveOutboundDraft(id, draft) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || shipment.dispatch || shipment.pickIssue) return;
    setOutboundDrafts((current) => ({ ...current, [id]: draft }));
  }
  function advanceOutbound(id, draft) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || !["Scheduled", "Picking", "Packing", "Ready to Ship"].includes(shipment.status) || shipment.dispatch || shipment.pickIssue) return { error: "This shipment cannot continue." };
    if (!["pick", "pack", "ready"].includes(draft.stage)) return { error: "Unknown fulfillment stage." };
    const error = draft.stage === "ready" ? validatePacked(shipment, draft, inventoryItems) : draft.stage === "pack" ? validatePicked(shipment, draft, inventoryItems) : "";
    if (error) return { error };
    const updated = { ...shipment, status: { pick: "Picking", pack: "Packing", ready: "Ready to Ship" }[draft.stage] };
    setOutboundShipments((current) => current.map((row) => row.id === id ? updated : row));
    setOutboundDrafts((current) => ({ ...current, [id]: { ...draft, savedAt: (/* @__PURE__ */ new Date()).toISOString() } }));
    if (shipment.status !== updated.status) logEvent({ module: "Outbound", action: "Fulfilment stage updated", reference: id, status: "Updated", details: updated.status, changes: [{ field: "Status", before: shipment.status, after: updated.status }] });
    return { shipment: updated };
  }
  function completeOutbound(id, draft) {
    const shipment = outboundShipments.find((row) => row.id === id);
    const result = shipOutbound({ shipment, draft, inventory: inventoryItems, movements, user: manager?.fullName || "Naura", date: (/* @__PURE__ */ new Date()).toISOString() });
    if (result.error) return result;
    setInventoryItems(result.inventory);
    setMovements(result.movements);
    setOutboundShipments((current) => current.map((row) => row.id === id ? result.shipment : row));
    setOutboundDrafts((current) => ({ ...current, [id]: result.draft }));
    logEvent({ module: "Outbound", action: "Outbound shipped", reference: id, details: `${result.shipment.dispatch.units} units shipped`, changes: [{ field: "Status", before: shipment.status, after: "Shipped" }, ...result.shipment.dispatch.stockChanges.map((row) => ({ field: row.sku, before: row.before, after: row.after }))] });
    return result;
  }
  function reportOutboundIssue(id, issue, draft) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || !["Picking", "Scheduled"].includes(shipment.status) || !["Missing stock", "Damaged stock", "Wrong stock"].includes(issue.type) || !issue.notes.trim()) return { error: "Choose an issue type and provide notes for an active picking order." };
    const updated = { ...shipment, status: "Issue", pickIssue: { ...issue, reportedAt: (/* @__PURE__ */ new Date()).toISOString(), user: manager?.fullName || "Naura" } };
    setOutboundShipments((current) => current.map((row) => row.id === id ? updated : row));
    setOutboundDrafts((current) => ({ ...current, [id]: draft }));
    logEvent({ module: "Outbound", action: "Pick issue reported", reference: id, severity: "Warning", details: issue.notes, changes: [{ field: "Status", before: shipment.status, after: "Issue" }] });
    return { shipment: updated };
  }
  function reviewOutboundIssue(id, values) {
    const result = resolveOutboundIssue({ shipment: outboundShipments.find((row) => row.id === id), shipments: outboundShipments, inventory: inventoryItems, draft: outboundDrafts[id], values, user: manager?.fullName || "Naura", date: (/* @__PURE__ */ new Date()).toISOString() });
    if (result.error) return result;
    setOutboundShipments((current) => {
      const next = current.map((row) => row.id === id ? result.shipment : row);
      return result.backorder ? [result.backorder, ...next] : next;
    });
    if (result.draft) setOutboundDrafts((current) => ({ ...current, [id]: result.draft }));
    logEvent({ module: "Outbound", action: result.onHold ? "Shipment held" : "Pick issue resolved", reference: id, details: values.note, changes: [{ field: "Status", before: "Issue", after: result.shipment.status }] });
    return result;
  }
  const [racks, setRacks] = useState(() => rackSeed.map((rack) => ({ ...rack })));
  const [receivingDrafts, setReceivingDrafts] = useState({});
  function saveReceivingDraft(id, draft) {
    setReceivingDrafts((current) => ({ ...current, [id]: draft }));
    setShipments((current) => current.map((row) => row.id === id && row.status === "Arrived" ? { ...row, status: "Inspecting" } : row));
  }
  function completeReceiving(id, draft) {
    const shipment = shipments.find((row) => row.id === id);
    if (!shipment) return "Shipment not found.";
    const linkedPO = poOrders.find((row) => row.id === shipment.po);
    if (linkedPO && !preferences.warehouse.allowPartial && inspectionSummary(draft.rows).accepted < poReceivingTotals(linkedPO).remaining) return "Partial PO receipts are disabled in Warehouse Preferences.";
    const result = receiveShipment({ shipment, draft, inventory: inventoryItems, movements, racks, user: manager?.fullName || "Naura", date: (/* @__PURE__ */ new Date()).toISOString() });
    if (result.error) return result.error;
    setInventoryItems(result.inventory);
    setMovements(result.movements);
    setRacks(result.racks);
    setShipments((current) => current.map((row) => row.id === id ? result.shipment : row));
    setPoOrders((current) => current.map((order) => order.id === shipment.po ? recordPOReceipt(order, result.shipment.receipt, id) : order));
    setReceivingDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    logEvent({ module: "Inbound", action: "Goods received", reference: id, details: `Accepted ${result.shipment.receipt.summary.accepted} units \xB7 ${shipment.po}`, changes: [{ field: "Status", before: shipment.status, after: "Received" }, ...result.shipment.receipt.stockChanges.map((row) => ({ field: row.sku, before: row.before, after: row.after }))] });
    return "";
  }
  function resolveIssue(id, values) {
    const shipment = shipments.find((row) => row.id === id);
    const result = resolveInboundIssue({ shipment, ...values, inventory: inventoryItems, racks, existingDraft: receivingDrafts[id], user: manager?.fullName || "Naura", date: (/* @__PURE__ */ new Date()).toISOString() });
    if (result.error) return result;
    setShipments((current) => current.map((row) => row.id === id ? result.shipment : row));
    setReceivingDrafts((current) => ({ ...current, [id]: result.draft }));
    logEvent({ module: "Inbound", action: "Receiving issue resolved", reference: id, details: result.shipment.issueResolution?.title || "Resolution saved", changes: [] });
    return result;
  }
  function markInboundArrived(id) {
    const shipment = shipments.find((row) => row.id === id);
    if (!shipment || shipment.status !== "Scheduled") return { error: "Only a Scheduled shipment can be marked as arrived." };
    const updated = { ...shipment, status: "Arrived", arrivedAt: (/* @__PURE__ */ new Date()).toISOString(), arrivedBy: manager?.fullName || "Naura" };
    setShipments((current) => current.map((row) => row.id === id && row.status === "Scheduled" ? updated : row));
    logEvent({ module: "Inbound", action: updated.status === "Arrived" ? "Shipment arrived" : "Schedule updated", reference: id, status: "Updated", details: `${updated.date} \xB7 ${updated.time}`, changes: [{ field: "Status", before: shipment.status, after: updated.status }, { field: "Date", before: shipment.date, after: updated.date }] });
    return { shipment: updated };
  }
  function editInboundSchedule(id, draft) {
    const shipment = shipments.find((row) => row.id === id);
    if (!shipment || shipment.status !== "Scheduled") return { error: "Only Scheduled shipments can be rescheduled." };
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && !Number.isNaN(Date.parse(draft.date)) && new Date(draft.date).toISOString().slice(0, 10) === draft.date;
    const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validDate || !validTime(draft.time)) return { error: "Choose a valid arrival date and start time." };
    if (draft.endTime && (!validTime(draft.endTime) || draft.endTime <= draft.time)) return { error: "End time must be later than start time on the same day." };
    if (!draft.dock?.trim()) return { error: "Enter a receiving dock." };
    if (!draft.staff?.trim()) return { error: "Enter an assigned staff name." };
    const updated = { ...shipment, date: draft.date, time: draft.time, endTime: draft.endTime || "", dock: draft.dock.trim().toUpperCase(), staff: draft.staff.trim(), scheduleUpdatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    setShipments((current) => current.map((row) => row.id === id && row.status === "Scheduled" ? updated : row));
    logEvent({ module: "Inbound", action: updated.status === "Arrived" ? "Shipment arrived" : "Schedule updated", reference: id, status: "Updated", details: `${updated.date} \xB7 ${updated.time}`, changes: [{ field: "Status", before: shipment.status, after: updated.status }, { field: "Date", before: shipment.date, after: updated.date }] });
    return { shipment: updated };
  }
  function createInbound(draft) {
    if (!poOrders.some((row) => row.id === draft.po && row.status === "Approved") || shipments.some((row) => row.po === draft.po)) return null;
    const nextNumber = Math.max(...shipments.map((row) => Number(row.id.slice(4)))) + 1;
    const shipment = { ...draft, scheduledAt: (/* @__PURE__ */ new Date()).toISOString(), scheduledBy: manager?.fullName || "Naura", carrier: draft.carrier.trim(), reference: draft.reference.trim(), id: `INB-${nextNumber}` };
    setShipments((current) => [shipment, ...current]);
    logEvent({ module: "Inbound", action: "Inbound created", reference: shipment.id, details: `${shipment.po} \xB7 ${shipment.units} units`, changes: [{ field: "Status", before: "Not created", after: "Scheduled" }] });
    return shipment;
  }
  function signOut(reason = "manual") {
    logEvent({ module: "Authentication", action: reason === "idle" ? "Session expired" : "Signed out", reference: "Session", details: reason === "idle" ? "Frontend inactivity timeout reached" : "Frontend session signed out" });
    setAuthenticated(false);
    setSecurity(null);
    setStep("signin");
  }
  function saveProduct(draft) {
    const original = inventoryItems.find((item2) => item2.sku === draft.sku);
    const updated = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16);
    const { reason, ...item } = draft;
    const changes = ["name", "category", "current", "reorder", "rack", "supplier", "barcode"].filter((key) => original[key] !== item[key]).map((key) => ({ field: key, before: original[key], after: item[key] }));
    if (changes.length) logEvent({ module: "Inventory", action: original.current !== item.current ? "Stock adjusted" : "Product updated", reference: item.sku, status: "Updated", details: `${item.name} \xB7 ${reason || "Product fields updated"}`, changes });
    setInventoryItems((current) => current.map((row) => row.sku === item.sku ? { ...item, updated } : row));
    if (original.current !== item.current) {
      setMovements((current) => [...current, { id: crypto.randomUUID(), sku: item.sku, category: item.category, date: updated, type: "Stock adjustment", reference: `ADJ-${Date.now()}`, before: original.current, change: item.current - original.current, after: item.current, rack: item.rack, user: manager?.fullName || "Naura", reason: reason.trim(), warehouse: item.warehouse }]);
    }
  }
  function backToSignIn(email = recoveryEmail) {
    setLoginEmail(email);
    setResetExpiresAt(0);
    setStep("signin");
  }
  function sendResetLink(email) {
    setRecoveryEmail(email);
    setResetExpiresAt(Date.now() + 15 * 60 * 1e3);
    setStep("reset-link-sent");
  }
  function continueFromManager(data) {
    setManager(data);
    setStep("warehouse");
  }
  function backToManager(data) {
    setWarehouse(data);
    setStep("manager");
  }
  function continueFromWarehouse(data) {
    setWarehouseDirectory((current) => [...current.filter((row) => row.warehouseName !== data.warehouseName), { ...data }]);
    setPreferences((current) => ({ ...current, warehouse: { ...current.warehouse, name: data.warehouseName } }));
    setWarehouse(data);
    setStep("security");
  }
  function backToWarehouse(data) {
    setSecurity(data);
    setStep("warehouse");
  }
  function changeEmail(data) {
    setSecurity(data);
    setStep("manager");
  }
  function demoSignIn(credentials) {
    if (credentials.email.toLowerCase() !== demoCredentials.current.email.toLowerCase() || credentials.password !== demoCredentials.current.password) {
      const email = credentials.email.toLowerCase();
      failedSignIns.current[email] = (failedSignIns.current[email] || 0) + 1;
      logEvent({ module: "Authentication", action: "Login failed", user: "Unauthenticated", authenticated: false, reference: "Sign in", status: "Failure", severity: failedSignIns.current[email] >= 3 ? "Critical" : "Warning", details: `Failed sign-in attempt ${failedSignIns.current[email]} for this session identity`, changes: [] });
      return false;
    }
    failedSignIns.current[credentials.email.toLowerCase()] = 0;
    setLoginEmail(credentials.email);
    if (preferences.security.twoStep) setStep("manager-verification");
    else finishSignIn();
    return true;
  }
  if (step === "manager-verification") return <SessionVerification onVerify={finishSignIn} onCancel={() => setStep("signin")} />;
  if (step === "staff-management") return <StaffManagement key={managementVisit} initialStaffId={staffRequest} manager={effectiveManager} warehouse={effectiveWarehouse} staff={staffAccounts} warehouses={assignedWarehouses} regional={preferences.appearance} onNavigate={navigatePage} onSignOut={signOut} onCreate={createStaff} onEdit={editStaff} onReset={resetStaff} onSuspend={suspendStaff} />;
  if (step === "settings") return <Settings key={managementVisit} initialView={settingsView} manager={effectiveManager} warehouse={effectiveWarehouse} preferences={preferences} warehouses={assignedWarehouses} onNavigate={navigatePage} onSignOut={signOut} onSaveProfile={saveManagerProfile} onSavePreferences={savePreferences} onChangePassword={changeManagerPassword} onRevokeSessions={revokeOtherSessions} otherSessions={otherSessions} currentSession={{ startedAt: sessionStartedAt, passwordChangedAt, browser: (navigator.userAgent.includes("Edg/") ? "Edge" : navigator.userAgent.includes("Chrome/") ? "Chrome" : navigator.userAgent.includes("Firefox/") ? "Firefox" : "Browser") + " \xB7 " + (navigator.userAgent.includes("Windows") ? "Windows" : navigator.userAgent.includes("Android") ? "Android" : navigator.userAgent.includes("Mac") ? "macOS" : "Current device") }} securityEvents={auditEvents.filter((row) => row.module === "Authentication" || row.module === "Settings" && ["Password changed", "Two-step verification updated", "Demo sessions removed"].includes(row.action))} />;
  if (step === "dashboard") {
    return <Dashboard manager={effectiveManager} warehouse={effectiveWarehouse} inventory={inventoryItems} onNavigate={navigatePage} onSignOut={signOut} />;
  }
  if (step === "reports") return <Reports manager={effectiveManager} warehouse={effectiveWarehouse} items={inventoryItems} movements={movements} orders={poOrders} onNavigate={navigatePage} onSignOut={signOut} onAudit={auditExport("Reports")} onMovements={() => {
    setReportSku(null);
    setReportReference(null);
    setReportOrigin("reports");
    setStep("movement-reports");
  }} />;
  if (step === "audit-trail") return <AuditTrail manager={effectiveManager} warehouse={effectiveWarehouse} events={auditEvents} onNavigate={navigatePage} onSignOut={signOut} onAudit={auditExport("Audit Trail")} onOpenReference={openAuditReference} />;
  if (step === "purchase-orders") {
    return <PurchaseOrders initialOrderId={poRequest} manager={effectiveManager} warehouse={effectiveWarehouse} orders={poOrders} inventory={inventoryItems} onDecide={decidePO} onCreate={createPO} racks={[...racks].sort((a, b) => preferences.warehouse.rackSort === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id))} shipments={shipments} onReceive={receivePO} onRevise={revisePO} onOpenInbound={openPOInbound} onMovements={(reference) => {
      setReportOrigin(null);
      setReportSku(null);
      setReportReference(reference);
      setStep("movement-reports");
    }} onNavigate={navigatePage} onSignOut={signOut} />;
  }
  if (step === "ai-insight") {
    return <AIInsight manager={effectiveManager} warehouse={effectiveWarehouse} items={inventoryItems} onReview={reviewInsight} onNavigate={navigatePage} onSignOut={signOut} />;
  }
  if (step === "outbound") {
    return <Outbound manager={effectiveManager} warehouse={effectiveWarehouse} shipments={outboundShipments} inventory={inventoryItems} drafts={outboundDrafts} onSaveDraft={saveOutboundDraft} onAdvance={advanceOutbound} onShip={completeOutbound} onReportIssue={reportOutboundIssue} onResolveIssue={reviewOutboundIssue} onViewMovements={(reference) => {
      setReportOrigin(null);
      setReportSku(null);
      setReportReference(reference);
      setStep("movement-reports");
    }} onCreate={createOutbound} onStartPicking={startOutboundPicking} onNavigate={navigatePage} onSignOut={signOut} />;
  }
  if (step === "inbound") {
    return <Inbound initialShipmentId={inboundRequest} purchaseOrders={poOrders} manager={effectiveManager} warehouse={effectiveWarehouse} shipments={shipments} movements={movements} inventory={inventoryItems} racks={[...racks].sort((a, b) => preferences.warehouse.rackSort === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id))} receivingDrafts={receivingDrafts} onSaveDraft={saveReceivingDraft} onCompleteReceiving={completeReceiving} onResolveIssue={resolveIssue} onViewMovements={(reference) => {
      setReportOrigin(null);
      setReportSku(null);
      setReportReference(reference);
      setStep("movement-reports");
    }} onCreate={createInbound} onMarkArrived={markInboundArrived} onEditSchedule={editInboundSchedule} onNavigate={navigatePage} onSignOut={signOut} />;
  }
  if (step === "inventory") {
    return <Inventory initialRequest={inventoryRequest} manager={effectiveManager} warehouse={effectiveWarehouse} items={inventoryItems} movements={movements} onSave={saveProduct} onNavigate={navigatePage} onReport={(sku) => {
      setReportOrigin(null);
      setReportReference(null);
      setReportSku(sku);
      setStep("movement-reports");
    }} onSignOut={signOut} />;
  }
  if (step === "movement-reports") {
    return <StockMovementReports reportOrigin={reportOrigin} key={`${reportSku || "all"}-${reportReference || "all"}`} reference={reportReference} manager={effectiveManager} warehouse={effectiveWarehouse} items={inventoryItems} movements={movements} sku={reportSku} onBack={() => setStep(reportOrigin === "reports" ? "reports" : reportReference?.startsWith("OUT-") ? "outbound" : reportReference ? "inbound" : "inventory")} onNavigate={navigatePage} onSignOut={signOut} />;
  }
  if (step === "forgot") {
    return <ForgotPassword initialEmail={recoveryEmail} onSend={sendResetLink} onBack={backToSignIn} />;
  }
  if (step === "reset-link-sent") {
    return <ResetLinkSent
      email={recoveryEmail}
      expiresAt={resetExpiresAt}
      onResend={() => setResetExpiresAt(Date.now() + 15 * 60 * 1e3)}
      onOpenReset={() => {
        if (Date.now() < resetExpiresAt) setStep("reset-password");
      }}
      onBack={backToSignIn}
    />;
  }
  if (step === "reset-password") {
    return <ResetPassword
      expiresAt={resetExpiresAt}
      onUpdated={() => {
        setResetExpiresAt(0);
        setStep("password-updated");
      }}
      onExpired={() => setStep("forgot")}
    />;
  }
  if (step === "password-updated") {
    return <PasswordUpdated onSignIn={() => backToSignIn()} />;
  }
  if (step === "signin") {
    return <SignIn
      initialEmail={loginEmail || manager?.email || ""}
      onCreateAccount={() => setStep("manager")}
      onForgotPassword={(email) => {
        setRecoveryEmail(email);
        setStep("forgot");
      }}
      onSignIn={demoSignIn}
    />;
  }
  if (step === "security") {
    return <SecuritySetup initialData={security} onBack={backToWarehouse} email={manager?.email ?? ""} onChangeEmail={changeEmail} manager={effectiveManager} warehouse={effectiveWarehouse} onSignIn={() => {
      setSecurity(null);
      setLoginEmail(manager?.email ?? "");
      setStep("signin");
    }} />;
  }
  if (step === "warehouse") {
    return <WarehouseSetup
      initialData={warehouse}
      onBack={backToManager}
      onContinue={continueFromWarehouse}
    />;
  }
  return <SignUp initialData={manager} onContinue={continueFromManager} onSignIn={() => setStep("signin")} />;
}
export {
  App as default
};
