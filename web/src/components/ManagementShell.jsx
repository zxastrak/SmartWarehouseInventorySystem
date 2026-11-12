import React, { useState } from "react";
import DashboardSidebar from "./DashboardSidebar.jsx";
import WarehouseHeader from "./WarehouseHeader.jsx";
import { managementRoutes } from "../utils/staffSettings.js";
import "../styles/dashboard.css";
import "../styles/inventory.css";
import "../styles/inbound.css";
import "../styles/staffSettings.css";
export default function ManagementShell({ page, title, eyebrow, description, manager, warehouse, onNavigate, onSignOut, query = "", onSearch, regional, children }) {
  const [open, setOpen] = useState(false), [notice, setNotice] = useState("");
  function navigate(label) {
    if (managementRoutes[label]) onNavigate(managementRoutes[label]);
    else setNotice(`${label} is not available in this demo.`);
  }
  return <div className="dashboard-layout"><DashboardSidebar activePage={page} warehouseName={warehouse?.warehouseName || "Main Warehouse"} open={open} onClose={() => setOpen(false)} onNavigate={navigate} /><div className="dashboard-main"><WarehouseHeader manager={manager} search={query} onSearch={onSearch || (() => {
  })} onMenu={() => setOpen(true)} onSignOut={onSignOut} onAlerts={() => onNavigate("audit-trail")} onViewProfile={() => onNavigate("settings-profile")} searchPlaceholder={page === "Staff Management" ? "Search staff name, role or username..." : "Search settings..."} searchLabel={page === "Staff Management" ? "Search staff" : "Search settings"} /><main className="dashboard-content ss-content"><div className="dashboard-intro"><div><p>{eyebrow}</p><h1>{title}</h1><p className="ss-description">{description}</p></div><div className="dashboard-date"><p>{new Intl.DateTimeFormat(regional?.language || "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: regional?.timeZone || "Asia/Jakarta" }).format(/* @__PURE__ */ new Date())}</p><p>{warehouse?.warehouseName || "Main Warehouse"}</p></div></div>{notice && <p role="status" className="form-notice">{notice}</p>}{children}</main></div></div>;
}
