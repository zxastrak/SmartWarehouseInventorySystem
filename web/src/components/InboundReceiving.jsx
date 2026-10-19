import { typeOf, matchesText, findProduct, normaliseType, cleanText } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import { newReceivingDraft, rackMatches } from "../data/receiving.js";
import { acceptedUnits, inspectionSummary, allocationSummary, validateInspection, validateAllocation } from "../utils/receiving.js";
import "../styles/receiving.css";
const headings = { inspect: "Inspect Inbound Shipment", storage: "Assign Storage Location", review: "Review & Complete Receiving" };
const receivingDate = (date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(/* @__PURE__ */ new Date(`${date}T12:00:00`));
const fileTypes = ["image/png", "image/jpeg", "application/pdf"];
function InboundReceiving({ shipment, inventory, racks, initialDraft, onSaveDraft, onComplete, onBack, onNavigate, warehouseName, onHeaderChange }) {
  const [rackZone, setRackZone] = useState("Electronics");
  const [draft, setDraft] = useState(() => initialDraft || newReceivingDraft(shipment, inventory, racks)), [error, setError] = useState(""), [fileError, setFileError] = useState(""), [rackQuery, setRackQuery] = useState(""), [confirmed, setConfirmed] = useState(false), [done, setDone] = useState(false), [notice, setNotice] = useState("");
  const inputRef = useRef(null), dialogRef = useRef(null), submitLock = useRef(false);
  const totals = inspectionSummary(draft.rows), allocation = allocationSummary(draft), issueUnits = totals.damaged + totals.rejected + totals.short;
  const descriptions = { inspect: "Verify delivered quantities and condition before adding stock to inventory.", storage: `Allocate ${totals.accepted} accepted units to available warehouse racks.`, review: "Confirm the inspection and storage allocation before updating inventory." };
  useEffect(() => {
    onHeaderChange({ title: headings[draft.stage], description: descriptions[draft.stage], stage: draft.stage });
    window.scrollTo(0, 0);
  }, [draft.stage, onHeaderChange]);
  useEffect(() => {
    if (done) dialogRef.current?.showModal();
  }, [done]);
  function change(transform) {
    setDraft((value) => ({ ...transform(value), savedAt: null }));
    setError("");
    setConfirmed(false);
  }
  function defaultRack(id) {
    change((current) => {
      const rack = racks.find((rack2) => rack2.id === id.trim().toUpperCase());
      if (!rack) return { ...current, defaultRack: id };
      id = rack.id;
      const allocations = { ...current.allocations };
      for (const row of current.rows) if (rackMatches(row.category, rack)) {
        allocations[row.sku] = (allocations[row.sku] || []).map((item) => Number(item.quantity) === 0 ? { ...item, rack: id } : item);
      }
      return { ...current, defaultRack: id, allocations };
    });
  }
  function quantity(sku, key, value) {
    change((current) => {
      const rows = current.rows.map((row2) => row2.sku === sku ? { ...row2, [key]: value } : row2);
      const row = rows.find((row2) => row2.sku === sku);
      return { ...current, rows, allocations: acceptedUnits(row) === 0 && ["received", "damaged", "rejected"].every((key2) => row[key2] !== "") ? { ...current.allocations, [sku]: [] } : current.allocations };
    });
  }
  function save() {
    const snapshot = { ...draft, savedAt: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) };
    setDraft(snapshot);
    onSaveDraft(snapshot);
    setNotice("Draft saved in this open application. Refresh resets demo data.");
  }
  function stage(value) {
    setDraft((current) => ({ ...current, stage: value }));
    setError("");
    setConfirmed(false);
  }
  function toStorage() {
    const problem = validateInspection(draft);
    if (problem) {
      setError(problem);
      return;
    }
    stage("storage");
  }
  function toReview() {
    const problem = validateAllocation(draft, racks);
    if (problem) {
      setError(problem);
      return;
    }
    stage("review");
  }
  function addEvidence(event) {
    const files = [...event.target.files];
    let message = "";
    const accepted = [];
    for (const file of files) {
      if (!fileTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
        message = "Use PNG, JPG or PDF, up to 10 MB per file.";
        continue;
      }
      if (draft.evidence.length + accepted.length >= 10) {
        message = "Maximum 10 evidence files per shipment.";
        break;
      }
      accepted.push({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) });
    }
    if (accepted.length) change((current) => ({ ...current, evidence: [...current.evidence, ...accepted] }));
    setFileError(message);
    event.target.value = "";
  }
  function removeFile(file) {
    change((current) => ({ ...current, evidence: current.evidence.filter((value) => value.id !== file.id) }));
  }
  function editAllocation(sku, id, key, value) {
    if (key === "rack") value = value.toUpperCase().replace(/\s/g, "");
    change((current) => ({ ...current, allocations: { ...current.allocations, [sku]: current.allocations[sku].map((row) => row.id === id ? { ...row, [key]: value } : row) } }));
  }
  function addLocation(row) {
    change((current) => ({ ...current, allocations: { ...current.allocations, [row.sku]: [...current.allocations[row.sku], { id: crypto.randomUUID(), rack: racks.find((rack) => rack.id === current.defaultRack && rackMatches(row.category, rack))?.id || racks.find((rack) => rackMatches(row.category, rack)).id, quantity: 0 }] } }));
  }
  function removeLocation(sku, id) {
    change((current) => ({ ...current, allocations: { ...current.allocations, [sku]: current.allocations[sku].filter((row) => row.id !== id) } }));
  }
  function complete() {
    if (submitLock.current || done) return;
    const problem = validateAllocation(draft, racks);
    if (problem) {
      setError(problem);
      return;
    }
    if (!confirmed) {
      setError("Confirm that quantities, conditions and storage locations are correct.");
      return;
    }
    submitLock.current = true;
    const problemOnSave = onComplete(draft);
    if (problemOnSave) {
      submitLock.current = false;
      setError(problemOnSave);
      return;
    }
    setDone(true);
  }
  const receivingProgress = draft.stage === "inspect" ? 1 : draft.stage === "storage" ? 2 : 3;
  const usableRacks = racks.filter((rack) => rack.id.toLowerCase().includes(rackQuery.toLowerCase()) && (rackQuery || matchesText(rackZone, rack.zone, "All Zones")));
  const issueBanner = <div className="receiving-issues"><span className="receiving-round">!</span><div><strong>{issueUnits} units require follow-up</strong><p>{totals.damaged} damaged · {totals.rejected} rejected · {totals.short} missing. These units will not be added to available stock.</p><p>Add evidence and inspection notes before continuing.</p></div><button className="inbound-secondary" onClick={() => inputRef.current.click()}>Add Evidence</button></div>;
  return <div className="receiving-content"><div className="receiving-top-actions">{draft.stage !== "inspect" && !done && <button className="inbound-secondary" onClick={save}>Save as Draft</button>}</div><ol className={`receiving-steps receiving-step-${receivingProgress}`} aria-label="Receiving progress">{["Shipment details", "Inspect items", "Assign storage", "Review & receive"].map((label, index) => <li key={label} className={index <= receivingProgress ? "receiving-active-step" : ""} aria-current={index === receivingProgress ? "step" : void 0}><span>{index < receivingProgress ? "\u2713" : index + 1}</span><strong>{label}</strong></li>)}</ol>
 {draft.stage === "inspect" && <div className="receiving-inspect-grid"><div className="receiving-left"><section className="dashboard-card receiving-shipment-card"><div className="receiving-card-heading"><h2>Shipment Information</h2><span className="inbound-status">{shipment.status.toUpperCase()}</span></div><dl>{[["Inbound ID", shipment.id], ["Purchase Order", shipment.po], ["Supplier", shipment.supplier], ["Delivery Date", `${receivingDate(shipment.date)} \xB7 ${shipment.time}`], ["Receiving Dock", shipment.dock], ["Delivery Note", shipment.reference || "Not provided"], ["Driver / Vehicle", shipment.carrier || "Not provided"], ["Assigned to", shipment.staff]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><section className="dashboard-card receiving-item-card"><h2>Item Inspection</h2><p>Enter the actual quantity and condition of each delivered item.</p><div className="receiving-table-wrap"><table><thead><tr>{["Product", "Ordered", "Received", "Damaged", "Rejected", "Accepted", "Result"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{draft.rows.map((row) => {
    const count = acceptedUnits(row), issues = Number(row.damaged) + Number(row.rejected) + Math.max(0, row.ordered - Number(row.received));
    return <tr key={row.sku}><td><strong>{row.name}</strong><small>Type: {typeOf(row)}</small><small>{row.sku} · {row.category}</small></td><td>{row.ordered}</td>{["received", "damaged", "rejected"].map((key) => <td key={key}><input aria-label={`${row.name} ${key}`} type="number" min="0" max={row.ordered} step="1" disabled={Boolean(shipment.issueResolution)} value={row[key]} onChange={(event) => quantity(row.sku, key, event.target.value)} /></td>)}<td className="positive-text"><strong>{Number.isFinite(count) ? count : "\u2014"}</strong></td><td><span className={`inbound-status${issues ? " inbound-status-issue" : ""}`}>{issues ? "Partial issue" : "Accepted"}</span></td></tr>;
  })}</tbody></table></div>{issueUnits > 0 && issueBanner}</section></div><div className="receiving-right"><section className="dashboard-card receiving-details-card"><h2>Receiving Details</h2><label>Default storage location<input type="text" autoComplete="off" placeholder="Enter registered rack code" aria-label="Default storage location" value={draft.defaultRack} onChange={(event) => defaultRack(event.target.value)} /></label><label>Inspection notes<textarea aria-label="Inspection notes" maxLength={300} value={draft.notes} placeholder="Describe the delivered condition and any issues..." onChange={(event) => change((current) => ({ ...current, notes: event.target.value }))} /><small>{draft.notes.length} / 300</small></label><label>Supporting evidence</label><input className="sr-only" ref={inputRef} type="file" aria-label="Supporting evidence files" accept=".png,.jpg,.jpeg,.pdf" multiple onChange={addEvidence} /><button className="receiving-upload" onClick={() => inputRef.current.click()}><span>+</span><div><strong>Upload photos or documents</strong><small>PNG, JPG or PDF · Max 10 MB each</small></div></button>{fileError && <p className="field-error" role="alert">{fileError}</p>}<div className="receiving-files">{draft.evidence.map((file) => <div key={file.id}>{file.url ? <a href={file.url} target="_blank" rel="noreferrer">{file.name}</a> : <span>{file.name} (demo placeholder)</span>}<button aria-label={`Remove ${file.name}`} onClick={() => removeFile(file)}>×</button></div>)}</div><p className="receiving-help">Next: assign accepted items to storage racks.</p></section><section className="dashboard-card receiving-summary-card"><h2>Inspection Summary</h2><div>{[["Ordered", totals.ordered], ["Accepted", totals.accepted], ["Issues", issueUnits]].map(([label, value]) => <article key={label} className={label === "Issues" ? "summary-issue" : ""}><span>{label}</span><strong>{value}</strong></article>)}</div></section></div></div>}
 {draft.stage === "storage" && <><section className="dashboard-card receiving-allocation-progress"><div><h2>Allocation Progress</h2><p>All accepted units must be assigned before you continue.</p><div><progress value={Math.min(allocation.total, totals.accepted)} max={Math.max(totals.accepted, 1)} /><span>{totals.accepted ? Math.round(allocation.total / totals.accepted * 100) : 0}% complete</span></div></div><div className="receiving-progress-stats">{[["Accepted units", totals.accepted], ["Allocated", allocation.total], ["Unallocated", totals.accepted - allocation.total]].map(([label, value]) => <article key={label} className={label === "Unallocated" ? "summary-issue" : ""}><span>{label}</span><strong>{value}</strong></article>)}</div></section><div className="receiving-storage-grid"><section className="dashboard-card receiving-storage-card"><h2>Storage Allocation</h2><p>Choose a rack and enter the quantity stored at each location.</p>{draft.rows.filter((row) => acceptedUnits(row) > 0).map((row) => {
    const assigned = (draft.allocations[row.sku] || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return <section className="receiving-product-allocation" key={row.sku}><div className="receiving-allocation-product-heading"><div><strong>{row.name}</strong><small>Type: {typeOf(row)}</small><p>{row.sku} · {acceptedUnits(row)} accepted units</p><small>{row.category} Zone</small></div><button className="dashboard-link" onClick={() => addLocation(row)}>+ Additional location</button></div>{(draft.allocations[row.sku] || []).map((item) => {
      const rack = racks.find((rack2) => rack2.id === item.rack), left = rack ? rack.capacity - rack.used - (allocation.byRack[item.rack] || 0) : null;
      return <div className="receiving-allocation-row" key={item.id}><label>Rack location<input type="text" autoComplete="off" placeholder="Enter registered rack code" aria-label={`${row.name} rack ${item.id}`} value={item.rack} onChange={(event) => editAllocation(row.sku, item.id, "rack", event.target.value)} /></label><label>Quantity<input aria-label={`${row.name} allocation ${item.id}`} type="number" min="0" step="1" max={acceptedUnits(row)} value={item.quantity} onChange={(event) => editAllocation(row.sku, item.id, "quantity", event.target.value)} /></label><span className={`receiving-space-badge${left <= 0 ? " space-full" : ""}`}>{left === null ? "Enter a registered rack" : left < 0 ? "Over capacity" : left === 0 ? "Full rack" : `${left} left`}</span><button className="receiving-remove" aria-label={`Remove ${row.name} location ${item.id}`} onClick={() => removeLocation(row.sku, item.id)}>×</button></div>;
    })}<p className={assigned === acceptedUnits(row) ? "positive-text" : "critical-text"}>{acceptedUnits(row) - assigned} units still unallocated</p></section>;
  })}</section><section className="dashboard-card receiving-rack-card"><h2>Rack Availability</h2><p>{warehouseName} · Current capacity</p><input type="text" autoComplete="off" placeholder="Search rack zone..." aria-label="Rack availability zone" value={rackZone === "All Zones" ? "" : rackZone} onChange={(event) => setRackZone(event.target.value)} /><input aria-label="Search racks" placeholder="Search rack..." value={rackQuery} onChange={(event) => setRackQuery(event.target.value)} />{usableRacks.map((rack) => <article key={rack.id}><div><strong>{rack.id}</strong><span>{rack.capacity - rack.used} available</span></div><progress value={rack.used} max={rack.capacity} /><p>{rack.used} / {rack.capacity} used · {rack.zone}</p></article>)}{!usableRacks.length && <p>No matching racks.</p>}</section></div></>}
 {draft.stage === "review" && <><div className="receiving-review-summary"><section className="dashboard-card"><div className="receiving-card-heading"><h2>Shipment</h2><span className="inbound-status">{done ? "RECEIVED" : "READY"}</span></div><small>{shipment.id}</small><strong>{shipment.supplier}</strong><p>Delivered {receivingDate(shipment.date)} · Dock {shipment.dock}</p></section><section className="dashboard-card"><h2>Inspection Result</h2><div><strong>{totals.accepted}</strong> accepted <strong className="critical-text">{issueUnits}</strong> issues <span className="receiving-review-check">✓</span></div><p>{totals.damaged} damaged · {totals.rejected} rejected · {totals.short} missing · {draft.evidence.length} evidence files</p></section><section className="dashboard-card"><h2>Storage Allocation</h2><div><strong>{allocation.total} / {totals.accepted}</strong> units allocated <span className="receiving-review-check">✓</span></div><p>{new Set(Object.entries(allocation.byRack).filter(([, qty]) => qty > 0).map(([id]) => id)).size} rack locations · 100% complete</p></section></div><div className="receiving-review-grid"><section className="dashboard-card receiving-review-items"><h2>Items to Add to Inventory</h2><p>Accepted quantities and final storage locations.</p><div className="receiving-table-wrap"><table><thead><tr>{["Product", "Accepted", "Storage locations", "New stock"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{draft.rows.map((row) => {
    const current = inventory.find((item) => item.sku === row.sku)?.current || 0;
    const before = done ? current - acceptedUnits(row) : current;
    return <tr key={row.sku}><td><strong>{row.name}</strong><small>Type: {typeOf(row)}</small><small>{row.sku}</small></td><td className="positive-text"><strong>{acceptedUnits(row)}</strong></td><td>{(draft.allocations[row.sku] || []).filter((item) => Number(item.quantity) > 0).map((item) => <div key={item.id}>{item.rack}: {item.quantity} units</div>)}</td><td className="positive-text"><strong>{before} → {before + acceptedUnits(row)}</strong></td></tr>;
  })}</tbody></table></div><div className="receiving-increase"><strong>Total inventory increase</strong><strong>+{totals.accepted} units</strong></div></section><section className="dashboard-card receiving-resolution"><h2>Issue Resolution</h2><p>Units excluded from available inventory.</p>{totals.damaged > 0 && <article><strong>{totals.damaged} damaged units</strong><p>{shipment.issueResolution?.title || "Move to Quarantine Zone Q-02"}</p><p>{shipment.issueResolution ? `${shipment.issueResolution.reference} (demo record)` : "Awaiting supplier claim (demo record)"}</p></article>}{totals.rejected > 0 && <article><strong>{totals.rejected} rejected units</strong><p>Return to {shipment.supplier}</p><p>Reference: RTN-{shipment.id.slice(4)}-01 (demo)</p></article>}{totals.short > 0 && <article><strong>{totals.short} missing units</strong><p>Purchase order remains partially received.</p></article>}<div><strong>Evidence & notes</strong><p>{draft.evidence.length} files · {draft.notes.trim() ? "Inspection notes completed" : "No issue notes required"}</p></div></section></div><div className="receiving-confirmation"><strong>{done ? "Receiving completed" : "Ready to complete receiving"}</strong><p>{done ? `${totals.accepted} accepted units were added once.` : `Completing will add ${totals.accepted} units, record ${issueUnits} issue units and ${totals.short ? "keep the PO partially received" : "close " + shipment.po} in demo state.`}</p><label><input type="checkbox" checked={confirmed} disabled={done} onChange={(event) => {
    setConfirmed(event.target.checked);
    setError("");
  }} />I confirm that quantities, conditions and storage locations above are correct.</label></div></>}
 {error && <p role="alert" className="field-error receiving-error">{error}</p>}{notice && <p role="status" className="form-notice">{notice}</p>}<div className="receiving-footer"><p>{draft.stage === "inspect" ? draft.savedAt ? `Draft saved at ${draft.savedAt}` : "Draft is not saved yet." : `${allocation.total} of ${totals.accepted} units allocated \xB7 ${totals.accepted - allocation.total} remaining`}</p><div>{draft.stage === "inspect" ? <><button className="inbound-secondary" onClick={() => {
    save();
    onBack();
  }}>Cancel</button><button className="inbound-primary" onClick={toStorage}>Continue to Storage</button></> : draft.stage === "storage" ? <><button className="inbound-secondary" onClick={() => stage("inspect")}>Back</button><button className="inbound-primary" onClick={toReview}>Continue to Review</button></> : <><button className="inbound-secondary" disabled={done} onClick={() => stage("storage")}>Back</button><button className="inbound-primary" disabled={!confirmed || done} onClick={complete}>{done ? "Received" : "Complete Receiving"}</button></>}</div></div>{done && <dialog ref={dialogRef} className="receiving-success-dialog" aria-labelledby="receiving-success-title" onCancel={onBack}><span className="receiving-review-check">✓</span><div><h2 id="receiving-success-title">Receiving completed</h2><p>{totals.accepted} units have been added to inventory.</p></div><button className="dashboard-link" onClick={onBack}>View Inbound</button><button className="dashboard-link" onClick={() => onNavigate("inventory")}>View Inventory</button><button className="dashboard-link" onClick={onBack}>Done</button></dialog>}</div>;
}
export {
  InboundReceiving as default
};
