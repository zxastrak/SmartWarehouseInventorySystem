import { typeOf } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import { newReceivingDraft } from "../data/receiving.js";
import { acceptedUnits, inspectionSummary, validateInspection } from "../utils/receiving.js";
import "../styles/receiving.css";

const headings = { 
  inspect: "Inspect Inbound Shipment", 
  review: "Review & Complete Receiving" 
};

const descriptions = { 
  inspect: "Verify delivered quantities and condition before adding stock to inventory.", 
  review: "Confirm inspection results before updating inventory." 
};

const receivingDate = (date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));

function InboundReceiving({ shipment, inventory, racks, initialDraft, staffAccounts = [], onSaveDraft, onInspect, onUpdateStaff, onComplete, onBack, onNavigate, warehouseName, onHeaderChange }) {
  const [currentStaff, setCurrentStaff] = useState(shipment.staff || shipment.assigned_staff || 'Staf Dok');
  const [assignNotice, setAssignNotice] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  useEffect(() => {
    if (shipment.staff || shipment.assigned_staff) {
      setCurrentStaff(shipment.staff || shipment.assigned_staff);
    }
  }, [shipment.staff, shipment.assigned_staff]);

  async function handleStaffChange(newStaff) {
    const finalStaff = (newStaff || '').trim() || 'Semua Staf Lapangan';
    setCurrentStaff(finalStaff);
    setIsSubmittingAssign(true);
    if (onUpdateStaff) {
      await onUpdateStaff(shipment.id, finalStaff);
    }
    setIsSubmittingAssign(false);
    setAssignNotice(`Penugasan inspeksi berhasil diubah ke: "${finalStaff}"`);
    setTimeout(() => setAssignNotice(''), 3500);
  }

  const [draft, setDraft] = useState(() => {
    if (initialDraft && shipment.status !== "Inspected") return initialDraft;
    const initial = newReceivingDraft(shipment, inventory, racks);
    if (shipment.status === "Inspected") {
      return { ...initial, stage: "review" };
    }
    return initial;
  });

  useEffect(() => {
    if (shipment.status === "Inspected" && draft.stage !== "review") {
      const refreshed = newReceivingDraft(shipment, inventory, racks);
      setDraft({ ...refreshed, stage: "review" });
    }
  }, [shipment.status, shipment, inventory, racks]);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");
  const dialogRef = useRef(null);
  const submitLock = useRef(false);

  const totals = inspectionSummary(draft.rows);
  const issueUnits = totals.damaged + totals.rejected + totals.short;
  const totalInspectedUnits = totals.accepted + totals.damaged + totals.rejected;
  const inspectPercent = totals.ordered > 0 ? Math.min(100, Math.round((totalInspectedUnits / totals.ordered) * 100)) : 0;

  useEffect(() => {
    onHeaderChange({ title: headings[draft.stage], description: descriptions[draft.stage], stage: draft.stage });
    window.scrollTo(0, 0);
  }, [draft.stage, onHeaderChange]);

  useEffect(() => {
    if (done) dialogRef.current?.showModal();
  }, [done]);

  function complete() {
    if (submitLock.current || done) return;
    const problem = validateInspection(draft);
    if (problem) {
      setError(problem);
      return;
    }
    if (!confirmed) {
      setError("Confirm that delivered quantities and physical inspection results are correct.");
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

  const receivingProgress = draft.stage === "inspect" ? 1 : 2;

  const issueBanner = (
    <div className="receiving-issues" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span className="receiving-round" style={{ background: '#f87171', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>!</span>
        <div>
          <strong style={{ display: 'block', color: '#991b1b', fontSize: 13 }}>{issueUnits} units require follow-up</strong>
          <p style={{ margin: '2px 0 0', color: '#b91c1c', fontSize: 12 }}>
            {totals.damaged} damaged units and {totals.rejected} rejected units will not be added to available stock.
          </p>
        </div>
      </div>
      <button type="button" className="inbound-secondary" style={{ fontSize: 12, padding: '6px 14px', background: '#fff' }}>
        Add Evidence
      </button>
    </div>
  );

  return (
    <div className="receiving-content">
      {/* 3-Step Progress Indicator (Figma MacBook Pro 16" - 17 & 15) */}
      <ol className={`receiving-steps receiving-step-${receivingProgress}`} aria-label="Receiving progress">
        {[
          "Shipment details", 
          "Inspect items", 
          "Review & receive"
        ].map((label, index) => (
          <li key={label} className={index <= receivingProgress ? "receiving-active-step" : ""} aria-current={index === receivingProgress ? "step" : void 0}>
            <span>{index < receivingProgress ? "✓" : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      {/* Toast Notice Penugasan */}
      {assignNotice && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #86efac',
            borderRadius: 10,
            padding: '12px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.1)',
            color: '#166534',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>✓</span>
          <span>{assignNotice}</span>
        </div>
      )}

      {/* TAHAP 1: INSPECT INBOUND SHIPMENT (Figma MacBook Pro 16" - 17) */}
      {draft.stage === "inspect" && (
        <div className="receiving-inspect-grid">
          <div className="receiving-left">

            {/* Shipment Information Card (Figma Layout) */}
            <section className="dashboard-card receiving-shipment-card">
              <div className="receiving-card-heading">
                <h2>Shipment Information</h2>
                <span className="inbound-status">{shipment.status.toUpperCase()}</span>
              </div>
              <dl>
                {[
                  ["Inbound ID", shipment.id],
                  ["Purchase Order", shipment.po],
                  ["Supplier", shipment.supplier],
                  ["Delivery Date", `${receivingDate(shipment.date)} · ${shipment.time}`],
                  ["Receiving Dock", shipment.dock],
                  ["Delivery Note", shipment.reference || "Not provided"],
                  ["Driver / Vehicle", shipment.carrier || "Not provided"],
                  [
                    "Assigned to",
                    <div key="assigned-action" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <select
                        value={currentStaff}
                        onChange={(e) => handleStaffChange(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: 240,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1.5px solid #5c732b',
                          background: '#ffffff',
                          color: '#191d17',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="Semua Staf Lapangan">👥 Semua Staf Lapangan</option>
                        {staffAccounts.map((acc) => {
                          const name = acc.fullName || acc.name;
                          return (
                            <option key={acc.id || name} value={name}>
                              👤 {name} {acc.role ? `(${acc.role})` : ''}
                            </option>
                          );
                        })}
                        {currentStaff && currentStaff !== 'Semua Staf Lapangan' && !staffAccounts.some((acc) => (acc.fullName || acc.name) === currentStaff) && (
                          <option value={currentStaff}>👤 {currentStaff}</option>
                        )}
                      </select>
                      {isSubmittingAssign && (
                        <span style={{ fontSize: 11, color: '#5c732b', fontWeight: 600 }}>Menyimpan...</span>
                      )}
                    </div>
                  ],
                ].map(([label, value]) => (
                  <div key={typeof label === 'string' ? label : 'row'}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Inspection Allocation Progress Bar Card */}
            <section className="dashboard-card receiving-allocation-progress">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Inspection Progress</h2>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#5c732b' }}>
                    {inspectPercent}% Selesai
                  </span>
                </div>
                <p>Status verifikasi fisik dan scan barcode barang datang dari PO.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <progress value={totalInspectedUnits} max={totals.ordered || 1} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#5c732b', minWidth: 46 }}>
                    {totalInspectedUnits}/{totals.ordered}
                  </span>
                </div>
              </div>
              <div className="receiving-progress-stats">
                <article>
                  <span>EXPECTED</span>
                  <strong>{totals.ordered}</strong>
                </article>
                <article>
                  <span>ACCEPTED</span>
                  <strong>{totals.accepted}</strong>
                </article>
                <article className={issueUnits > 0 ? "summary-issue" : ""}>
                  <span>ISSUES</span>
                  <strong>{issueUnits}</strong>
                </article>
              </div>
            </section>

            {/* Item Inspection Card (Matching Figma MacBook Pro 16" - 17 Columns) */}
            <section className="dashboard-card receiving-item-card">
              <div className="card-heading" style={{ marginBottom: 12 }}>
                <div>
                  <h2>Item Inspection</h2>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    Data kuantitas dan kondisi fisik barang pesanan dari purchase order.
                  </p>
                </div>
                <span className="status-badge-waiting">
                  ⏳ Menunggu Cek Staf
                </span>
              </div>

              <div className="receiving-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["Product", "Ordered", "Received", "Damaged", "Rejected", "Accepted", "Result"].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.rows.map((row) => {
                      const count = acceptedUnits(row);
                      const issues = Number(row.damaged) + Number(row.rejected) + Math.max(0, row.ordered - Number(row.received));
                      return (
                        <tr key={row.sku}>
                          <td>
                            <strong>{row.name}</strong>
                            <small>Type: {typeOf(row)}</small>
                            <small>{row.sku} · {row.category}</small>
                          </td>
                          <td><strong>{row.ordered}</strong></td>
                          <td>{row.received !== undefined ? row.received : "—"}</td>
                          <td>{Number(row.damaged) > 0 ? <span className="critical-text">{row.damaged}</span> : "0"}</td>
                          <td>{Number(row.rejected) > 0 ? <span className="critical-text">{row.rejected}</span> : "0"}</td>
                          <td className="positive-text"><strong>{Number.isFinite(count) ? count : "—"}</strong></td>
                          <td>
                            <span className={`inbound-status${issues ? " inbound-status-issue" : " inbound-status-arrived"}`}>
                              {issues ? "Partial issue" : "Accepted"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!draft.rows.length && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "24px 16px", color: "#64748b" }}>
                          Tidak ada produk tercatat dalam PO ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {issueUnits > 0 && issueBanner}
              <p style={{ margin: '14px 0 0', fontSize: 11, color: '#737b6c' }}>
                Inspection progress saved automatically
              </p>
            </section>
          </div>

          <div className="receiving-right">
            {/* Supporting evidence (Exact Figma MacBook Pro 16" - 17) */}
            <section className="dashboard-card receiving-details-card">
              <h2>Supporting evidence</h2>
              <div style={{
                border: '1.5px dashed #cbd5e1',
                borderRadius: 8,
                padding: '20px 16px',
                textAlign: 'center',
                background: '#f8fafc',
                margin: '12px 0'
              }}>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>📷</span>
                <strong style={{ display: 'block', fontSize: 13, color: '#334155' }}>+ Upload photos or documents</strong>
                <span style={{ fontSize: 11, color: '#64748b' }}>PNG, JPG, or PDF · Max. 10 MB</span>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#0369a1' }}>
                  ℹ️ Dikirim oleh staf dok ({currentStaff}) via Mobile
                </p>
              </div>
              <p className="receiving-help" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, margin: 0, fontSize: 11, color: '#737b6c' }}>
                Next: review accepted items before completing receiving.
              </p>
            </section>

            {/* Dock Workflow Status */}
            <section className="dashboard-card receiving-details-card">
              <h2>Alur Pemeriksaan Dok</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '14px 0' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ background: '#dcfce7', color: '#166534', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>✓</span>
                  <div>
                    <strong style={{ fontSize: 13, color: '#166534' }}>Armada Barang Tiba</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Dikonfirmasi tiba di Dok {shipment.dock}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ background: '#e0f2fe', color: '#0284c7', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>⏳</span>
                  <div>
                    <strong style={{ fontSize: 13, color: '#0369a1' }}>Pemeriksaan Fisik & Scan Barcode</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Sedang diproses oleh {currentStaff} di HP Mobile</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ background: '#f1f5f9', color: '#94a3b8', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>3</span>
                  <div>
                    <strong style={{ fontSize: 13, color: '#64748b' }}>Review & ACC Manager</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Menunggu pengiriman data dari aplikasi mobile staf</p>
                  </div>
                </div>
              </div>
              <p className="receiving-help" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                Setelah staf dok menekan "Kirim Hasil Cek & Barcode ke Manager" di aplikasi Mobile, halaman ini akan otomatis berganti ke tampilan Review & ACC.
              </p>
            </section>

            {/* Inspection Summary Card (Exact Figma 3 Metrics Layout) */}
            <section className="dashboard-card receiving-summary-card">
              <h2>Inspection Summary</h2>
              <div>
                {[
                  ["Ordered", totals.ordered, ""],
                  ["Accepted", totals.accepted, "summary-accepted"],
                  ["Issues", issueUnits, issueUnits ? "summary-issue" : ""]
                ].map(([label, value, tone]) => (
                  <article key={label} className={tone}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAHAP 2: REVIEW & COMPLETE RECEIVING (Figma MacBook Pro 16" - 15) */}
      {draft.stage === "review" && (
        <>
          {/* Banner Review Laporan Staf Dok */}
          <div className="banner-review-staff">
            <div className="banner-content">
              <span className="banner-icon">📱</span>
              <div>
                <h3 className="banner-title">
                  Laporan Hasil Pemeriksaan Fisik & Scan Barcode dari Staf Dok
                </h3>
                <p className="banner-desc">
                  Inspektur Dok: <strong>{shipment.inspector || shipment.staff || 'Staf Dok Lapangan'}</strong>
                  {shipment.inspectedAt ? ` · Waktu Cek: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(shipment.inspectedAt))}` : ''}
                  {draft.notes ? ` · Catatan Lapangan: "${draft.notes}"` : ''}
                </p>
              </div>
            </div>
            <span className="banner-badge-mobile">
              ✓ Data Masuk dari Mobile
            </span>
          </div>

          {/* Top 3 Summary Cards (Exact Figma MacBook Pro 16" - 15) */}
          <div className="receiving-review-summary">
            <section className="dashboard-card">
              <div className="receiving-card-heading">
                <h2>Shipment</h2>
                <span className="inbound-status">{done ? "RECEIVED" : "READY"}</span>
              </div>
              <small>{shipment.id}</small>
              <strong>{shipment.supplier}</strong>
              <p>Delivered {receivingDate(shipment.date)} · Dock {shipment.dock}</p>
            </section>

            <section className="dashboard-card">
              <h2>Inspection Result</h2>
              <div>
                <strong>{totals.accepted}</strong> accepted <strong className="critical-text">{issueUnits}</strong> issues <span className="receiving-review-check">✓</span>
              </div>
              <p>{totals.damaged} damaged · {totals.rejected} rejected · {totals.short} missing · Evidence attached</p>
            </section>

            <section className="dashboard-card">
              <h2>Inventory Update</h2>
              <div>
                <strong>+{totals.accepted}</strong> units to add <span className="receiving-review-check">✓</span>
              </div>
              <p>Dicatat ke Dock Staging (Area Transit Dok) · Siap Putaway</p>
            </section>
          </div>

          {/* Main Review Grid */}
          <div className="receiving-review-grid">
            <section className="dashboard-card receiving-review-items">
              <h2>Items to Add to Inventory</h2>
              <p>Accepted quantities and verified barcodes from dock inspection.</p>
              <div className="receiving-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["Product", "Accepted", "Barcode Hasil Scan Staf Dok", "Condition", "New stock"].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.rows.map((row) => {
                      const current = inventory.find((item) => item.sku === row.sku)?.current || 0;
                      const before = done ? current - acceptedUnits(row) : current;
                      const rowIssues = Number(row.damaged) + Number(row.rejected);
                      const invItem = inventory.find((item) => item.sku === row.sku);
                      const rowImg = row.image_url || invItem?.image_url;
                      const rowBarcodes = Array.isArray(row.barcodes) && row.barcodes.length > 0
                        ? row.barcodes
                        : Array.from({ length: acceptedUnits(row) }, (_, i) => `${row.sku}-${String(i + 1).padStart(3, '0')}`);

                      return (
                        <tr key={row.sku}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="inventory-thumb" style={{ width: 38, height: 38, borderRadius: 8 }}>
                                {rowImg ? (
                                  <img
                                    src={rowImg}
                                    alt={row.name}
                                    className="inventory-thumb-img"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className="inventory-thumb-fallback" style={{ display: rowImg ? 'none' : 'flex', fontSize: 13 }}>
                                  📦
                                </div>
                              </div>
                              <div>
                                <strong>{row.name}</strong>
                                <small>Type: {typeOf(row)}</small>
                                <small>{row.sku} · {row.category}</small>
                              </div>
                            </div>
                          </td>
                          <td className="positive-text"><strong>{acceptedUnits(row)}</strong></td>
                          <td>
                            {/* Barcode Chips Container (docs/design.md Section 5.3) */}
                            <div className="barcode-scan-container">
                              <div className="barcode-scan-header">
                                <span>📱 {rowBarcodes.length} Barcode Di-scan Staf</span>
                              </div>
                              <div className="barcode-badge-wrap">
                                {rowBarcodes.map((bc, bIdx) => (
                                  <span key={bIdx} className="barcode-badge-item" title={`Barcode fisik unit ${bIdx + 1}`}>
                                    ║▌║ {bc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td>
                            {rowIssues > 0 ? (
                              <span className="critical-text">{rowIssues} damaged/rejected</span>
                            ) : (
                              <span className="positive-text">Good condition</span>
                            )}
                          </td>
                          <td className="positive-text"><strong>{before} → {before + acceptedUnits(row)}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="receiving-increase">
                <strong>Total inventory increase</strong>
                <strong>+{totals.accepted} units</strong>
              </div>
            </section>

            <section className="dashboard-card receiving-resolution">
              <h2>Issue Resolution</h2>
              <p>Units excluded from available inventory.</p>
              {totals.damaged > 0 && (
                <article>
                  <strong>{totals.damaged} damaged units</strong>
                  <p>{shipment.issueResolution?.title || "Move to Quarantine Zone Q-02"}</p>
                </article>
              )}
              {totals.rejected > 0 && (
                <article>
                  <strong>{totals.rejected} rejected units</strong>
                  <p>Return to {shipment.supplier}</p>
                </article>
              )}
              {totals.short > 0 && (
                <article>
                  <strong>{totals.short} missing units</strong>
                  <p>Purchase order remains partially received.</p>
                </article>
              )}
              {issueUnits === 0 && (
                <article>
                  <strong>Perfect Condition</strong>
                  <p>All delivered items passed physical inspection with verified barcodes.</p>
                </article>
              )}
              <div>
                <strong>Evidence & notes</strong>
                <p>{draft.notes.trim() ? draft.notes : "Inspection notes completed by dock staff."}</p>
              </div>
            </section>
          </div>

          {/* Bottom Confirmation Card (Exact Figma MacBook Pro 16" - 15) */}
          <div className="receiving-confirmation">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="receiving-review-check" style={{ width: 24, height: 24, fontSize: 14 }}>✓</span>
              <strong style={{ fontSize: 15 }}>{done ? "Receiving completed" : "Ready to complete receiving & ACC"}</strong>
            </div>
            <p>
              {done
                ? `${totals.accepted} accepted units were added to Dock Staging.`
                : `Memberikan ACC akan mencatat ${totals.accepted} unit masuk ke area transit Dock Staging, mencatat ${issueUnits} unit issue, dan menutup tugas review. Penataan lokasi rak akan dilanjutkan oleh staf melalui Putaway di Mobile.`}
            </p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={done}
                onChange={(event) => {
                  setConfirmed(event.target.checked);
                  setError("");
                }}
              />
              Saya telah memeriksa laporan fisik & scan barcode staf dok dan menyetujui penerimaan barang ini.
            </label>
          </div>
        </>
      )}

      {error && <p role="alert" className="field-error receiving-error">{error}</p>}
      {notice && <p role="status" className="form-notice">{notice}</p>}

      {/* Footer Bar (Figma Layout) */}
      <div className="receiving-footer">
        <p>
          {draft.stage === "inspect"
            ? "⏳ Menunggu staf dok mengirimkan hasil pemeriksaan fisik & scan barcode via aplikasi Mobile"
            : `${totals.accepted} units to be received into inventory`}
        </p>
        <div>
          {draft.stage === "inspect" ? (
            <>
              <button
                className="inbound-secondary"
                onClick={onBack}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inbound-secondary"
                style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}
                onClick={() => window.location.reload()}
                title="Muat ulang data dari server"
              >
                🔄 Refresh Status
              </button>
            </>
          ) : (
            <>
              <button className="inbound-secondary" onClick={onBack}>
                ← Back
              </button>
              <button className="inbound-primary" disabled={!confirmed || done} onClick={complete}>
                {done ? "Telah Di-ACC" : "✅ Complete Receiving"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Dialog (Figma Receiving Completed Screen) */}
      {done && (
        <dialog ref={dialogRef} className="receiving-success-dialog" aria-labelledby="receiving-success-title" onCancel={onBack} style={{ maxWidth: 540, padding: '26px 30px', borderRadius: 16 }}>
          <span className="receiving-review-check" style={{ fontSize: 32, marginBottom: 12 }}>✓</span>
          <div>
            <h2 id="receiving-success-title" style={{ margin: '0 0 6px', fontSize: 20 }}>Receiving Completed!</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#555d4e' }}>
              <strong>+{totals.accepted} units</strong> were verified by dock staff and successfully received into inventory stock.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#737b6c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Next Operations:
            </span>
            <button
              className="inbound-primary"
              style={{ padding: '12px 18px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => onNavigate("inventory")}
            >
              📦 Cek Stok Baru di Master Inventory ›
            </button>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 4 }}>
              <button className="dashboard-link" onClick={onBack}>
                ← Back to Inbound
              </button>
              <button className="dashboard-link" onClick={onBack}>
                Done
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

export {
  InboundReceiving as default
};
