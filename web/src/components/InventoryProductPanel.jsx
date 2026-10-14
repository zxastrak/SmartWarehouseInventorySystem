import React, { useState } from "react";
import Icon from "./DashboardIcon.jsx";
import { categories, stockStatus, movementTypes } from "../data/inventory.js";
function EditProduct({ product, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...product, reason: "" }), [error, setError] = useState("");
  function change(e) {
    const { name, value } = e.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setError("");
  }
  function save(e) {
    e.preventDefault();
    const current = Number(draft.current), reorder = Number(draft.reorder);
    if (!draft.name.trim() || !draft.rack.trim() || !draft.supplier.trim()) {
      setError("Product name, rack and supplier are required.");
      return;
    }
    if (draft.current === "" || draft.reorder === "" || !Number.isSafeInteger(current) || !Number.isSafeInteger(reorder) || current < 0 || reorder < 1) {
      setError("Stock must be a nonnegative whole number; reorder level must be a positive whole number.");
      return;
    }
    if (!/^\d{8,14}$/.test(draft.barcode)) {
      setError("Code must contain 8\u201314 digits.");
      return;
    }
    if (current !== product.current && !draft.reason.trim()) {
      setError("Add an adjustment reason when changing current stock.");
      return;
    }
    onSave({ ...draft, name: draft.name.trim(), rack: draft.rack.trim(), supplier: draft.supplier.trim(), current, reorder });
  }
  return <><h2>Edit Product</h2><p className="inventory-muted">Update product information and stock rules.</p><hr /><form className="inventory-edit" onSubmit={save} noValidate><h3>Product Information</h3><label>Product name<input name="name" value={draft.name} onChange={change} maxLength={100} /></label><div className="panel-two"><label>SKU code<input value={draft.sku} disabled /></label><label>Category<select name="category" value={draft.category} onChange={change}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label></div><h3>Stock Management</h3><div className="panel-two"><label>Current stock<input name="current" type="number" min="0" step="1" value={draft.current} onChange={change} /></label><label>Reorder level<input name="reorder" type="number" min="1" step="1" value={draft.reorder} onChange={change} /></label></div>{Number(draft.current) < Number(draft.reorder) && <div className="inventory-warning"><strong>Current stock is below reorder level</strong><p>Saving this value keeps the product below its reorder point.</p></div>}<div className="panel-two"><label>Rack location<input name="rack" value={draft.rack} onChange={change} maxLength={30} /></label><label>Supplier<input name="supplier" value={draft.supplier} onChange={change} maxLength={80} /></label></div><label>Code<input name="barcode" value={draft.barcode} onChange={change} inputMode="numeric" maxLength={14} /></label><label>Adjustment reason<textarea name="reason" value={draft.reason} onChange={change} maxLength={200} placeholder="Add a reason for changing stock..." /></label><p className="reason-count">{draft.reason.length}/200</p>{error && <p className="field-error" role="alert">{error}</p>}<button type="submit" className="continue-button">Save Changes</button><button type="button" className="back-button panel-button" onClick={onCancel}>Cancel</button></form></>;
}
export default function InventoryProductPanel({ product, mode, onMode, onClose, onSave, movements, onReport, onExport }) {
  const [tab, setTab] = useState("Overview"), [query, setQuery] = useState(""), [type, setType] = useState("All movements");
  const status = stockStatus(product), history = movements.filter((row) => row.sku === product.sku).sort((a, b) => b.date.localeCompare(a.date));
  const filtered = history.filter((row) => (type === "All movements" || row.type === type) && `${row.type} ${row.reference} ${row.reason}`.toLowerCase().includes(query.toLowerCase()));
  return <aside className="inventory-product-panel" aria-label={`${mode === "edit" ? "Edit" : mode === "movements" ? "Movements for" : "Details for"} ${product.name}`}><button className="inventory-close" aria-label="Close product panel" onClick={onClose}>×</button>
 {mode === "edit" ? <EditProduct key={product.sku} product={product} onSave={onSave} onCancel={() => onMode("overview")} /> : mode === "movements" ? <>
 <h2>Stock Movements</h2><p className="inventory-muted">{product.name} · {product.sku}</p><hr /><div className="panel-two panel-stat"><div><span>Current Stock</span><strong>{product.current}</strong></div><div><span>Net Change</span><strong className="critical-text">{history.reduce((sum, row) => sum + row.change, 0)}</strong></div></div><div className="panel-two movement-filters"><label className="sr-only" htmlFor="movement-search">Search movement</label><input id="movement-search" placeholder="Search movement..." value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Panel movement type" value={type} onChange={(e) => setType(e.target.value)}><option>All movements</option>{movementTypes.map((value) => <option key={value}>{value}</option>)}</select></div><div className="movement-timeline">{filtered.map((row) => <article key={row.id}><span className={`movement-circle ${row.change < 0 ? "negative" : ""}`}>{row.type === "Rack transfer" ? "\u2194" : row.change < 0 ? "\u2191" : "\u2193"}</span><div><time>{row.date.replace("T", " \xB7 ")}</time><h3>{row.type}</h3><p>{row.reference} · {row.type === "Rack transfer" ? row.rack : row.reason}</p></div><strong className={row.change < 0 ? "critical-text" : "positive-text"}>{row.change > 0 ? "+" : ""}{row.change}</strong></article>)}{!filtered.length && <p>No sample movements match the filter.</p>}</div><button className="back-button panel-button" onClick={onReport}>View Full Movement Report</button><button className="continue-button" onClick={onExport}>Export Movements</button><p className="inventory-small">Showing {filtered.length} sample movements.</p>
 </> : <>
 <div className="product-panel-header"><div className="product-thumbnail"><Icon name="box" size={40} /></div><div><h2>{product.name}</h2><span className={`inventory-status status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span><p className="inventory-muted">{product.sku} · {product.category}</p></div></div>
 <div className="product-tabs">{["Overview", "Stock History", "Details"].map((value) => <button key={value} className={tab === value ? "selected-tab" : ""} onClick={() => setTab(value)}>{value}</button>)}</div>
 {tab === "Stock History" ? <><p className="inventory-muted">{history.length} sample movements recorded.</p><button className="continue-button" onClick={() => onMode("movements")}>View Stock Movements</button></> : <>
 {tab === "Overview" && <div className="panel-two panel-stat"><div><span>Current Stock</span><strong>{product.current}</strong></div><div><span>Reorder Level</span><strong>{product.reorder}</strong></div></div>}
 <dl className="product-details">{[["Rack Location", product.rack], ["Warehouse", product.warehouse], ["Supplier", product.supplier], ["Code", product.barcode], ["Last Updated", product.updated.replace("T", " \xB7 ")]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button className="continue-button" onClick={() => onMode("edit")}>Edit Product</button><button className="back-button panel-button" onClick={() => onMode("movements")}>View Stock Movements</button>
 {tab === "Overview" && <div className="stock-health"><h3>Stock Health</h3><progress value={Math.min(product.current, product.reorder)} max={product.reorder} /><div><span>{product.current} current</span><span>{product.reorder} reorder level</span></div>{product.current < product.reorder && <div className="inventory-warning"><strong>Restock recommended</strong><p>Demo estimate: stockout in 4 days. Suggested quantity: {Math.max(0, product.reorder * 2 - product.current)} units.</p></div>}</div>}
 </>}
 </>}
 </aside>;
}
