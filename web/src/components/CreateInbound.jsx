import React, { useRef, useState, useEffect } from "react";
import { orderUnits, inboundDate } from "../data/inbound.js";
function ItemsTable({ order, review = false }) {
  return <div className="inbound-table-wrap"><table><thead><tr><th>PRODUCT</th>{review && <th>CODE</th>}<th>{review ? "QUANTITY" : "QTY"}</th>{review && <th>STATUS</th>}</tr></thead><tbody>{order.products.map((item) => <tr key={item.code}><td><strong>{item.name}</strong></td>{review && <td>{item.code}</td>}<td>{item.quantity}</td>{review && <td className="positive-text">Expected</td>}</tr>)}</tbody></table></div>;
}
function DetailRows({ rows }) {
  return <dl className="inbound-detail-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export { ItemsTable, DetailRows };
export default function CreateInbound({ orders, warehouseName, search, onSearch, onCancel, onCreate, onDetails, onStageChange }) {
  const [stage, setStage] = useState(0), [selected, setSelected] = useState(""), [supplier, setSupplier] = useState("All suppliers"), [expectedFilter, setExpectedFilter] = useState(""), [draft, setDraft] = useState({ date: orders[0]?.expected || "", time: "09:30", dock: "D-03", staff: "Naura", carrier: "", reference: "" }), [errors, setErrors] = useState({}), [created, setCreated] = useState(null);
  const formRef = useRef(null);
  const order = orders.find((value) => value.id === selected);
  useEffect(() => {
    onStageChange(stage);
    window.scrollTo(0, 0);
  }, [stage, onStageChange]);
  const filtered = orders.filter((value) => `${value.id} ${value.supplier}`.toLowerCase().includes(search.toLowerCase()) && (supplier === "All suppliers" || value.supplier === supplier) && (!expectedFilter || value.expected === expectedFilter));
  function pick(id) {
    setSelected(id);
    setDraft((value) => ({ ...value, date: orders.find((row) => row.id === id).expected }));
    setErrors({});
  }
  function update(event) {
    setDraft((value) => ({ ...value, [event.target.name]: event.target.value }));
    setErrors((value) => ({ ...value, [event.target.name]: void 0 }));
  }
  function validate(event) {
    event.preventDefault();
    const next = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) next.date = "Choose an arrival date.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) next.time = "Choose a valid arrival time.";
    if (!["D-01", "D-02", "D-03", "D-04"].includes(draft.dock)) next.dock = "Choose a receiving dock.";
    if (!["Naura", "Idam", "Ocha"].includes(draft.staff)) next.staff = "Choose a staff member.";
    if (!order) next.order = "Select an eligible approved purchase order.";
    setErrors(next);
    if (Object.keys(next).length) {
      formRef.current?.querySelector(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    setStage(2);
  }
  function create() {
    const result = onCreate({ ...draft, po: order.id, supplier: order.supplier, items: order.products.length, units: orderUnits(order), products: order.products.map((item) => ({ ...item })), warehouse: warehouseName, status: "Scheduled" });
    if (!result) {
      setErrors({ submit: "This PO already has an inbound shipment. Choose another purchase order." });
      return;
    }
    setCreated(result);
    setStage(3);
  }
  const field = (name, label, type = "text", options = null) => <label className="inbound-field" key={name}>{label}{["date", "time", "dock", "staff"].includes(name) && <span className="required-mark"> *</span>}{options ? <select name={name} value={draft[name]} onChange={update} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `inbound-${name}-error` : void 0}><option value="">Please select...</option>{options.map((value) => <option key={value}>{value}</option>)}</select> : <input name={name} type={type} value={draft[name]} onChange={update} maxLength={name === "carrier" ? 80 : 60} placeholder={["carrier", "reference"].includes(name) ? "Optional" : void 0} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `inbound-${name}-error` : void 0} />} {errors[name] && <span id={`inbound-${name}-error`} className="field-error" role="alert">{errors[name]}</span>}</label>;
  return <><ol className={`inbound-steps steps-stage-${stage}`} aria-label="Create inbound progress">{["Select PO", "Delivery details", stage === 3 ? "Created \u2713" : "Review & create"].map((label, index) => <li key={index} className={index <= Math.min(stage, 2) ? "complete-step" : ""} aria-current={index === Math.min(stage, 2) ? "step" : void 0}><span aria-hidden="true" /><strong>{label}</strong></li>)}</ol>
 {stage === 0 && <section className="dashboard-card inbound-po-card"><h2>Select Purchase Order</h2><p>Only approved purchase orders without an inbound shipment are shown.</p><div className="inbound-po-filters"><input aria-label="Search purchase order or supplier" placeholder="Search PO number or supplier..." value={search} onChange={(event) => onSearch(event.target.value)} /><select aria-label="PO supplier filter" value={supplier} onChange={(event) => setSupplier(event.target.value)}><option>All suppliers</option>{[...new Set(orders.map((value) => value.supplier))].map((value) => <option key={value}>{value}</option>)}</select><input aria-label="PO expected date filter" type="date" value={expectedFilter} onChange={(event) => setExpectedFilter(event.target.value)} /></div><div className="inbound-table-wrap inbound-po-table"><table><thead><tr>{["SELECT", "PURCHASE ORDER", "SUPPLIER", "ITEMS", "UNITS", "EXPECTED", "TOTAL"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map((value) => <tr key={value.id} className={selected === value.id ? "selected-po" : ""}><td><input aria-label={`Select ${value.id}`} name="purchase-order" type="radio" checked={selected === value.id} onChange={() => pick(value.id)} /></td><td><strong>{value.id}</strong><small>Approved · {inboundDate(value.approved, true)}</small></td><td><strong>{value.supplier}</strong></td><td>{value.products.length}</td><td>{orderUnits(value)}</td><td>{inboundDate(value.expected, true)}</td><td><strong>{new Intl.NumberFormat(value.currency === "IDR" ? "id-ID" : "en-US", { style: "currency", currency: value.currency || "USD", maximumFractionDigits: 0 }).format(value.total)}</strong></td></tr>)}{!filtered.length && <tr><td colSpan="7">No approved purchase orders match. Clear the filters or try another PO.</td></tr>}</tbody></table></div><div className="inbound-selected-po">{order ? <><strong>Selected: {order.id} · {order.supplier}</strong><p>{order.products.length} product types · {orderUnits(order)} units · Expected {inboundDate(order.expected, true)}</p></> : <p>{orders.length ? "Select a purchase order to continue." : "No eligible purchase orders remain in this demo."}</p>}</div><div className="inbound-form-actions"><button className="inbound-secondary" onClick={onCancel}>Cancel</button><button className="inbound-primary" disabled={!order} onClick={() => {
    onSearch("");
    setStage(1);
  }}>Continue</button></div></section>}
 {stage === 1 && order && <><section className="dashboard-card inbound-selected-order"><h2>Selected Purchase Order</h2><div><span>PURCHASE ORDER <strong>{order.id}</strong></span><span>SUPPLIER <strong>{order.supplier}</strong></span><span>ITEMS / UNITS <strong>{order.products.length} / {orderUnits(order)}</strong></span><button className="dashboard-link" onClick={() => setStage(0)}>Change PO</button></div></section><form ref={formRef} onSubmit={validate} noValidate><div className="inbound-delivery-grid"><section className="dashboard-card inbound-delivery-card"><h2>Delivery Details</h2><div className="inbound-fields">{field("date", "Expected arrival date", "date")}{field("time", "Expected time", "time")}{field("dock", "Receiving dock", "text", ["D-01", "D-02", "D-03", "D-04"])}{field("staff", "Assign staff", "text", ["Naura", "Idam", "Ocha"])}{field("carrier", "Carrier / vehicle")}{field("reference", "Reference number")}</div><p className="inbound-helper">Fields marked * are required to schedule the inbound. Dates use sample data from the design.</p></section><section className="dashboard-card inbound-items-card"><h2>Items from PO</h2><ItemsTable order={order} /><div className="inbound-units"><strong>Total: {orderUnits(order)} units</strong><p>Loaded automatically from {order.id}</p></div></section></div><div className="inbound-form-actions"><button type="button" className="inbound-secondary" onClick={() => setStage(0)}>Back</button><button className="inbound-primary" type="submit">Continue to Review</button></div></form></>}
 {stage === 2 && order && <><div className="inbound-review-grid"><section className="dashboard-card"><h2>Purchase Order</h2><DetailRows rows={[["PO NUMBER", order.id], ["SUPPLIER", order.supplier], ["PRODUCT TYPES", order.products.length], ["TOTAL UNITS", orderUnits(order)]]} /></section><section className="dashboard-card"><h2>Delivery Schedule</h2><DetailRows rows={[["EXPECTED ARRIVAL", `${inboundDate(draft.date, true)} \xB7 ${draft.time}`], ["RECEIVING DOCK", draft.dock], ["ASSIGNED TO", draft.staff], ["WAREHOUSE", warehouseName], ...draft.carrier.trim() ? [["CARRIER", draft.carrier.trim()]] : [], ...draft.reference.trim() ? [["REFERENCE", draft.reference.trim()]] : []]} /></section><section className="dashboard-card"><h2>Inbound Status</h2><span className="inbound-review-status">SCHEDULED</span><p>The shipment will appear in the Inbound list and can be inspected after it arrives.</p></section></div><section className="dashboard-card inbound-expected-card"><h2>Items Expected</h2><ItemsTable order={order} review /></section><p className="inbound-note">Creating this inbound does not add stock yet. Inventory changes only after inspection and receiving are completed.</p>{errors.submit && <p role="alert" className="field-error">{errors.submit}</p>}<div className="inbound-form-actions"><button className="inbound-secondary" onClick={() => setStage(1)}>Back</button><button className="inbound-primary" onClick={create}>Create Inbound</button></div></>}
 {stage === 3 && created && <section className="dashboard-card inbound-success"><span className="inbound-success-check" aria-hidden="true">✓</span><h2>Inbound shipment created</h2><p>{created.id} is scheduled to arrive on {inboundDate(created.date, true)} at {created.time}.</p><div className="inbound-created-summary"><div><span>INBOUND ID<strong>{created.id}</strong></span><span>PURCHASE ORDER<strong>{created.po}</strong></span><span>SUPPLIER<strong>{created.supplier}</strong></span><span>STATUS<strong className="positive-text">Scheduled</strong></span></div><hr /><p>{created.units} units · Dock {created.dock} · Assigned to {created.staff}</p><p>Stock will only be updated after the receiving inspection is completed.</p></div><div className="inbound-form-actions"><button className="inbound-secondary" onClick={() => onDetails(created)}>View Inbound Details</button><button className="inbound-primary" onClick={onCancel}>Back to Inbound</button></div></section>}
 </>;
}
