import React, { useEffect, useState, useRef, useMemo } from "react";
import QRCode from "qrcode";
import { recordQrEvent } from "../utils/qrHistory.js";

// Menghasilkan kode batch ringkas: 2 digit tahun + 2 digit bulan + 2 digit tanggal + ID inbound
// Contoh: 15 Nov 2026, Inbound #01 -> "26111501"
function formatInboundBatchCode(shipment) {
  let dateObj = new Date();
  const dateVal = shipment?.date || shipment?.scheduled_date || shipment?.scheduledAt || shipment?.created_at;
  if (dateVal) {
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) dateObj = parsed;
  }
  const yy = String(dateObj.getFullYear()).slice(-2);
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`;

  const rawId = String(shipment?.inbound_number || shipment?.id || "1").toUpperCase();
  const match = rawId.match(/(\d+)$/);
  const idPart = match ? (match[1].length === 1 ? `0${match[1]}` : match[1]) : rawId.replace(/[^A-Z0-9]/g, "").slice(-4);

  return `${datePart}${idPart}`;
}

export default function InboundItemQrDialog({
  shipment,
  initialSku = null,
  onClose,
}) {
  const dialogRef = useRef(null);
  const products = Array.isArray(shipment?.products) && shipment.products.length > 0
    ? shipment.products
    : [
        {
          sku: "SKU-ITEM",
          name: "Barang Inbound",
          ordered: shipment?.units || 1,
          unit: "pcs",
        },
      ];

  const [selectedSku, setSelectedSku] = useState(
    initialSku || (products[0] ? products[0].sku : "")
  );
  // Scope: 'single' (produk terpilih) | 'batch' (semua produk)
  const [scopeMode, setScopeMode] = useState(initialSku ? "single" : "batch");
  // Skema mode per item: { [sku]: 'single_series' | 'sequential' }
  const [itemModes, setItemModes] = useState(() => {
    const initial = {};
    products.forEach((p) => {
      initial[p.sku] = "single_series";
    });
    return initial;
  });
  // Custom limit unit jika sequential pada single product
  const [customQty, setCustomQty] = useState("");
  const [qrMap, setQrMap] = useState({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const activeProduct = products.find((p) => p.sku === selectedSku) || products[0];

  function setItemMode(sku, mode) {
    setItemModes((prev) => ({
      ...prev,
      [sku]: mode,
    }));
  }

  function setAllModes(mode) {
    const updated = {};
    products.forEach((p) => {
      updated[p.sku] = mode;
    });
    setItemModes(updated);
  }

  // Hitung daftar label yang akan dicetak/ditampilkan
  // Format standar: SKU - YYMMDD[INB] - No. Urut (Serial) atau SKU - YYMMDD[INB] (Master)
  const labelsToPrint = useMemo(() => {
    const targetProducts = scopeMode === "single" ? [activeProduct].filter(Boolean) : products;
    const batchCode = formatInboundBatchCode(shipment);

    const list = [];
    targetProducts.forEach((prod) => {
      const totalOrdered = Math.max(1, Number(prod.ordered ?? prod.quantity ?? 1));
      const cleanSku = (prod.sku || prod.code || "ITEM").trim().toUpperCase();
      const currentMode = itemModes[prod.sku] || "single_series";

      if (currentMode === "single_series") {
        // Cukup satu seri (Master): SKU-YYMMDDINB
        const code = `${cleanSku}-${batchCode}`;
        list.push({
          id: `${code}-MASTER`,
          code,
          sku: prod.sku,
          name: prod.name,
          ordered: totalOrdered,
          unit: prod.unit || "pcs",
        });
      } else {
        // Nomor berurutan per unit fisik: SKU-YYMMDDINB-001
        let count = totalOrdered;
        if (scopeMode === "single" && customQty && !isNaN(Number(customQty)) && Number(customQty) > 0) {
          count = Math.min(totalOrdered, Number(customQty));
        }

        for (let i = 1; i <= count; i++) {
          const serialCode = `${cleanSku}-${batchCode}-${String(i).padStart(3, "0")}`;

          list.push({
            id: `${serialCode}-UNIT-${i}`,
            code: serialCode,
            sku: prod.sku,
            name: prod.name,
            ordered: totalOrdered,
            unit: prod.unit || "pcs",
          });
        }
      }
    });

    return list;
  }, [products, scopeMode, activeProduct, itemModes, customQty, shipment]);

  // Kelompokkan label berdasarkan produk agar cetak / PDF terorganisir per barang
  const groupedProducts = useMemo(() => {
    const groups = [];
    const productMap = new Map();

    labelsToPrint.forEach((item) => {
      if (!productMap.has(item.sku)) {
        const groupObj = {
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          ordered: item.ordered,
          labels: [],
        };
        productMap.set(item.sku, groupObj);
        groups.push(groupObj);
      }
      productMap.get(item.sku).labels.push(item);
    });

    return groups;
  }, [labelsToPrint]);

  // Generate QR code data URL untuk semua label yang belum ada di qrMap
  useEffect(() => {
    let isCancelled = false;
    const uniqueCodes = [...new Set(labelsToPrint.map((l) => l.code))];
    const missingCodes = uniqueCodes.filter((c) => !qrMap[c]);

    if (missingCodes.length === 0) return;

    setGenerating(true);
    const generateQrs = async () => {
      const newUrls = {};
      for (const code of missingCodes) {
        if (isCancelled) break;
        try {
          const url = await QRCode.toDataURL(code.trim().toUpperCase(), {
            width: 280,
            margin: 1,
            color: {
              dark: "#191d17",
              light: "#ffffff",
            },
            errorCorrectionLevel: "M",
          });
          newUrls[code] = url;
        } catch (err) {
          console.error(`Gagal membuat QR untuk ${code}:`, err);
        }
      }

      if (!isCancelled) {
        setQrMap((prev) => ({ ...prev, ...newUrls }));
        setGenerating(false);
      }
    };

    generateQrs();
    return () => {
      isCancelled = true;
    };
  }, [labelsToPrint, qrMap]);

  function handlePrint() {
    recordQrEvent({
      type: "INBOUND_ITEM",
      code: scopeMode === "single" ? activeProduct?.sku : `${shipment?.id}-BATCH`,
      name: scopeMode === "single" ? activeProduct?.name : `${labelsToPrint.length} Label Inbound (5x5)`,
      action: "PRINT",
      details: {
        shipmentId: shipment?.id,
        po: shipment?.po,
        dock: shipment?.dock,
        scopeMode,
        format: "SKU-INBOUND-SEQ",
        totalLabels: labelsToPrint.length,
      },
    });

    const printElement = document.getElementById("printable-inbound-label");
    if (!printElement) {
      window.print();
      return;
    }

    // Buat iframe terisolasi khusus print agar 100% muncul di PDF preview dan cetak fisik
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cetak Label Barcode 5x5 - ${shipment?.id || "SUSUNO"}</title>
          <style>
            @page {
              size: auto;
              margin: 4mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              background: #ffffff;
              color: #191d17;
            }
            /* Judul Dokumen Cetak / PDF */
            .inbound-print-doc-header {
              margin-bottom: 4mm;
              padding-bottom: 2mm;
              border-bottom: 2px solid #191d17;
            }
            .inbound-print-title-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1.5mm;
            }
            .inbound-print-brand {
              font-size: 13pt;
              font-weight: 900;
              letter-spacing: 0.05em;
              color: #191d17;
            }
            .inbound-print-badge {
              font-size: 8pt;
              font-weight: 800;
              padding: 1mm 2.5mm;
              background: #eef3e9;
              color: #3e5510;
              border-radius: 2px;
            }
            .inbound-print-meta-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 4mm;
              font-size: 8.5pt;
              color: #334155;
            }
            /* Grup Produk & Pemisah Halaman (Page Break) saat Ganti Barang */
            .inbound-print-product-section {
              page-break-inside: auto;
              margin-bottom: 4mm;
            }
            .inbound-print-page-break {
              page-break-before: always !important;
              break-before: page !important;
              margin-top: 0 !important;
              padding-top: 0 !important;
            }
            .inbound-print-product-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 1.5mm;
              margin-bottom: 2.5mm;
              border-bottom: 1px solid #94a3b8;
            }
            .inbound-print-prod-title {
              font-size: 10pt;
              font-weight: 800;
              color: #191d17;
            }
            .inbound-print-sku-tag {
              font-family: monospace;
              font-weight: 700;
              color: #0f172a;
            }
            .inbound-print-prod-qty {
              font-size: 8.5pt;
              font-weight: 700;
              color: #5c732b;
            }
            .inbound-qr-cards-container {
              display: flex;
              flex-wrap: wrap;
              gap: 2.5mm;
              justify-content: flex-start;
              align-items: flex-start;
            }
            .inbound-qr-card-5x5 {
              width: 5cm;
              height: 5cm;
              max-width: 5cm;
              max-height: 5cm;
              min-width: 5cm;
              min-height: 5cm;
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
              margin: 0 0 2.5mm 0;
              padding: 2.5mm;
              border: 1px solid #191d17;
              border-radius: 2px;
              background: #ffffff;
              color: #191d17;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              overflow: hidden;
            }
            .inbound-qr-5x5-body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 100%;
            }
            .inbound-qr-5x5-img {
              width: 3.7cm;
              height: 3.7cm;
              display: block;
              image-rendering: pixelated;
            }
            .inbound-qr-5x5-placeholder {
              width: 3.7cm;
              height: 3.7cm;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8pt;
              color: #64748b;
            }
            .inbound-qr-5x5-barcode {
              font-family: monospace;
              font-weight: 800;
              font-size: 10pt;
              color: #191d17;
              letter-spacing: 0.04em;
              margin-top: 1.5mm;
              text-align: center !important;
              width: 100% !important;
              display: block !important;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          ${printElement.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 250);
  }

  function handleDownload(item) {
    const target = item || labelsToPrint[0];
    if (!target) return;
    const url = qrMap[target.code];
    if (!url) return;

    recordQrEvent({
      type: "INBOUND_ITEM",
      code: target.code,
      name: target.name,
      action: "DOWNLOAD",
      details: {
        shipmentId: shipment?.id,
        po: shipment?.po,
        dock: shipment?.dock,
        format: "SKU-INBOUND-SEQ",
      },
    });

    const a = document.createElement("a");
    a.href = url;
    a.download = `QR-${target.code}-5x5.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <dialog
      ref={dialogRef}
      className="dashboard-dialog inbound-qr-dialog"
      onCancel={onClose}
      aria-labelledby="inbound-qr-title"
    >
      <div className="inbound-qr-modal-content">
        <div className="inbound-qr-header no-print">
          <div>
            <h2 id="inbound-qr-title" style={{ margin: 0, fontSize: "16px", color: "var(--brand-ink, #191d17)" }}>
              🏷️ Cetak Label Barcode & QR (Ukuran 5×5 cm)
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--brand-muted, #737b6c)" }}>
              Format stiker minimalis 5×5 cm: hanya memuat gambar barcode/QR dan teks kode tanpa ornamen teks lain.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="inventory-close"
              onClick={onClose}
              aria-label="Tutup dialog QR barang"
            >
              ×
            </button>
          </div>
        </div>

        {/* Kontrol Opsi Barcode & Cakupan Cetak (No Print) */}
        <div className="inbound-qr-controls-v2 no-print">
          {/* Baris 1: Cakupan Produk & Quick Batch Actions */}
          <div className="inbound-qr-control-row">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="inbound-qr-control-label">
                📦 Cakupan:
              </span>
              <div className="ss-view-toggle" role="group" aria-label="Cakupan produk">
                <button
                  type="button"
                  className={scopeMode === "batch" ? "active" : ""}
                  onClick={() => setScopeMode("batch")}
                >
                  Semua Produk ({products.length})
                </button>
                <button
                  type="button"
                  className={scopeMode === "single" ? "active" : ""}
                  onClick={() => setScopeMode("single")}
                >
                  Pilih Produk
                </button>
              </div>

              {scopeMode === "single" && products.length > 1 && (
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", marginLeft: "4px" }}>
                  <select
                    value={selectedSku}
                    onChange={(e) => {
                      setSelectedSku(e.target.value);
                      setCustomQty("");
                    }}
                    className="inbound-qr-select"
                  >
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.name} ({p.sku}) · {p.ordered} {p.unit || "pcs"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* Quick Actions untuk Batch Mode */}
            {scopeMode === "batch" && products.length > 1 && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px" }}>
                <span style={{ color: "var(--brand-muted, #737b6c)", fontWeight: 600 }}>Set Semua:</span>
                <button
                  type="button"
                  className="inbound-qr-quick-btn"
                  onClick={() => setAllModes("single_series")}
                  title="Ubah semua produk menjadi 1 label Master"
                >
                  🏷️ 1 Master
                </button>
                <span style={{ color: "#cbd5e1" }}>|</span>
                <button
                  type="button"
                  className="inbound-qr-quick-btn"
                  onClick={() => setAllModes("sequential")}
                  title="Ubah semua produk menjadi Serial per unit"
                >
                  🔢 Serial
                </button>
              </div>
            )}
          </div>

          {/* Baris 2: Daftar Konfigurasi Skema per Item (Jika Mode Batch & Multi-Item) */}
          {scopeMode === "batch" && products.length > 1 ? (
            <div className="inbound-qr-items-list-v2">
              {products.map((p) => {
                const currentMode = itemModes[p.sku] || "single_series";
                return (
                  <div key={p.sku} className="inbound-qr-item-row-v2">
                    <div className="inbound-qr-item-meta-v2">
                      <strong className="inbound-qr-item-name-v2">{p.name}</strong>
                      <span className="inbound-qr-item-sku-v2">{p.sku} · {p.ordered} {p.unit || "pcs"}</span>
                    </div>
                    <div className="ss-view-toggle ss-toggle-micro" role="group" aria-label={`Skema untuk ${p.name}`}>
                      <button
                        type="button"
                        className={currentMode === "single_series" ? "active" : ""}
                        onClick={() => setItemMode(p.sku, "single_series")}
                        title="Cetak 1 label master untuk produk ini"
                      >
                        🏷️ 1 Master
                      </button>
                      <button
                        type="button"
                        className={currentMode === "sequential" ? "active" : ""}
                        onClick={() => setItemMode(p.sku, "sequential")}
                        title={`Cetak ${p.ordered} label serial berurutan`}
                      >
                        🔢 Serial ({p.ordered}x)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Baris 2 jika Single Product atau Inbound hanya 1 produk */
            <div className="inbound-qr-control-row" style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="inbound-qr-control-label">
                  🏷️ Skema Barcode:
                </span>
                <div className="ss-view-toggle" role="group" aria-label="Skema nomor barcode">
                  <button
                    type="button"
                    className={(itemModes[activeProduct?.sku] || "single_series") === "single_series" ? "active" : ""}
                    onClick={() => setItemMode(activeProduct?.sku, "single_series")}
                  >
                    🏷️ 1 Master
                  </button>
                  <button
                    type="button"
                    className={(itemModes[activeProduct?.sku] || "single_series") === "sequential" ? "active" : ""}
                    onClick={() => setItemMode(activeProduct?.sku, "sequential")}
                  >
                    🔢 Serial ({activeProduct?.ordered || 1}x)
                  </button>
                </div>
              </div>

              {/* Jika Sequential dan Single Product: Opsi Limit Jumlah Unit */}
              {(itemModes[activeProduct?.sku] || "single_series") === "sequential" && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                  <span style={{ color: "var(--brand-muted, #737b6c)", fontWeight: 600 }}>Cetak:</span>
                  <input
                    type="number"
                    min="1"
                    max={activeProduct?.ordered || 9999}
                    value={customQty || activeProduct?.ordered || 1}
                    onChange={(e) => setCustomQty(e.target.value)}
                    style={{
                      width: "56px",
                      height: "28px",
                      borderRadius: "6px",
                      border: "1px solid #dfe4d9",
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                    title={`Maksimal ${activeProduct?.ordered || 1} unit`}
                  />
                  <span style={{ color: "var(--brand-muted, #737b6c)" }}>dari {activeProduct?.ordered} unit</span>
                  {customQty && Number(customQty) !== Number(activeProduct?.ordered) && (
                    <button
                      type="button"
                      className="dashboard-link"
                      style={{ fontSize: "11px" }}
                      onClick={() => setCustomQty("")}
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Banner Info Ringkas Ukuran 5x5 */}
          <div className="inbound-qr-dimension-pill">
            <span>
              📐 <strong>Ukuran Stiker: 5cm × 5cm</strong> • Format: <code>SKU - YYMMDD[ID] - Urutan</code> (Unik per unit & batch).
            </span>
            <span className="inbound-qr-label-count-badge">
              {labelsToPrint.length} Label Siap Cetak
            </span>
          </div>
        </div>

        {/* PRINTABLE AREA (5x5 cm Clean Format with Document Title & Product Sections) */}
        <div className="inbound-qr-printable-wrapper" id="printable-inbound-label">
          {/* Header Dokumen Cetak (Judul PDF & Metadata) */}
          <div className="inbound-print-doc-header">
            <div className="inbound-print-title-row">
              <span className="inbound-print-brand">SUSUNO SMART WAREHOUSE</span>
              <span className="inbound-print-badge">LABEL PENERIMAAN INBOUND</span>
            </div>
            <div className="inbound-print-meta-grid">
              <div><strong>No. Inbound:</strong> {shipment?.id || "-"}</div>
              <div><strong>No. PO:</strong> {shipment?.po || "-"}</div>
              <div><strong>Dock:</strong> {shipment?.dock || "-"}</div>
              <div><strong>Tanggal:</strong> {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          </div>

          {/* Grup Produk - Ganti Barang Otomatis Halaman Baru */}
          {groupedProducts.map((group, gIdx) => (
            <div
              key={group.sku}
              className={`inbound-print-product-section ${gIdx > 0 ? "inbound-print-page-break" : ""}`}
            >
              <div className="inbound-print-product-header">
                <span className="inbound-print-prod-title">
                  📦 <strong>{group.name}</strong> · <span className="inbound-print-sku-tag">SKU: {group.sku}</span>
                </span>
                <span className="inbound-print-prod-qty">
                  Total {group.labels.length} Unit
                </span>
              </div>

              <div className="inbound-qr-cards-container">
                {group.labels.map((item) => (
                  <div key={item.id} className="inbound-qr-card inbound-qr-card-5x5">
                    <div className="inbound-qr-5x5-body">
                      {qrMap[item.code] ? (
                        <img
                          src={qrMap[item.code]}
                          alt={`QR Code ${item.code}`}
                          className="inbound-qr-5x5-img"
                        />
                      ) : (
                        <div className="inbound-qr-5x5-placeholder">
                          {generating ? "Membuat..." : "..."}
                        </div>
                      )}
                      <div className="inbound-qr-5x5-barcode" style={{ textAlign: "center", width: "100%", display: "block" }}>
                        {item.code}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions (No Print) */}
        <div className="inbound-qr-actions no-print">
          <button type="button" className="inbound-secondary" onClick={onClose}>
            Tutup
          </button>
          {labelsToPrint.length > 0 && (
            <button
              type="button"
              className="inbound-secondary"
              onClick={() => handleDownload(labelsToPrint[0])}
              title="Unduh file gambar QR pertama sebagai PNG"
            >
              ⬇️ Unduh Contoh PNG
            </button>
          )}
          <button type="button" className="inbound-primary" onClick={handlePrint} disabled={labelsToPrint.length === 0}>
            🖨️ Cetak {labelsToPrint.length} Label (5×5 cm)
          </button>
        </div>
      </div>
    </dialog>
  );
}
