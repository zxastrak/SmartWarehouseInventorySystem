import React, { useEffect, useRef } from "react";
import { typeOf } from "../utils/productTypes.js";
import "../styles/scheduled.css";

export default function InboundItemDetailModal({ item, inventory = [], shipment, onClose }) {
  const dialogRef = useRef(null);

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
              <span className="inbound-item-photo-icon">📦</span>
              <span className="inbound-item-photo-caption">Belum ada foto produk</span>
            </div>
          </div>

          {/* Badge Info Rak Lokasi */}
          <div className="inbound-rack-info-badge">
            <span className="inbound-rack-icon">📍</span>
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
            <span className="inbound-staff-icon">👤</span>
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

          {/* Barcode Fisik Yang Terscan */}
          {barcodes.length > 0 && (
            <div className="inbound-barcodes-section">
              <div className="inbound-barcodes-header">
                <span className="inbound-section-heading">
                  📱 Barcode Fisik Unit ({barcodes.length} Unit Terscan)
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
    </dialog>
  );
}
