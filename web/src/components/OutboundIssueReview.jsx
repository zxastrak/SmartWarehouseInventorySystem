import { typeOf } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import { issueAvailability } from "../utils/outboundIssues.js";
import "../styles/outboundIssueReview.css";
function OutboundIssueReview({ shipment, inventory, onResolve, onClose }) {
  const dialog = useRef(null), locked = useRef(false);
  const [resolution, setResolution] = useState(""), [note, setNote] = useState(""), [rack, setRack] = useState(""), [confirmed, setConfirmed] = useState(false), [sku, setSku] = useState(shipment.pickIssue?.sku || shipment.products?.[0]?.sku || ""), [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const rows = issueAvailability(shipment, inventory), row = rows.find((item) => item.sku === sku), short = rows.reduce((sum, item) => sum + item.shortage, 0), fulfillable = rows.reduce((sum, item) => sum + Math.min(item.quantity, item.available), 0), issue = shipment.pickIssue;
  const date = issue?.reportedAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(new Date(issue.reportedAt)) : "Not recorded";
  function resolve() {
    if (locked.current) return;
    if (!row && resolution !== "hold") {
      setError("Enter a SKU belonging to this shipment.");
      return;
    }
    locked.current = true;
    const result = onResolve({ resolution, note, rack, confirmed, sku });
    locked.current = false;
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose(result);
  }
  const choices = [["alternate", "Use alternate rack", row ? issue?.availableAtReport != null ? `Pick ${Math.max(0, row.quantity - issue.availableAtReport)} units from a verified alternate rack` : `Confirm another rack for ${row.name}` : "Item details are required"], ["partial", "Partially fulfill order", short ? `Pick ${fulfillable} units and create a backorder for ${short}` : "No current stock shortage"], ["hold", "Put shipment on hold", "Wait for replenishment before continuing"]];
  return <dialog ref={dialog} className="outbound-issue-dialog" aria-labelledby="outbound-issue-title" onCancel={onClose}><header><h2 id="outbound-issue-title">Review Outbound Issue</h2><button aria-label="Close outbound issue review" onClick={() => onClose()}>×</button></header><div className="outbound-issue-alert"><span>!</span><div><strong>{issue?.type || "Outbound issue"}</strong><p>{row ? `${row.name} \xB7 ${row.sku}` : shipment.id}</p>{row && <small>Type: {typeOf(row)} · Required {row.quantity} · Available {row.available} · Shortage {row.shortage} units</small>}</div></div><h3>Issue information</h3><dl className="outbound-issue-info"><div><dt>Reported by</dt><dd>{issue?.user || shipment.staff}</dd></div><div><dt>Reported at</dt><dd>{date}</dd></div><div><dt>Current rack</dt><dd>{row?.rack || "Not recorded"}</dd></div></dl>{issue?.notes && <p className="outbound-issue-note">{issue.notes}</p>}{rows.length > 1 && !issue?.sku && <label className="outbound-issue-field">Affected product<input type="text" autoComplete="off" placeholder="Enter affected SKU" aria-label="Affected product" value={sku} onChange={(e) => {
    setSku(e.target.value.toUpperCase().trim());
    setConfirmed(false);
    setRack("");
  }} /></label>}<h3>Choose a resolution</h3><div className="outbound-issue-choices">{choices.map(([value, title, description]) => <label className={resolution === value ? "selected" : ""} key={value}><input type="radio" name="outbound-resolution" value={value} checked={resolution === value} disabled={value !== "hold" && !rows.length} onChange={() => {
    setResolution(value);
    setError("");
  }} /><span><strong>{title}</strong><small>{description}</small></span></label>)}</div>{resolution === "alternate" && <div className="outbound-issue-extra"><label className="outbound-issue-field">Alternate rack<input aria-label="Alternate rack" value={rack} maxLength={40} placeholder="Enter alternate rack, e.g. A-06" onChange={(e) => {
    setRack(e.target.value);
    setConfirmed(false);
  }} /></label><label className="outbound-issue-confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I checked the SKU and quantity at this rack.</label><p>Total SKU stock must be sufficient. Stock per rack is not recorded in this frontend demo.</p></div>}{resolution === "partial" && <p className="outbound-issue-note">Available quantities continue through picking, packing, and shipping. The remainder becomes a separate Scheduled backorder. No stock is deducted here.</p>}<label className="outbound-issue-field">Review note<textarea aria-label="Outbound review note" placeholder="Enter your review note..." value={note} maxLength={2e3} onChange={(e) => setNote(e.target.value)} /></label>{error && <p role="alert" className="field-error">{error}</p>}<button className="inbound-primary outbound-issue-submit" disabled={!resolution || !note.trim()} onClick={resolve}>{resolution === "hold" ? "Save & Put on Hold" : "Resolve & Continue Picking"}</button></dialog>;
}
export {
  OutboundIssueReview as default
};
