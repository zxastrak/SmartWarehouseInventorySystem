import { typeOf, matchesText, findProduct, normaliseType, cleanText } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import DashboardSidebar from "../components/DashboardSidebar.jsx";
import WarehouseHeader from "../components/WarehouseHeader.jsx";
import Icon from "../components/DashboardIcon.jsx";
import InventoryProductPanel from "../components/InventoryProductPanel.jsx";
import MovementExport from "../components/MovementExport.jsx";
import { categories, inventorySeed, stockStatus } from "../data/inventory.js";
import "../styles/dashboard.css";
import "../styles/inventory.css";
function Inventory({ manager, warehouse, items, movements, onSave, onNavigate, onReport, onSignOut, initialRequest = null }) {
  const [query, setQuery] = useState(initialRequest?.sku || ""), [category, setCategory] = useState("All Categories"), [status, setStatus] = useState("All Stock Status"), [location, setLocation] = useState("All Warehouses"), [sort, setSort] = useState("default"), [page, setPage] = useState(1), [selected, setSelected] = useState(initialRequest?.sku || null), [mode, setMode] = useState(initialRequest?.kind === "location" || initialRequest?.kind === "reorder" ? "edit" : "overview"), [checks, setChecks] = useState([]), [navOpen, setNavOpen] = useState(false), [exporting, setExporting] = useState(false), [notice, setNotice] = useState(initialRequest?.kind === "report" ? "Inventory report review: inspect this product\u2019s current record." : initialRequest?.kind === "location" ? "Location review: inspect the product rack and available stock. Editing the rack updates its primary location; per-rack quantity transfers are not connected yet." : initialRequest?.kind === "reorder" ? "Reorder review: inspect and update this product\u2019s reorder level." : initialRequest ? "Restock review: inspect current stock and reorder level for this product." : "");
  const panelFocus = useRef(null), panelTrigger = useRef(null);
  const warehouses = [...new Set(items.map((item) => item.warehouse))];
  const filtered = items.filter((item) => `${item.name} ${item.sku} ${item.supplier} ${item.rack}`.toLowerCase().includes(query.toLowerCase()) && matchesText(category, item.category, "All Categories") && (status === "All Stock Status" || stockStatus(item) === status) && matchesText(location, item.warehouse, "All Warehouses")).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "stock-low" ? a.current - b.current : sort === "stock-high" ? b.current - a.current : 0);
  const pages = Math.max(1, Math.ceil(filtered.length / 9)), visible = filtered.slice((page - 1) * 9, page * 9), product = items.find((item) => item.sku === selected);
  useEffect(() => setPage(1), [query, category, status, location, sort]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  useEffect(() => {
    if (selected) panelFocus.current?.querySelector("button")?.focus();
  }, [selected]);
  useEffect(() => {
    if (initialRequest && mode === "edit") panelFocus.current?.querySelector(initialRequest.kind === "location" ? 'input[name="rack"]' : 'input[name="reorder"]')?.focus();
  }, [initialRequest, mode]);
  function close() {
    setSelected(null);
    setExporting(false);
    panelTrigger.current?.focus();
  }
  function select(item, event) {
    panelTrigger.current = event.currentTarget;
    setSelected(item.sku);
    setMode("overview");
    setNotice("");
  }
  function navigate(label) {
    if (label === "Staff Management" || label === "Settings") {
      onNavigate(label === "Settings" ? "settings" : "staff-management");
      return;
    }
    if (label === "Dashboard") onNavigate("dashboard");
    else if (label === "Inbound") onNavigate("inbound");
    else if (label === "Outbound") onNavigate("outbound");
    else if (label === "Reports" || label === "Audit Trail") onNavigate(label === "Reports" ? "reports" : "audit-trail");
    else if (label === "Purchase Orders") onNavigate("purchase-orders");
    else if (label === "AI Insight") onNavigate("ai-insight");
    else if (label !== "Inventory") setNotice(`${label} will be connected after its design is implemented.`);
  }
  const countFor = (array, value) => array.filter((item) => stockStatus(item) === value).length;
  const summaries = [["Total Items", "1,000", "box", "green"], ["In Stock", 365 + countFor(items, "In Stock") - countFor(inventorySeed, "In Stock"), "box", "green"], ["Low Stock", 365 + countFor(items, "Low") + countFor(items, "Critical") - countFor(inventorySeed, "Low") - countFor(inventorySeed, "Critical"), "warning", "rose"], ["Out of Stock", 47 + countFor(items, "Out of Stock") - countFor(inventorySeed, "Out of Stock"), "close", "rose"]];
  return <div className="dashboard-layout"><DashboardSidebar activePage="Inventory" warehouseName={warehouse?.warehouseName || "Main Warehouse"} onNavigate={navigate} open={navOpen} onClose={() => setNavOpen(false)} /><div className="dashboard-main"><WarehouseHeader onViewProfile={() => onNavigate("settings-profile")} manager={manager} search={query} onSearch={setQuery} onMenu={() => setNavOpen(true)} onSignOut={onSignOut} /><main className="dashboard-content inventory-content"><div className="dashboard-intro"><div><p>WAREHOUSE OPERATIONS</p><h1>Inventory</h1><p className="inventory-description">Manage products, stock levels, and storage locations.</p></div><div className="dashboard-date"><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(/* @__PURE__ */ new Date())}</p><p>{warehouse?.warehouseName || "Main Warehouse"}</p></div></div>
 {initialRequest && <div className="inventory-selection"><span>Opened from AI Insight · {initialRequest.sku}</span><button className="dashboard-link" onClick={() => onNavigate("ai-insight")}>‹ Back to AI Insight</button></div>}
 <div className={`inventory-grid${product ? " with-panel" : ""}`}><div className="inventory-primary"><section className="inventory-metrics" aria-label="Inventory summary">{summaries.map(([label, value, icon, tone], index) => <div className={`metric-card metric-${tone}`} key={label}><div><h2>{label}</h2><div className="inventory-metric-value"><Icon name={icon} size={42} /><strong>{value.toLocaleString("en-US")}</strong></div><p><span>▲ {["+8%", "+12%", "+12%", "+67%"][index]}</span> vs. last month</p></div></div>)}</section>
 <section className="inventory-list dashboard-card" aria-label="Inventory products"><div className="inventory-filters"><div className="inventory-filter-search"><Icon name="search" /><input aria-label="Search product, SKU or supplier" placeholder="Search product, SKU, or supplier..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><input type="text" autoComplete="off" placeholder="Search product type..." aria-label="Category filter" value={category === "All Categories" ? "" : category} onChange={(e) => setCategory(e.target.value)} /><select aria-label="Stock status filter" value={status} onChange={(e) => setStatus(e.target.value)}>{["All Stock Status", "Critical", "Low", "In Stock", "Out of Stock"].map((value) => <option key={value}>{value}</option>)}</select><input type="text" autoComplete="off" placeholder="Search warehouse..." aria-label="Warehouse filter" value={location === "All Warehouses" ? "" : location} onChange={(e) => setLocation(e.target.value)} /><select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}><option value="default">Sort</option><option value="name">Name A–Z</option><option value="stock-low">Stock ascending</option><option value="stock-high">Stock descending</option></select></div>
 {checks.length > 0 && <div className="inventory-selection">{checks.length} selected <button className="dashboard-link" onClick={() => setChecks([])}>Clear selection</button></div>}
 <div className="inventory-table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Select visible products" checked={visible.length > 0 && visible.every((item) => checks.includes(item.sku))} onChange={(e) => setChecks((current) => e.target.checked ? [.../* @__PURE__ */ new Set([...current, ...visible.map((item) => item.sku)])] : current.filter((sku) => !visible.some((item) => item.sku === sku)))} /></th>{["Product", "Code", "Product Type", "Current", "Reorder", "Rack", "Supplier", "Status", "Actions"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map((item) => <tr key={item.sku} className={item.sku === selected ? "inventory-row-selected" : ""}><td><input aria-label={`Select ${item.name}`} type="checkbox" checked={checks.includes(item.sku)} onChange={(e) => setChecks((current) => e.target.checked ? [...current, item.sku] : current.filter((sku) => sku !== item.sku))} /></td><td><button className="inventory-product-link" onClick={(event) => select(item, event)}>{item.name}</button></td><td>{item.sku}</td><td>{item.category}</td><td className={item.current < 10 ? "critical-text" : ""}>{item.current}</td><td>{item.reorder}</td><td>{item.rack}</td><td>{item.supplier}</td><td><span className={`inventory-status status-${stockStatus(item).toLowerCase().replaceAll(" ", "-")}`}>{stockStatus(item)}</span></td><td><button className="inventory-dots" aria-label={`Actions for ${item.name}`} onClick={(event) => select(item, event)}>•••</button></td></tr>)}{!visible.length && <tr><td colSpan="10" className="inventory-empty">No products match these filters.</td></tr>}</tbody></table></div><div className="inventory-pagination"><span>Showing {filtered.length ? (page - 1) * 9 + 1 : 0}–{Math.min(page * 9, filtered.length)} of {filtered.length} sample products</span><div>{Array.from({ length: pages }, (_, index) => <button key={index} className={page === index + 1 ? "active-page" : ""} aria-label={`Page ${index + 1}`} aria-current={page === index + 1 ? "page" : void 0} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button aria-label="Next page" disabled={page === pages} onClick={() => setPage((current) => current + 1)}>›</button></div></div></section></div>
 {product && <div ref={panelFocus} onKeyDown={(e) => {
    if (e.key === "Escape" && !exporting) close();
  }}><InventoryProductPanel key={product.sku} product={product} mode={mode} onMode={setMode} onClose={close} movements={movements} onReport={() => onReport(product.sku)} onExport={() => setExporting(true)} onSave={(draft) => {
    onSave(draft);
    setMode("overview");
    setNotice("Changes saved to demo state. Refreshing the browser resets sample data.");
  }} /></div>}</div>{notice && <p className="form-notice inventory-notice" role="status">{notice}</p>}<p className="dashboard-demo">Frontend demo · Global KPI sample: 1,000 items. Table contains {items.length} sample products; edits remain in React state.</p></main></div>{exporting && <MovementExport product={product} movements={movements} onClose={() => setExporting(false)} />}</div>;
}
export {
  Inventory as default
};
