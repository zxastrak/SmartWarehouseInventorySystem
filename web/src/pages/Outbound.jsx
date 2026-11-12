import { typeOf } from "../utils/productTypes.js";
import { formatNumber } from "../utils/formatters.js";
import React, { useEffect, useRef, useState } from "react";
import DashboardSidebar from "../components/DashboardSidebar.jsx";
import WarehouseHeader from "../components/WarehouseHeader.jsx";
import CreateOutbound from "../components/CreateOutbound.jsx";
import OutboundFulfillment from "../components/OutboundFulfillment.jsx";
import CompletedOutbound from "../components/CompletedOutbound.jsx";
import OutboundIssueReview from "../components/OutboundIssueReview.jsx";
import ScheduledOutbound from "../components/ScheduledOutbound.jsx";
import { outboundStatuses, outboundTypes, outboundDate } from "../data/outbound.js";
import { downloadOutboundList } from "../utils/outbound.js";
import "../styles/dashboard.css";
import "../styles/inventory.css";
import "../styles/inbound.css";
import "../styles/outbound.css";

const titles = ["Create Outbound", "Add Items", "Review Outbound"];
const descriptions = [
  "Create a customer shipment, warehouse transfer, or internal request.",
  "Select products and quantities for this outbound request.",
  "Check the request before creating the scheduled outbound order.",
];

const actions = {
  Scheduled: "Tandai Datang",
  Arrived: "Menunggu Cek Staf",
  Inspecting: "Sedang Dicek Staf",
  Inspected: "Review & ACC",
  Shipped: "Details",
  Issue: "Review",
  Picking: "Sedang Dicek Staf",
  Packing: "Sedang Dicek Staf",
  "Ready to Ship": "Review & ACC",
};

