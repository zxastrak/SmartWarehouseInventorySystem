import { typeOf, matchesText, findProduct, normaliseType, cleanText } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import PurchaseOrderFlow, { poFlowTitles } from "../components/PurchaseOrderFlow.jsx";
import DashboardSidebar from "../components/DashboardSidebar.jsx";
import WarehouseHeader from "../components/WarehouseHeader.jsx";
import { purchaseOrderStatuses } from "../data/purchaseOrders.js";
import { poTotal, poMoney, poDate, poToday, downloadPurchaseOrder } from "../utils/purchaseOrders.js";
import "../styles/dashboard.css";
import "../styles/inventory.css";
import "../styles/inbound.css";
import "../styles/purchaseOrders.css";
function PurchaseOrders({ manager, warehouse, orders, inventory, onDecide, onCreate, onNavigate, onSignOut, racks, shipments, onReceive, onRevise, onOpenInbound, onMovements, initialOrderId = null }) {
  const [view, setView] = useState(() => ({ "In Transit": "track", "Partially Received": "partial", Overdue: "overdue", Received: "completed" })[orders.find((row) => row.id === initialOrderId)?.status] || "details");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("All Status"), [supplier, setSupplier] = useState("All Suppliers"), [page, setPage] = useState(1), [selected, setSelected] = useState(initialOrderId), [navOpen, setNavOpen] = useState(false), [notice, setNotice] = useState(""), [result, setResult] = useState(null), [creating, setCreating] = useState(false), [error, setError] = useState("");
  const [draft, setDraft] = useState({ supplier: "", expected: "", terms: "Net 30", reference: "", notes: "", products: [{ name: "", code: "", category: "", quantity: "", unitPrice: "" }] });
  const resultRef = useRef(null), createRef = useRef(null), lock = useRef(false), order = orders.find((row) => row.id === selected), warehouseName = warehouse?.warehouseName || "Main Warehouse";
  const filtered = orders.filter((row) => `${row.id} ${row.supplier}`.toLowerCase().includes(query.trim().toLowerCase()) && (status === "All Status" || row.status === status || status === "Overdue" && !["Pending", "Rejected", "Received"].includes(row.status) && row.expected < poToday()) && matchesText(supplier, row.supplier, "All Suppliers"));
  const pages = Math.max(1, Math.ceil(filtered.length / 6)), activePage = Math.min(page, pages), visible = filtered.slice((activePage - 1) * 6, activePage * 6), active = orders.filter((row) => !["Pending", "Rejected", "Received"].includes(row.status)), pending = orders.filter((row) => row.status === "Pending").length, overdue = active.filter((row) => row.expected < poToday()).length, monthly = orders.filter((row) => row.currency === "IDR" && row.created?.startsWith(poToday().slice(0, 7)) && row.status !== "Rejected").reduce((sum, row) => sum + poTotal(row), 0);
  useEffect(() => setPage(1), [query, status, supplier]);
  useEffect(() => {
    if (result) resultRef.current?.showModal();
  }, [result]);
  useEffect(() => {
    if (creating) createRef.current?.showModal();
  }, [creating]);
  function back() {
    setView("details");
    setSelected(null);
    setResult(null);
    setError("");
    lock.current = false;
    window.scrollTo(0, 0);
  }
  function navigate(label) {
    if (label === "Staff Management" || label === "Settings") {
      onNavigate(label === "Settings" ? "settings" : "staff-management");
      return;
    }
    const routes = { Dashboard: "dashboard", Inventory: "inventory", Inbound: "inbound", Outbound: "outbound", "AI Insight": "ai-insight", "Purchase Orders": "purchase-orders", Reports: "reports", "Audit Trail": "audit-trail" };
    if (label === "Purchase Orders") {
      back();
      setQuery("");
    } else if (routes[label]) onNavigate(routes[label]);
    else setNotice(`${label} will be connected after its design is implemented.`);
  }
  function decide(value) {
    if (lock.current) return;
    lock.current = true;
    const next = onDecide(order.id, value);
    if (next.error) {
      lock.current = false;
      setError(next.error);
      return;
    }
    setResult(value);
  }
  function newOrder() {
    setDraft({ supplier: "", expected: "", terms: "Net 30", reference: "", notes: "", products: [{ name: "", code: "", category: "", quantity: "", unitPrice: "" }] });
    setError("");
    setCreating(true);
  }
  function changeItem(index, key, value) {
    setDraft((current) => ({ ...current, products: current.products.map((row, i) => i === index ? { ...row, [key]: value } : row) }));
  }
  function changeProduct(index, text) {
    const found = findProduct(text, inventory);
    setDraft((current) => ({ ...current, products: current.products.map((row, i) => i === index ? { ...row, name: text, code: found?.sku || "", category: found?.category || row.category || "" } : row) }));
    setError("");
  }
  function changeSku(index, text) {
    const found = findProduct(text, inventory);
    setDraft((current) => ({ ...current, products: current.products.map((row, i) => i === index ? { ...row, code: text.toUpperCase().replace(/\s/g, ""), ...found ? { name: found.name, category: found.category } : {} } : row) }));
    setError("");
  }
  function create(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    const next = onCreate({ ...draft, deliverTo: warehouseName });
    lock.current = false;
    if (next.error) {
      setError(next.error);
      return;
    }
    setCreating(false);
    setView("details");
    setSelected(next.order.id);
    setNotice(`${next.order.id} created for approval.`);
    setQuery("");
    setStatus("All Status");
    setSupplier("All Suppliers");
  }
  const action = (row) => row.status === "Pending" || row.status === "Overdue" ? "Review" : row.status === "In Transit" ? "Track" : row.status === "Partially Received" ? "Receive" : "View";
  return <div className="dashboard-layout"><DashboardSidebar activePage="Purchase Orders" warehouseName={warehouseName} open={navOpen} onClose={() => setNavOpen(false)} onNavigate={navigate} /><div className="dashboard-main"><WarehouseHeader onViewProfile={() => onNavigate("settings-profile")} manager={manager} search={query} onSearch={setQuery} onMenu={() => setNavOpen(true)} onSignOut={onSignOut} /><main className="dashboard-content po-content"><div className="dashboard-intro"><div><p>{order ? "PURCHASE ORDERS / " + (view === "details" ? order.status === "Pending" ? "PENDING ORDERS" : "DETAIL" : view.toUpperCase()) : "WAREHOUSE OPERATIONS"}</p><h1>{order ? view === "track" && order.deliveryRevision ? "Track Revised Delivery" : poFlowTitles[view] || (order.status === "Pending" ? "Pending Orders" : "Purchase Orders Detail") : "Purchase Orders"}</h1><p className="po-description">Create, monitor, and receive supplier purchase orders.</p></div><div className="dashboard-date"><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Jakarta" }).format(/* @__PURE__ */ new Date())}</p><p>{warehouseName}</p></div></div>{!order ? <><section className="po-metrics" aria-label="Purchase order summary">{[[active.length, "Open Orders", "awaiting delivery", "green"], [pending, "Pending Approval", "need review", "rose"], [overdue, "Overdue", "past expected date", "rose"]].map(([value, label, caption, tone]) => <div className={"po-metric metric-" + tone} key={label}><strong>{value}</strong><div><h2>{label}</h2><p>{caption}</p></div></div>)}<div className="po-month"><h2>This Month</h2><strong>{poMoney(monthly)}</strong><small>IDR orders · {poToday().slice(0, 7)}</small></div></section><section className="dashboard-card po-list"><h2>Purchase Orders</h2><p>Supplier orders, approval decisions, and expected deliveries.</p><div className="po-filters"><input aria-label="Search PO number or supplier" placeholder="Search PO number or supplier..." value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Purchase order status" value={status} onChange={(e) => setStatus(e.target.value)}><option>All Status</option>{purchaseOrderStatuses.map((value) => <option key={value}>{value}</option>)}</select><input type="text" autoComplete="off" placeholder="Search supplier..." aria-label="Purchase order supplier" value={supplier === "All Suppliers" ? "" : supplier} onChange={(e) => setSupplier(e.target.value)} /><button className="inbound-primary" onClick={newOrder}>+ New Purchase Order</button></div><div className="inventory-table-wrap po-list-table"><table><thead><tr>{["PO Number", "Supplier", "Expected Date", "Items", "Total", "Status", "Action"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.id}</strong></td><td><strong>{row.supplier}</strong></td><td>{poDate(row.expected)}</td><td>{row.products.length}</td><td>{poMoney(poTotal(row), row.currency)}</td><td><span className={"po-status status-" + row.status.toLowerCase().replaceAll(" ", "-")}>{row.status}</span></td><td><button className="dashboard-link" aria-label={`${action(row)} ${row.id}`} onClick={() => {
    setView({ "In Transit": "track", "Partially Received": "partial", Overdue: "overdue", Received: "completed" }[row.status] || "details");
    setSelected(row.id);
    setNotice("");
    setError("");
    window.scrollTo(0, 0);
  }}>{action(row)} ›</button></td></tr>)}{!visible.length && <tr><td colSpan="7">No purchase orders match these filters.</td></tr>}</tbody></table></div><div className="inventory-pagination"><span>Showing {filtered.length ? (activePage - 1) * 6 + 1 : 0}–{Math.min(activePage * 6, filtered.length)} of {filtered.length} orders</span><div>{Array.from({ length: pages }, (_, i) => <button key={i} className={activePage === i + 1 ? "active-page" : ""} aria-label={`Purchase orders page ${i + 1}`} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button disabled={activePage === pages} aria-label="Next purchase orders page" onClick={() => setPage(activePage + 1)}>›</button></div></div></section></> : view !== "details" ? <PurchaseOrderFlow key={order.id} order={order} stage={view} onStage={setView} inventory={inventory} racks={racks} shipments={shipments} manager={manager} onReceive={(draft2) => onReceive(order.id, draft2)} onRevise={(values) => onRevise(order.id, values)} onBack={back} onOpenInbound={onOpenInbound} onMovements={onMovements} /> : <section className="dashboard-card po-details"><button className="dashboard-link po-back" onClick={back}>‹ Back to Purchase Orders</button><div className="po-detail-title"><h2>{order.id}</h2><span className={"po-status status-" + order.status.toLowerCase().replaceAll(" ", "-")}>{order.status === "Pending" ? "Pending Approval" : order.status}</span><p>Created {poDate(order.created)} · {order.requestedBy}</p></div><div className="po-detail-grid"><section className="po-info"><h2>Order Information</h2><dl>{[["Supplier", order.supplier], ["Requested by", order.requestedBy], ["Deliver to", order.deliverTo || warehouseName], ["Reference", order.reference || "\u2014"], ["Expected date", poDate(order.expected)], ["Notes", order.notes || "\u2014"], ["Payment terms", order.terms || "Not recorded"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><aside className="po-approval"><h2>{order.status === "Approved" ? "\u2713 Order approved" : "Approval"}</h2><dl><div><dt>Status</dt><dd className={order.status === "Pending" || order.status === "Rejected" ? "critical-text" : "positive-text"}>{order.status === "Pending" ? "Pending Review" : order.status}</dd></div><div><dt>Approver</dt><dd>{order.decision?.user || "Warehouse Manager"}</dd></div></dl>{order.status === "Pending" ? <div className="po-decision-buttons"><button className="inbound-secondary critical-text" onClick={() => decide("Rejected")}>Reject</button><button className="inbound-primary" onClick={() => decide("Approved")}>Approve Order</button></div> : <>{order.decision && <p className="po-muted">{order.decision.status} by {order.decision.user}</p>}{order.status === "Approved" && <button className="inbound-primary" onClick={() => setView("pdf")}>Download PO</button>}{order.status !== "Rejected" && <button className="inbound-secondary" onClick={() => onOpenInbound(order.id)}>Open Inbound</button>}</>}</aside></div><section className="po-items"><h2>Ordered Items</h2><div className="inventory-table-wrap"><table><thead><tr>{["Product", "Product Type", "Qty", "Unit Price", "Subtotal", "Received"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{order.products.map((item) => <tr key={item.code}><td><strong>{item.name} · {item.code}</strong></td><td>{typeOf(item)}</td><td>{item.quantity}</td><td>{item.unitPrice == null ? "Not provided" : poMoney(item.unitPrice, order.currency)}</td><td><strong>{item.unitPrice == null ? "Not provided" : poMoney(item.quantity * item.unitPrice, order.currency)}</strong></td><td>{item.received == null ? "Not recorded" : `${item.received} / ${item.quantity}`}</td></tr>)}</tbody></table></div><dl className="po-total"><div><dt>Subtotal</dt><dd>{poMoney(poTotal(order), order.currency)}</dd></div><div><dt>Total</dt><dd>{poMoney(poTotal(order), order.currency)}</dd></div></dl></section>{order.sampleItems && <p className="po-muted">Item quantities and prices are sample breakdowns matching the list total. Receipt quantities are not provided.</p>}</section>}{notice && <p role="status" className="form-notice">{notice}</p>}{error && !creating && <p role="alert" className="field-error">{error}</p>}<p className="dashboard-demo">Frontend demo · Counts and totals use these orders. Approval does not add inventory; receiving uses the Inbound flow. Refresh resets demo state.</p></main></div>{result && <dialog ref={resultRef} className="dashboard-dialog po-result" aria-labelledby="po-result-title" onCancel={back}><div className={"po-result-icon " + (result === "Rejected" ? "rejected" : "")}>{result === "Approved" ? "\u2713" : "\xD7"}</div><h2 id="po-result-title">Order {result}</h2><button className="inbound-secondary" onClick={back}>Back</button></dialog>}{creating && <dialog ref={createRef} className="dashboard-dialog po-create" aria-labelledby="po-create-title" onCancel={() => setCreating(false)}><h2 id="po-create-title">New Purchase Order</h2><form onSubmit={create} noValidate><div className="po-create-fields"><label>Supplier<input type="text" autoComplete="off" placeholder="Enter supplier name" aria-label="New PO supplier" value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} /></label><label>Expected date<input aria-label="New PO expected date" type="date" min={poToday()} value={draft.expected} onChange={(e) => setDraft({ ...draft, expected: e.target.value })} /></label><label>Payment terms<input value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} /></label><label>Reference<input value={draft.reference} maxLength={100} placeholder="Optional reference" onChange={(e) => setDraft({ ...draft, reference: e.target.value })} /></label></div><h3>Order items (IDR)</h3>{draft.products.map((row, i) => <div className="po-create-item" key={i}><label>Product<input type="text" autoComplete="off" placeholder="Enter product name or SKU" aria-label={`New PO product ${i + 1}`} value={row.name || ""} onChange={(e) => changeProduct(i, e.target.value)} /></label><label>SKU<input aria-label={`New PO SKU ${i + 1}`} value={row.code} placeholder="Enter SKU" maxLength={40} onChange={(e) => changeSku(i, e.target.value)} /></label><label>Product type<input aria-label={`New PO type ${i + 1}`} value={row.category || ""} placeholder="e.g. Electronics" maxLength={60} onChange={(e) => changeItem(i, "category", e.target.value)} /></label><label>Qty<input aria-label={`New PO quantity ${i + 1}`} type="number" min="1" step="1" value={row.quantity} onChange={(e) => changeItem(i, "quantity", e.target.value)} /></label><label>Unit price<input aria-label={`New PO price ${i + 1}`} type="number" min="1" step="1" value={row.unitPrice} onChange={(e) => changeItem(i, "unitPrice", e.target.value)} /></label><button type="button" className="dashboard-link" aria-label={`Remove PO item ${i + 1}`} onClick={() => setDraft({ ...draft, products: draft.products.filter((_, index) => index !== i) })}>Remove</button></div>)}<button type="button" className="inbound-secondary" onClick={() => setDraft({ ...draft, products: [...draft.products, { name: "", code: "", category: "", quantity: "", unitPrice: "" }] })}>+ Add Item</button><label className="po-notes-label">Notes<textarea value={draft.notes} maxLength={2e3} placeholder="Optional notes" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>{error && <p role="alert" className="field-error">{error}</p>}<div className="inbound-form-actions"><button type="button" className="inbound-secondary" onClick={() => setCreating(false)}>Cancel</button><button className="inbound-primary" type="submit">Create Pending Order</button></div></form></dialog>}</div>;
}
export {
  PurchaseOrders as default
};
