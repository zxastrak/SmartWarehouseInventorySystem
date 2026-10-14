import React, { useEffect, useRef, useState } from "react";
import { prepareReportExport, downloadPreparedReport } from "../utils/reportExport.js";
export default function ReportExport({ config, onClose, onAudit }) {
  const ref = useRef(null), [format, setFormat] = useState("xlsx"), [groups, setGroups] = useState(config.groups?.map((row) => row.id) || []), [summary, setSummary] = useState(false), [result, setResult] = useState(null), [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  function prepare() {
    try {
      const columns = config.groups ? config.groups.filter((group) => groups.includes(group.id)).flatMap((group) => group.columns) : config.columns;
      const next = prepareReportExport({ ...config, columns, format, summary: summary ? config.summary || [] : [] });
      setResult(next);
      setError("");
      onAudit?.({ action: "Export generated", reference: next.filename, details: `${next.count} records \xB7 ${next.format.toUpperCase()} \xB7 ${next.scope}`, changes: [{ field: "Export scope", before: "Not generated", after: next.scope }, { field: "Records", before: 0, after: next.count }] });
    } catch (err) {
      setError(err.message);
    }
  }
  function download() {
    downloadPreparedReport(result);
    onAudit?.({ action: "Export downloaded", reference: result.filename, details: `${result.count} records \xB7 ${result.format.toUpperCase()}`, changes: [] });
  }
  return <dialog ref={ref} className="dashboard-dialog ra-export" aria-labelledby="ra-export-title" onCancel={onClose}>{result ? <><div className="ra-success-icon">✓</div><h2 id="ra-export-title">{config.audit ? "Audit Log Exported" : "Export completed"}</h2><p className="ra-muted">The selected records are ready to download.</p><dl className="ra-export-result"><div><dt>File</dt><dd>{result.filename}</dd></div><div><dt>Records</dt><dd>{result.count}</dd></div><div><dt>Scope</dt><dd>{result.scope}</dd></div></dl><div className="inbound-form-actions"><button className="inbound-secondary" onClick={onClose}>Close</button><button className="inbound-primary" onClick={download}>Download</button></div></> : <><button className="inventory-close" aria-label="Close report export" onClick={onClose}>×</button><h2 id="ra-export-title">Export {config.title}</h2><p className="ra-muted">Choose the file format and included records.</p><h3>File format</h3><div className="ra-format">{[["xlsx", "Excel"], ["csv", "CSV"], ["pdf", "PDF"]].map(([value, label]) => <label className={format === value ? "selected" : ""} key={value}><input type="radio" name="report-format" value={value} checked={format === value} onChange={() => setFormat(value)} /><strong>{label}</strong><small>.{value}</small></label>)}</div>{config.groups && <><h3>Data to include</h3><div className="ra-export-groups">{config.groups.map((group) => <label key={group.id}><input type="checkbox" checked={groups.includes(group.id)} onChange={() => setGroups((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])} />{group.label}</label>)}<label><input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} />Include report summary</label></div></>}<h3>Export scope</h3><div className="ra-export-scope"><small>{config.scope}</small><strong>{config.rows.length} filtered records · all matching pages</strong></div>{error && <p role="alert" className="field-error">{error}</p>}<div className="inbound-form-actions"><button className="inbound-secondary" onClick={onClose}>Cancel</button><button className="inbound-primary" onClick={prepare}>{config.audit ? "Export Log" : "Export Report"}</button></div></>}</dialog>;
}
