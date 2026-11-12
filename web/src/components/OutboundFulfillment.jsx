import { typeOf } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import { formatNumber } from "../utils/formatters.js";
import { outboundDate } from "../data/outbound.js";
import "../styles/receiving.css";
import "../styles/outboundFulfillment.css";

const headings = {
  inspect: "Picking & Pemeriksaan Barang Keluar",
  review: "Review & ACC Pengeluaran Barang",
};

const descriptions = {
  inspect: "Staf dok mengambil fisik barang dari rak dan memindai barcode sebelum pemuatan ke armada.",
  review: "Verifikasi hasil scan barcode dan kuantitas fisik sebelum menyetujui pengiriman & memotong stok master.",
};

function OutboundFulfillment({
  shipment,
  inventory = [],
  staffAccounts = [],
  onUpdateStaff,
  onShip,
  onBack,
  onNavigate,
  warehouseName = "Main Warehouse",
}) {
  const [currentStaff, setCurrentStaff] = useState(shipment.staff || shipment.assigned_staff || "Staf Dok");
  const [assignNotice, setAssignNotice] = useState("");
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submitLock = useRef(false);
  const dialogRef = useRef(null);

  const isInspected = shipment.status === "Inspected" || shipment.status === "Ready to Ship";
  const isShipped = shipment.status === "Shipped";
  const stage = isInspected ? "review" : "inspect";

  const products = (shipment.products || shipment.items || []).map((p) => {
    const inv = inventory.find((it) => it.sku === (p.sku || p.product_sku)) || {};
    const ordered = Number(p.quantity || p.ordered_qty || p.requested_qty || 0);
    const fulfilled = Number(p.fulfilled_qty ?? p.shipped_qty ?? (isInspected ? ordered : 0));
    const damaged = Number(p.damaged_qty || 0);

    let barcodes = [];
    if (p.barcodes) {
      if (Array.isArray(p.barcodes)) {
        barcodes = p.barcodes;
      } else {
        try {
          barcodes = JSON.parse(p.barcodes);
        } catch (_) {
          barcodes = String(p.barcodes).split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
    }
    if (barcodes.length === 0 && isInspected) {
      barcodes = Array.from({ length: fulfilled }, (_, i) => `${p.sku || inv.sku || 'SKU'}-${String(i + 1).padStart(3, '0')}`);
    }

    return {
      ...p,
      name: p.name || p.product_name || inv.name || "Item",
      sku: p.sku || p.product_sku || inv.sku || "-",
      category: p.category || inv.category || "General",
      rack: p.rack || inv.rack || "A-01",
      ordered,
      fulfilled,
      damaged,
      barcodes,
      image_url: p.image_url || inv.image_url,
      current_stock: inv.current ?? p.current_stock ?? 0,
    };
  });

  const totalOrdered = products.reduce((sum, p) => sum + p.ordered, 0);
  const totalFulfilled = products.reduce((sum, p) => sum + p.fulfilled, 0);
  const totalDamaged = products.reduce((sum, p) => sum + p.damaged, 0);
  const progressPercent = totalOrdered > 0 ? Math.min(100, Math.round((totalFulfilled / totalOrdered) * 100)) : 0;

  useEffect(() => {
    if (shipment.staff || shipment.assigned_staff) {
      setCurrentStaff(shipment.staff || shipment.assigned_staff);
    }
  }, [shipment.staff, shipment.assigned_staff]);

  async function handleStaffChange(newStaff) {
    const finalStaff = (newStaff || "").trim() || "Semua Staf Lapangan";
    setCurrentStaff(finalStaff);
    setIsSubmittingAssign(true);
    if (onUpdateStaff) {
      await onUpdateStaff(shipment.id, finalStaff);
    }
    setIsSubmittingAssign(false);
    setAssignNotice(`Penugasan picking berhasil diubah ke: "${finalStaff}"`);
    setTimeout(() => setAssignNotice(""), 3500);
  }

  async function completeACC() {
    if (submitLock.current || done) return;
    if (!confirmed) {
      setError("Centang konfirmasi bahwa fisik barang keluar dan barcode scan telah diverifikasi.");
      return;
    }

    submitLock.current = true;
    setError("");

    try {
      const itemsToShip = products.map((p) => ({
        product_id: p.product_id || p.id,
        sku: p.sku,
        quantity: p.fulfilled,
        fulfilled_qty: p.fulfilled,
        barcodes: p.barcodes,
      }));

      const res = await onShip({
        carrier: shipment.carrier || "Ekspedisi Gudang",
        tracking: shipment.tracking || shipment.tracking_number || `OUT-TRK-${shipment.id}`,
        items: itemsToShip,
        stockChanges: products.map((p) => ({
          sku: p.sku,
          before: p.current_stock,
          after: Math.max(0, p.current_stock - p.fulfilled),
        })),
        notes: `Pengeluaran barang disetujui oleh Manager (${currentStaff})`,
      });

      if (res?.error) {
        submitLock.current = false;
        setError(res.error);
        return;
      }

      setDone(true);
      dialogRef.current?.showModal();
    } catch (err) {
      submitLock.current = false;
      setError(err.message || "Gagal memproses persetujuan pengeluaran barang");
    }
  }

  return (
    <div className="receiving-content outbound-fulfillment-content">
      {/* 3-Step Progress Indicator */}
      <ol className={`receiving-steps receiving-step-${stage === "inspect" ? 1 : 2}`} aria-label="Outbound progress">
        {["Jadwal Pengeluaran", "Picking & Scan Dok", "Review & ACC Kirim"].map((label, index) => {
          const currentStep = stage === "inspect" ? 1 : 2;
          return (
            <li
              key={label}
              className={index <= currentStep ? "receiving-active-step" : ""}
              aria-current={index === currentStep ? "step" : undefined}
            >
              <span>{index < currentStep ? "✓" : index + 1}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>

      {/* Toast Notice Penugasan */}
      {assignNotice && (
        <div
          style={{
            background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            border: "1px solid #86efac",
            borderRadius: 10,
            padding: "12px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#166534",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>✓</span>
          <span>{assignNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAHAP 1: INSPEKSI / PICKING BARANG KELUAR (READ-ONLY MANAGER)             */}
      {/* ========================================================================= */}
      {stage === "inspect" && (
        <div className="receiving-inspect-grid">
          <div className="receiving-left">
            {/* Banner Menunggu Staf Dok (docs/development-rules.md Handover Rule) */}
            <div
              className="banner-waiting-staff"
              style={{
                background: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)",
                border: "1.5px solid #fde68a",
                borderRadius: 14,
                padding: "16px 20px",
                marginBottom: 20,
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                boxShadow: "0 2px 8px rgba(217, 119, 6, 0.08)",
              }}
            >
              <div
                style={{
                  background: "#d97706",
                  color: "#ffffff",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                ⏱
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 14, color: "#92400e", display: "block" }}>
                  {shipment.status === "Arrived"
                    ? "Menunggu Staf Dok Memulai Pengambilan Barang (Picking)"
                    : "Staf Dok Sedang Memindai Barcode Fisik Barang Keluar"}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>
                  Sesuai Standar Operasional Gudang SUSUNO, tahap pengambilan fisik barang dari rak dan pemindaian barcode unit dilakukan oleh{" "}
                  <strong>{currentStaff}</strong> via aplikasi Mobile. Halaman ini bersifat <strong>100% Read-Only</strong> untuk Manajer sampai staf mengirim laporan picking.
                </p>
              </div>
            </div>

            {/* Shipment Information Card */}
            <section className="dashboard-card receiving-shipment-card">
              <div className="receiving-card-heading">
                <h2>Informasi Pengiriman Keluar</h2>
                <span className="inbound-status">{shipment.status.toUpperCase()}</span>
              </div>
              <dl>
                {[
                  ["Outbound ID", shipment.id || shipment.outbound_number],
                  ["Tujuan / Customer", shipment.destination],
                  ["Referensi / PO", shipment.reference || "Standar"],
                  ["Jadwal Kirim", `${outboundDate(shipment.date || shipment.scheduled_date)} · ${shipment.time || shipment.scheduled_time || "09:00"}`],
                  ["Dok Pemuatan", `Dok ${shipment.dock || "1"}`],
                  ["Ekspedisi / Armada", shipment.carrier || "Logistik Internal"],
                  ["Prioritas", shipment.priority || "Normal"],
                  [
                    "Staf Penanggung Jawab",
                    <div key="assigned-action" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                      <select
                        value={currentStaff}
                        onChange={(e) => handleStaffChange(e.target.value)}
                        style={{
                          width: "100%",
                          maxWidth: 240,
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1.5px solid #5c732b",
                          background: "#ffffff",
                          color: "#191d17",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        <option value="Semua Staf Lapangan">👥 Semua Staf Lapangan</option>
                        {staffAccounts.map((acc) => {
                          const name = acc.fullName || acc.name;
                          return (
                            <option key={acc.id || name} value={name}>
                              👤 {name} {acc.role ? `(${acc.role})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      {isSubmittingAssign && (
                        <span style={{ fontSize: 11, color: "#5c732b", fontWeight: 600 }}>Menyimpan...</span>
                      )}
                    </div>,
                  ],
                ].map(([label, value]) => (
                  <div key={typeof label === "string" ? label : "row"}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Picking Allocation Progress Bar Card */}
            <section className="dashboard-card receiving-allocation-progress">
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2>Progress Pengambilan Barang (Picking)</h2>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#5c732b" }}>
                    {progressPercent}% Siap
                  </span>
                </div>
                <p>Status pengambilan fisik barang dari rak dan scan barcode unit oleh staf dok.</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <progress value={totalFulfilled} max={totalOrdered || 1} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#5c732b", minWidth: 46 }}>
                    {totalFulfilled}/{totalOrdered}
                  </span>
                </div>
              </div>
              <div className="receiving-progress-stats">
                <article>
                  <span>DIMINTA</span>
                  <strong>{totalOrdered}</strong>
                </article>
                <article>
                  <span>DIAMBIL (PICKED)</span>
                  <strong>{totalFulfilled}</strong>
                </article>
                <article className={totalDamaged > 0 ? "summary-issue" : ""}>
                  <span>KENDALA / RUSAK</span>
                  <strong>{totalDamaged}</strong>
                </article>
              </div>
            </section>

            {/* Daftar Produk yang Harus Diambil dari Rak (Read-Only) */}
            <section className="dashboard-card receiving-table-card">
              <h2>Daftar Barang Keluar</h2>
              <p>Barang yang harus diambil dari rak gudang dan dimuat ke armada dok.</p>
              <div className="receiving-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["Produk", "Lokasi Rak", "Diminta", "Stok Tersedia", "Diambil Staf", "Status"].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((row) => (
                      <tr key={row.sku}>
                        <td>
                          <strong>{row.name}</strong>
                          <small>SKU: {row.sku} · Kategori: {row.category}</small>
                        </td>
                        <td>
                          <span className="barcode-badge-item" style={{ background: "#f1f5f9", borderColor: "#cbd5e1" }}>
                            📍 Rak {row.rack}
                          </span>
                        </td>
                        <td><strong>{row.ordered}</strong></td>
                        <td>{row.current_stock} {row.unit || "unit"}</td>
                        <td>{row.fulfilled > 0 ? row.fulfilled : "Menunggu Staf"}</td>
                        <td>
                          <span className={`inbound-status ${row.fulfilled >= row.ordered ? "inbound-status-arrived" : "inbound-status-issue"}`}>
                            {row.fulfilled >= row.ordered ? "Lengkap" : "Pending Picking"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="receiving-right">
            {/* Supporting Evidence Card */}
            <section className="dashboard-card receiving-details-card">
              <h2>Surat Jalan & Bukti Pemuatan</h2>
              <div
                style={{
                  border: "1.5px dashed #cbd5e1",
                  borderRadius: 8,
                  padding: "20px 16px",
                  textAlign: "center",
                  background: "#f8fafc",
                  margin: "12px 0",
                }}
              >
                <span style={{ fontSize: 24, display: "block", marginBottom: 6 }}>📄</span>
                <strong style={{ display: "block", fontSize: 13, color: "#334155" }}>
                  Foto Fisik / Dokumen Surat Jalan
                </strong>
                <span style={{ fontSize: 11, color: "#64748b" }}>Diunggah otomatis oleh staf lapangan saat picking selesai</span>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#0369a1" }}>
                  ℹ️ Ditangani oleh staf dok: <strong>{currentStaff}</strong>
                </p>
              </div>
            </section>

            {/* Workflow Alur Outbound */}
            <section className="dashboard-card receiving-details-card">
              <h2>Alur Pengeluaran Dok</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "14px 0" }}>
                {[
                  ["1. Armada Tiba di Dok", "Manajer menandai kedatangan armada pemuatan di dok."],
                  ["2. Pengambilan & Scan Barcode (Mobile)", "Staf dok mengambil fisik barang dari rak dan scan setiap unit."],
                  ["3. Review & ACC Manajer (Web)", "Manajer mengecek hasil scan staf dok, memberikan ACC, dan stok terpotong otomatis."],
                ].map(([title, desc], i) => (
                  <div key={title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span
                      style={{
                        background: i === 0 ? "#dcfce7" : i === 1 ? "#ecfeff" : "#f1f5f9",
                        color: i === 0 ? "#166534" : i === 1 ? "#0e7490" : "#64748b",
                        borderRadius: "50%",
                        width: 24,
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <strong style={{ fontSize: 12, color: "#191d17" }}>{title}</strong>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <button type="button" className="inbound-secondary" style={{ width: "100%" }} onClick={onBack}>
              ‹ Kembali ke Daftar Outbound
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAHAP 2: REVIEW & ACC PENGELUARAN BARANG (MANAGER)                        */}
      {/* ========================================================================= */}
      {stage === "review" && (
        <div className="receiving-review-container">
          {/* Banner Review Staf Dok */}
          <div
            className="banner-review-staff"
            style={{
              background: "linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)",
              border: "1.5px solid #67e8f9",
              borderRadius: 14,
              padding: "16px 20px",
              marginBottom: 20,
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              boxShadow: "0 2px 8px rgba(8, 145, 178, 0.08)",
            }}
          >
            <div
              style={{
                background: "#0891b2",
                color: "#ffffff",
                borderRadius: "50%",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 14, color: "#0e7490", display: "block" }}>
                Staf Dok Telah Menyelesaikan Pengambilan Barang & Scan Barcode
              </strong>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#155e75", lineHeight: 1.5 }}>
                Pemeriksaan fisik dan pemindaian barcode telah dilaporkan oleh <strong>{shipment.inspector || currentStaff}</strong>.
                Silakan verifikasi kuantitas fisik dan nomor barcode satuan di bawah sebelum menyetujui (ACC) pengeluaran barang.
              </p>
            </div>
          </div>

          {/* 3 Metric Cards Ringkasan */}
          <div className="receiving-review-summary-cards">
            <section className="dashboard-card">
              <h2>Tujuan & Armada</h2>
              <div>
                <strong>{shipment.destination}</strong>
              </div>
              <p>Dok {shipment.dock || "1"} · {shipment.carrier || "Logistik"}</p>
            </section>

            <section className="dashboard-card">
              <h2>Hasil Pengecekan Staf</h2>
              <div>
                <strong>{totalFulfilled}</strong> unit siap kirim <span className="receiving-review-check">✓</span>
              </div>
              <p>{totalDamaged > 0 ? `${totalDamaged} unit bermasalah` : "Semua unit dalam kondisi baik"}</p>
            </section>

            <section className="dashboard-card">
              <h2>Pemotongan Stok Master</h2>
              <div>
                <strong className="critical-text">-{totalFulfilled}</strong> unit akan dipotong <span className="receiving-review-check">✓</span>
              </div>
              <p>Otomatis dicatat ke kartu stok (Transaksi Mutasi OUT)</p>
            </section>
          </div>

          {/* Main Review Table with Barcode Chips */}
          <div className="receiving-review-grid">
            <section className="dashboard-card receiving-review-items">
              <h2>Verifikasi Barang & Barcode Hasil Scan Staf Dok</h2>
              <p>Daftar kuantitas fisik dan nomor barcode satuan yang telah dipindai dari rak gudang.</p>

              <div className="receiving-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["Produk", "Lokasi Rak", "Diminta", "Disiapkan Staf", "Barcode Hasil Scan Staf Dok", "Stok Sebelum → Sesudah"].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((row) => {
                      const afterStock = Math.max(0, row.current_stock - row.fulfilled);
                      return (
                        <tr key={row.sku}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="inventory-thumb" style={{ width: 38, height: 38, borderRadius: 8 }}>
                                {row.image_url ? (
                                  <img
                                    src={row.image_url}
                                    alt={row.name}
                                    className="inventory-thumb-img"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = "flex";
                                    }}
                                  />
                                ) : null}
                                <div className="inventory-thumb-fallback" style={{ display: row.image_url ? "none" : "flex", fontSize: 13 }}>
                                  📦
                                </div>
                              </div>
                              <div>
                                <strong>{row.name}</strong>
                                <small>SKU: {row.sku} · {row.category}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="barcode-badge-item" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                              📍 Rak {row.rack}
                            </span>
                          </td>
                          <td><strong>{row.ordered}</strong></td>
                          <td className="positive-text"><strong>{row.fulfilled}</strong></td>
                          <td>
                            {/* Barcode Chips Container (100% Identik dengan Inbound) */}
                            <div className="barcode-scan-container">
                              <div className="barcode-scan-header">
                                <span>📱 {row.barcodes.length} Barcode Di-scan Staf</span>
                              </div>
                              <div className="barcode-badge-wrap">
                                {row.barcodes.map((bc, bIdx) => (
                                  <span key={bIdx} className="barcode-badge-item" title={`Barcode fisik unit ${bIdx + 1}`}>
                                    ║▌║ {bc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{row.current_stock}</strong> → <span className="critical-text"><strong>{afterStock}</strong> (-{row.fulfilled})</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Konfirmasi & Aksi ACC Manajer */}
          <div
            className="dashboard-card"
            style={{
              marginTop: 20,
              padding: 24,
              border: "1.5px solid #86efac",
              background: "#f0fdf4",
              borderRadius: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <input
                type="checkbox"
                id="outbound-acc-confirm"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, cursor: "pointer", accentColor: "#5c732b" }}
              />
              <label htmlFor="outbound-acc-confirm" style={{ fontSize: 13, color: "#166534", fontWeight: 600, cursor: "pointer", lineHeight: 1.5 }}>
                Saya mengonfirmasi bahwa seluruh barang fisik keluar dan barcode scan telah diverifikasi sesuai pesanan. Menyetujui pengeluaran ini akan memotong stok master dan menerbitkan Surat Jalan resmi.
              </label>
            </div>

            {error && (
              <p style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, margin: "14px 0 0" }}>
                ⚠️ {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                type="button"
                className="inbound-primary"
                disabled={!confirmed || submitLock.current}
                onClick={completeACC}
                style={{ padding: "12px 28px", fontSize: 14 }}
              >
                {submitLock.current ? "Memproses..." : "✓ ACC & Selesaikan Pengeluaran Barang"}
              </button>
              <button type="button" className="inbound-secondary" onClick={onBack}>
                Batal / Kembali
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Dialog Modal */}
      <dialog ref={dialogRef} className="dashboard-dialog" style={{ maxWidth: 450, padding: 24, borderRadius: 16, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", color: "#166534", display: "grid", placeItems: "center", fontSize: 28, margin: "0 auto 16px" }}>
          ✓
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#191d17", marginBottom: 8 }}>Pengeluaran Barang Berhasil</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.5 }}>
          Pengiriman <strong>{shipment.id}</strong> telah disetujui (ACC). Stok produk telah otomatis terpotong dari inventaris master dan tercatat di riwayat mutasi stok.
        </p>
        <button
          type="button"
          className="inbound-primary"
          style={{ width: "100%" }}
          onClick={() => {
            dialogRef.current?.close();
            onBack();
          }}
        >
          Lihat Daftar Outbound
        </button>
      </dialog>
    </div>
  );
}

export default OutboundFulfillment;
