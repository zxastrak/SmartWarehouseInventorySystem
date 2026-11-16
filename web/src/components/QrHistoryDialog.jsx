import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { getQrHistory, deleteQrEvent, clearQrHistory, formatQrDate } from "../utils/qrHistory.js";

export default function QrHistoryDialog({ onClose, onSelectQr }) {
  const dialogRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [filterType, setFilterType] = useState("ALL"); // 'ALL' | 'RACK' | 'INBOUND_ITEM'
  const [query, setQuery] = useState("");
  const [previewQr, setPreviewQr] = useState(null); // { item, url }

  async function loadHistory() {
    const data = await getQrHistory();
    setHistory(data);
  }

  useEffect(() => {
    dialogRef.current?.showModal();
    loadHistory();
  }, []);

  function handleFilter(type) {
    setFilterType(type);
  }

  async function handleDelete(id, e) {
    if (e) e.stopPropagation();
    await deleteQrEvent(id);
    await loadHistory();
  }

  async function handleClearAll() {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh riwayat aktivitas QR Code dari database?")) {
      await clearQrHistory();
      setHistory([]);
      setPreviewQr(null);
    }
  }

  async function handleQuickPreview(item, e) {
    if (e) e.stopPropagation();
    try {
      const url = await QRCode.toDataURL(item.code, {
        width: 240,
        margin: 1,
        color: { dark: "#191d17", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      setPreviewQr({ item, url });
    } catch (err) {
      console.error("Gagal generate preview QR:", err);
    }
  }

  const filtered = history.filter((item) => {
    const matchType = filterType === "ALL" || item.type === filterType;
    const matchQuery =
      !query ||
      `${item.code} ${item.name} ${item.actionLabel} ${JSON.stringify(item.details)}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchType && matchQuery;
  });

  const countRack = history.filter((i) => i.type === "RACK").length;
  const countInbound = history.filter((i) => i.type === "INBOUND_ITEM").length;
  const countPrint = history.filter((i) => i.action === "PRINT").length;

  return (
    <dialog
      ref={dialogRef}
      className="dashboard-dialog qr-history-dialog"
      onCancel={onClose}
      aria-labelledby="qr-history-title"
    >
      <div className="qr-history-content">
        {/* Header Dialog */}
        <div className="qr-history-header no-print">
          <div>
            <h2 id="qr-history-title" style={{ margin: 0, fontSize: "18px", color: "var(--brand-ink, #191d17)" }}>
              📜 Riwayat Aktivitas & Cetak QR Code
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--brand-muted, #737b6c)" }}>
              Log riwayat pembuatan, pencetakan fisik, dan pengunduhan label QR tersimpan di MySQL Database.
            </p>
          </div>
          <button
            type="button"
            className="inventory-close"
            onClick={onClose}
            aria-label="Tutup dialog riwayat QR"
          >
            ×
          </button>
        </div>

        {/* Ringkasan Metrik Mini */}
        <div className="qr-history-metrics">
          <div className="qr-metric-card">
            <span>Total Log</span>
            <strong>{history.length}</strong>
          </div>
          <div className="qr-metric-card">
            <span>Cetak Fisik</span>
            <strong style={{ color: "var(--brand-olive, #5c732b)" }}>{countPrint}</strong>
          </div>
          <div className="qr-metric-card">
            <span>QR Rak</span>
            <strong>{countRack}</strong>
          </div>
          <div className="qr-metric-card">
            <span>QR Barang Inbound</span>
            <strong>{countInbound}</strong>
          </div>
        </div>

        {/* Filter Bar & Tabs */}
        <div className="qr-history-filter-bar">
          <div className="qr-history-tabs" role="tablist">
            <button
              type="button"
              className={filterType === "ALL" ? "active" : ""}
              onClick={() => handleFilter("ALL")}
            >
              Semua ({history.length})
            </button>
            <button
              type="button"
              className={filterType === "RACK" ? "active" : ""}
              onClick={() => handleFilter("RACK")}
            >
              🏁 Rak ({countRack})
            </button>
            <button
              type="button"
              className={filterType === "INBOUND_ITEM" ? "active" : ""}
              onClick={() => handleFilter("INBOUND_ITEM")}
            >
              🏷️ Barang Inbound ({countInbound})
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
            <input
              type="search"
              placeholder="Cari kode, nama, atau PO..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="qr-history-search"
            />
            {history.length > 0 && (
              <button
                type="button"
                className="dashboard-link"
                style={{ fontSize: "12px", color: "#dc2626" }}
                onClick={handleClearAll}
                title="Hapus semua riwayat"
              >
                Bersihkan Riwayat
              </button>
            )}
          </div>
        </div>

        {/* Tabel Riwayat */}
        <div className="qr-history-table-wrap">
          {filtered.length === 0 ? (
            <div className="qr-history-empty">
              <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>📭</span>
              <p>Belum ada riwayat aktivitas QR Code yang sesuai.</p>
            </div>
          ) : (
            <table className="qr-history-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Kategori</th>
                  <th>Kode / SKU</th>
                  <th>Keterangan & Metadata</th>
                  <th>Aksi Terakhir</th>
                  <th style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isRack = row.type === "RACK";
                  return (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "12px", color: "#64748b" }}>
                        {formatQrDate(row.timestamp)}
                      </td>
                      <td>
                        <span className={`qr-type-badge ${isRack ? "badge-rack" : "badge-inbound"}`}>
                          {isRack ? "🏁 Rak Fisik" : "🏷️ Barang Inbound"}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontFamily: "monospace", fontSize: "13px", color: "#191d17" }}>
                          {isRack ? row.code : `║▌║ ${row.code}`}
                        </strong>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <strong style={{ fontSize: "12.5px", color: "#191d17" }}>{row.name}</strong>
                          <span style={{ fontSize: "11px", color: "#737b6c" }}>
                            {isRack
                              ? `${row.details.zone || "Zone"} • ${row.details.warehouse || "Main Warehouse"}`
                              : `Inbound: ${row.details.shipmentId || "-"} • PO: ${row.details.po || "-"} • Dok: ${row.details.dock || "-"}`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`qr-action-badge ${
                            row.action === "PRINT"
                              ? "action-print"
                              : row.action === "DOWNLOAD"
                              ? "action-download"
                              : "action-generate"
                          }`}
                        >
                          {row.action === "PRINT"
                            ? "🖨️ Dicetak"
                            : row.action === "DOWNLOAD"
                            ? "⬇️ Diunduh"
                            : "⚡ Digenerate"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          <button
                            type="button"
                            className="dashboard-link"
                            style={{
                              padding: "4px 8px",
                              fontSize: "11.5px",
                              border: "1px solid #dfe4d9",
                              borderRadius: "6px",
                              background: "#f8fafc",
                            }}
                            onClick={(e) => handleQuickPreview(row, e)}
                            title="Pratinjau QR Code ini"
                          >
                            Lihat QR
                          </button>
                          {onSelectQr && (
                            <button
                              type="button"
                              className="dashboard-link"
                              style={{
                                padding: "4px 8px",
                                fontSize: "11.5px",
                                border: "1px solid #5c732b",
                                borderRadius: "6px",
                                background: "#f0fdf4",
                                color: "#166534",
                                fontWeight: 700,
                              }}
                              onClick={() => {
                                onSelectQr(row);
                                onClose();
                              }}
                              title="Buka generator dialog untuk kode ini"
                            >
                              Cetak Ulang
                            </button>
                          )}
                          <button
                            type="button"
                            className="dashboard-link"
                            style={{ padding: "4px 6px", fontSize: "12px", color: "#94a3b8" }}
                            onClick={(e) => handleDelete(row.id, e)}
                            title="Hapus baris ini dari riwayat"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Mini Preview QR */}
        {previewQr && (
          <div className="qr-quick-preview-overlay" onClick={() => setPreviewQr(null)}>
            <div className="qr-quick-preview-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <strong style={{ fontSize: "14px", color: "#191d17" }}>
                  {previewQr.item.type === "RACK" ? "🏁 QR Rak" : "🏷️ QR Barang"}
                </strong>
                <button
                  type="button"
                  className="inventory-close"
                  onClick={() => setPreviewQr(null)}
                >
                  ×
                </button>
              </div>
              <img src={previewQr.url} alt={`QR Code ${previewQr.item.code}`} style={{ width: "200px", height: "200px", display: "block", margin: "0 auto" }} />
              <div style={{ textAlign: "center", marginTop: "10px" }}>
                <strong style={{ fontFamily: "monospace", fontSize: "16px", color: "#191d17" }}>
                  {previewQr.item.code}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                  {previewQr.item.name}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "14px" }}>
                <button
                  type="button"
                  className="inbound-secondary"
                  style={{ height: "34px", padding: "0 12px", fontSize: "12px" }}
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = previewQr.url;
                    a.download = `QR-${previewQr.item.code}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  ⬇️ Unduh PNG
                </button>
                <button
                  type="button"
                  className="inbound-primary"
                  style={{ height: "34px", padding: "0 14px", fontSize: "12px" }}
                  onClick={() => window.print()}
                >
                  🖨️ Cetak
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Dialog */}
        <div className="qr-history-footer no-print">
          <small style={{ color: "#737b6c" }}>
            Data riwayat tersimpan langsung di tabel <code>qr_histories</code> database MySQL sistem SUSUNO.
          </small>
          <button type="button" className="inbound-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </dialog>
  );
}
