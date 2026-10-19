import { typeOf } from "../utils/productTypes.js";
import React, { useState } from "react";
import { completedRecord, completedTime, downloadReceivingReport } from "../utils/completedReceiving.js";
import "../styles/completedReceiving.css";
function CompletedReceiving({ shipment, inventory = [], movements, warehouseName, onBack, onViewMovements }) {
  const record = completedRecord(shipment, movements);
  const [notice, setNotice] = useState("");
  const issues = record ? record.summary.damaged + record.summary.rejected + record.summary.short : 0;
  const racks = record ? [...new Set(record.items.flatMap((item) => item.allocations.map((value) => value.rack)))] : [];
  function download() {
    try {
      downloadReceivingReport(shipment, record, warehouseName);
      setNotice("Receiving report downloaded as CSV.");
    } catch (error) {
      setNotice(error.message);
    }
  }
  return <div className="completed-content">
    <button className="inbound-primary completed-download" disabled={!record?.items.length} onClick={download}>Download Receiving Report</button>
    <section className="dashboard-card completed-information">
      <div className="completed-heading"><h2>{shipment.id}</h2><span className="inbound-status inbound-status-received">RECEIVED</span></div>
      <dl><div><dt>{shipment.po}</dt><dd>{shipment.supplier}</dd></div><div><dt>Completed</dt><dd>{completedTime(record?.completedAt)}</dd></div><div><dt>Received by</dt><dd>{record?.user || "Not recorded"}</dd></div></dl>
    </section>
    {record && record.items.length > 0 ? <>
      <div className="completed-grid">
        <section className="dashboard-card completed-items"><h2>Received Items</h2>
          <div className="completed-table-wrap"><table><thead><tr>{["Product", "Received", "Accepted", "Rack", "Stock change"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{record.items.map((item) => <tr key={item.sku}>
            <td><strong>{item.name}</strong><small>Type: {typeOf(item, inventory)}</small>{item === record.items[0] && <small>{item.sku}</small>}</td><td>{item.received}</td><td className="positive-text">{item.accepted}</td><td>{item.allocations.length ? item.allocations.map((value, index) => <div key={`${value.rack}-${index}`}>{value.rack}{item.allocations.length > 1 ? `: ${value.quantity}` : ""}</div>) : "No stock added"}</td><td className="positive-text">{item.before == null || item.after == null ? "Not recorded" : `${item.before} \u2192 ${item.after}`}</td>
          </tr>)}</tbody><tfoot><tr><th colSpan="2">Total received</th><td className="positive-text"><strong>{record.summary.received} units</strong></td><td /><td /></tr></tfoot></table></div>
        </section>
        <section className="dashboard-card completed-summary"><h2>Receiving Summary</h2><div className="completed-increase"><span>Inventory increase</span><strong>+{record.summary.accepted} units</strong></div><div className={`completed-issues${issues ? " has-issues" : ""}`}><span>Issues recorded</span><strong>{issues} units</strong>{issues > 0 && <p>{record.summary.damaged} damaged · {record.summary.rejected} rejected · {record.summary.short} missing</p>}</div><section><h3>Storage locations</h3><p>{racks.join(" \xB7 ") || "No stock added"}</p></section>{record.dispositions.length > 0 && <section><h3>Excluded stock</h3>{record.dispositions.map((value, index) => <p key={index}>{value.name}: {value.quantity} · {value.kind} · {value.location}{value.replacementRequested ? " \xB7 Replacement requested" : ""}</p>)}</section>}{record.resolution && <section><h3>Issue resolution</h3><p>{record.resolution.title} · {record.resolution.reference}</p><p>{record.resolution.notificationStatus}</p></section>}<section><h3>Inspection notes</h3>{record.notes ? record.notes.split("\n").map((line, index) => <p key={index}>{line}</p>) : <p>No inspection notes recorded.</p>}{record.evidence.length > 0 && <p>{record.evidence.length} supporting files recorded</p>}{record.poStatus === "Partially Received" && <p>PO remains partially received.</p>}</section></section>
      </div>
      <section className="completed-success"><span aria-hidden="true">✓</span><div><strong>Receiving completed</strong><p>Inventory and stock movement records were updated successfully. This record is read-only.</p><button className="dashboard-link" onClick={() => onViewMovements(shipment.id)}>View stock movement ›</button></div></section>
    </> : <section className="dashboard-card completed-unavailable"><h2>Detailed record unavailable</h2><p>This sample shipment is marked Received, but its item-level history has not been provided. Complete a receiving flow to create a detailed record.</p></section>}
    {notice && <p className="form-notice" role="status">{notice}</p>}
    <button className="dashboard-link completed-back" onClick={onBack}>‹ Back to Inbound</button>
  </div>;
}
export {
  CompletedReceiving as default
};
