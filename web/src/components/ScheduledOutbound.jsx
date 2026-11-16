import { typeOf } from "../utils/productTypes.js";
import React, { useState } from "react";
import { outboundDate } from "../data/outbound.js";
import { validateOutboundItems } from "../utils/outbound.js";
import "../styles/outboundFulfillment.css";
import "../styles/scheduledOutbound.css";

function ScheduledOutbound({ shipment, inventory = [], onStart, onMarkArrived, onBack }) {
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const products = shipment.products || shipment.items || [];
  const units = products.reduce((sum, row) => sum + (row.quantity || row.ordered_qty || 0), 0);
  const stockError = validateOutboundItems(products, inventory);
  const shortages = products.flatMap((row) => {
    const available = inventory.find((item) => item.sku === row.sku)?.current || 0;
    const req = row.quantity || row.ordered_qty || 0;
    return available < req ? [{ ...row, available, short: req - available }] : [];
  });

  async function handleMarkArrived() {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      if (onMarkArrived) {
        await onMarkArrived(shipment.id);
      } else if (onStart) {
        await onStart();
      }
    } catch (err) {
      setError(err.message || "Gagal menandai armada datang");
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <div className="fulfillment-heading">
        <div>
          <p>OUTBOUND / JADWAL PENGELUARAN</p>
          <h1>Detail Jadwal Outbound</h1>
          <p className="inbound-description">Verifikasi daftar barang keluar sebelum menandai kedatangan armada di dok pemuatan.</p>
        </div>
      </div>

      <ol className="outbound-steps dashboard-card">
        {["Jadwal Pengeluaran", "Armada Tiba di Dok", "Picking & Scan Staf", "Review & ACC"].map((label, i) => (
          <li key={label} className={i === 0 ? "reached" : ""} aria-current={i === 0 ? "step" : undefined}>
            <span>{i + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <div className="fulfillment-grid scheduled-outbound-grid">
        <section className="dashboard-card fulfillment-panel">
          <h2>{shipment.type === "Warehouse transfer" ? "Transfer Antar Gudang" : shipment.type === "Customer order" ? "Pengiriman Pelanggan" : "Pengeluaran Internal"}</h2>
          <dl className="scheduled-outbound-summary">
            <div>
              <dt>Tujuan</dt>
              <dd>{shipment.destination}</dd>
            </div>
            <div>
              <dt>Referensi / DO</dt>
              <dd>{shipment.reference || "-"}</dd>
            </div>
          </dl>

          <h2 className="scheduled-outbound-items-title">Barang yang Akan Diambil (Picking)</h2>
          <div className="inbound-table-wrap scheduled-outbound-table">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Lokasi Rak</th>
                  <th>Jumlah Diminta</th>
                  <th>Stok Tersedia</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => {
                  const inv = inventory.find((item) => item.sku === row.sku);
                  return (
                    <tr key={row.sku}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>{row.sku} · Tipe: {typeOf(row)}</small>
                      </td>
                      <td>
                        <span className="barcode-badge-item" style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}>
                          📍 {row.rack || inv?.rack || "A-01"}
                        </span>
                      </td>
                      <td><strong>{row.quantity || row.ordered_qty}</strong></td>
                      <td>{inv?.current ?? row.current_stock ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {shipment.notes && <p className="fulfillment-muted">Catatan: {shipment.notes}</p>}
        </section>

        <aside className="dashboard-card fulfillment-panel scheduled-outbound-assignment">
          <h2>Penugasan Dok</h2>
          <dl className="outbound-summary-rows">
            <div>
              <dt>Petugas Dok</dt>
              <dd>{shipment.staff || shipment.assigned_staff || "Semua Staf Lapangan"}</dd>
            </div>
            <div>
              <dt>Jadwal Keberangkatan</dt>
              <dd>{outboundDate(shipment.date || shipment.scheduled_date)} · {shipment.time || shipment.scheduled_time || "09:00"}</dd>
            </div>
            <div>
              <dt>Total Unit</dt>
              <dd><strong>{units}</strong> unit</dd>
            </div>
            <div>
              <dt>Dok Pemuatan</dt>
              <dd>Dok {shipment.dock || "1"}</dd>
            </div>
          </dl>

          <div className="fulfillment-warning" style={{ background: "#ecfeff", borderColor: "#67e8f9" }}>
            <strong style={{ color: "#0e7490" }}>Alur Handover Staf Dok</strong>
            <p style={{ color: "#155e75" }}>
              Setelah Anda mengklik <strong>"Tandai Armada Datang di Dok"</strong>, tugas picking akan otomatis muncul di aplikasi Mobile staf dok untuk pengambilan fisik dan scan barcode.
            </p>
          </div>

          {shortages.length > 0 && (
            <div className="scheduled-outbound-stock" role="status">
              <strong>Stok Tidak Mencukupi</strong>
              {shortages.map((row) => (
                <p key={row.sku}>
                  {row.name}: {row.available} tersedia / {row.quantity || row.ordered_qty} diminta (Kurang {row.short})
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            className="inbound-primary"
            disabled={Boolean(stockError) || starting}
            onClick={handleMarkArrived}
            style={{ width: "100%", padding: "12px 18px", fontSize: 13 }}
          >
            {starting ? "Memproses..." : "🚚 Tandai Armada Datang di Dok"}
          </button>
        </aside>
      </div>

      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="button" className="dashboard-link outbound-back" onClick={onBack}>‹ Kembali</button>
    </>
  );
}

export default ScheduledOutbound;
