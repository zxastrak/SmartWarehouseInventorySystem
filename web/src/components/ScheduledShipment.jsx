import { typeOf } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import { inboundDate } from "../data/inbound.js";
import { shipmentProducts } from "../data/receiving.js";
import "../styles/scheduled.css";
const eventTime = (value) => value ? new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta"
}).format(new Date(value)) : "";
function ScheduledShipment({ shipment, inventory, warehouseName, onBack, onInspect, onMarkArrived, onEditSchedule }) {
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState({});
  const dialogRef = useRef(null);
  const submitting = useRef(false);
  const items = shipmentProducts(shipment, inventory);
  const total = items.reduce((sum, item) => sum + item.ordered, 0);
  const extra = items.slice(4);
  const extraTotal = extra.reduce((sum, item) => sum + item.ordered, 0);
  const arrived = shipment.status === "Arrived";
  const arrivalWindow = `${inboundDate(shipment.date)} \xB7 ${shipment.time}${shipment.endTime ? "\u2013" + shipment.endTime : ""}`;
  useEffect(() => {
    if (modal && !dialogRef.current.open) dialogRef.current.showModal();
    else if (!modal && dialogRef.current.open) dialogRef.current.close();
  }, [modal]);
  function closeModal() {
    setModal(null);
    setError("");
  }
  function openArrival() {
    setConfirmed(false);
    setError("");
    setModal("arrival");
  }
  function confirmArrival() {
    if (submitting.current || confirmed) return;
    submitting.current = true;
    const result = onMarkArrived(shipment.id);
    if (result.error) setError(result.error);
    else setConfirmed(true);
    submitting.current = false;
  }
  function openEdit() {
    setSchedule({ date: shipment.date, time: shipment.time, endTime: shipment.endTime || "", dock: shipment.dock, staff: shipment.staff });
    setError("");
    setModal("edit");
  }
  function saveSchedule(event) {
    event.preventDefault();
    const result = onEditSchedule(shipment.id, schedule);
    if (result.error) setError(result.error);
    else closeModal();
  }
  function edit(key, value) {
    setSchedule((current) => ({ ...current, [key]: value }));
    setError("");
  }
  const timeline = [
    ["Purchase order approved", eventTime(shipment.approvedAt) || "Approved purchase order", true],
    ["Inbound scheduled", shipment.scheduledAt ? `${eventTime(shipment.scheduledAt)}${shipment.scheduledBy ? " by " + shipment.scheduledBy : ""}` : "Delivery plan saved", true],
    [arrived ? "Shipment arrived" : "Expected arrival", arrived ? eventTime(shipment.arrivedAt) : arrivalWindow, arrived],
    ["Inspection", "Starts after arrival confirmation", false]
  ];
  return <div className="scheduled-content">
    {!arrived && <button className="scheduled-edit dashboard-link" onClick={openEdit}>Edit Schedule</button>}
    <section className="dashboard-card scheduled-information">
      <div className="scheduled-heading"><h2>{shipment.id}</h2><span className={`inbound-status inbound-status-${shipment.status.toLowerCase()}`}>{shipment.status.toUpperCase()}</span></div>
      <dl>{[["Purchase Order", shipment.po], ["Supplier", shipment.supplier], ["Expected arrival", arrivalWindow], ["Receiving dock", shipment.dock], ["Assigned to", shipment.staff], ["Warehouse", warehouseName]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    <div className="scheduled-grid">
      <section className="dashboard-card scheduled-items">
        <h2>Expected Items</h2><p>{items.length} products · {total} expected units</p>
        <div className="scheduled-table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Ordered</th><th>Remaining</th></tr></thead><tbody>
          {(expanded ? items : items.slice(0, 4)).map((item) => <tr key={item.sku}><td><strong>{item.name}</strong><small>Type: {typeOf(item)}</small>{item.category === "PPE" && item === items[0] && <small>{item.category}</small>}</td><td>{item.sku}</td><td>{item.ordered}</td><td className="positive-text">{item.ordered}</td></tr>)}
          {extra.length > 0 && !expanded && <tr><td><button className="scheduled-expand" onClick={() => setExpanded(true)}>+ {extra.length} additional products</button></td><td /><td>{extraTotal}</td><td className="positive-text">{extraTotal}</td></tr>}
        </tbody></table></div>
        {expanded && extra.length > 0 && <button className="scheduled-expand scheduled-collapse" onClick={() => setExpanded(false)}>Show fewer products</button>}
      </section>
      <section className="dashboard-card scheduled-timeline"><h2>Delivery Timeline</h2><ol>{timeline.map(([label, caption, complete]) => <li key={label} className={complete ? "scheduled-event-complete" : ""}><span aria-hidden="true" /><div><strong>{label}</strong><p>{caption}</p></div></li>)}</ol>
        {arrived ? <button className="inbound-primary" onClick={() => onInspect(shipment)}>Inspect Items</button> : <button className="inbound-primary" onClick={openArrival}>Mark as Arrived</button>}
      </section>
    </div>
    <section className="scheduled-next"><strong>What happens next?</strong><p>{arrived ? "Arrival confirmed. Inspect delivered quantities and conditions before completing receiving." : "Marking the shipment as arrived enables item inspection and changes its status to Arrived."}</p></section>
    <button className="dashboard-link scheduled-back" onClick={onBack}>‹ Back to Inbound</button>
    <dialog ref={dialogRef} className="scheduled-dialog" aria-labelledby="scheduled-dialog-title" onCancel={(event) => {
    event.preventDefault();
    closeModal();
  }}>
      <button className="scheduled-close" aria-label="Close dialog" onClick={closeModal}>×</button>
      {modal === "arrival" && <>
        <span className="scheduled-arrival-icon" aria-hidden="true">↓</span>
        <h2 id="scheduled-dialog-title">Mark Shipment as Arrived?</h2>
        <p className="scheduled-dialog-description">Confirm that {shipment.id} has physically arrived at receiving dock {shipment.dock}.</p>
        <section className="scheduled-dialog-summary"><dl>{[["Shipment", shipment.id], ["Supplier", shipment.supplier], ["Expected units", total]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{confirmed ? "Arrival recorded. Stock will be added only after inspection and Complete Receiving." : "Status will change from Scheduled to Arrived and item inspection will become available."}</p></section>
        {error && <p className="field-error" role="alert">{error}</p>}
        {confirmed ? <><div className="scheduled-confirmed" role="status">Confirmed!</div><button className="dashboard-link scheduled-modal-footer" onClick={() => onInspect(shipment)}>Continue to Inspect Items ›</button></> : <><div className="scheduled-dialog-actions"><button className="inbound-secondary" onClick={closeModal}>Cancel</button><button className="inbound-primary" onClick={confirmArrival}>Confirm Arrival</button></div><p className="scheduled-modal-footer">After confirmation, continue to Inspect Items.</p></>}
      </>}
      {modal === "edit" && <form onSubmit={saveSchedule} noValidate>
        <h2 id="scheduled-dialog-title">Edit Schedule</h2><p className="scheduled-dialog-description">Update the delivery plan for {shipment.id}.</p>
        <div className="scheduled-edit-fields">
          <label>Expected arrival date<input type="date" value={schedule.date || ""} onChange={(event) => edit("date", event.target.value)} /></label>
          <label>Start time<input type="time" value={schedule.time || ""} onChange={(event) => edit("time", event.target.value)} /></label>
          <label>End time (optional)<input type="time" value={schedule.endTime || ""} onChange={(event) => edit("endTime", event.target.value)} /></label>
          <label>Receiving dock<input type="text" autoComplete="off" placeholder="Enter dock code, e.g. D-02" aria-label="Receiving dock" value={schedule.dock || ""} onChange={(event) => edit("dock", event.target.value)} /></label>
          <label>Assigned to<input type="text" autoComplete="off" placeholder="Enter staff name" aria-label="Assigned to" value={schedule.staff || ""} onChange={(event) => edit("staff", event.target.value)} /></label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="scheduled-dialog-actions"><button type="button" className="inbound-secondary" onClick={closeModal}>Cancel</button><button className="inbound-primary" type="submit">Save Schedule</button></div>
      </form>}
    </dialog>
  </div>;
}
export {
  ScheduledShipment as default
};