function Outbound({
  initialShipmentId = null,
  manager,
  warehouse,
  shipments = [],
  inventory = [],
  onCreate,
  onStartPicking,
  drafts = {},
  onSaveDraft,
  onAdvance,
  onShip,
  onReportIssue,
  onResolveIssue,
  onViewMovements,
  onNavigate,
  onSignOut,
  onMarkArrived,
  onUpdateStaff,
  staffAccounts = [],
}) {
  const [creating, setCreating] = useState(false);
  const [stage, setStage] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [type, setType] = useState("All Types");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);
  const [navOpen, setNavOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [flowId, setFlowId] = useState(null);
  const [issueId, setIssueId] = useState(null);

  const issueShipment = shipments.find((row) => row.id === issueId);
  const flowShipment = shipments.find((row) => row.id === flowId);
  const detail = shipments.find((row) => row.id === detailId);
  const successRef = useRef(null);
  const detailRef = useRef(null);
  const warehouseName = warehouse?.warehouseName || "Main Warehouse";
  const latestDate = shipments.map((row) => row.date).sort().at(-1);

  const activeOutboundId = flowId || detailId || issueId;

  useEffect(() => {
    if (initialShipmentId && shipments.length > 0) {
      const row = shipments.find((r) => r.id === initialShipmentId);
      if (row) openShipment(row);
    }
  }, [initialShipmentId, shipments]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (activeOutboundId) {
        currentUrl.searchParams.set("id", activeOutboundId);
      } else {
        currentUrl.searchParams.delete("id");
      }
      if (currentUrl.pathname === "/outbound") {
        window.history.replaceState(null, "", currentUrl.pathname + currentUrl.search);
      }
    }
  }, [activeOutboundId]);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const currentMonthLabel = new Date().toLocaleString("id-ID", { month: "long", year: "numeric" });

  const filtered = shipments
    .filter(
      (row) =>
        `${row.id} ${row.reference || ""} ${row.destination || ""}`.toLowerCase().includes(query.toLowerCase()) &&
        (status === "All Statuses" || row.status === status) &&
        (type === "All Types" || row.type === type) &&
        (range === "all" ||
          (range === "latest" && row.date === latestDate) ||
          (range === "thismonth" && row.date?.startsWith(currentMonthPrefix)))
    )
    .sort((a, b) =>
      sort === "earliest"
        ? `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
        : sort === "latest"
        ? `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
        : sort === "destination"
        ? (a.destination || "").localeCompare(b.destination || "")
        : 0
    );

  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const activePage = Math.min(page, pages);
  const visible = filtered.slice((activePage - 1) * 6, activePage * 6);

  useEffect(() => setPage(1), [query, status, type, range, sort]);

  useEffect(() => {
    if (created) successRef.current?.showModal();
  }, [created]);

  useEffect(() => {
    if (detail) detailRef.current?.showModal();
  }, [detailId]);

  function back() {
    setFlowId(null);
    setDetailId(null);
    setIssueId(null);
    setCreating(false);
    setStage(0);
    setQuery("");
    window.scrollTo(0, 0);
  }

  function navigate(label) {
    if (label === "Suppliers") {
      onNavigate("suppliers");
      return;
    }
    if (label === "Staff Management" || label === "Settings") {
      onNavigate(label === "Settings" ? "settings" : "staff-management");
      return;
    }
    const routes = {
      Dashboard: "dashboard",
      Inventory: "inventory",
      Inbound: "inbound",
      Outbound: "outbound",
      "AI Insight": "ai-insight",
      "Purchase Orders": "purchase-orders",
      Suppliers: "suppliers",
      Reports: "reports",
      "Audit Trail": "audit-trail",
    };
    if (label === "Outbound") back();
    else if (routes[label]) onNavigate(routes[label]);
    else setNotice(`${label} will be connected after its design is implemented.`);
  }

  function create(draft) {
    const result = onCreate(draft);
    if (result.error) return result;
    back();
    setStatus("All Statuses");
    setType("All Types");
    setRange("all");
    setSort("default");
    setPage(1);
    setCreated(result.shipment);
    return result;
  }

  function openShipment(row) {
    if (row.status === "Issue" && row.pickIssue) {
      setIssueId(row.id);
      return;
    }
    if (row.status === "Shipped" && row.dispatch) {
      setFlowId(row.id);
      setCreating(false);
      setQuery("");
      window.scrollTo(0, 0);
      return;
    }
    if (["Scheduled", "Arrived", "Inspecting", "Inspected", "Picking", "Packing", "Ready to Ship"].includes(row.status)) {
      setFlowId(row.id);
      setCreating(false);
      setQuery("");
      window.scrollTo(0, 0);
    } else {
      setDetailId(row.id);
    }
  }

  function closeSuccess() {
    setCreated(null);
  }

  async function handleTableAction(row) {
    if (row.status === "Scheduled" && onMarkArrived) {
      const res = await onMarkArrived(row.id);
      if (res?.error) {
        setNotice(res.error);
      } else {
        setNotice(`Armada pengeluaran ${row.id} telah ditandai tiba di Dok ${row.dock || "1"}.`);
        openShipment({ ...row, status: "Arrived" });
      }
    } else {
      openShipment(row);
    }
  }

  return (
    <div className="dashboard-layout">
      <DashboardSidebar
        activePage="Outbound"
        warehouseName={warehouseName}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onNavigate={navigate}
      />
      <div className="dashboard-main">
        <WarehouseHeader
          onViewProfile={() => onNavigate("settings-profile")}
          manager={manager}
          search={query}
          onSearch={setQuery}
          onMenu={() => setNavOpen(true)}
          onSignOut={onSignOut}
          onAlerts={() => {
            back();
            setStatus("Issue");
            setNotice("Showing outbound issues.");
          }}
        />
        <main className="dashboard-content outbound-content">
          <div className="dashboard-intro" hidden={Boolean(flowShipment)}>
            <div>
              <p>
                {creating
                  ? ["OUTBOUND / BUAT JADWAL", "OUTBOUND / PILIH BARANG", "OUTBOUND / REVIEW JADWAL"][stage]
                  : "OPERASIONAL GUDANG"}
              </p>
              <h1>{creating ? titles[stage] : "Outbound"}</h1>
              <p className="inbound-description">
                {creating
                  ? descriptions[stage]
                  : "Kelola alur pengambilan (picking), scan barcode dok, dan pengiriman barang keluar secara akurat."}
              </p>
            </div>
            <div className="dashboard-date">
              <p>
                {new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "Asia/Jakarta",
                }).format(new Date())}
              </p>
              <p>{warehouseName}</p>
              {!creating && (
                <button
                  type="button"
                  className="inbound-primary inbound-create-button"
                  onClick={() => {
                    setCreating(true);
                    setStage(0);
                    setQuery("");
                    setNotice("");
                  }}
                >
                  <span>+</span> Jadwalkan Outbound
                </button>
              )}
            </div>
          </div>

          {/* Sub-tampilan Outbound */}
          {flowShipment ? (
            <>
              <div className="fulfillment-date">
                <p>
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date())}
                </p>
                <p>{warehouseName}</p>
              </div>

              {flowShipment.status === "Shipped" && flowShipment.dispatch ? (
                <CompletedOutbound
                  key={flowShipment.id}
                  shipment={flowShipment}
                  onDetails={() => setDetailId(flowShipment.id)}
                  onBack={back}
                />
              ) : flowShipment.status === "Scheduled" ? (
                <ScheduledOutbound
                  key={flowShipment.id}
                  shipment={flowShipment}
                  inventory={inventory}
                  onMarkArrived={async () => {
                    if (onMarkArrived) {
                      await onMarkArrived(flowShipment.id);
                      setNotice(`Armada pengeluaran ${flowShipment.id} tiba di Dok ${flowShipment.dock || "1"}.`);
                    }
                  }}
                  onBack={back}
                />
              ) : (
                <OutboundFulfillment
                  key={flowShipment.id}
                  shipment={flowShipment}
                  inventory={inventory}
                  staffAccounts={staffAccounts}
                  onUpdateStaff={onUpdateStaff}
                  onShip={(draft) => onShip(flowShipment.id, draft)}
                  onBack={back}
                  warehouseName={warehouseName}
                />
              )}
            </>
          ) : creating ? (
            <CreateOutbound
              inventory={inventory}
              stage={stage}
              onStage={setStage}
              onCancel={back}
              onCreate={create}
            />
          ) : (
            <>
              {/* Metrik Outbound */}
              <section className="inbound-metrics outbound-metrics" aria-label="Outbound summary">
                {[
                  [
                    "Terjadwal Hari Ini",
                    shipments.filter((s) => s.status === "Scheduled").length,
                    "→",
                    "Jadwal pengeluaran",
                    "green",
                    "jadwal",
                  ],
                  [
                    "Armada Tiba di Dok",
                    shipments.filter((s) => s.status === "Arrived" || s.status === "Inspecting" || s.status === "Picking").length,
                    "⏱",
                    "Menunggu / sedang dicek staf",
                    "rose",
                    "armada",
                  ],
                  [
                    "Siap Review & ACC",
                    shipments.filter((s) => s.status === "Inspected" || s.status === "Ready to Ship").length,
                    "✓",
                    "Scan barcode selesai",
                    "green",
                    "siap ACC",
                  ],
                  [
                    "Kendala / On Hold",
                    shipments.filter((s) => s.status === "Issue").length,
                    "!",
                    "Stok selisih atau rusak",
                    "rose",
                    "kendala",
                  ],
                ].map(([label, value, icon, caption, tone, unit]) => (
                  <div className={`inbound-metric metric-${tone}`} key={label}>
                    <span className="inbound-metric-icon">{icon}</span>
                    <div>
                      <h2>{label}</h2>
                      <p>
                        <strong>{formatNumber(value)}</strong> {unit}
                      </p>
                      <small>{caption}</small>
                    </div>
                  </div>
                ))}
              </section>

              {/* Tabel Daftar Pengiriman Outbound */}
              <section className="dashboard-card inbound-shipments-card">
                <h2>Daftar Pengiriman Outbound</h2>
                <p>Pesanan pelanggan, transfer gudang, dan pemenuhan logistik barang keluar.</p>

                <div className="inbound-list-filters">
                  <input
                    aria-label="Search outbound shipments"
                    placeholder="⌕ Cari ID outbound, DO, atau tujuan..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Outbound status filter"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option>All Statuses</option>
                    {["Scheduled", "Arrived", "Inspecting", "Inspected", "Shipped", "Issue"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Outbound type filter"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option>All Types</option>
                    {outboundTypes.map((row) => (
                      <option key={row.name}>{row.name}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Outbound date range"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    <option value="all">Semua Tanggal</option>
                    <option value="latest">Tanggal Terbaru</option>
                    <option value="thismonth">{currentMonthLabel}</option>
                  </select>
                  <select
                    aria-label="Sort outbound shipments"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="default">Urutkan</option>
                    <option value="earliest">Jadwal Terdahulu</option>
                    <option value="latest">Jadwal Terkini</option>
                    <option value="destination">Tujuan A–Z</option>
                  </select>
                  <button
                    type="button"
                    className="inbound-export-button"
                    onClick={() => {
                      downloadOutboundList(filtered);
                      setNotice(`${filtered.length} pengiriman berhasil diekspor.`);
                    }}
                  >
                    Ekspor CSV
                  </button>
                </div>

                <div className="inbound-table-wrap inbound-list-table">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Outbound ID",
                          "Referensi / DO",
                          "Tujuan",
                          "Jadwal Kirim",
                          "Dok",
                          "Total Unit",
                          "Status",
                          "Petugas Dok",
                          "Aksi",
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => {
                        const actionLabel = actions[row.status] || "Details";
                        const isArrived = row.status === "Arrived";
                        const isInspecting = row.status === "Inspecting";
                        const isInspected = row.status === "Inspected";

                        return (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.id}</strong>
                            </td>
                            <td>{row.reference || "-"}</td>
                            <td>
                              <strong>{row.destination}</strong>
                            </td>
                            <td>
                              {outboundDate(row.date)} · {row.time || "09:00"}
                            </td>
                            <td>
                              <span className="barcode-badge-item" style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}>
                                Dok {row.dock || "1"}
                              </span>
                            </td>
                            <td>{formatNumber(row.units)}</td>
                            <td>
                              <span className={`outbound-status status-${row.status.toLowerCase().replaceAll(" ", "-")}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>{row.staff || row.assigned_staff || "Staf Dok"}</td>
                            <td>
                              <button
                                type="button"
                                className={`dashboard-link${
                                  row.status === "Issue"
                                    ? " critical-text"
                                    : isInspected
                                    ? " positive-text"
                                    : ""
                                }`}
                                aria-label={`${actionLabel} ${row.id}`}
                                onClick={() => handleTableAction(row)}
                                style={
                                  isInspected
                                    ? { fontWeight: 800, color: "#166534" }
                                    : row.status === "Scheduled"
                                    ? { fontWeight: 700, color: "#5c732b" }
                                    : {}
                                }
                              >
                                {actionLabel} ›
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!visible.length && (
                        <tr>
                          <td colSpan="9" className="inventory-empty">
                            Tidak ada pengiriman outbound yang sesuai dengan filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="inventory-pagination">
                  <span>
                    Menampilkan {filtered.length ? (activePage - 1) * 6 + 1 : 0}–
                    {Math.min(activePage * 6, filtered.length)} dari {filtered.length} pengiriman
                  </span>
                  <div>
                    {Array.from({ length: pages }, (_, index) => (
                      <button
                        type="button"
                        key={index}
                        className={activePage === index + 1 ? "active-page" : ""}
                        aria-label={`Outbound page ${index + 1}`}
                        onClick={() => setPage(index + 1)}
                      >
                        {index + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={activePage === pages}
                      aria-label="Next outbound page"
                      onClick={() => setPage(activePage + 1)}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {notice && <p role="status" className="form-notice">{notice}</p>}
          <p className="dashboard-demo">
            Sistem Terintegrasi Live · Persetujuan (ACC) pengiriman otomatis memotong stok master gudang dan mencatat transaksi ke database MySQL.
          </p>
        </main>
      </div>

      {issueShipment && (
        <OutboundIssueReview
          key={issueShipment.id}
          shipment={issueShipment}
          inventory={inventory}
          onResolve={(values) => onResolveIssue(issueShipment.id, values)}
          onClose={() => setIssueId(null)}
        />
      )}

      {created && (
        <dialog
          ref={successRef}
          className="dashboard-dialog outbound-success"
          aria-labelledby="outbound-created-title"
          onCancel={closeSuccess}
        >
          <div className="outbound-success-check">✓</div>
          <h2 id="outbound-created-title">Jadwal Outbound Dibuat</h2>
          <dl className="outbound-summary-rows outbound-info">
            <div>
              <dt>Outbound ID</dt>
              <dd>{created.id}</dd>
            </div>
            <div>
              <dt>Tujuan</dt>
              <dd>{created.destination}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className="positive-text">Scheduled</dd>
            </div>
          </dl>
          <button type="button" className="inbound-primary" onClick={closeSuccess}>
            Lihat Daftar Outbound
          </button>
        </dialog>
      )}

      {detail && (
        <dialog
          ref={detailRef}
          className="dashboard-dialog outbound-detail"
          aria-labelledby="outbound-detail-title"
          onCancel={() => setDetailId(null)}
        >
          <h2 id="outbound-detail-title">
            {detail.id} · {detail.status}
          </h2>
          <dl className="outbound-summary-rows">
            {[
              ["Tipe", detail.type],
              ["Tujuan", detail.destination],
              ["Referensi / DO", detail.reference],
              ["Jadwal Kirim", `${outboundDate(detail.date)} · ${detail.time}`],
              ["Prioritas", detail.priority],
              ["Petugas Dok", detail.staff],
              ["Items / Unit", `${formatNumber(detail.items)} / ${formatNumber(detail.units)}`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="inbound-form-actions">
            <button type="button" className="inbound-secondary" onClick={() => setDetailId(null)}>
              Tutup
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}

export default Outbound;
