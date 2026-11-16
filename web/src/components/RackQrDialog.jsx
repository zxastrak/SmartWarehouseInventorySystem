import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { recordQrEvent } from "../utils/qrHistory.js";
import QrHistoryDialog from "./QrHistoryDialog.jsx";

export default function RackQrDialog({
  rack: initialRack = "RACK-A1-01-A",
  zone: initialZone = "Zone A",
  productName = "",
  sku = "",
  warehouseName = "Main Warehouse",
  allRacks = [],
  onClose,
}) {
  const [rack, setRack] = useState(initialRack || "RACK-A1-01-A");
  const [zone, setZone] = useState(initialZone || "Zone A");
  const [qrUrl, setQrUrl] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (!rack) return;
    const cleanRack = rack.trim().toUpperCase();
    QRCode.toDataURL(cleanRack, {
      width: 320,
      margin: 1,
      color: {
        dark: "#191d17",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        setQrUrl(url);
        recordQrEvent({
          type: "RACK",
          code: cleanRack,
          name: productName || `Lokasi Rak ${cleanRack}`,
          action: "GENERATE",
          details: { zone, warehouse: warehouseName, sku },
        });
      })
      .catch((err) => console.error("Gagal generate QR Code Rak:", err));
  }, [rack]);

  function handlePrint() {
    const cleanRack = rack.trim().toUpperCase();
    recordQrEvent({
      type: "RACK",
      code: cleanRack,
      name: productName || `Lokasi Rak ${cleanRack}`,
      action: "PRINT",
      details: { zone, warehouse: warehouseName, sku },
    });
    window.print();
  }

  function handleDownload() {
    if (!qrUrl) return;
    const cleanRack = rack.trim().toUpperCase();
    recordQrEvent({
      type: "RACK",
      code: cleanRack,
      name: productName || `Lokasi Rak ${cleanRack}`,
      action: "DOWNLOAD",
      details: { zone, warehouse: warehouseName, sku },
    });
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `QR-RAK-${cleanRack.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <dialog
      ref={dialogRef}
      className="dashboard-dialog rack-qr-dialog"
      onCancel={onClose}
      aria-labelledby="rack-qr-title"
    >
      <div className="rack-qr-modal-content">
        <div className="rack-qr-header no-print">
          <div>
            <h2 id="rack-qr-title" style={{ margin: 0, fontSize: "18px", color: "var(--brand-ink, #191d17)" }}>
              🏁 Generator QR Code Rak Gudang
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--brand-muted, #737b6c)" }}>
              Cetak label barcode/QR untuk ditempel fisik pada rak penyimpanan gudang.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="dashboard-link"
              style={{
                fontSize: "12px",
                border: "1px solid #dfe4d9",
                borderRadius: "8px",
                padding: "6px 12px",
                background: "#f8fafc",
                fontWeight: 600,
              }}
              onClick={() => setShowHistory(true)}
              title="Lihat riwayat aktivitas & cetak QR"
            >
              📜 Riwayat QR
            </button>
            <button
              type="button"
              className="inventory-close"
              onClick={onClose}
              aria-label="Tutup dialog QR rak"
            >
              ×
            </button>
          </div>
        </div>

        {/* Form Selector Rak (Hanya Tampil di Layar, Sembunyi Saat Print) */}
        <div className="rack-qr-selector-box no-print" style={{ margin: "14px 0", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {allRacks.length > 0 && (
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              <span>Pilih Dari Rak Tersedia:</span>
              <select
                value={rack}
                onChange={(e) => {
                  setRack(e.target.value);
                  const clean = e.target.value.replace("RACK-", "");
                  const z = clean.length > 0 ? `Zone ${clean[0].toUpperCase()}` : "Zone A";
                  setZone(z);
                }}
                style={{ height: "36px", borderRadius: "8px", border: "1px solid #dfe4d9", padding: "0 10px", fontSize: "13px" }}
              >
                {allRacks.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600, flex: 1, minWidth: "160px" }}>
            <span>Kode Rak Kustom:</span>
            <input
              type="text"
              value={rack}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setRack(val);
                const clean = val.replace("RACK-", "");
                const z = clean.length > 0 ? `Zone ${clean[0].toUpperCase()}` : "Zone A";
                setZone(z);
              }}
              placeholder="Contoh: RACK-A1-01-A"
              style={{ height: "36px", borderRadius: "8px", border: "1px solid #dfe4d9", padding: "0 10px", fontSize: "13px", fontFamily: "monospace" }}
            />
          </label>
        </div>

        {/* PRATINJAU KARTU LABEL RAK (Printable Area) */}
        <div className="rack-qr-printable-wrapper" id="printable-rack-label">
          <div className="rack-qr-card">
            <div className="rack-qr-card-header">
              <span className="rack-qr-brand">SUSUNO WAREHOUSE SYSTEM</span>
              <span className="rack-qr-badge">{warehouseName}</span>
            </div>

            <div className="rack-qr-body">
              <div className="rack-qr-image-wrap">
                {qrUrl ? (
                  <img src={qrUrl} alt={`QR Code ${rack}`} className="rack-qr-img" />
                ) : (
                  <div className="rack-qr-placeholder">Membuat QR Code...</div>
                )}
              </div>

              <div className="rack-qr-info">
                <span className="rack-qr-caption">LOKASI RAK FISIK</span>
                <strong className="rack-qr-code">{rack}</strong>
                <div className="rack-qr-meta-grid">
                  <div>
                    <small>ZONA GUDANG</small>
                    <span>{zone}</span>
                  </div>
                  {sku && (
                    <div>
                      <small>KODE SKU BARANG</small>
                      <span style={{ fontFamily: "monospace" }}>║▌║ {sku}</span>
                    </div>
                  )}
                </div>
                {productName && (
                  <p className="rack-qr-product-name" title={productName}>
                    Barang: <strong>{productName}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="rack-qr-footer">
              <small>Pindai QR ini melalui menu Putaway / Dispatching di aplikasi mobile SUSUNO</small>
            </div>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="rack-qr-actions no-print" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
          <button type="button" className="inbound-secondary" onClick={() => setShowHistory(true)}>
            📜 Riwayat
          </button>
          <button type="button" className="inbound-secondary" onClick={onClose}>
            Tutup
          </button>
          <button type="button" className="inbound-secondary" onClick={handleDownload} disabled={!qrUrl}>
            ⬇️ Unduh Gambar QR (PNG)
          </button>
          <button type="button" className="inbound-primary" onClick={handlePrint} disabled={!qrUrl}>
            🖨️ Cetak Label Rak (Print)
          </button>
        </div>
      </div>

      {showHistory && (
        <QrHistoryDialog
          onClose={() => setShowHistory(false)}
          onSelectQr={(item) => {
            if (item.type === "RACK") {
              setRack(item.code);
            }
          }}
        />
      )}
    </dialog>
  );
}
