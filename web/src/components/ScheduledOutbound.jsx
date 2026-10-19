import { typeOf } from "../utils/productTypes.js";
import React, { useState } from "react";
import { outboundDate } from "../data/outbound.js";
import { validateOutboundItems } from "../utils/outbound.js";
import "../styles/outboundFulfillment.css";
import "../styles/scheduledOutbound.css";
function ScheduledOutbound({ shipment, inventory, onStart, onBack }) {
  const [error, setError] = useState(""), [starting, setStarting] = useState(false);
  const units = shipment.products.reduce((sum, row) => sum + row.quantity, 0);
  const stockError = validateOutboundItems(shipment.products, inventory);
  const shortages = shipment.products.flatMap((row) => {
    const available = inventory.find((item) => item.sku === row.sku)?.current || 0;
    return available < row.quantity ? [{ ...row, available, short: row.quantity - available }] : [];
  });
  function start() {
    if (starting) return;
    setStarting(true);
    const result = onStart();
    if (result.error) {
      setError(result.error);
      setStarting(false);
    }
  }
  return <>
 <div className="fulfillment-heading"><div><p>OUTBOUND / ORDER DETAILS</p><h1>Outbound Order Details</h1><p className="inbound-description">Review the scheduled request before starting warehouse picking.</p></div></div>
 <ol className="outbound-steps dashboard-card">{["Order details", "Pick items", "Pack & verify", "Ready to ship"].map((label, i) => <li key={label} className={i === 0 ? "reached" : ""} aria-current={i === 0 ? "step" : void 0}><span>{i + 1}</span><strong>{label}</strong></li>)}</ol>
 <div className="fulfillment-grid scheduled-outbound-grid"><section className="dashboard-card fulfillment-panel"><h2>{shipment.type === "Warehouse transfer" ? "Transfer request" : shipment.type === "Customer order" ? "Customer order" : "Internal request"}</h2><dl className="scheduled-outbound-summary"><div><dt>Destination</dt><dd>{shipment.destination}</dd></div><div><dt>Reference</dt><dd>{shipment.reference}</dd></div></dl><h2 className="scheduled-outbound-items-title">Items to pick</h2><div className="inbound-table-wrap scheduled-outbound-table"><table><thead><tr><th>Product</th><th>Rack</th><th>Qty</th></tr></thead><tbody>{shipment.products.map((row) => <tr key={row.sku}><td><strong>{row.name}</strong><small>Type: {typeOf(row)}</small></td><td>{row.rack}</td><td>{row.quantity}</td></tr>)}</tbody></table></div>{shipment.notes && <p className="fulfillment-muted">Notes: {shipment.notes}</p>}</section><aside className="dashboard-card fulfillment-panel scheduled-outbound-assignment"><h2>Picking assignment</h2><dl className="outbound-summary-rows"><div><dt>Assigned to</dt><dd>{shipment.staff}</dd></div><div><dt>Ship by</dt><dd>{outboundDate(shipment.date)} · {shipment.time}</dd></div><div><dt>Total</dt><dd>{units} units</dd></div></dl><div className="fulfillment-warning"><strong>Before starting</strong><p>Confirm that a picking cart and barcode scanner are available.</p></div>{shortages.length > 0 && <div className="scheduled-outbound-stock" role="status"><strong>Stock needs replenishment</strong>{shortages.map((row) => <p key={row.sku}>{row.name}: {row.available} available / {row.quantity} required · short {row.short}</p>)}<p>Receive more stock or review Inventory before starting this request.</p></div>}<button className="inbound-primary" disabled={Boolean(stockError) || starting} onClick={start}>{starting ? "Starting..." : "Start Picking"}</button></aside></div>
 {error && <p role="alert" className="field-error">{error}</p>}
 <button className="dashboard-link outbound-back" onClick={onBack}>‹ Back</button>
 </>;
}
export {
  ScheduledOutbound as default
};
