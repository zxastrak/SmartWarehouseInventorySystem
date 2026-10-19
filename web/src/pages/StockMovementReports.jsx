import { typeOf, matchesText, findProduct, normaliseType, cleanText } from "../utils/productTypes.js";
import React, { useState } from "react";
import DashboardSidebar from "../components/DashboardSidebar.jsx";
import WarehouseHeader from "../components/WarehouseHeader.jsx";
import MovementExport from "../components/MovementExport.jsx";
import { movementTypes } from "../data/inventory.js";
import "../styles/dashboard.css";
import "../styles/inventory.css";
const columns = [["category", "Product Type"], ["date", "Date & time"], ["type", "Movement type"], ["reference", "Reference"], ["rack", "Rack"], ["user", "Created by"], ["before", "Before"], ["change", "Change"], ["after", "After"], ["reason", "Reason"]];
const defaultEnd = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) > "2026-09-30" ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) : "2026-09-30";
function StockMovementReports({ manager, warehouse, items, movements, sku, reference = null, onBack, onNavigate, onSignOut, reportOrigin = null }) {
  const [query, setQuery] = useState(""), [productSku, setProductSku] = useState(sku || "all"), [start, setStart] = useState("2026-09-01"), [end, setEnd] = useState(defaultEnd), [type, setType] = useState("All movements"), [location, setLocation] = useState("All warehouses"), [user, setUser] = useState("All users"), [page, setPage] = useState(1), [keys, setKeys] = useState(columns.map(([key]) => key)), [columnsOpen, setColumnsOpen] = useState(false), [exporting, setExporting] = useState(false), [navOpen, setNavOpen] = useState(false), [notice, setNotice] = useState("");
  const product = items.find((item) => item.sku === productSku);
  const filtered = movements.filter((row) => (!reference || row.reference === reference) && (!productSku.trim() || productSku === "all" || row.sku.toLowerCase().includes(productSku.trim().toLowerCase()) || (items.find((item) => item.sku === row.sku)?.name || "").toLowerCase().includes(productSku.trim().toLowerCase())) && row.date.slice(0, 10) >= start && row.date.slice(0, 10) <= end && (type === "All movements" || row.type === type) && matchesText(location, row.warehouse, "All warehouses") && matchesText(user, row.user, "All users") && `${row.sku} ${row.reference} ${row.rack} ${row.reason} ${items.find((item) => item.sku === row.sku)?.name || ""}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.date.localeCompare(b.date));
  const balances = /* @__PURE__ */ new Map();
  filtered.forEach((row) => {
    if (!balances.has(row.sku)) balances.set(row.sku, { opening: row.before, closing: row.after });
    else balances.get(row.sku).closing = row.after;
  });
  const opening = [...balances.values()].reduce((sum, b) => sum + b.opening, 0), closing = [...balances.values()].reduce((sum, b) => sum + b.closing, 0);
  const inbound = filtered.filter((row) => row.type === "Inbound received").reduce((sum, row) => sum + row.change, 0), outbound = filtered.filter((row) => row.type === "Outbound shipped").reduce((sum, row) => sum - row.change, 0), adjustments = filtered.filter((row) => row.type === "Stock adjustment").reduce((sum, row) => sum + row.change, 0);
  const pages = Math.max(1, Math.ceil(filtered.length / 9)), activePage = Math.min(page, pages), visible = filtered.slice().reverse().slice((activePage - 1) * 9, activePage * 9);
  function change(setter, value) {
    setter(value);
    setPage(1);
  }
  function reset() {
    setQuery("");
    setProductSku(sku || "all");
    setStart("2026-09-01");
    setEnd(defaultEnd());
    setType("All movements");
    setLocation("All warehouses");
    setUser("All users");
    setPage(1);
  }
  function navigate(label) {
    if (label === "Staff Management" || label === "Settings") {
      onNavigate(label === "Settings" ? "settings" : "staff-management");
      return;
    }
    if (label === "Inventory") onNavigate("inventory");
    else if (label === "Dashboard") onNavigate("dashboard");
    else if (label === "Inbound") onNavigate("inbound");
    else if (label === "Outbound") onNavigate("outbound");
    else if (label === "Reports" || label === "Audit Trail") onNavigate(label === "Reports" ? "reports" : "audit-trail");
    else if (label === "Purchase Orders") onNavigate("purchase-orders");
    else if (label === "AI Insight") onNavigate("ai-insight");
    else setNotice(`${label} will be connected after its design is implemented.`);
  }
  return <div className="dashboard-layout"><DashboardSidebar activePage={reportOrigin === "reports" ? "Reports" : "Inventory"} warehouseName={warehouse?.warehouseName || "Main Warehouse"} open={navOpen} onClose={() => setNavOpen(false)} onNavigate={navigate} /><div className="dashboard-main"><WarehouseHeader onViewProfile={() => onNavigate("settings-profile")} manager={manager} search={query} onSearch={(value) => change(setQuery, value)} onMenu={() => setNavOpen(true)} onSignOut={onSignOut} /><main className="dashboard-content inventory-content report-content"><div className="dashboard-intro"><div><p>WAREHOUSE OPERATIONS</p><h1>Stock Movement Reports</h1><p className="inventory-description">{reference ? `Stock movement history for ${reference}.` : "Review stock changes and movement history."}</p></div><div className="dashboard-date"><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(/* @__PURE__ */ new Date())}</p><p>{warehouse?.warehouseName || "Main Warehouse"}</p></div></div><section className="dashboard-card report-filter-card"><div className="report-filters"><label>Product<input type="text" autoComplete="off" placeholder="Enter product name or SKU" value={productSku === "all" ? "" : productSku} onChange={(e) => change(setProductSku, e.target.value)} /></label><label>From<input type="date" value={start} onChange={(e) => change(setStart, e.target.value)} /></label><label>To<input type="date" value={end} onChange={(e) => change(setEnd, e.target.value)} /></label><label>Movement type<select value={type} onChange={(e) => change(setType, e.target.value)}><option>All movements</option>{movementTypes.map((value) => <option key={value}>{value}</option>)}</select></label><label>Warehouse<input type="text" autoComplete="off" placeholder="Search warehouse..." value={location === "All Warehouses" ? "" : location} onChange={(e) => change(setLocation, e.target.value)} /></label><label>Created by<input type="text" autoComplete="off" placeholder="Search user..." value={user === "All users" ? "" : user} onChange={(e) => change(setUser, e.target.value)} /></label><button className="dashboard-link" onClick={reset}>Reset</button></div>{start > end && <p role="alert" className="field-error">Start date must be before the end date.</p>}</section><div className="report-metrics">{[["Opening Stock", opening, "green"], ["Total Inbound", inbound, "green"], ["Total Outbound", outbound, "rose"], ["Adjustments", adjustments, "rose"], ["Closing Stock", closing, "green"]].map(([label, value, tone]) => <div key={label} className={`metric-card metric-${tone}`}><div><h2>{label}</h2><strong>{value.toLocaleString("en-US")}</strong></div></div>)}</div><section className="dashboard-card report-table-card"><div className="report-top-actions"><div><h2>All Movements</h2><p className="inventory-muted">{product ? `${product.name} \xB7 ${product.sku}` : "All sample products"} · {filtered.length} records</p></div><div className="report-table-buttons"><button onClick={onBack}>‹ Back to {reportOrigin === "reports" ? "Reports" : reference?.startsWith("OUT-") ? "Outbound" : reference ? "Inbound" : "Inventory"}</button><button onClick={() => setExporting(true)}>Export Movements</button><div className="report-columns"><button aria-expanded={columnsOpen} onClick={() => setColumnsOpen((value) => !value)}>Columns ⌄</button>{columnsOpen && <div className="report-columns-options">{columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={keys.includes(key)} disabled={keys.length === 1 && keys.includes(key)} onChange={() => setKeys((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key])} />{label}</label>)}</div>}</div></div></div><div className="inventory-table-wrap"><table><thead><tr>{!product && <th>SKU</th>}{columns.filter(([key]) => keys.includes(key)).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id}>{!product && <td>{row.sku}</td>}{columns.filter(([key]) => keys.includes(key)).map(([key]) => <td key={key} className={key === "change" ? row.change < 0 ? "critical-text" : "positive-text" : ""}>{key === "date" ? row.date.replace("T", " \xB7 ") : key === "change" && row.change > 0 ? `+${row.change}` : row[key]}</td>)}</tr>)}{!visible.length && <tr><td colSpan={keys.length + (!product ? 1 : 0)} className="inventory-empty">No movements match these filters.</td></tr>}</tbody></table></div><div className="inventory-pagination"><span>Showing {filtered.length ? (activePage - 1) * 9 + 1 : 0}–{Math.min(activePage * 9, filtered.length)} of {filtered.length} records</span><div>{Array.from({ length: pages }, (_, index) => <button key={index} className={activePage === index + 1 ? "active-page" : ""} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button disabled={activePage === pages} onClick={() => setPage(activePage + 1)}>›</button></div></div></section>{notice && <p role="status" className="form-notice inventory-notice">{notice}</p>}<p className="dashboard-demo">Frontend demo · Balances use first/last matching records per SKU. Export has its own scope, date and type filters.</p></main></div>{exporting && <MovementExport contextLabel={reference ? `Shipment ${reference}` : null} product={product} movements={reference ? movements.filter((row) => row.reference === reference) : movements} onClose={() => setExporting(false)} />}</div>;
}
export {
  StockMovementReports as default
};
