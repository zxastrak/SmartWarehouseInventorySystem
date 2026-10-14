import React, { useEffect, useRef, useState } from "react";
import { movementColumns, movementTypes } from "../data/inventory.js";
import { exportMovements } from "../utils/exportMovements.js";
export default function MovementExport({ product, movements, contextLabel = null, onClose }) {
  const dates = movements.map(row => row.date.slice(0, 10)).sort();
  const ref = useRef(null), [scope, setScope] = useState(product ? "product" : "all"), [start, setStart] = useState(contextLabel ? dates[0] || "2026-09-01" : "2026-09-01"), [end, setEnd] = useState(contextLabel ? dates.at(-1) || "2026-09-30" : "2026-09-30"), [types, setTypes] = useState(movementTypes.slice(0, 3)), [format, setFormat] = useState("xlsx"), [keys, setKeys] = useState(movementColumns.map(([key]) => key)), [error, setError] = useState("");
  useEffect(() => {
    ref.current.showModal();
  }, []);
  const rows = movements.filter((row) => (scope === "all" || row.sku === product?.sku) && row.date.slice(0, 10) >= start && row.date.slice(0, 10) <= end && types.includes(row.type));
  function toggle(value, setter) {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }
  function submit(event) {
    event.preventDefault();
    if (!start || !end || start > end) {
      setError("Choose a valid date range.");
      return;
    }
    if (!keys.length || !types.length) {
      setError("Choose at least one column and movement type.");
      return;
    }
    if (!rows.length) {
      setError("No records match these export filters.");
      return;
    }
    try {
      exportMovements(rows, movementColumns.filter(([key]) => keys.includes(key)), format);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }
  return <dialog ref={ref} className="movement-export" aria-labelledby="export-title" onCancel={onClose}><form onSubmit={submit}><button type="button" className="inventory-close" aria-label="Close export" onClick={onClose}>×</button><h2 id="export-title">Export Stock Movements</h2><p className="inventory-muted">Choose the movement data and file format you want to export.</p><hr />
  <fieldset><legend>Export scope</legend><div className="export-two">{[["product", "Current product"], ["all", contextLabel || "All inventory"]].map(([value, label]) => <label className={`export-choice${scope === value ? " chosen" : ""}`} key={value}><input type="radio" name="scope" value={value} checked={scope === value} disabled={value === "product" && !product} onChange={() => setScope(value)} /><span><strong>{label}</strong><small>{value === "product" ? `${product?.name || "No product selected"} \xB7 ${product?.sku || ""}` : contextLabel ? "Export movements for this shipment only" : "Export movements for every SKU"}</small></span></label>)}</div></fieldset>
  <fieldset><legend>Date range</legend><div className="export-two"><label><span className="sr-only">Export start date</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></label><label><span className="sr-only">Export end date</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required /></label></div></fieldset>
  <fieldset><legend>Movement types</legend><div className="export-two">{movementTypes.map((type) => <label className="export-checkbox" key={type}><input type="checkbox" checked={types.includes(type)} onChange={() => toggle(type, setTypes)} />{type}</label>)}</div></fieldset>
  <fieldset><legend>File format</legend><div className="export-formats">{[["xlsx", "Excel", ".xlsx"], ["pdf", "PDF", ".pdf"], ["csv", "CSV", ".csv"]].map(([value, label, extension]) => <label key={value} className={`export-choice${format === value ? " chosen" : ""}`}><input type="radio" name="format" checked={format === value} onChange={() => setFormat(value)} /><span><strong>{label}</strong><small>{extension}</small></span></label>)}</div></fieldset>
  <fieldset><legend>Include columns</legend><div className="export-columns">{movementColumns.map(([key, label]) => <label key={key}><input type="checkbox" checked={keys.includes(key)} onChange={() => toggle(key, setKeys)} />{label}</label>)}</div></fieldset>
  <div className="export-preview"><strong>Export preview</strong><p>{rows.length} sample movement records{format === "pdf" ? " \xB7 Choose Save as PDF in the print dialog" : ""}</p></div>{error && <p className="field-error" role="alert">{error}</p>}<div className="export-two export-buttons"><button type="button" className="back-button" onClick={onClose}>Cancel</button><button className="continue-button" type="submit">Export Movements</button></div></form></dialog>;
}
