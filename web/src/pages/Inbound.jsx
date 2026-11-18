import { typeOf, matchesText, findProduct, normaliseType, cleanText } from "../utils/productTypes.js";
import { formatNumber } from "../utils/formatters.js";
import InboundIssueReview from "../components/InboundIssueReview.jsx";
import CompletedReceiving from "../components/CompletedReceiving.jsx";
import ScheduledShipment from "../components/ScheduledShipment.jsx";
import InboundReceiving from "../components/InboundReceiving.jsx";
import QrHistoryDialog from "../components/QrHistoryDialog.jsx";
import React, { useEffect, useRef, useState } from "react";
import DashboardSidebar from "../components/DashboardSidebar.jsx";
import WarehouseHeader from "../components/WarehouseHeader.jsx";
import Icon from "../components/DashboardIcon.jsx";
import CreateInbound, { DetailRows, ItemsTable } from "../components/CreateInbound.jsx";
import { inboundStatuses, inboundDate } from "../data/inbound.js";
import "../styles/dashboard.css";
import "../styles/inventory.css";
import "../styles/inbound.css";
const stageNames = ["Create Inbound", "Create Inbound", "Review New Inbound", "Inbound Created"];
const stageDescriptions = ["Create an inbound shipment from an approved purchase order.", "Set the expected arrival and receiving assignment.", "Confirm the purchase order and delivery schedule before creating.", "The incoming shipment has been scheduled successfully."];
const actionNames = { 
  Order: "Tandai Datang", 
  Scheduled: "Tandai Datang", 
  Arrived: "Menunggu Cek Staf", 
  Inspect: "Sedang Dicek Staf", 
  Inspecting: "Sedang Dicek Staf", 
  Review: "Review & ACC", 
  Inspected: "Review & ACC", 
  Complete: "Details", 
  Received: "Details", 
  Issue: "Review" 
};
function Inbound({ manager, warehouse, shipments, inventory, racks, receivingDrafts, staffAccounts = [], onSaveDraft, onInspect, onCompleteReceiving, onResolveIssue, onUpdateStaff, onUpdateItemStaff, onCreate, onMarkArrived, onEditSchedule, onViewMovements, movements, onNavigate, onSignOut, purchaseOrders = [], initialShipmentId = null }) {
  const [creating, setCreating] = useState(false), [stage, setStage] = useState(0), [query, setQuery] = useState(""), [status, setStatus] = useState("All Statuses"), [dateRange, setDateRange] = useState("all"), [sort, setSort] = useState("default"), [page, setPage] = useState(1), [navOpen, setNavOpen] = useState(false), [detail, setDetail] = useState(null), [notice, setNotice] = useState("");
  const [receivingId, setReceivingId] = useState(null), [receivingHeader, setReceivingHeader] = useState({ title: "Inspect Inbound Shipment", description: "Verify delivered quantities and condition before adding stock to inventory.", stage: "inspect" });
  const [issueId, setIssueId] = useState(null);
  const issueShipment = shipments.find((row) => row.id === issueId);
  const [completedId, setCompletedId] = useState(null);
  const completedShipment = shipments.find((row) => row.id === completedId);
  const [scheduledId, setScheduledId] = useState(null);
  const [showQrHistory, setShowQrHistory] = useState(false);
  const scheduledShipment = shipments.find((row) => row.id === scheduledId);
  const receivingShipment = shipments.find((row) => row.id === receivingId);

  function openShipment(row) {
    setCompletedId(null);
    setIssueId(null);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/inbound?id=${encodeURIComponent(row.id)}`);
    }
    if (["Arrived", "Inspect", "Inspecting", "Review", "Inspected"].includes(row.status)) {
      setScheduledId(null);
      setReceivingId(row.id);
      setCreating(false);
      setQuery("");
      setNotice("");
      window.scrollTo(0, 0);
      return;
    }
    if (row.status === "Order" || row.status === "Scheduled") {
      setScheduledId(row.id);
      setReceivingId(null);
      setCreating(false);
      setQuery("");
      setNotice("");
      window.scrollTo(0, 0);
    } else if (row.status === "Complete" || row.status === "Received") {
      setCompletedId(row.id);
      setScheduledId(null);
      setReceivingId(null);
      setCreating(false);
      setQuery("");
      setNotice("");
      window.scrollTo(0, 0);
    } else if (row.status === "Issue") {
      setIssueId(row.id);
      setScheduledId(null);
      setReceivingId(null);
      setCreating(false);
      setQuery("");
      setNotice("");
      window.scrollTo(0, 0);
    } else setDetail(row);
  }
  useEffect(() => {
    if (initialShipmentId) {
      const row = shipments.find((row2) => row2.id === initialShipmentId);
      if (row) openShipment(row);
    }
  }, [initialShipmentId]);

  const activeInboundId = scheduledId || receivingId || completedId || issueId;
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (activeInboundId) {
        currentUrl.searchParams.set("id", activeInboundId);
      } else {
        currentUrl.searchParams.delete("id");
      }
      if (currentUrl.pathname === "/inbound") {
        window.history.replaceState(null, "", currentUrl.pathname + currentUrl.search);
      }
    }
  }, [activeInboundId]);
  const dialogRef = useRef(null), warehouseName = warehouse?.warehouseName || "Main Warehouse";
  const eligibleOrders = purchaseOrders.filter((order) => order.status === "Approved" && !shipments.some((shipment) => shipment.po === order.id));
  const dates = shipments.map((row) => row.date).sort(), latestDate = dates.at(-1);
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // e.g. "2026-10"
  const currentMonthLabel = new Date().toLocaleString("id-ID", { month: "long", year: "numeric" }); // e.g. "Oktober 2026"
  const filtered = shipments
    .filter(
      (row) =>
        `${row.id} ${row.po} ${row.supplier}`.toLowerCase().includes(query.toLowerCase()) &&
        (status === "All Statuses" || row.status === status) &&
        (dateRange === "all" ||
          (dateRange === "latest" && row.date === latestDate) ||
          (dateRange === "thismonth" && row.date.startsWith(currentMonthPrefix)))
    )
    .sort((a, b) => {
      if (sort === "newest") {
        return (
          (b.backendId && a.backendId ? b.backendId - a.backendId : 0) ||
          (b.scheduledAt || "").localeCompare(a.scheduledAt || "") ||
          b.id.localeCompare(a.id, undefined, { numeric: true }) ||
          `${b.date}T${b.time || "00:00"}`.localeCompare(`${a.date}T${a.time || "00:00"}`)
        );
      }
      if (sort === "oldest") {
        return (
          (a.backendId && b.backendId ? a.backendId - b.backendId : 0) ||
          (a.scheduledAt || "").localeCompare(b.scheduledAt || "") ||
          a.id.localeCompare(b.id, undefined, { numeric: true }) ||
          `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`)
        );
      }
      if (sort === "earliest") {
        return `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`);
      }
      if (sort === "latest") {
        return `${b.date}T${b.time || "00:00"}`.localeCompare(`${a.date}T${a.time || "00:00"}`);
      }
      if (sort === "supplier") {
        return a.supplier.localeCompare(b.supplier);
      }
      return 0;
    });
  const pages = Math.max(1, Math.ceil(filtered.length / 6)), activePage = Math.min(page, pages), visible = filtered.slice((activePage - 1) * 6, activePage * 6);
  useEffect(() => setPage(1), [query, status, dateRange, sort]);
  useEffect(() => {
    if (detail) dialogRef.current?.showModal();
  }, [detail]);
  function navigate(label) {
    if (label === "Suppliers") {
      onNavigate("suppliers");
      return;
    }
    if (label === "Staff Management" || label === "Settings") {
      onNavigate(label === "Settings" ? "settings" : "staff-management");
      return;
    }
    const routes = { Dashboard: "dashboard", Inventory: "inventory", Inbound: "inbound", Outbound: "outbound", "AI Insight": "ai-insight", "Purchase Orders": "purchase-orders", Suppliers: "suppliers", Reports: "reports", "Audit Trail": "audit-trail" };
    if (label === "Inbound") back();
    else if (routes[label]) onNavigate(routes[label]);
    else setNotice(`${label} will be connected after its design is implemented.`);
  }
  function back() {
    setIssueId(null);
    setCompletedId(null);
    setScheduledId(null);
    setReceivingId(null);
    setCreating(false);
    setStage(0);
    setQuery("");
    window.scrollTo(0, 0);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/inbound');
    }
  }
  function start() {
    setIssueId(null);
    setCompletedId(null);
    setScheduledId(null);
    setCreating(true);
    setStage(0);
    setQuery("");
    setNotice("");
    window.scrollTo(0, 0);
  }
  function exportList() {
    const keys = ["id", "po", "supplier", "date", "time", "items", "units", "status"];
    const escape = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
    const csv = "\uFEFF" + [keys, ...filtered.map((row) => keys.map((key) => row[key]))].map((row) => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "susuno-inbound-list.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    setNotice(`${filtered.length} matching shipments exported as CSV.`);
  }

  return (
    <div className="dashboard-layout"><DashboardSidebar activePage="Inbound" warehouseName={warehouseName} open={navOpen} onClose={() => setNavOpen(false)} onNavigate={navigate} /><div className="dashboard-main"><WarehouseHeader onViewProfile={() => onNavigate("settings-profile")} manager={manager} search={query} onSearch={setQuery} onMenu={() => setNavOpen(true)} onSignOut={onSignOut} onNavigate={onNavigate} shipments={shipments} onAlerts={() => {
    back();
    setStatus("Arrived");
    setNotice("Showing arrivals waiting for inspection.");
  }} /><main className={`dashboard-content inbound-content${receivingShipment ? " receiving-page" : ""}`}><div className="dashboard-intro"><div><p>{issueShipment ? "INBOUND / REVIEW" : receivingShipment ? receivingHeader.stage === "inspect" ? "INBOUND / INSPECTION" : "INBOUND / INSPECTION / REVIEW" : scheduledShipment ? "INBOUND / DETAILS" : "WAREHOUSE OPERATIONS"}</p><h1>{issueShipment ? "Review Inbound Issue" : completedShipment ? "Completed Receiving Details" : receivingShipment ? receivingHeader.title : scheduledShipment ? ["Order", "Scheduled"].includes(scheduledShipment.status) ? "Scheduled Shipment Detail" : "Shipment Detail" : creating ? stageNames[stage] : "Inbound"}</h1><p className="inbound-description">{issueShipment ? "Resolve damaged and mismatched items before completing receiving." : completedShipment ? "Read-only record of the completed inbound receiving process." : receivingShipment ? receivingHeader.description : scheduledShipment ? ["Order", "Scheduled"].includes(scheduledShipment.status) ? "Review the delivery plan before the shipment arrives." : "Arrival confirmed. Inspect items before completing receiving." : creating ? stageDescriptions[stage] : "Track, inspect, and receive incoming stock from suppliers."}</p></div><div className="dashboard-date"><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(/* @__PURE__ */ new Date())}</p><p>{warehouseName}</p>{!creating && !receivingShipment && !scheduledShipment && !completedShipment && !issueShipment && <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "14px", flexWrap: "wrap", justifyContent: "flex-end" }}><button type="button" className="inbound-secondary" onClick={() => setShowQrHistory(true)} title="Lihat riwayat pembuatan dan pencetakan QR Code" style={{ height: "40px", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600, fontSize: "13px" }}><span aria-hidden="true">📜</span> Riwayat QR</button><button className="inbound-primary inbound-create-button" onClick={start}><span aria-hidden="true">+</span> Create Inbound</button></div>}</div></div>
 {issueShipment ? <InboundIssueReview key={issueShipment.id} shipment={issueShipment} onResolve={onResolveIssue} onContinue={openShipment} onBack={back} /> : completedShipment ? <CompletedReceiving key={completedShipment.id} shipment={completedShipment} inventory={inventory} movements={movements} warehouseName={warehouseName} onBack={back} onViewMovements={onViewMovements} /> : receivingShipment ? <InboundReceiving key={receivingShipment.id} shipment={receivingShipment} inventory={inventory} racks={racks} staffAccounts={staffAccounts} initialDraft={receivingDrafts[receivingShipment.id]} onSaveDraft={(draft) => onSaveDraft(receivingShipment.id, draft)} onInspect={onInspect} onUpdateStaff={onUpdateStaff} onUpdateItemStaff={onUpdateItemStaff} onComplete={(draft) => onCompleteReceiving(receivingShipment.id, draft)} onBack={back} onNavigate={onNavigate} warehouseName={warehouseName} onHeaderChange={setReceivingHeader} /> : scheduledShipment ? <ScheduledShipment key={scheduledShipment.id} shipment={scheduledShipment} inventory={inventory} staffAccounts={staffAccounts} warehouseName={warehouseName} onBack={back} onInspect={openShipment} onMarkArrived={onMarkArrived} onEditSchedule={onEditSchedule} onUpdateItemStaff={onUpdateItemStaff} /> : creating ? <CreateInbound orders={eligibleOrders} warehouseName={warehouseName} search={query} onSearch={setQuery} onCancel={back} onCreate={onCreate} onDetails={setDetail} onStageChange={setStage} /> : <>
{eligibleOrders.length > 0 && (
  <div style={{
    background: '#f0f7ff',
    border: '1px solid #c7ddff',
    borderRadius: '10px',
    padding: '12px 18px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '24px' }}>📋</span>
      <div>
        <strong style={{ display: 'block', fontSize: '14px', color: '#1e40af' }}>
          {eligibleOrders.length} Purchase Order Telah Disetujui Siap Dijadwalkan
        </strong>
        <span style={{ fontSize: '12px', color: '#3b82f6' }}>
          Pesanan pembelian telah disetujui, jadwalkan waktu kedatangan armada pengiriman ke dok gudang.
        </span>
      </div>
    </div>
    <button
      type="button"
      className="inbound-primary"
      style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}
      onClick={start}
    >
      + Jadwalkan Inbound
    </button>
  </div>
)}
<section className="inbound-metrics" aria-label="Inbound summary">{[["Expected Today", shipments.filter((s) => ["Order", "Scheduled"].includes(s.status)).length, "inbound", "Scheduled shipments", "green"], ["Completed Today", shipments.filter((s) => ["Complete", "Received"].includes(s.status)).length, "check", "Completed arrivals", "green"], ["Pending Review / Inspect", shipments.filter((s) => ["Arrived", "Inspect", "Inspecting", "Review", "Inspected"].includes(s.status)).length, "warning", "Requires warehouse review", "rose"], ["Issues Reported", shipments.filter((s) => s.status === "Issue").length, "close", "Damaged or quantity mismatch", "rose"]].map(([label, value, icon, caption, tone]) => <div className={`inbound-metric metric-${tone}`} key={label}><span className="inbound-metric-icon">{icon === "check" ? "\u2713" : icon === "inbound" ? "\u2193" : icon === "warning" ? "!" : "\xD7"}</span><div><h2>{label}</h2><p><strong>{formatNumber(value)}</strong> shipments</p><small>{caption}</small></div></div>)}</section><section className="dashboard-card inbound-shipments-card"><h2>Inbound Shipments</h2><p>Purchase orders and incoming deliveries assigned to this warehouse.</p><div className="inbound-list-filters"><div className="inbound-search"><Icon name="search" /><input aria-label="Search inbound ID, PO or supplier" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inbound ID, PO, or supplier..." /></div><select aria-label="Inbound status filter" value={status} onChange={(event) => setStatus(event.target.value)}><option>All Statuses</option>{inboundStatuses.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Inbound date range" value={dateRange} onChange={(event) => setDateRange(event.target.value)}><option value="all">Date Range</option><option value="latest">Latest arrival date</option><option value="thismonth">{currentMonthLabel}</option></select><select aria-label="Sort inbound shipments" value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">Sort by</option><option value="newest">Order Terbaru</option><option value="oldest">Order Terlama</option><option value="earliest">Earliest arrival</option><option value="latest">Latest arrival</option><option value="supplier">Supplier A–Z</option></select><button className="inbound-export-button" onClick={exportList}>Export List</button></div><div className="inbound-table-wrap inbound-list-table"><table><thead><tr>{["Inbound ID", "Purchase Order", "Supplier", "Arrival Date", "Arrival Time", "Items", "Units", "Status", "Action"].map((value) => <th key={value}>{value}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.id}</strong></td><td>{row.po}</td><td><strong>{row.supplier}</strong></td><td>{inboundDate(row.date)}</td><td>{row.time || "-"}</td><td>{formatNumber(row.items)}</td><td>{formatNumber(row.units)}</td><td><span className={`inbound-status inbound-status-${row.status.toLowerCase()}`}>{row.status}</span></td><td><button className={`dashboard-link${row.status === "Issue" || row.status === "Issues" ? " critical-text" : ""}`} aria-label={`${actionNames[row.status] || "Details"} ${row.id}`} onClick={() => openShipment(row)}>{actionNames[row.status] || "Details"} ›</button></td></tr>)}{!visible.length && <tr><td colSpan="9" className="inventory-empty">No inbound shipments match these filters.</td></tr>}</tbody></table></div>
        <div className="inventory-pagination">
          <span>Showing {filtered.length ? (activePage - 1) * 6 + 1 : 0}–{Math.min(activePage * 6, filtered.length)} of {filtered.length} shipments</span>
          <div>
            {Array.from({ length: pages }, (_, index) => (
              <button key={index} className={activePage === index + 1 ? "active-page" : ""} aria-label={`Inbound page ${index + 1}`} onClick={() => setPage(index + 1)}>
                {index + 1}
              </button>
            ))}
            <button disabled={activePage === pages} aria-label="Next inbound page" onClick={() => setPage(activePage + 1)}>›</button>
          </div>
        </div>
      </section>
    </>}
  {notice && <p role="status" className="form-notice">{notice}</p>}
</main>
</div>
{detail && (
  <dialog ref={dialogRef} className="dashboard-dialog inbound-detail-dialog" aria-labelledby="inbound-detail-title" onCancel={() => setDetail(null)}>
    <h2 id="inbound-detail-title">{detail.id} · {detail.status}</h2>
    <DetailRows rows={[["PURCHASE ORDER", detail.po], ["SUPPLIER", detail.supplier], ["EXPECTED", `${inboundDate(detail.date, true)} \xB7 ${detail.time}`], ["DOCK", detail.dock], ["ASSIGNED TO", detail.staff], ["ITEMS / UNITS", `${formatNumber(detail.items)} / ${formatNumber(detail.units)}`], ...detail.carrier ? [["CARRIER", detail.carrier]] : [], ...detail.reference ? [["REFERENCE", detail.reference]] : []]} />
    {detail.receipt && (
      <div className="inbound-receipt-detail">
        <h3>Receiving completed</h3>
        <p>{formatNumber(detail.receipt.summary.accepted)} units accepted · {formatNumber(detail.receipt.summary.damaged + detail.receipt.summary.rejected + detail.receipt.summary.short)} issue units · PO {detail.poStatus}</p>
        <p>{detail.receipt.notes || "No issue notes"}</p>
      </div>
    )}
    {detail.products && <ItemsTable order={{ products: detail.products }} />}
    <p>Shipment detail preview. Inspect and Continue open the receiving flow for Arrived or Inspecting shipments. Issue review will be connected with its next design.</p>
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
      <button className="continue-button" onClick={() => setDetail(null)}>Close</button>
      {['Arrived', 'Inspect', 'Inspecting', 'Review', 'Inspected'].includes(detail.status) && (
        <button
          className="inbound-primary"
          style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '8px', cursor: 'pointer' }}
          onClick={() => {
            const target = detail;
            setDetail(null);
            openShipment(target);
          }}
        >
          {detail.status === 'Arrived' ? 'Inspect Items ›' : ['Review', 'Inspected'].includes(detail.status) ? 'Review & Receive ›' : 'Continue Inspection ›'}
        </button>
      )}
    </div>
  </dialog>
)}
{showQrHistory && (
  <QrHistoryDialog
    onClose={() => setShowQrHistory(false)}
  />
)}
</div>
);
}
export {
  Inbound as default
};
