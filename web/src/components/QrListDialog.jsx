import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { getQrHistory, recordQrEvent, deleteQrEvent, clearQrHistory, formatQrDate } from "../utils/qrHistory.js";

// 10 Fixed Rak Default SUSUNO
const DEFAULT_RACKS = [
  { code: "A1", zone: "Zone A" },
  { code: "A2", zone: "Zone A" },
  { code: "A3", zone: "Zone A" },
  { code: "A4", zone: "Zone A" },
  { code: "A5", zone: "Zone A" },
  { code: "A6", zone: "Zone A" },
  { code: "A7", zone: "Zone A" },
  { code: "A8", zone: "Zone A" },
  { code: "A9", zone: "Zone A" },
  { code: "A10", zone: "Zone A" },
];

export default function QrListDialog({
  items = [],
  warehouseName = "Main Warehouse",
  onClose,
}) {
  const dialogRef = useRef(null);
  const [activeTab, setActiveTab] = useState("RACKS"); // 'RACKS' (default) | 'PRODUCTS' | 'HISTORY'
  const [query, setQuery] = useState("");
  const [previewQr, setPreviewQr] = useState(null); // { type, code, name, zone, sku, details, url }
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("ALL"); // 'ALL' | 'RACK' | 'INBOUND_ITEM'
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    // Inisialisasi preview QR untuk rak pertama secara instan jika diinginkan
  }, []);

  async function loadHistoryData() {
    setLoadingHistory(true);
    try {
      const data = await getQrHistory();
      setHistory(data);
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setQuery("");
    if (tab === "HISTORY") {
      loadHistoryData();
    }
  }

  // Buka preview modal & generate QR
  async function handleShowQr({ type, code, name = "", zone = "Zone A", sku = "", details = {} }) {
    const cleanCode = (code || "").trim().toUpperCase();
    try {
      const url = await QRCode.toDataURL(cleanCode, {
        width: 320,
        margin: 1,
        color: { dark: "#191d17", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });

      setPreviewQr({
        type,
        code: cleanCode,
        name: name || (type === "RACK" ? `Lokasi Rak ${cleanCode}` : cleanCode),
        zone,
        sku,
        details,
        url,
      });

      // Catat event GENERATE ke audit log database
      recordQrEvent({
        type: type === "RACK" ? "RACK" : "INBOUND_ITEM",
        code: cleanCode,
        name: name || (type === "RACK" ? `Lokasi Rak ${cleanCode}` : cleanCode),
        action: "GENERATE",
        details: { zone, warehouse: warehouseName, sku, ...details },
      });
    } catch (err) {
      console.error("Gagal generate QR Code:", err);
    }
  }

  function handlePrintPreview() {
    if (!previewQr) return;
    recordQrEvent({
      type: previewQr.type === "RACK" ? "RACK" : "INBOUND_ITEM",
      code: previewQr.code,
      name: previewQr.name,
      action: "PRINT",
      details: { zone: previewQr.zone, warehouse: warehouseName, sku: previewQr.sku, ...previewQr.details },
    });
    window.print();
  }

  function handleDownloadPreview() {
    if (!previewQr?.url) return;
    recordQrEvent({
      type: previewQr.type === "RACK" ? "RACK" : "INBOUND_ITEM",
      code: previewQr.code,
      name: previewQr.name,
      action: "DOWNLOAD",
      details: { zone: previewQr.zone, warehouse: warehouseName, sku: previewQr.sku, ...previewQr.details },
    });
    const a = document.createElement("a");
    a.href = previewQr.url;
    a.download = `QR-${previewQr.type}-${previewQr.code.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Riwayat Handlers
  async function handleDeleteHistory(id, e) {
    if (e) e.stopPropagation();
    await deleteQrEvent(id);
    await loadHistoryData();
  }

  async function handleClearAllHistory() {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh log riwayat aktivitas QR Code dari database?")) {
      await clearQrHistory();
      setHistory([]);
    }
  }

  // Map produk yang terisi di tiap rak
  const rackProductsMap = {};
  for (const item of items) {
    const r = (item.rack || "").trim().toUpperCase();
    if (r) {
      if (!rackProductsMap[r]) rackProductsMap[r] = [];
      rackProductsMap[r].push(item);
    }
  }

  // Filter List Rak Default
  const filteredRacks = DEFAULT_RACKS.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const prods = rackProductsMap[r.code] || [];
    const prodsMatch = prods.some(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
    return r.code.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q) || prodsMatch;
  });

  // Filter List Produk
  const filteredProducts = items.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.sku || "").toLowerCase().includes(q) ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.rack || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    );
  });

  // Filter Riwayat
  const filteredHistory = history.filter((item) => {
    const matchType = historyFilter === "ALL" || item.type === historyFilter;
    const matchQuery =
      !query ||
      `${item.code} ${item.name} ${item.actionLabel} ${JSON.stringify(item.details)}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchType && matchQuery;
  });

  return (
    <dialog
      ref={dialogRef}
      className="dashboard-dialog qr-history-dialog qr-list-dialog"
      onCancel={onClose}
      aria-labelledby="qr-list-title"
    >
      <div className="qr-history-content">
        {/* Header Dialog */}
        <div className="qr-history-header no-print">
          <div>
            <h2 id="qr-list-title" style={{ margin: 0, fontSize: "19px", color: "var(--brand-ink, #191d17)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📋</span> List QR Code Gudang
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--brand-muted, #737b6c)" }}>
              Daftar QR Code default untuk 10 fixed rak gudang (A1–A10), produk inventaris, dan cetak label cepat.
            </p>
          </div>
          <button
            type="button"
            className="inventory-close"
            onClick={onClose}
            aria-label="Tutup dialog QR"
          >
            ×
          </button>
        </div>

        {/* Tab Navigasi Utama */}
        <div className="qr-history-filter-bar no-print" style={{ borderBottom: "1.5px solid #e2e8f0", paddingBottom: "10px" }}>
          <div className="qr-history-tabs" role="tablist">
            <button
              type="button"
              className={activeTab === "RACKS" ? "active" : ""}
              onClick={() => handleTabChange("RACKS")}
              style={{ fontWeight: 700 }}
            >
              🏁 Default Rak (A1–A10)
            </button>
            <button
              type="button"
              className={activeTab === "PRODUCTS" ? "active" : ""}
              onClick={() => handleTabChange("PRODUCTS")}
              style={{ fontWeight: 700 }}
            >
              📦 Produk Inventaris ({items.length})
            </button>
            <button
              type="button"
              className={activeTab === "HISTORY" ? "active" : ""}
              onClick={() => handleTabChange("HISTORY")}
              style={{ fontWeight: 700 }}
            >
              📜 Riwayat Cetak
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
            <input
              type="search"
              placeholder={
                activeTab === "RACKS"
                  ? "Cari kode rak (A1-A10) atau barang..."
                  : activeTab === "PRODUCTS"
                  ? "Cari SKU, nama produk, atau rak..."
                  : "Cari log riwayat cetak..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="qr-history-search"
              style={{ maxWidth: 300 }}
            />
          </div>
        </div>

        {/* ===================== TAB 1: DEFAULT RAK (A1 - A10) ===================== */}
        {activeTab === "RACKS" && (
          <div className="qr-history-table-wrap">
            <div style={{ background: "#f8faf5", padding: "10px 14px", borderRadius: 8, marginBottom: 12, border: "1px solid #e5ecd6", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "18px" }}>🏷️</span>
                <span style={{ fontSize: "12.5px", color: "#365314", fontWeight: 600 }}>
                  10 Fixed Rak Resmi Gudang (Zone A). Siap dipindai kamera scanner mobile dan dicetak sebagai stiker fisik.
                </span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#5c732b", background: "#f0fdf4", padding: "3px 8px", borderRadius: 4, border: "1px solid #86efac" }}>
                10 Rak Aktif
              </span>
            </div>

            <table className="qr-history-table">
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>Kode Rak</th>
                  <th style={{ width: "110px" }}>Zona</th>
                  <th>Status & Produk di Rak Ini</th>
                  <th style={{ textAlign: "right", width: "200px" }}>Aksi QR Code</th>
                </tr>
              </thead>
              <tbody>
                {filteredRacks.map((r) => {
                  const prods = rackProductsMap[r.code] || [];
                  const isOccupied = prods.length > 0;
                  return (
                    <tr key={r.code}>
                      <td>
                        <strong style={{ fontFamily: "monospace", fontSize: "15px", color: "#191d17", background: "#f1f5f9", padding: "4px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", display: "inline-block" }}>
                          ║▌║ {r.code}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                          {r.zone}
                        </span>
                      </td>
                      <td>
                        {isOccupied ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {prods.map((p) => (
                              <div key={p.sku} style={{ fontSize: "12.5px" }}>
                                <strong>{p.name}</strong> <span style={{ color: "#64748b", fontFamily: "monospace" }}>({p.sku})</span> — <strong style={{ color: "#166534" }}>{p.current} {p.unit || "pcs"}</strong>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                            Kosong (Siap untuk Putaway)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                          <button
                            type="button"
                            className="dashboard-link"
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              border: "1px solid #5c732b",
                              borderRadius: "6px",
                              background: "#f0fdf4",
                              color: "#166534",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              handleShowQr({
                                type: "RACK",
                                code: r.code,
                                name: `Lokasi Rak ${r.code}`,
                                zone: r.zone,
                                details: { products: prods.map((p) => p.sku).join(", ") },
                              })
                            }
                            title={`Lihat dan cetak QR Code Rak ${r.code}`}
                          >
                            👁️ Lihat QR
                          </button>
                          <button
                            type="button"
                            className="inbound-primary"
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              height: "auto",
                              cursor: "pointer",
                            }}
                            onClick={async () => {
                              await handleShowQr({
                                type: "RACK",
                                code: r.code,
                                name: `Lokasi Rak ${r.code}`,
                                zone: r.zone,
                                details: { products: prods.map((p) => p.sku).join(", ") },
                              });
                              window.print();
                            }}
                            title={`Cetak label stiker untuk Rak ${r.code}`}
                          >
                            🖨️ Cetak
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================== TAB 2: PRODUK INVENTARIS ===================== */}
        {activeTab === "PRODUCTS" && (
          <div className="qr-history-table-wrap">
            <table className="qr-history-table">
              <thead>
                <tr>
                  <th style={{ width: "160px" }}>SKU & Barcode</th>
                  <th>Nama Produk & Kategori</th>
                  <th style={{ width: "120px" }}>Lokasi Rak</th>
                  <th style={{ width: "110px" }}>Stok Fisik</th>
                  <th style={{ textAlign: "right", width: "180px" }}>Aksi QR Code</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                      Tidak ada produk inventaris yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.sku}>
                      <td>
                        <strong style={{ fontFamily: "monospace", fontSize: "13px", color: "#191d17" }}>
                          ║▌║ {p.sku}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ fontSize: "13px", color: "#191d17" }}>{p.name}</strong>
                        <div style={{ fontSize: "11px", color: "#737b6c" }}>{p.category}</div>
                      </td>
                      <td>
                        <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>
                          {p.rack || "A1"}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: "13px", color: p.current > 0 ? "#166534" : "#dc2626" }}>
                          {p.current} {p.unit || "pcs"}
                        </strong>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                          <button
                            type="button"
                            className="dashboard-link"
                            style={{
                              padding: "6px 10px",
                              fontSize: "12px",
                              border: "1px solid #5c732b",
                              borderRadius: "6px",
                              background: "#f0fdf4",
                              color: "#166534",
                              fontWeight: 700,
                            }}
                            onClick={() =>
                              handleShowQr({
                                type: "PRODUCT",
                                code: p.sku,
                                name: p.name,
                                sku: p.sku,
                                details: { category: p.category, rack: p.rack },
                              })
                            }
                          >
                            👁️ QR SKU
                          </button>
                          <button
                            type="button"
                            className="inbound-primary"
                            style={{ padding: "6px 12px", fontSize: "12px", height: "auto" }}
                            onClick={async () => {
                              await handleShowQr({
                                type: "PRODUCT",
                                code: p.sku,
                                name: p.name,
                                sku: p.sku,
                                details: { category: p.category, rack: p.rack },
                              });
                              window.print();
                            }}
                          >
                            🖨️ Cetak
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================== TAB 3: RIWAYAT AKTIVITAS ===================== */}
        {activeTab === "HISTORY" && (
          <div className="qr-history-table-wrap">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
              <div className="qr-history-tabs" role="tablist">
                <button
                  type="button"
                  className={historyFilter === "ALL" ? "active" : ""}
                  onClick={() => setHistoryFilter("ALL")}
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  Semua ({history.length})
                </button>
                <button
                  type="button"
                  className={historyFilter === "RACK" ? "active" : ""}
                  onClick={() => setHistoryFilter("RACK")}
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  🏁 Rak ({history.filter((i) => i.type === "RACK").length})
                </button>
                <button
                  type="button"
                  className={historyFilter === "INBOUND_ITEM" ? "active" : ""}
                  onClick={() => setHistoryFilter("INBOUND_ITEM")}
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  🏷️ Barang ({history.filter((i) => i.type === "INBOUND_ITEM").length})
                </button>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  className="dashboard-link"
                  style={{ fontSize: "12px", color: "#dc2626" }}
                  onClick={handleClearAllHistory}
                >
                  Bersihkan Log Riwayat
                </button>
              )}
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>Memuat riwayat dari database...</div>
            ) : filteredHistory.length === 0 ? (
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
                    <th>Nama & Keterangan</th>
                    <th>Aksi</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((row) => {
                    const isRack = row.type === "RACK";
                    return (
                      <tr key={row.id}>
                        <td style={{ whiteSpace: "nowrap", fontSize: "12px", color: "#64748b" }}>
                          {formatQrDate(row.timestamp)}
                        </td>
                        <td>
                          <span className={`qr-type-badge ${isRack ? "badge-rack" : "badge-inbound"}`}>
                            {isRack ? "🏁 Rak Fisik" : "🏷️ Barang"}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontFamily: "monospace", fontSize: "13px" }}>
                            {row.code}
                          </strong>
                        </td>
                        <td>
                          <strong style={{ fontSize: "12.5px" }}>{row.name}</strong>
                        </td>
                        <td>
                          <span className={`qr-action-badge ${row.action === "PRINT" ? "action-print" : "action-generate"}`}>
                            {row.action === "PRINT" ? "🖨️ Dicetak" : "⚡ Digenerate"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="dashboard-link"
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                            onClick={() =>
                              handleShowQr({
                                type: row.type,
                                code: row.code,
                                name: row.name,
                                details: row.details,
                              })
                            }
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className="dashboard-link"
                            style={{ padding: "4px 6px", fontSize: "12px", color: "#94a3b8" }}
                            onClick={(e) => handleDeleteHistory(row.id, e)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Modal Mini Preview & Print QR Code */}
        {previewQr && (
          <div className="qr-quick-preview-overlay" onClick={() => setPreviewQr(null)}>
            <div className="qr-quick-preview-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <strong style={{ fontSize: "15px", color: "#191d17" }}>
                  {previewQr.type === "RACK" ? "🏁 Label Rak Gudang" : "🏷️ Label SKU Produk"}
                </strong>
                <button
                  type="button"
                  className="inventory-close"
                  onClick={() => setPreviewQr(null)}
                >
                  ×
                </button>
              </div>

              {/* Tampilan Fisik Label Siap Cetak */}
              <div
                className="qr-print-box"
                style={{
                  border: "2px solid #191d17",
                  borderRadius: "10px",
                  padding: "16px",
                  background: "#ffffff",
                  textAlign: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#64748b", marginBottom: "6px" }}>
                  SUSUNO SMART WAREHOUSE
                </div>
                <img
                  src={previewQr.url}
                  alt={`QR Code ${previewQr.code}`}
                  style={{ width: "220px", height: "220px", display: "block", margin: "0 auto" }}
                />
                <div style={{ marginTop: "10px" }}>
                  <strong style={{ fontFamily: "monospace", fontSize: "20px", color: "#191d17", letterSpacing: "1.5px" }}>
                    ║▌║ {previewQr.code}
                  </strong>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                    {previewQr.name}
                  </p>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {warehouseName} · {previewQr.zone}
                  </span>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "18px" }}>
                <button
                  type="button"
                  className="inbound-secondary"
                  style={{ height: "36px", padding: "0 14px", fontSize: "13px" }}
                  onClick={handleDownloadPreview}
                >
                  ⬇️ Unduh PNG
                </button>
                <button
                  type="button"
                  className="inbound-primary"
                  style={{ height: "36px", padding: "0 18px", fontSize: "13px" }}
                  onClick={handlePrintPreview}
                >
                  🖨️ Cetak Fisik
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Dialog */}
        <div className="qr-history-footer no-print">
          <small style={{ color: "#737b6c" }}>
            Pusat manajemen label barcode QR SUSUNO. Format QR terintegrasi langsung dengan scanner kamera Handheld Mobile.
          </small>
          <button type="button" className="inbound-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </dialog>
  );
}
