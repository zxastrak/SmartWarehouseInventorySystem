import { typeOf, matchesText, findProduct, normaliseType, cleanText } from "../utils/productTypes.js";
import React, { useEffect, useRef, useState } from "react";
import PurchaseOrderFlow, { poFlowTitles } from "../components/PurchaseOrderFlow.jsx";
import DashboardSidebar from "../components/DashboardSidebar.jsx";
import WarehouseHeader from "../components/WarehouseHeader.jsx";
import { purchaseOrderStatuses } from "../data/purchaseOrders.js";
import { poTotal, poMoney, poDate, poToday, downloadPurchaseOrder } from "../utils/purchaseOrders.js";
import { categoriesApi } from "../utils/api.js";
import "../styles/dashboard.css";
import "../styles/inventory.css";
import "../styles/inbound.css";
import "../styles/purchaseOrders.css";

function PurchaseOrders({
  manager,
  warehouse,
  orders = [],
  inventory = [],
  suppliers = [],
  onDecide,
  onCreate,
  onNavigate,
  onSignOut,
  racks,
  shipments,
  onReceive,
  onRevise,
  onOpenInbound,
  onMovements,
  initialOrderId = null,
  initialSupplier = null,
}) {
  const [view, setView] = useState(
    () =>
      ({ "In Transit": "track", "Partially Received": "partial", Overdue: "overdue", Received: "completed" })[
        orders.find((row) => row.id === initialOrderId)?.status
      ] || "details"
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Status");
  const [supplier, setSupplier] = useState("All Suppliers");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(initialOrderId);
  const [navOpen, setNavOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const list = await categoriesApi.getAll();
        if (Array.isArray(list)) {
          setCategories(list);
        } else {
          setCategories([]);
        }
      } catch (err) {
        console.error("Failed to load categories in PurchaseOrders:", err);
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    if (initialOrderId) {
      setSelected(initialOrderId);
    }
  }, [initialOrderId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (selected) {
        currentUrl.searchParams.set("po", selected);
      } else {
        currentUrl.searchParams.delete("po");
      }
      if (currentUrl.pathname === "/purchase-orders") {
        window.history.replaceState(null, "", currentUrl.pathname + currentUrl.search);
      }
    }
  }, [selected]);

  const supplierOptions = Array.from(
    new Set([
      ...suppliers.map((s) => (typeof s === "string" ? s : s.name)?.trim()).filter(Boolean),
      ...inventory.map((i) => i.supplier?.trim()).filter(Boolean),
      ...orders.map((o) => o.supplier?.trim()).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const allKnownProducts = (() => {
    const map = new Map();
    // 1. Dari katalog resmi supplier (jika ada)
    (suppliers || []).forEach((s) => {
      (s.catalog || []).forEach((cp) => {
        const code = cp.sku || cp.code;
        if (code) {
          map.set(code.toLowerCase(), {
            sku: code,
            name: cp.name || code,
            category: cp.category || cp.category_name || "Electronics",
            price: Number(cp.price) || 0,
            supplier: s.name || "",
            supplier_id: s.id,
          });
        }
      });
    });
    // 2. Dari inventory master gudang
    (inventory || []).forEach((p) => {
      if (p.sku) {
        const existing = map.get(p.sku.toLowerCase());
        map.set(p.sku.toLowerCase(), {
          sku: p.sku,
          name: p.name || p.sku,
          category: p.category || "Electronics",
          price: Number(p.price) || 0,
          supplier: p.supplier || existing?.supplier || "",
          supplier_id: p.supplier_id || existing?.supplier_id,
        });
      }
    });
    // 3. Dari riwayat order terdahulu
    (orders || []).forEach((o) => {
      (o.products || []).forEach((p) => {
        const code = p.code || p.sku;
        if (code && !map.has(code.toLowerCase())) {
          map.set(code.toLowerCase(), {
            sku: code,
            name: p.name || code,
            category: p.category || "Electronics",
            price: Number(p.unitPrice) || 0,
            supplier: o.supplier || "",
          });
        }
      });
    });
    return Array.from(map.values());
  })();

  const [draft, setDraft] = useState({
    supplier: "",
    expected: "",
    terms: "Net 30",
    reference: "",
    notes: "",
    products: [{ name: "", code: "", category: "Electronics", quantity: "", unitPrice: "" }],
  });

  const matchedSupplierObj = (suppliers || []).find(
    (s) => s.name?.toLowerCase().trim() === draft.supplier?.toLowerCase().trim()
  );

  const supplierProducts = draft.supplier
    ? allKnownProducts.filter((p) => {
        const byName = p.supplier?.toLowerCase().trim() === draft.supplier.toLowerCase().trim();
        const byId = matchedSupplierObj && p.supplier_id === matchedSupplierObj.id;
        return byName || byId;
      })
    : [];

  const otherProducts = draft.supplier
    ? allKnownProducts.filter((p) => !supplierProducts.some((sp) => sp.sku.toLowerCase() === p.sku.toLowerCase()))
    : allKnownProducts;

  const resultRef = useRef(null);
  const createRef = useRef(null);
  const lock = useRef(false);
  const order = orders.find((row) => row.id === selected);
  const linkedShipment = (shipments || []).find((s) => s.po === order?.id);
  const warehouseName = warehouse?.warehouseName || "Main Warehouse";

  const filtered = orders.filter(
    (row) =>
      `${row.id} ${row.supplier}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (status === "All Status" ||
        row.status === status ||
        (status === "Overdue" && !["Pending", "Rejected", "Received"].includes(row.status) && row.expected < poToday())) &&
      matchesText(supplier, row.supplier, "All Suppliers")
  );

  const pages = Math.max(1, Math.ceil(filtered.length / 5));
  const activePage = Math.min(page, pages);
  const visible = filtered.slice((activePage - 1) * 5, activePage * 5);
  const active = orders.filter((row) => !["Pending", "Rejected", "Received"].includes(row.status));
  const pending = orders.filter((row) => row.status === "Pending").length;
  const overdue = active.filter((row) => row.expected < poToday()).length;
  const monthly = orders
    .filter((row) => row.currency === "IDR" && row.created?.startsWith(poToday().slice(0, 7)) && row.status !== "Rejected")
    .reduce((sum, row) => sum + poTotal(row), 0);

  useEffect(() => setPage(1), [query, status, supplier]);

  useEffect(() => {
    if (result) resultRef.current?.showModal();
  }, [result]);

  useEffect(() => {
    if (creating) createRef.current?.showModal();
  }, [creating]);

  useEffect(() => {
    if (initialSupplier) {
      setDraft((curr) => ({
        ...curr,
        supplier: initialSupplier,
      }));
      setCreating(true);
    }
  }, [initialSupplier]);

  function back() {
    setView("details");
    setSelected(null);
    setResult(null);
    setError("");
    lock.current = false;
    window.scrollTo(0, 0);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/purchase-orders");
    }
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
    if (label === "Purchase Orders") {
      back();
      setQuery("");
    } else if (routes[label]) {
      onNavigate(routes[label]);
    } else {
      setNotice(`${label} will be connected after its design is implemented.`);
    }
  }

  async function decide(value) {
    if (lock.current) return;
    lock.current = true;
    setError("");
    try {
      const next = await onDecide(order.id, value);
      if (next?.error) {
        lock.current = false;
        setError(next.error);
        return;
      }
      setResult(value);
    } catch (err) {
      lock.current = false;
      setError(err.message || "Gagal memproses persetujuan pesanan");
    } finally {
      lock.current = false;
    }
  }

  function newOrder() {
    const defaultCat = categories[0]?.name || "Electronics";
    setDraft({
      supplier: initialSupplier || (supplierOptions.length > 0 ? supplierOptions[0] : ""),
      expected: "",
      terms: "Net 30",
      reference: "",
      notes: "",
      products: [{ name: "", code: "", category: defaultCat, quantity: "", unitPrice: "" }],
    });
    setError("");
    setCreating(true);
  }

  function changeItem(index, key, value) {
    setDraft((current) => ({
      ...current,
      products: current.products.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
  }

  function handleSelectProductSku(index, selectedSku) {
    if (!selectedSku) {
      setDraft((curr) => ({
        ...curr,
        products: curr.products.map((row, i) =>
          i === index
            ? { ...row, code: "", name: "", category: categories[0]?.name || "Electronics", unitPrice: "" }
            : row
        ),
      }));
      return;
    }

    const found = allKnownProducts.find((p) => p.sku.toLowerCase() === selectedSku.toLowerCase());

    setDraft((curr) => ({
      ...curr,
      products: curr.products.map((row, i) => {
        if (i !== index) return row;
        return {
          ...row,
          code: found?.sku || selectedSku,
          name: found?.name || row.name,
          category: found?.category || row.category || categories[0]?.name || "Electronics",
          unitPrice: found?.price ? found.price : row.unitPrice,
        };
      }),
    }));
    setError("");
  }

  function changeProduct(index, text) {
    const found = findProduct(text, inventory);
    setDraft((current) => ({
      ...current,
      products: current.products.map((row, i) =>
        i === index
          ? {
              ...row,
              name: text,
              code: found?.sku || row.code,
              category: found?.category || row.category || categories[0]?.name || "Electronics",
              unitPrice: found?.price ? found.price : row.unitPrice,
            }
          : row
      ),
    }));
    setError("");
  }

  function changeSku(index, text) {
    const found = findProduct(text, inventory);
    setDraft((current) => ({
      ...current,
      products: current.products.map((row, i) =>
        i === index
          ? {
              ...row,
              code: text.toUpperCase().replace(/\s/g, ""),
              ...(found ? { name: found.name, category: found.category, unitPrice: found.price || row.unitPrice } : {}),
            }
          : row
      ),
    }));
    setError("");
  }

  async function create(event) {
    event.preventDefault();
    if (lock.current) return;
    if (!draft.supplier || !draft.supplier.trim()) {
      setError("Silakan pilih supplier terlebih dahulu.");
      return;
    }
    lock.current = true;
    setError("");
    try {
      const next = await onCreate({ ...draft, deliverTo: warehouseName });
      if (next?.error) {
        setError(next.error);
        return;
      }
      if (!next?.order) {
        setError("Gagal membuat purchase order.");
        return;
      }
      setCreating(false);
      setView("details");
      setSelected(next.order.id);
      setNotice(`${next.order.id} berhasil dibuat dan menunggu persetujuan.`);
      setQuery("");
      setStatus("All Status");
      setSupplier("All Suppliers");
    } catch (err) {
      setError(err.message || "Gagal membuat purchase order");
    } finally {
      lock.current = false;
    }
  }

  const action = (row) =>
    row.status === "Pending" || row.status === "Overdue"
      ? "Review"
      : row.status === "In Transit"
      ? "Track"
      : row.status === "Partially Received"
      ? "Receive"
      : "View";

  return (
    <div className="dashboard-layout">
      <DashboardSidebar
        activePage="Purchase Orders"
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
        />
        <main className="dashboard-content po-content">
          <div className="dashboard-intro">
            <div>
              <p>
                {order
                  ? "PURCHASE ORDERS / " +
                    (view === "details"
                      ? order.status === "Pending"
                        ? "PENDING ORDERS"
                        : "DETAIL"
                      : view.toUpperCase())
                  : "WAREHOUSE OPERATIONS"}
              </p>
              <h1>
                {order
                  ? view === "track" && order.deliveryRevision
                    ? "Track Revised Delivery"
                    : poFlowTitles[view] || (order.status === "Pending" ? "Pending Orders" : "Purchase Orders Detail")
                  : "Purchase Orders"}
              </h1>
              <p className="po-description">Create, monitor, and receive supplier purchase orders.</p>
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
            </div>
          </div>

          {!order ? (
            <>
              <section className="po-metrics" aria-label="Purchase order summary">
                {[
                  [active.length, "Open Orders", "awaiting delivery", "green"],
                  [pending, "Pending Approval", "need review", "rose"],
                  [overdue, "Overdue", "past expected date", "rose"],
                ].map(([value, label, caption, tone]) => (
                  <div className={"po-metric metric-" + tone} key={label}>
                    <strong>{value}</strong>
                    <div>
                      <h2>{label}</h2>
                      <p>{caption}</p>
                    </div>
                  </div>
                ))}
                <div className="po-month">
                  <h2>This Month</h2>
                  <strong>{poMoney(monthly)}</strong>
                  <small>IDR orders · {poToday().slice(0, 7)}</small>
                </div>
              </section>

              <section className="dashboard-card po-list">
                <h2>Purchase Orders</h2>
                <p>Supplier orders, approval decisions, and expected deliveries.</p>
                <div className="po-filters">
                  <input
                    aria-label="Search PO number or supplier"
                    placeholder="Search PO number or supplier..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Purchase order status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option>All Status</option>
                    {purchaseOrderStatuses.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Purchase order supplier"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                  >
                    <option value="All Suppliers">All Suppliers</option>
                    {supplierOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <button className="inbound-primary" onClick={newOrder}>
                    + New Purchase Order
                  </button>
                </div>

                <div className="inventory-table-wrap po-list-table">
                  <table>
                    <thead>
                      <tr>
                        {["PO Number", "Supplier", "Expected Date", "Items", "Total", "Status", "Action"].map(
                          (label) => (
                            <th key={label} style={{ textAlign: "center" }}>
                              {label}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.id}</strong>
                          </td>
                          <td>
                            <strong>{row.supplier}</strong>
                          </td>
                          <td>{poDate(row.expected)}</td>
                          <td>{(row.products || []).length}</td>
                          <td>{poMoney(poTotal(row), row.currency)}</td>
                          <td>
                            <span className={"po-status status-" + row.status.toLowerCase().replaceAll(" ", "-")}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="dashboard-link"
                              aria-label={`${action(row)} ${row.id}`}
                              onClick={() => {
                                setView(
                                  {
                                    "In Transit": "track",
                                    "Partially Received": "partial",
                                    Overdue: "overdue",
                                    Received: "completed",
                                  }[row.status] || "details"
                                );
                                setSelected(row.id);
                                setNotice("");
                                setError("");
                                window.scrollTo(0, 0);
                              }}
                            >
                              {action(row)} ›
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!visible.length && (
                        <tr>
                          <td colSpan="7">No purchase orders match these filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="inventory-pagination">
                  <span>
                    Showing {filtered.length ? (activePage - 1) * 5 + 1 : 0}–
                    {Math.min(activePage * 5, filtered.length)} of {filtered.length} orders
                  </span>
                  <div>
                    <button
                      disabled={activePage === 1}
                      aria-label="Previous purchase orders page"
                      onClick={() => setPage(activePage - 1)}
                    >
                      ‹
                    </button>
                    {Array.from({ length: pages }, (_, i) => (
                      <button
                        key={i}
                        className={activePage === i + 1 ? "active-page" : ""}
                        aria-label={`Purchase orders page ${i + 1}`}
                        onClick={() => setPage(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      disabled={activePage === pages}
                      aria-label="Next purchase orders page"
                      onClick={() => setPage(activePage + 1)}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : !order ? (
            <section className="dashboard-card po-details">
              <button className="dashboard-link po-back" onClick={back}>
                ‹ Back to Purchase Orders
              </button>
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p className="po-muted">Purchase Order tidak ditemukan atau sedang dimuat.</p>
                <button className="inbound-primary" style={{ marginTop: "12px" }} onClick={back}>
                  Kembali ke Daftar PO
                </button>
              </div>
            </section>
          ) : view !== "details" ? (
            <PurchaseOrderFlow
              key={order.id}
              order={order}
              stage={view}
              onStage={setView}
              inventory={inventory}
              racks={racks}
              shipments={shipments}
              manager={manager}
              onReceive={(draft2) => onReceive(order.id, draft2)}
              onRevise={(values) => onRevise(order.id, values)}
              onBack={back}
              onOpenInbound={onOpenInbound}
              onMovements={onMovements}
            />
          ) : (
            <section className="dashboard-card po-details">
              <button className="dashboard-link po-back" onClick={back}>
                ‹ Back to Purchase Orders
              </button>
              <div className="po-detail-title">
                <h2>{order.id}</h2>
                <span className={"po-status status-" + order.status.toLowerCase().replaceAll(" ", "-")}>
                  {order.status === "Pending" ? "Pending Approval" : order.status}
                </span>
                <p>
                  Created {poDate(order.created)} · {order.requestedBy}
                </p>
              </div>
              <div className="po-detail-grid">
                <section className="po-info">
                  <h2>Order Information</h2>
                  <dl>
                    {[
                      ["Supplier", order.supplier],
                      ["Requested by", order.requestedBy],
                      ["Deliver to", order.deliverTo || warehouseName],
                      ["Reference", order.reference || "—"],
                      ["Expected date", poDate(order.expected)],
                      ["Notes", order.notes || "—"],
                      ["Payment terms", order.terms || "Not recorded"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <aside className="po-approval">
                  <h2>{order.status === "Approved" ? "✓ Order approved" : "Approval"}</h2>
                  <dl>
                    <div>
                      <dt>Status</dt>
                      <dd
                        className={
                          order.status === "Pending" || order.status === "Rejected"
                            ? "critical-text"
                            : "positive-text"
                        }
                      >
                        {order.status === "Pending" ? "Pending Review" : order.status}
                      </dd>
                    </div>
                    <div>
                      <dt>Approver</dt>
                      <dd>{order.decision?.user || "Warehouse Manager"}</dd>
                    </div>
                  </dl>
                  {order.status === "Pending" ? (
                    <div className="po-decision-buttons">
                      <button className="inbound-secondary critical-text" onClick={() => decide("Rejected")}>
                        Reject
                      </button>
                      <button className="inbound-primary" onClick={() => decide("Approved")}>
                        Approve Order
                      </button>
                    </div>
                  ) : (
                    <>
                      {order.decision && (
                        <p className="po-muted">
                          {order.decision.status} by {order.decision.user}
                        </p>
                      )}
                      {order.status === "Approved" && (
                        <button className="inbound-secondary" onClick={() => setView("pdf")}>
                          Download PO
                        </button>
                      )}
                      {order.status !== "Rejected" && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {linkedShipment ? (
                            <div style={{ padding: '8px 12px', background: 'var(--sage, #eef3e9)', borderRadius: '6px', border: '1px solid #d3e0cb', fontSize: '12px' }}>
                              <span style={{ color: 'var(--muted, #556052)', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>Truk Inbound Terhubung</span>
                              <strong style={{ color: 'var(--olive, #5c732b)', fontSize: '13px' }}>{linkedShipment.id}</strong>
                              <span style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: '#fff', border: '1px solid #c5d3bd' }}>
                                Status: {linkedShipment.status}
                              </span>
                            </div>
                          ) : null}
                          <button className="inbound-primary" onClick={() => onOpenInbound(order.id)}>
                            {linkedShipment?.status === "Arrived"
                              ? "Proses Inspeksi di Dock (Inbound)"
                              : linkedShipment?.status === "Inspecting"
                              ? "Lanjutkan Inspeksi Inbound"
                              : linkedShipment?.status === "Received"
                              ? "Lihat Bukti Penerimaan Inbound"
                              : "Buka Pengiriman Inbound (Dock)"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </aside>
              </div>

              <section className="po-items">
                <h2>Ordered Items</h2>
                <div className="inventory-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {["Product", "Kategori", "Qty", "Unit Price", "Subtotal", "Received"].map((label) => (
                          <th key={label} style={{ textAlign: "center" }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(order.products || []).map((item) => (
                        <tr key={item.code}>
                          <td>
                            <strong>
                              {item.name} · {item.code}
                            </strong>
                          </td>
                          <td>{typeOf(item)}</td>
                          <td>{item.quantity}</td>
                          <td>
                            {item.unitPrice == null ? "Not provided" : poMoney(item.unitPrice, order.currency)}
                          </td>
                          <td>
                            <strong>
                              {item.unitPrice == null
                                ? "Not provided"
                                : poMoney(item.quantity * item.unitPrice, order.currency)}
                            </strong>
                          </td>
                          <td>
                            {item.received == null ? "Not recorded" : `${item.received} / ${item.quantity}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <dl className="po-total">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{poMoney(poTotal(order), order.currency)}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>{poMoney(poTotal(order), order.currency)}</dd>
                  </div>
                </dl>
              </section>
              {order.sampleItems && (
                <p className="po-muted">
                  Item quantities and prices are sample breakdowns matching the list total. Receipt quantities are not
                  provided.
                </p>
              )}
            </section>
          )}

          {notice && (
            <p role="status" className="form-notice">
              {notice}
            </p>
          )}
          {error && !creating && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <p className="dashboard-demo">
            Frontend demo · Counts and totals use these orders. Approval does not add inventory; receiving uses the
            Inbound flow. Refresh resets demo state.
          </p>
        </main>
      </div>

      {result && (
        <dialog
          ref={resultRef}
          className="dashboard-dialog po-result"
          aria-labelledby="po-result-title"
          onCancel={back}
        >
          <div className={"po-result-icon " + (result === "Rejected" ? "rejected" : "")}>
            {result === "Approved" ? "✓" : "×"}
          </div>
          <h2 id="po-result-title">Order {result}</h2>
          <button className="inbound-secondary" onClick={back}>
            Back
          </button>
        </dialog>
      )}

      {creating && (
        <dialog
          ref={createRef}
          className="dashboard-dialog po-create"
          aria-labelledby="po-create-title"
          onCancel={() => setCreating(false)}
        >
          <h2 id="po-create-title">New Purchase Order</h2>
          <form onSubmit={create} noValidate>
            <div className="po-create-fields">
              <label>
                Supplier <span style={{ color: "#ba1a1a" }}>*</span>
                <select
                  aria-label="New PO supplier"
                  value={draft.supplier}
                  onChange={(e) => {
                    const nextSupplier = e.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      supplier: nextSupplier,
                      products: [{ name: "", code: "", category: categories[0]?.name || "General", quantity: "", unitPrice: "" }],
                    }));
                    setError("");
                  }}
                  required
                >
                  <option value="">-- Pilih Supplier --</option>
                  {supplierOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {draft.supplier && !supplierOptions.includes(draft.supplier) && (
                    <option value={draft.supplier}>{draft.supplier}</option>
                  )}
                </select>
              </label>
              <label>
                Expected date <span style={{ color: "#ba1a1a" }}>*</span>
                <input
                  aria-label="New PO expected date"
                  type="date"
                  min={poToday()}
                  value={draft.expected}
                  onChange={(e) => setDraft({ ...draft, expected: e.target.value })}
                  required
                />
              </label>
              <label>
                Payment terms
                <input
                  value={draft.terms}
                  onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
                />
              </label>
              <label>
                Reference
                <input
                  value={draft.reference}
                  maxLength={100}
                  placeholder="Optional reference"
                  onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                />
              </label>
            </div>

            <h3>Order items (IDR)</h3>
            {!draft.supplier ? (
              <div style={{ margin: "4px 0 12px", fontSize: "12px", color: "var(--olive, #5c732b)", background: "var(--sage, #eef3e9)", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d3e0cb" }}>
                ℹ Silakan pilih Supplier / PT di atas terlebih dahulu untuk menampilkan daftar produk yang tersedia.
              </div>
            ) : (
              <div style={{ margin: "4px 0 12px", fontSize: "12px", color: "var(--olive, #5c732b)", background: "var(--sage, #eef3e9)", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d3e0cb" }}>
                {supplierProducts.length > 0 ? (
                  <>✓ Terhubung dengan Katalog <strong>{draft.supplier}</strong> ({supplierProducts.length} produk ditemukan). Pilih ID Produk untuk otomatis mengisi data.</>
                ) : (
                  <>ℹ Belum ada produk terdaftar untuk PT <strong>{draft.supplier}</strong>. Silakan tambahkan katalog produk melalui menu Suppliers terlebih dahulu.</>
                )}
              </div>
            )}
            {draft.products.map((row, i) => (
              <div className="po-create-item" key={i}>
                <label>
                  ID Produk (SKU) <span style={{ color: "#ba1a1a" }}>*</span>
                  <select
                    aria-label={`New PO SKU ${i + 1}`}
                    value={row.code || ""}
                    onChange={(e) => handleSelectProductSku(i, e.target.value)}
                    disabled={!draft.supplier}
                    required
                  >
                    {!draft.supplier ? (
                      <option value="">-- Pilih Supplier / PT terlebih dahulu --</option>
                    ) : supplierProducts.length === 0 ? (
                      <option value="" disabled>-- Belum ada produk dari {draft.supplier} --</option>
                    ) : (
                      <>
                        <option value="">-- Pilih ID Produk ({draft.supplier}) --</option>
                        {supplierProducts.map((p) => (
                          <option key={p.sku} value={p.sku}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                      </>
                    )}
                    {row.code && !supplierProducts.some((p) => p.sku.toLowerCase() === row.code.toLowerCase()) && (
                      <option value={row.code}>{row.code}</option>
                    )}
                  </select>
                </label>

                <label>
                  Nama Produk <span style={{ color: "#ba1a1a" }}>*</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Nama produk"
                    aria-label={`New PO product ${i + 1}`}
                    value={row.name || ""}
                    onChange={(e) => changeProduct(i, e.target.value)}
                    required
                  />
                </label>

                <label>
                  Kategori <span style={{ color: "#ba1a1a" }}>*</span>
                  <select
                    aria-label={`New PO category ${i + 1}`}
                    value={row.category || ""}
                    onChange={(e) => changeItem(i, "category", e.target.value)}
                    required
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id || c.name || c} value={c.name || c}>
                        {c.name || c}
                      </option>
                    ))}
                    {row.category &&
                      !categories.some((c) => (c.name || c).toLowerCase() === row.category.toLowerCase()) && (
                        <option value={row.category}>{row.category}</option>
                      )}
                  </select>
                </label>

                <label>
                  Qty <span style={{ color: "#ba1a1a" }}>*</span>
                  <input
                    aria-label={`New PO quantity ${i + 1}`}
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    onChange={(e) => changeItem(i, "quantity", e.target.value)}
                    required
                  />
                </label>

                <label>
                  Unit price (IDR) <span style={{ color: "#ba1a1a" }}>*</span>
                  <input
                    aria-label={`New PO price ${i + 1}`}
                    type="number"
                    min="1"
                    step="1"
                    value={row.unitPrice}
                    onChange={(e) => changeItem(i, "unitPrice", e.target.value)}
                    required
                  />
                </label>

                <button
                  type="button"
                  className="dashboard-link"
                  aria-label={`Remove PO item ${i + 1}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      products: draft.products.filter((_, index) => index !== i),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              className="inbound-secondary"
              onClick={() => {
                const defaultCat = categories[0]?.name || "Electronics";
                setDraft({
                  ...draft,
                  products: [
                    ...draft.products,
                    { name: "", code: "", category: defaultCat, quantity: "", unitPrice: "" },
                  ],
                });
              }}
            >
              + Add Item
            </button>

            <label className="po-notes-label">
              Notes
              <textarea
                value={draft.notes}
                maxLength={2000}
                placeholder="Optional notes"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>

            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}

            <div className="inbound-form-actions">
              <button type="button" className="inbound-secondary" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="inbound-primary" type="submit">
                Create Purchase Order
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}

export { PurchaseOrders as default };

