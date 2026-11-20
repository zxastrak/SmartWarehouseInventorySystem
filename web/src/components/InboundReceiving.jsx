import { typeOf } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import { newReceivingDraft } from "../data/receiving.js";
import { acceptedUnits, inspectionSummary, validateInspection } from "../utils/receiving.js";
import InboundItemDetailModal from "./InboundItemDetailModal.jsx";
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

const resolveEvidenceUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image')) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads/')) {
    const origin = typeof window !== 'undefined' ? (window.location.port === '5173' ? 'http://localhost:5000' : window.location.origin) : '';
    return `${origin}${trimmed}`;
  }
  return null;
};

const normalizeStaff = (val) => {
  if (!val || ['staff', 'staf'].includes(String(val).trim().toLowerCase())) {
    return 'Semua Staf Lapangan';
  }
  return String(val).trim();
};

function InboundReceiving({ shipment, inventory, racks, initialDraft, staffAccounts = [], onSaveDraft, onInspect, onUpdateStaff, onUpdateItemStaff, onComplete, onBack, onNavigate, warehouseName, onHeaderChange }) {
  const [currentStaff, setCurrentStaff] = useState(() => normalizeStaff(shipment.staff || shipment.assigned_staff));
  const [isAssigned, setIsAssigned] = useState(false);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [viewingPhoto, setViewingPhoto] = useState(null);

  useEffect(() => {
    if (shipment.staff || shipment.assigned_staff) {
      const staffVal = normalizeStaff(shipment.staff || shipment.assigned_staff);
      setCurrentStaff(staffVal);
    }
  }, [shipment.staff, shipment.assigned_staff]);

  async function handleStaffChange(newStaff) {
    const finalStaff = (newStaff || '').trim() || 'Semua Staf Lapangan';
    setCurrentStaff(finalStaff);
    setIsSubmittingAssign(true);
    try {
      if (onUpdateStaff) {
        await onUpdateStaff(shipment.id, finalStaff);
      }
      setIsAssigned(true);
    } finally {
      setIsSubmittingAssign(false);
    }
  }

  async function handleItemStaffChange(sku, newStaff) {
    const finalStaff = (newStaff || '').trim() || 'Semua Staf Lapangan';
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.sku === sku ? { ...r, assigned_staff: finalStaff } : r)),
    }));
    if (onUpdateItemStaff) {
      await onUpdateItemStaff(shipment.id, sku, finalStaff);
    }
  }

  async function handleAssignAll() {
    setIsSubmittingAssign(true);
    try {
      if (onUpdateItemStaff) {
        for (const row of draft.rows) {
          const finalStaff = (row.assigned_staff || 'Semua Staf Lapangan').trim();
          await onUpdateItemStaff(shipment.id, row.sku, finalStaff);
        }
      }
      if (onUpdateStaff) {
        const primaryStaff = draft.rows.find((r) => r.assigned_staff && r.assigned_staff !== 'Semua Staf Lapangan')?.assigned_staff || 'Semua Staf Lapangan';
        await onUpdateStaff(shipment.id, primaryStaff);
      }
      setIsAssigned(true);
    } catch (err) {
      console.error('handleAssignAll error:', err);
    } finally {
      setIsSubmittingAssign(false);
    }
  }

  const [draft, setDraft] = useState(() => {
    if (initialDraft && !["Review", "Inspected"].includes(shipment.status)) return initialDraft;
    const initial = newReceivingDraft(shipment, inventory, racks);
    if (["Review", "Inspected"].includes(shipment.status)) {
      return { ...initial, stage: "review" };
    }
    return initial;
  });

  useEffect(() => {
    if (["Review", "Inspected"].includes(shipment.status) && draft.stage !== "review") {
      const refreshed = newReceivingDraft(shipment, inventory, racks);
      setDraft({ ...refreshed, stage: "review" });
    }
  }, [shipment.status, shipment, inventory, racks]);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);
  const dialogRef = useRef(null);
  const submitLock = useRef(false);

  const totals = inspectionSummary(draft.rows);
  const damagedRows = draft.rows.filter((r) => Number(r.damaged) > 0);
  const isInspectedStage = ['Review', 'Inspected', 'Complete', 'Received'].includes(shipment.status) || draft.stage === 'review';
  const hasAnyInspection = isInspectedStage || draft.rows.some((row) =>
    Boolean(
      row.is_inspected ||
      (Array.isArray(row.barcodes) && row.barcodes.length > 0) ||
      row.inspected_at ||
      Number(row.received) > 0 ||
      Number(row.damaged) > 0 ||
      Number(row.rejected) > 0
    )
  );
  const issueUnits = hasAnyInspection ? (totals.damaged + totals.rejected + totals.short) : 0;
  const totalInspectedUnits = hasAnyInspection ? (totals.accepted + totals.damaged + totals.rejected) : 0;
  const inspectPercent = totals.ordered > 0 ? Math.min(100, Math.round((totalInspectedUnits / totals.ordered) * 100)) : 0;

  useEffect(() => {
    onHeaderChange({ title: headings[draft.stage], description: descriptions[draft.stage], stage: draft.stage });
    window.scrollTo(0, 0);
  }, [draft.stage, onHeaderChange]);

  useEffect(() => {
    if (done) dialogRef.current?.showModal();
  }, [done]);

  async function complete() {
    if (submitLock.current || done || isSubmittingComplete) return;
    if (!["Review", "Inspected"].includes(shipment.status)) {
      setError("Inbound shipment belum diinspeksi oleh staf dok. Staf dok wajib menginput kuantitas fisik dan memindai barcode unit di Mobile terlebih dahulu sebelum Manager memberikan ACC.");
      return;
    }
    const problem = validateInspection(draft, { isReview: true });
    if (problem) {
      setError(problem);
      return;
    }
    if (!confirmed) {
      setError("Confirm that delivered quantities and physical inspection results are correct.");
      return;
    }
    submitLock.current = true;
    setIsSubmittingComplete(true);
    setError("");
    try {
      const problemOnSave = await onComplete(draft);
      if (problemOnSave) {
        submitLock.current = false;
        setIsSubmittingComplete(false);
        setError(typeof problemOnSave === "string" ? problemOnSave : "Gagal menyelesaikan penerimaan barang.");
        return;
      }
      setDone(true);
    } catch (err) {
      submitLock.current = false;
      setIsSubmittingComplete(false);
      setError(err?.message || "Gagal menyelesaikan penerimaan barang.");
    }
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
      {/* Top Navigation Bar: Tombol Kembali Langsung ke Menu / Detail Sebelumnya */}
      <div className="inbound-top-nav-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <button
          type="button"
          className="dashboard-link inbound-back-nav-btn"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 13,
            color: '#3e5510',
            background: '#f8f9f5',
            border: '1.5px solid #d4dec3',
            borderRadius: 8,
            padding: '7px 15px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          ← Kembali ke Detail / Daftar Inbound
        </button>
        <span style={{ fontSize: 12, color: '#737b6c', fontWeight: 500 }}>
          No. Inbound: <strong style={{ color: '#191d17' }}>{shipment.id}</strong> · PO: <strong style={{ color: '#191d17' }}>{shipment.po}</strong> · Dok: <strong style={{ color: '#191d17' }}>{shipment.dock}</strong>
        </span>
      </div>

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

      {/* TAHAP 1: INSPECT INBOUND SHIPMENT (Figma MacBook Pro 16" - 17) */}
      {draft.stage === "inspect" && (
        <div className="receiving-inspect-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              ].map(([label, value]) => (
                <div key={typeof label === 'string' ? label : 'row'}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Top Row: Inspection Allocation Progress & Alur Pemeriksaan Dok (Naik ke Atas) */}
          <div className="receiving-inspect-top-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, alignItems: 'stretch' }}>
            {/* Inspection Allocation Progress Bar Card */}
            <section
              className="dashboard-card receiving-allocation-progress"
              style={{
                margin: 0,
                height: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 20px',
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 16 }}>Inspection Progress</h2>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#5c732b' }}>
                    {inspectPercent}% Selesai
                  </span>
                </div>
                <p style={{ margin: '6px 0 14px', fontSize: 12, color: '#737b6c' }}>
                  Status verifikasi fisik dan scan barcode barang datang dari PO.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <progress value={totalInspectedUnits} max={totals.ordered || 1} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#5c732b', minWidth: 46 }}>
                    {totalInspectedUnits}/{totals.ordered}
                  </span>
                </div>
              </div>
              <div
                className="receiving-progress-stats"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  margin: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <article style={{ background: '#f8fafc', padding: '10px 8px', borderRadius: 8, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 700 }}>EXPECTED</span>
                  <strong style={{ fontSize: 22, display: 'block', color: '#1e293b' }}>{totals.ordered}</strong>
                </article>
                <article style={{ background: hasAnyInspection ? '#f0fdf4' : '#f8fafc', padding: '10px 8px', borderRadius: 8, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: hasAnyInspection ? '#166534' : '#64748b', display: 'block', marginBottom: 4, fontWeight: 700 }}>ACCEPTED</span>
                  <strong style={{ fontSize: 22, display: 'block', color: hasAnyInspection ? '#16a34a' : '#64748b' }}>{hasAnyInspection ? totals.accepted : 0}</strong>
                </article>
                <article className={issueUnits > 0 ? "summary-issue" : ""} style={{ background: issueUnits > 0 ? '#fdecec' : '#f8fafc', padding: '10px 8px', borderRadius: 8, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: issueUnits > 0 ? '#991b1b' : '#64748b', display: 'block', marginBottom: 4, fontWeight: 700 }}>ISSUES</span>
                  <strong style={{ fontSize: 22, display: 'block', color: issueUnits > 0 ? '#b91c1c' : '#64748b' }}>{issueUnits}</strong>
                </article>
              </div>
            </section>

            {/* Dock Workflow Status / Alur Pemeriksaan Dok */}
            <section
              className="dashboard-card receiving-details-card"
              style={{
                margin: 0,
                height: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 20px',
              }}
            >
              <div>
                <h2>Alur Pemeriksaan Dok</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '14px 0' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ background: '#dcfce7', color: '#166534', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <div>
                      <strong style={{ fontSize: 13, color: '#166534' }}>Armada Barang Tiba</strong>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Dikonfirmasi tiba di Dok {shipment.dock}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ background: '#e0f2fe', color: '#0284c7', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>⏳</span>
                    <div>
                      <strong style={{ fontSize: 13, color: '#0369a1' }}>Pemeriksaan Fisik & Scan Barcode</strong>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Sedang diproses oleh {currentStaff} di HP Mobile</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ background: '#f1f5f9', color: '#94a3b8', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>3</span>
                    <div>
                      <strong style={{ fontSize: 13, color: '#64748b' }}>Review & ACC Manager</strong>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Menunggu pengiriman data dari aplikasi mobile staf</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="receiving-help" style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, margin: 0, fontSize: 11, color: '#737b6c' }}>
                Setelah staf dok menekan "Kirim Hasil Cek & Barcode ke Manager" di aplikasi Mobile, halaman ini akan otomatis berganti ke tampilan Review & ACC.
              </p>
            </section>
          </div>

          {/* Item Inspection Card (Matching Figma MacBook Pro 16" - 17 Columns, Full Width) */}
          <section className="dashboard-card receiving-item-card" style={{ width: '100%', boxSizing: 'border-box' }}>
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
                    <th style={{ textAlign: 'left', minWidth: 200 }}>Product</th>
                    <th style={{ textAlign: 'center', width: 85 }}>Ordered</th>
                    <th style={{ textAlign: 'center', width: 85 }}>Damaged</th>
                    <th style={{ textAlign: 'center', width: 85 }}>Rejected</th>
                    <th style={{ textAlign: 'center', width: 85 }}>Accepted</th>
                    <th style={{ textAlign: 'center', width: 150 }}>Staf Bertugas</th>
                    <th style={{ textAlign: 'center', width: 110 }}>Result</th>
                    <th style={{ textAlign: 'center', width: 85 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.rows.map((row) => {
                    const count = acceptedUnits(row);
                    const invItem = inventory.find((item) => item.sku === row.sku);
                    const rowImg = row.image_url || invItem?.image_url;
                    const rowStaff = normalizeStaff(row.assigned_staff || currentStaff);
                    const hasInspected = Boolean(
                      row.is_inspected ||
                      (Array.isArray(row.barcodes) && row.barcodes.length > 0) ||
                      row.inspected_at ||
                      (['Review', 'Inspected', 'Complete', 'Received'].includes(shipment.status))
                    );
                    const hasRowIssue = hasInspected && (
                      Number(row.damaged) > 0 ||
                      Number(row.rejected) > 0 ||
                      (Number(row.received) < row.ordered)
                    );
                    return (
                      <tr key={row.sku}>
                        <td>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                            onClick={() => setSelectedDetailItem(row)}
                            title="Klik untuk melihat detail lengkap produk dan rak"
                          >
                            <div className="inventory-thumb" style={{ width: 34, height: 34, borderRadius: 6, flexShrink: 0 }}>
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
                              <div className="inventory-thumb-fallback" style={{ display: rowImg ? 'none' : 'flex' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#737b6c' }}>
                                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                  <line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                              </div>
                            </div>
                            <div>
                              <strong style={{ color: '#191d17', textDecoration: 'underline dotted', cursor: 'pointer' }}>{row.name}</strong>
                              <small>Type: {typeOf(row)}</small>
                              <small>{row.sku} · {row.category}</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong>{row.ordered}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {hasInspected ? (
                            Number(row.damaged) > 0 ? (
                              <span className="critical-text">{row.damaged}</span>
                            ) : (
                              "0"
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {hasInspected ? (
                            Number(row.rejected) > 0 ? (
                              <span className="critical-text">{row.rejected}</span>
                            ) : (
                              "0"
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {hasInspected ? (
                            <strong className="positive-text">
                              {Number.isFinite(count) ? count : "0"}
                            </strong>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <select
                            value={rowStaff}
                            onChange={(e) => handleItemStaffChange(row.sku, e.target.value)}
                            className="inbound-item-staff-select"
                            title={`Tugaskan staf untuk ${row.name}`}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1.5px solid #d4dec3',
                              background: '#ffffff',
                              color: '#191d17',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              maxWidth: 160,
                            }}
                          >
                            <option value="Semua Staf Lapangan">Semua Staf</option>
                            {staffAccounts
                              .filter((acc) => !['staff', 'staf'].includes(String(acc.fullName || acc.name || '').trim().toLowerCase()))
                              .map((acc) => {
                                const name = acc.fullName || acc.name;
                                return (
                                  <option key={acc.id || name} value={name}>
                                    {name}
                                  </option>
                                );
                              })}
                            {rowStaff && rowStaff !== 'Semua Staf Lapangan' && !['staff', 'staf'].includes(rowStaff.toLowerCase()) && !staffAccounts.some((acc) => (acc.fullName || acc.name) === rowStaff) && (
                              <option value={rowStaff}>{rowStaff}</option>
                            )}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!hasInspected ? (
                            <span className="inbound-status inbound-status-nodata">
                              No Data
                            </span>
                          ) : hasRowIssue ? (
                            <span className="inbound-status inbound-status-issue">
                              Issues
                            </span>
                          ) : (
                            <span className="inbound-status inbound-status-complete">
                              Complete
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="inbound-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                            onClick={() => setSelectedDetailItem(row)}
                            title={`Buka detail barang ${row.sku}`}
                          >
                            <span>🔍 Detail</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!draft.rows.length && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "24px 16px", color: "#64748b" }}>
                        Tidak ada produk tercatat dalam PO ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {hasAnyInspection && issueUnits > 0 && issueBanner}
            <p style={{ margin: '14px 0 0', fontSize: 11, color: '#737b6c' }}>
              Inspection progress saved automatically
            </p>
          </section>
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
                      {["Product", "Accepted", "Barcode Hasil Scan Staf Dok", "Condition", "New stock", "Aksi"].map((label) => (
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
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                              onClick={() => setSelectedDetailItem(row)}
                              title="Klik untuk melihat detail lengkap produk dan rak"
                            >
                              <div className="inventory-thumb" style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }}>
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
                                <div className="inventory-thumb-fallback" style={{ display: rowImg ? 'none' : 'flex' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#737b6c' }}>
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                  </svg>
                                </div>
                              </div>
                              <div>
                                <strong style={{ color: '#191d17', textDecoration: 'underline dotted', cursor: 'pointer' }}>{row.name}</strong>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                              {rowIssues > 0 ? (
                                <span className="critical-text" style={{ fontWeight: 700 }}>
                                  {rowIssues} damaged/rejected
                                </span>
                              ) : (
                                <span className="positive-text">Good condition</span>
                              )}
                              {Number(row.damaged) > 0 && (row.damage_photo || row.evidence_url || shipment.evidence_url || draft.evidence?.length > 0) && (
                                <button
                                  type="button"
                                  className="inbound-photo-pill"
                                  onClick={() => setViewingPhoto({
                                    url: row.damage_photo || row.evidence_url || shipment.evidence_url || draft.evidence?.[0]?.url,
                                    item: row,
                                    shipment,
                                    notes: row.notes || draft.notes,
                                    inspector: shipment.inspector || shipment.staff,
                                  })}
                                  title="Buka foto bukti kerusakan fisik"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    background: '#fdecec',
                                    border: '1px solid #fca5a5',
                                    color: '#8a5a5b',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                    <circle cx="12" cy="13" r="4" />
                                  </svg>
                                  <span>Foto Kerusakan ▾</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="positive-text"><strong>{before} → {before + acceptedUnits(row)}</strong></td>
                          <td>
                            <button
                              type="button"
                              className="inbound-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                              onClick={() => setSelectedDetailItem(row)}
                              title={`Buka detail barang ${row.sku}`}
                            >
                              Detail
                            </button>
                          </td>
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
              <div className="receiving-evidence-box" style={{ background: '#f8f9f5', border: '1px solid #dfe4d9', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <strong style={{ fontSize: 13, color: '#191d17' }}>Evidence & notes</strong>
                  {(shipment.evidence_url || draft.evidence?.length > 0 || totals.damaged > 0) && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#8a5a5b', background: '#fdecec', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>Foto Terlampir</span>
                    </span>
                  )}
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: '#737b6c', lineHeight: 1.4 }}>
                  {draft.notes.trim() ? draft.notes : "Catatan inspeksi fisik dari staf dok penerimaan."}
                </p>

                {/* Dropdown Bukti Foto Kerusakan */}
                {(shipment.evidence_url || draft.evidence?.length > 0 || totals.damaged > 0) && (
                  <details className="evidence-small-dropdown">
                    <summary className="evidence-dropdown-summary">
                      <span className="evidence-dropdown-title">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span>Bukti Foto Kerusakan ({damagedRows.length > 0 ? damagedRows.length : 1})</span>
                      </span>
                      <span className="evidence-dropdown-arrow">▾</span>
                    </summary>
                    <div className="evidence-dropdown-content">
                      {damagedRows.length > 0 ? (
                        damagedRows.map((dRow, idx) => {
                          const rowPhoto = dRow.damage_photo || dRow.evidence_url || shipment.evidence_url || draft.evidence?.[0]?.url;
                          return (
                            <div
                              key={dRow.sku || idx}
                              className="evidence-dropdown-item"
                              onClick={() => setViewingPhoto({
                                url: rowPhoto,
                                item: dRow,
                                shipment,
                                notes: dRow.notes || draft.notes,
                                inspector: shipment.inspector || shipment.staff,
                              })}
                              title="Buka foto besar"
                            >
                              <div className="evidence-dropdown-item-thumb">
                                {resolveEvidenceUrl(rowPhoto) ? (
                                  <img
                                    src={resolveEvidenceUrl(rowPhoto)}
                                    alt="Thumbnail"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                    <circle cx="12" cy="13" r="4" />
                                  </svg>
                                )}
                              </div>
                              <div className="evidence-dropdown-item-info">
                                <strong>{dRow.name}</strong>
                                <small>{dRow.sku} · {dRow.damaged} unit rusak</small>
                              </div>
                              <span className="evidence-dropdown-item-action">
                                Lihat Foto ›
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div
                          className="evidence-dropdown-item"
                          onClick={() => setViewingPhoto({
                            url: shipment.evidence_url || draft.evidence?.[0]?.url || 'FOTO-DOK-INSPECTION',
                            item: null,
                            shipment,
                            notes: draft.notes,
                            inspector: shipment.inspector || shipment.staff,
                          })}
                          title="Buka foto besar"
                        >
                          <div className="evidence-dropdown-item-thumb">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </div>
                          <div className="evidence-dropdown-item-info">
                            <strong>Bukti Foto Dok (Mobile)</strong>
                            <small>{shipment.evidence_url || 'Snapshot Handheld'}</small>
                          </div>
                          <span className="evidence-dropdown-item-action">
                            Lihat Foto ›
                          </span>
                        </div>
                      )}
                    </div>
                  </details>
                )}
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
            ? "Tahap pemeriksaan fisik & verifikasi barcode armada tiba oleh staf dok lapangan"
            : `${totals.accepted} units to be received into inventory`}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {draft.stage === "inspect" && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                color: '#166534',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                lineHeight: 1.3,
              }}
            >
              <span>{isAssigned ? "✓" : "💡"}</span>
              <span>
                {isAssigned
                  ? "Penugasan staf telah disimpan. Sedang menunggu hasil pemeriksaan fisik di mobile."
                  : "Silakan pilih staf pada tabel dan tekan Tugaskan untuk memulai inspeksi di mobile."}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {draft.stage === "inspect" ? (
              <>
                <button
                  type="button"
                  className="inbound-secondary"
                  onClick={onBack}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inbound-primary"
                  disabled={isSubmittingAssign}
                  style={isAssigned ? { background: '#3e5510', borderColor: '#3e5510' } : {}}
                  onClick={handleAssignAll}
                >
                  {isSubmittingAssign ? "Menugaskan..." : isAssigned ? "✓ Ditugaskan" : "Tugaskan"}
                </button>
              </>
            ) : (
              <>
                <button className="inbound-secondary" onClick={onBack}>
                  ← Back
                </button>
                <button
                  className="inbound-primary"
                  disabled={!confirmed || done || isSubmittingComplete}
                  onClick={complete}
                >
                  {isSubmittingComplete ? "Menyimpan ke Inventory..." : done ? "Telah Di-ACC" : "✅ Complete Receiving"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Standardized Success / Confirmation Pop-up Modal matching SUSUNO design */}
      {done && (
        <dialog
          ref={dialogRef}
          className="dashboard-dialog inbound-success-modal"
          aria-labelledby="receiving-success-title"
          onCancel={onBack}
          style={{
            maxWidth: 480,
            padding: "28px 26px 24px",
            borderRadius: 18,
            textAlign: "center",
            boxShadow: "0 20px 48px rgba(24, 35, 14, 0.22)",
            border: "1px solid #dfe4d9",
            position: "relative",
          }}
        >
          <button
            type="button"
            className="inventory-close"
            style={{ position: "absolute", top: 16, right: 18, fontSize: 24, cursor: "pointer", background: "none", border: "none", color: "#737b6c" }}
            onClick={onBack}
            aria-label="Tutup dialog"
          >
            ×
          </button>

          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: "#dcfce7",
              color: "#166534",
              display: "grid",
              placeItems: "center",
              fontSize: 28,
              fontWeight: 800,
              margin: "0 auto 16px",
              boxShadow: "0 4px 12px rgba(22, 101, 52, 0.15)",
            }}
          >
            ✓
          </div>

          <h2
            id="receiving-success-title"
            style={{
              fontSize: 21,
              fontWeight: 800,
              color: "#191d17",
              marginBottom: 8,
              letterSpacing: "-0.3px",
            }}
          >
            Penerimaan Barang Berhasil Disetujui
          </h2>

          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 18px" }}>
            Pengiriman <strong>{shipment.id}</strong> telah diverifikasi dan disetujui (ACC). Sebanyak <strong>+{totals.accepted} unit</strong> telah berhasil ditambahkan ke inventaris transit Dock Staging dan tercatat di riwayat mutasi stok gudang.
          </p>

          {/* Summary Box matching ScheduledShipment & Outbound */}
          <div
            style={{
              background: "#f8f9f5",
              border: "1px solid #dfe4d9",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 20,
              textAlign: "left",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px 14px",
              fontSize: 12,
            }}
          >
            <div>
              <span style={{ display: "block", color: "#737b6c", fontSize: 11, marginBottom: 2 }}>Inbound ID:</span>
              <strong style={{ color: "#191d17" }}>{shipment.id}</strong>
            </div>
            <div>
              <span style={{ display: "block", color: "#737b6c", fontSize: 11, marginBottom: 2 }}>Purchase Order:</span>
              <strong style={{ color: "#191d17" }}>{shipment.po}</strong>
            </div>
            <div>
              <span style={{ display: "block", color: "#737b6c", fontSize: 11, marginBottom: 2 }}>Supplier:</span>
              <strong style={{ color: "#191d17" }}>{shipment.supplier}</strong>
            </div>
            <div>
              <span style={{ display: "block", color: "#737b6c", fontSize: 11, marginBottom: 2 }}>Total Unit Diterima:</span>
              <strong style={{ color: "#166534" }}>+{totals.accepted} unit</strong>
            </div>
            {issueUnits > 0 && (
              <div style={{ gridColumn: "1 / -1", paddingTop: 6, borderTop: "1px dashed #e2e8f0" }}>
                <span style={{ color: "#8a5a5b", fontSize: 11, fontWeight: 600 }}>
                  Perhatian: {issueUnits} unit tercatat issue ({totals.damaged} rusak, {totals.rejected} ditolak) & tidak masuk stok.
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <button
              type="button"
              className="inbound-primary"
              style={{
                width: "100%",
                padding: "12px 18px",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 10,
                cursor: "pointer",
              }}
              onClick={() => onNavigate("inventory")}
            >
              Cek Stok Baru di Master Inventory ›
            </button>
            <button
              type="button"
              className="inbound-secondary"
              style={{
                width: "100%",
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                cursor: "pointer",
                background: "#ffffff",
                border: "1.5px solid #d4dec3",
                color: "#3e5510",
              }}
              onClick={onBack}
            >
              ← Kembali ke Daftar Inbound
            </button>
          </div>
        </dialog>
      )}

      {/* Modal Detail Item Barang (Foto Produk, Rak Masuk, Kuantitas, Barcode) */}
      {selectedDetailItem && (
        <InboundItemDetailModal
          item={selectedDetailItem}
          inventory={inventory}
          shipment={shipment}
          onClose={() => setSelectedDetailItem(null)}
        />
      )}

      {/* Modal Lightbox Bukti Foto Kerusakan Fisik */}
      {viewingPhoto && (
        <dialog
          className="dashboard-dialog evidence-photo-modal-dialog"
          open
          onCancel={() => setViewingPhoto(null)}
        >
          <div className="evidence-photo-modal-header">
            <div>
              <span className="evidence-photo-modal-tag">
                Bukti Foto Kerusakan Fisik
              </span>
              <h3 className="evidence-photo-modal-title">
                {viewingPhoto.item?.name || shipment.id} {viewingPhoto.item?.sku ? `(${viewingPhoto.item.sku})` : ''}
              </h3>
            </div>
            <button
              type="button"
              className="evidence-photo-modal-close"
              onClick={() => setViewingPhoto(null)}
              aria-label="Tutup bukti foto"
            >
              ✕
            </button>
          </div>

          <div className="evidence-photo-modal-body">
            {/* Foto Container */}
            <div className="evidence-photo-frame">
              {resolveEvidenceUrl(viewingPhoto.url) ? (
                <img
                  src={resolveEvidenceUrl(viewingPhoto.url)}
                  alt="Bukti foto kerusakan fisik"
                  className="evidence-photo-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="evidence-photo-empty"
                style={{ display: resolveEvidenceUrl(viewingPhoto.url) ? "none" : "flex" }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <strong>Belum Ada Berkas Foto Terunggah</strong>
                <p>Dokumen fisik tersimpan pada sistem pencatatan dok {shipment.dock || 'D-01'}.</p>
              </div>
            </div>

            {/* Metadata Kerusakan */}
            <div className="evidence-meta-grid">
              <div className="evidence-meta-card">
                <span className="evidence-meta-label">Unit Rusak / Kendala:</span>
                <strong className="evidence-meta-val val-issue">
                  {viewingPhoto.item?.damaged ? `${viewingPhoto.item.damaged} ${viewingPhoto.item.unit || 'unit'}` : `${totals.damaged} unit`}
                </strong>
              </div>
              <div className="evidence-meta-card">
                <span className="evidence-meta-label">Pemeriksa Lapangan:</span>
                <strong className="evidence-meta-val">
                  {viewingPhoto.inspector || shipment.inspector || shipment.staff || 'Staf Dok'}
                </strong>
              </div>
              <div className="evidence-meta-card">
                <span className="evidence-meta-label">Dok / PO Terkait:</span>
                <strong className="evidence-meta-val val-dock">
                  Dok {shipment.dock || 'D-01'} · PO {shipment.po}
                </strong>
              </div>
              <div className="evidence-meta-card">
                <span className="evidence-meta-label">Disposisi Penanganan:</span>
                <strong className="evidence-meta-val">
                  Karantina Dok / Retur Supplier
                </strong>
              </div>
            </div>

            {/* Catatan Lapangan */}
            {(viewingPhoto.notes || draft.notes) && (
              <div className="evidence-notes-card">
                <strong className="evidence-notes-title">
                  Catatan Kerusakan dari Dok:
                </strong>
                <p className="evidence-notes-desc">
                  {viewingPhoto.notes || draft.notes}
                </p>
              </div>
            )}
          </div>

          <div className="evidence-photo-modal-footer">
            {resolveEvidenceUrl(viewingPhoto.url) ? (
              <a
                href={resolveEvidenceUrl(viewingPhoto.url)}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: "#5c732b", fontWeight: 600, textDecoration: "underline" }}
              >
                Buka Resolusi Penuh di Tab Baru
              </a>
            ) : <span />}
            <button
              type="button"
              className="inbound-secondary"
              onClick={() => setViewingPhoto(null)}
              style={{ padding: "7px 16px", fontSize: 12 }}
            >
              Tutup
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}

export {
  InboundReceiving as default
};
