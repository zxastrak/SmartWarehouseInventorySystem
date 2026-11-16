import { typeOf } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import { inboundDate } from "../data/inbound.js";
import { shipmentProducts } from "../data/receiving.js";
import InboundItemQrDialog from "./InboundItemQrDialog.jsx";
import InboundItemDetailModal from "./InboundItemDetailModal.jsx";
import "../styles/scheduled.css";
const eventTime = (value) => value ? new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta"
}).format(new Date(value)) : "";
function ScheduledShipment({ shipment, inventory, warehouseName, staffAccounts = [], onBack, onInspect, onMarkArrived, onEditSchedule, onUpdateItemStaff }) {
  const [modal, setModal] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState({});
  const [inboundQrSku, setInboundQrSku] = useState(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const dialogRef = useRef(null);
  const submitting = useRef(false);
  const items = shipmentProducts(shipment, inventory);
  const total = items.reduce((sum, item) => sum + item.ordered, 0);
  const arrived = shipment.status === "Arrived";
  const arrivalWindow = `${inboundDate(shipment.date)} \xB7 ${shipment.time}${shipment.endTime ? "\u2013" + shipment.endTime : ""}`;
  useEffect(() => {
    if (modal && !dialogRef.current.open) dialogRef.current.showModal();
    else if (!modal && dialogRef.current.open) dialogRef.current.close();
  }, [modal]);
  function closeModal() {
    setModal(null);
    setError("");
  }
  function openArrival() {
    setConfirmed(false);
    setError("");
    setModal("arrival");
  }
  function confirmArrival() {
    if (submitting.current || confirmed) return;
    submitting.current = true;
    const result = onMarkArrived(shipment.id);
    if (result.error) setError(result.error);
    else setConfirmed(true);
    submitting.current = false;
  }
  function openEdit() {
    setSchedule({ date: shipment.date, time: shipment.time, endTime: shipment.endTime || "", dock: shipment.dock, staff: shipment.staff });
    setError("");
    setModal("edit");
  }
  function saveSchedule(event) {
    event.preventDefault();
    const result = onEditSchedule(shipment.id, schedule);
    if (result.error) setError(result.error);
    else closeModal();
  }
  function edit(key, value) {
    setSchedule((current) => ({ ...current, [key]: value }));
    setError("");
  }
  const timeline = [
    ["Inbound scheduled", shipment.scheduledAt ? `${eventTime(shipment.scheduledAt)}${shipment.scheduledBy ? " by " + shipment.scheduledBy : ""}` : "Delivery plan saved", true],
    [arrived ? "Shipment arrived" : "Expected arrival", arrived ? eventTime(shipment.arrivedAt) : arrivalWindow, arrived],
    ["Inspection", arrived ? (['Inspected', 'Received'].includes(shipment.status) ? "Completed by dock staff" : shipment.status === 'Inspecting' ? "In progress by dock staff" : "Waiting for dock staff inspection") : "Starts after arrival confirmation", ['Inspected', 'Received'].includes(shipment.status)]
  ];
  return <div className="scheduled-content">
    {!arrived && <button className="scheduled-edit dashboard-link" onClick={openEdit}>Edit Schedule</button>}
    
    {/* 1. Delivery Timeline di sebelah atas Scheduled Information */}
    <section className="dashboard-card scheduled-timeline scheduled-timeline-top">
      <div className="scheduled-timeline-header">
        <div>
          <h2>Delivery Timeline</h2>
          <p className="scheduled-timeline-desc">Alur kedatangan dan tahapan operasional pengiriman di dok gudang.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {arrived ? (
            <button className="inbound-primary" onClick={() => onInspect(shipment)}>Inspect Items</button>
          ) : (
            <button className="inbound-primary" onClick={openArrival}>Mark as Arrived</button>
          )}
        </div>
      </div>
      <ol>
        {timeline.map(([label, caption, complete]) => (
          <li key={label} className={complete ? "scheduled-event-complete" : ""}>
            <span aria-hidden="true" />
            <div>
              <strong>{label}</strong>
              <p>{caption}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>

    {/* 2. Scheduled Information Card */}
    <section className="dashboard-card scheduled-information">
      <div className="scheduled-heading"><h2>{shipment.id}</h2><span className={`inbound-status inbound-status-${shipment.status.toLowerCase()}`}>{shipment.status.toUpperCase()}</span></div>
      <dl>{[["Purchase Order", shipment.po], ["Supplier", shipment.supplier], ["Expected arrival", arrivalWindow], ["Receiving dock", shipment.dock], ["Assigned to", shipment.staff], ["Warehouse", warehouseName]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>

    {/* 3. Expected Items Card */}
    <section className="dashboard-card scheduled-items scheduled-items-full">
      <div className="scheduled-items-header-bar">
        <div>
          <h2>Expected Items</h2>
          <p>{items.length} products · {total} expected units</p>
        </div>
        <button
          type="button"
          className="inbound-secondary scheduled-items-batch-qr-btn"
          onClick={() => setInboundQrSku("")}
          title="Buka dialog cetak label QR untuk semua barang pengiriman ini"
        >
          <span aria-hidden="true">🏷️</span> Cetak Semua QR Barang ({items.length})
        </button>
      </div>
      <div className="scheduled-table-wrap"><table><thead><tr><th>SKU</th><th>Nama Produk</th><th>Tipe Barang</th><th>Ordered</th><th>Staf Bertugas</th><th>Aksi</th></tr></thead><tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#737b6c" }}>
              Tidak ada item produk dalam pengiriman ini.
            </td>
          </tr>
        ) : (
          items.map((item) => {
            const itemStaff = item.assigned_staff || item.staff || shipment.staff || shipment.assigned_staff || 'Semua Staf Lapangan';
            return (
            <tr key={item.sku}>
              <td>
                <strong
                  style={{ fontFamily: 'monospace', color: '#191d17', cursor: 'pointer', textDecoration: 'underline dotted' }}
                  onClick={() => setSelectedDetailItem(item)}
                  title="Klik untuk melihat detail item"
                >
                  {item.sku}
                </strong>
              </td>
              <td>
                <strong
                  style={{ cursor: 'pointer', color: '#191d17' }}
                  onClick={() => setSelectedDetailItem(item)}
                  title="Klik untuk melihat detail item"
                >
                  {item.name}
                </strong>
              </td>
              <td>
                <span className="scheduled-unit-badge">{typeOf(item) || item.category || 'General'}</span>
              </td>
              <td>
                <strong>{item.ordered}</strong> <span className="scheduled-unit-text">{item.unit || "pcs"}</span>
              </td>
              <td>
                <select
                  value={itemStaff}
                  onChange={(e) => onUpdateItemStaff && onUpdateItemStaff(shipment.id, item.sku, e.target.value)}
                  className="inbound-item-staff-select"
                  title={`Tugaskan staf untuk ${item.name}`}
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
                  <option value="Semua Staf Lapangan">👥 Semua Staf</option>
                  {staffAccounts
                    .filter((acc) => !['staff', 'staf'].includes(String(acc.fullName || acc.name || '').trim().toLowerCase()))
                    .map((acc) => {
                      const name = acc.fullName || acc.name;
                      return (
                        <option key={acc.id || name} value={name}>
                          👤 {name}
                        </option>
                      );
                    })}
                  {itemStaff && itemStaff !== 'Semua Staf Lapangan' && !['staff', 'staf'].includes(itemStaff.toLowerCase()) && !staffAccounts.some((acc) => (acc.fullName || acc.name) === itemStaff) && (
                    <option value={itemStaff}>👤 {itemStaff}</option>
                  )}
                </select>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="inbound-secondary"
                    style={{ padding: "4px 8px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={() => setSelectedDetailItem(item)}
                    title={`Lihat detail produk & lokasi rak ${item.sku}`}
                  >
                    <span>🔍 Detail</span>
                  </button>
                  <button
                    type="button"
                    className="inbound-secondary"
                    style={{ padding: "4px 8px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={() => setInboundQrSku(item.sku)}
                    title={`Generate QR label untuk ${item.sku}`}
                  >
                    <span>║▌║ QR</span>
                  </button>
                </div>
              </td>
            </tr>
          );})
        )}
      </tbody></table></div>
    </section>
    <section className="scheduled-next"><strong>What happens next?</strong><p>{arrived ? "Arrival confirmed. Inspect delivered quantities and conditions before completing receiving." : "Marking the shipment as arrived enables item inspection and changes its status to Arrived."}</p></section>
    <button className="dashboard-link scheduled-back" onClick={onBack}>‹ Back to Inbound</button>
    <dialog ref={dialogRef} className="scheduled-dialog" aria-labelledby="scheduled-dialog-title" onCancel={(event) => {
    event.preventDefault();
    closeModal();
  }}>
      <button className="scheduled-close" aria-label="Close dialog" onClick={closeModal}>×</button>
      {modal === "arrival" && <>
        <span className="scheduled-arrival-icon" aria-hidden="true" style={{ background: confirmed ? '#dcfce7' : undefined, color: confirmed ? '#16a34a' : undefined }}>{confirmed ? "✓" : "↓"}</span>
        <h2 id="scheduled-dialog-title">{confirmed ? "Confirmed!" : "Mark Shipment as Arrived?"}</h2>
        <p className="scheduled-dialog-description">{confirmed ? `Arrival recorded for ${shipment.id}. Item inspection is now available for dock verification.` : `Confirm that ${shipment.id} has physically arrived at receiving dock ${shipment.dock}.`}</p>
        <section className="scheduled-dialog-summary"><dl>{[["Shipment", shipment.id], ["Supplier", shipment.supplier], ["Expected units", total]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{confirmed ? "Arrival recorded. Stock will be added only after inspection and Complete Receiving." : "Status will change from Scheduled to Arrived and item inspection will become available."}</p></section>
        {error && <p className="field-error" role="alert">{error}</p>}
        {confirmed ? <><div className="scheduled-confirmed" role="status">Confirmed!</div><button className="dashboard-link scheduled-modal-footer" onClick={() => onInspect(shipment)}>Continue to Inspect Items ›</button></> : <><div className="scheduled-dialog-actions"><button className="inbound-secondary" onClick={closeModal}>Cancel</button><button className="inbound-primary" onClick={confirmArrival}>Confirm Arrival</button></div><p className="scheduled-modal-footer">After confirmation, continue to Inspect Items.</p></>}
      </>}
      {modal === "edit" && <form onSubmit={saveSchedule} noValidate>
        <h2 id="scheduled-dialog-title">Edit Schedule</h2><p className="scheduled-dialog-description">Update the delivery plan for {shipment.id}.</p>
        <div className="scheduled-edit-fields">
          <label>Expected arrival date<input type="date" value={schedule.date || ""} onChange={(event) => edit("date", event.target.value)} /></label>
          <label>Start time<input type="time" value={schedule.time || ""} onChange={(event) => edit("time", event.target.value)} /></label>
          <label>End time (optional)<input type="time" value={schedule.endTime || ""} onChange={(event) => edit("endTime", event.target.value)} /></label>
          <label>Receiving dock<input type="text" autoComplete="off" placeholder="Enter dock code, e.g. D-02" aria-label="Receiving dock" value={schedule.dock || ""} onChange={(event) => edit("dock", event.target.value)} /></label>
          <label>
            Assigned to
            <input
              type="text"
              list="staff-list-options"
              autoComplete="off"
              placeholder="Pilih atau masukkan nama staf"
              aria-label="Assigned to"
              value={schedule.staff || ""}
              onChange={(event) => edit("staff", event.target.value)}
            />
            <datalist id="staff-list-options">
              <option value="Semua Staf Lapangan" />
              {staffAccounts.map((s) => (
                <option key={s.id || s.name} value={s.fullName || s.name} />
              ))}
            </datalist>
          </label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="scheduled-dialog-actions"><button type="button" className="inbound-secondary" onClick={closeModal}>Cancel</button><button className="inbound-primary" type="submit">Save Schedule</button></div>
      </form>}
    </dialog>

    {inboundQrSku !== null && (
      <InboundItemQrDialog
        shipment={{ ...shipment, products: items }}
        initialSku={inboundQrSku}
        onClose={() => setInboundQrSku(null)}
      />
    )}

    {selectedDetailItem !== null && (
      <InboundItemDetailModal
        item={selectedDetailItem}
        inventory={inventory}
        shipment={shipment}
        onClose={() => setSelectedDetailItem(null)}
      />
    )}
  </div>;
}
export {
  ScheduledShipment as default
};
