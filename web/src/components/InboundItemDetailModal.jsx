import React, { useEffect, useRef, useState } from "react";
import { typeOf } from "../utils/productTypes.js";
import "../styles/scheduled.css";

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

export default function InboundItemDetailModal({ item, inventory = [], shipment, onClose }) {
  const dialogRef = useRef(null);
  const [showPhotoZoom, setShowPhotoZoom] = useState(false);

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  function handleClose() {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    onClose();
  }

  if (!item) return null;

  // Temukan data komprehensif dari Master Inventory
  const invItem = (inventory || []).find(
    (inv) => inv.sku === item.sku || inv.sku === item.code || inv.name === item.name
  );

  const imageUrl = item.image_url || invItem?.image_url || null;
  const targetRack = item.rack || invItem?.rack || "Dock Staging (Menunggu Putaway)";
  const category = item.category || invItem?.category || typeOf(item) || "General";
  const unit = item.unit || invItem?.unit || "pcs";
  const assignedStaff = item.assigned_staff || item.staff || shipment?.staff || shipment?.assigned_staff || "Semua Staf Lapangan";
  const barcodes = Array.isArray(item.barcodes) ? item.barcodes : [];

  const orderedQty = Number(item.ordered ?? item.quantity ?? 1);
  const receivedQty = item.received !== undefined ? Number(item.received) : null;
  const damagedQty = Number(item.damaged || 0);
  const rejectedQty = Number(item.rejected || 0);
  const acceptedQty = receivedQty !== null ? Math.max(0, receivedQty - damagedQty - rejectedQty) : null;

  const damagePhotoToken = item.damage_photo || item.evidence_url || (damagedQty > 0 ? (shipment?.evidence_url || shipment?.evidence?.[0]?.url || 'FOTO-DOK-INSPECTION') : null);
  const evidencePhotoUrl = resolveEvidenceUrl(damagePhotoToken);

  return (
    <dialog
      ref={dialogRef}
      className="dashboard-dialog inbound-item-detail-dialog"
      aria-labelledby="inbound-item-detail-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
    >
      <div className="inbound-item-detail-header">
        <div>
          <span className="inbound-item-detail-tag">DETAIL BARANG INBOUND</span>
          <h2 id="inbound-item-detail-title">{item.name || "Detail Produk"}</h2>
          <span className="inbound-item-detail-sku">SKU: {item.sku || item.code}</span>
        </div>
        <button
          type="button"
          className="scheduled-close"
          aria-label="Tutup detail barang"
          onClick={handleClose}
        >
          ×
        </button>
      </div>

      <div className="inbound-item-detail-body">
        {/* Kolom Kiri: Foto Produk & Status Rak */}
        <div className="inbound-item-detail-media">
          <div className="inbound-item-photo-card">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.name}
                className="inbound-item-photo-img"
                onError={(e) => {
                  e.target.style.display = "none";
                  if (e.target.nextElementSibling) {
                    e.target.nextElementSibling.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <div
              className="inbound-item-photo-fallback"
              style={{ display: imageUrl ? "none" : "flex" }}
            >
              <span className="inbound-item-photo-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </span>
              <span className="inbound-item-photo-caption">Belum ada foto produk</span>
            </div>
          </div>

          {/* Badge Info Rak Lokasi */}
          <div className="inbound-rack-info-badge">
            <span className="inbound-rack-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#166534' }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <div>
              <strong className="inbound-rack-title">Lokasi Rak Target:</strong>
              <span className="inbound-rack-val">{targetRack}</span>
              <p className="inbound-rack-hint">
                Barang yang diterima dicatat transit di Dock Staging sebelum penataan rak melalui Putaway.
              </p>
            </div>
          </div>

          {/* Staf Bertugas */}
          <div className="inbound-assigned-staff-badge">
            <span className="inbound-staff-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#737b6c' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <div>
              <span className="inbound-staff-label">Staf Dok Ditugaskan:</span>
              <strong className="inbound-staff-name">{assignedStaff}</strong>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Detail Spesifikasi & Kuantitas Fisik */}
        <div className="inbound-item-detail-info">
          {/* Ringkasan Metadata */}
          <div className="inbound-spec-grid">
            <div className="inbound-spec-box">
              <span className="inbound-spec-label">Kategori / Tipe</span>
              <strong className="inbound-spec-value">{category}</strong>
            </div>
            <div className="inbound-spec-box">
              <span className="inbound-spec-label">Satuan Unit</span>
              <strong className="inbound-spec-value">{unit.toUpperCase()}</strong>
            </div>
            <div className="inbound-spec-box">
              <span className="inbound-spec-label">No. Pengiriman</span>
              <strong className="inbound-spec-value">{shipment?.id || "—"}</strong>
            </div>
            <div className="inbound-spec-box">
              <span className="inbound-spec-label">Purchase Order</span>
              <strong className="inbound-spec-value">{shipment?.po || "—"}</strong>
            </div>
          </div>

          {/* Status Kuantitas Fisik */}
          <div className="inbound-qty-breakdown">
            <h3 className="inbound-section-heading">Rincian Kuantitas Fisik</h3>
            <div className="inbound-qty-cards">
              <div className="inbound-qty-card card-ordered">
                <span>Dipesan (PO)</span>
                <strong>{orderedQty} {unit}</strong>
              </div>
              <div className="inbound-qty-card card-received">
                <span>Diterima Fisik</span>
                <strong>{receivedQty !== null ? `${receivedQty} ${unit}` : "Menunggu Cek"}</strong>
              </div>
              <div className={`inbound-qty-card ${damagedQty > 0 || rejectedQty > 0 ? "card-issues" : "card-good"}`}>
                <span>Kondisi Rusak/Tolak</span>
                <strong>{damagedQty + rejectedQty} {unit}</strong>
              </div>
              <div className="inbound-qty-card card-accepted">
                <span>Siap Masuk Stok (ACC)</span>
                <strong>{acceptedQty !== null ? `${acceptedQty} ${unit}` : "—"}</strong>
              </div>
            </div>
          </div>

          {/* Seksi Bukti Foto Kerusakan Fisik */}
          {(damagedQty > 0 || (item.damage_photo && item.damage_photo !== '')) && (
            <div className="inbound-damage-evidence-box">
              <div className="inbound-damage-evidence-head">
                <span className="inbound-damage-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8a5a5b' }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>BUKTI FOTO KERUSAKAN FISIK ({damagedQty} {unit.toUpperCase()} RUSAK)</span>
                </span>
                <span className="inbound-damage-inspector-badge">
                  Pemeriksa: {assignedStaff}
                </span>
              </div>
              <div
                className="inbound-damage-evidence-card"
                onClick={() => setShowPhotoZoom(true)}
                title="Buka bukti foto kerusakan"
              >
                <div className="inbound-damage-thumb">
                  {evidencePhotoUrl ? (
                    <img
                      src={evidencePhotoUrl}
                      alt="Bukti foto kerusakan fisik"
                      className="inbound-damage-thumb-img"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : null}
                  <div className="inbound-damage-thumb-fallback" style={{ display: evidencePhotoUrl ? 'none' : 'grid' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#737b6c' }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                </div>
                <div className="inbound-damage-meta">
                  <strong>Foto Bukti Fisik Lapangan</strong>
                  <span className="inbound-damage-token">{damagePhotoToken}</span>
                  <p className="inbound-damage-hint">
                    Terekam langsung melalui kamera handheld dok staf saat pemeriksaan fisik.
                  </p>
                </div>
                <button type="button" className="inbound-damage-zoom-btn">
                  Perbesar Foto
                </button>
              </div>
            </div>
          )}

          {/* Barcode Fisik Yang Terscan */}
          {barcodes.length > 0 && (
            <div className="inbound-barcodes-section">
              <div className="inbound-barcodes-header">
                <span className="inbound-section-heading">
                  Barcode Fisik Unit ({barcodes.length} Unit Terscan)
                </span>
              </div>
              <div className="inbound-barcodes-chip-list">
                {barcodes.map((bc, idx) => (
                  <span key={idx} className="barcode-badge-item" title={`Barcode fisik unit ke-${idx + 1}`}>
                    ║▌║ {bc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Catatan / Keterangan */}
          {invItem?.description || item.notes ? (
            <div className="inbound-notes-box">
              <span className="inbound-notes-label">Keterangan / Spesifikasi:</span>
              <p className="inbound-notes-content">
                {invItem?.description || item.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="inbound-item-detail-footer">
        <button
          type="button"
          className="inbound-secondary"
          onClick={handleClose}
        >
          Tutup
        </button>
      </div>

      {/* Lightbox Zoom Foto Bukti Kerusakan */}
      {showPhotoZoom && (
        <dialog
          className="dashboard-dialog evidence-photo-modal-dialog"
          open
          onCancel={() => setShowPhotoZoom(false)}
        >
          <div className="evidence-photo-modal-header">
            <div>
              <span className="evidence-photo-modal-tag">
                Bukti Foto Kerusakan Fisik
              </span>
              <h3 className="evidence-photo-modal-title">
                {item.name} ({item.sku || item.code})
              </h3>
            </div>
            <button
              type="button"
              className="evidence-photo-modal-close"
              onClick={() => setShowPhotoZoom(false)}
              aria-label="Tutup foto"
            >
              ✕
            </button>
          </div>

          <div className="evidence-photo-modal-body">
            <div className="evidence-photo-frame">
              {evidencePhotoUrl ? (
                <img
                  src={evidencePhotoUrl}
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
                style={{ display: evidencePhotoUrl ? "none" : "flex" }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <strong>Belum Ada Berkas Foto Terunggah</strong>
                <p>Dokumen fisik unit tercatat pada sistem dok penerimaan.</p>
              </div>
            </div>

            <div className="evidence-meta-grid">
              <div className="evidence-meta-card">
                <span className="evidence-meta-label">Jumlah Rusak:</span>
                <strong className="evidence-meta-val val-issue">{damagedQty} {unit}</strong>
              </div>
              <div className="evidence-meta-card">
                <span className="evidence-meta-label">Pemeriksa Lapangan:</span>
                <strong className="evidence-meta-val">{assignedStaff}</strong>
              </div>
            </div>
          </div>

          <div className="evidence-photo-modal-footer">
            {evidencePhotoUrl ? (
              <a
                href={evidencePhotoUrl}
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
              onClick={() => setShowPhotoZoom(false)}
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              Tutup
            </button>
          </div>
        </dialog>
      )}
    </dialog>
  );
}
