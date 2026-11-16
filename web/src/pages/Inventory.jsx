import { typeOf, matchesText, findProduct, normaliseType, cleanText } from "../utils/productTypes.js";
import { formatNumber } from "../utils/formatters.js";
import React, { useEffect, useRef, useState } from "react";
import DashboardSidebar from "../components/DashboardSidebar.jsx";
import WarehouseHeader from "../components/WarehouseHeader.jsx";
import Icon from "../components/DashboardIcon.jsx";
import InventoryProductPanel from "../components/InventoryProductPanel.jsx";
import MovementExport from "../components/MovementExport.jsx";
import RackQrDialog from "../components/RackQrDialog.jsx";
import QrHistoryDialog from "../components/QrHistoryDialog.jsx";
import { categories, stockStatus } from "../data/inventory.js";
import "../styles/dashboard.css";
import "../styles/inventory.css";
function Inventory({ manager, warehouse, items, movements, onSave, onNavigate, onReport, onSignOut, initialRequest = null, shipments = [] }) {
  const [query, setQuery] = useState(initialRequest?.sku || ""), [category, setCategory] = useState("All Categories"), [status, setStatus] = useState("All Stock Status"), [location, setLocation] = useState("All Warehouses"), [sort, setSort] = useState("default"), [page, setPage] = useState(1), [selected, setSelected] = useState(initialRequest?.sku || null), [mode, setMode] = useState(initialRequest?.kind === "location" || initialRequest?.kind === "reorder" ? "edit" : "overview"), [checks, setChecks] = useState([]), [navOpen, setNavOpen] = useState(false), [exporting, setExporting] = useState(false), [notice, setNotice] = useState(initialRequest?.kind === "report" ? "Inventory report review: inspect this product\u2019s current record." : initialRequest?.kind === "location" ? "Location review: inspect the product rack and available stock. Editing the rack updates its primary location; per-rack quantity transfers are not connected yet." : initialRequest?.kind === "reorder" ? "Reorder review: inspect and update this product\u2019s reorder level." : initialRequest ? "Restock review: inspect current stock and reorder level for this product." : "");
  const [safetyStockItem, setSafetyStockItem] = useState(null);
  const [safetyStockInput, setSafetyStockInput] = useState('');
  const [safetyStockError, setSafetyStockError] = useState('');
  const [rackQrTarget, setRackQrTarget] = useState(null);
  const [showQrHistory, setShowQrHistory] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);
  const cachedProductRef = useRef(null);

  function openSafetyStock(item, event) {
    if (event) event.stopPropagation();
    setSafetyStockItem(item);
    setSafetyStockInput(String(item.reorder || 15));
    setSafetyStockError('');
  }

  function handleSaveSafetyStock(e) {
    if (e) e.preventDefault();
    const val = Number(safetyStockInput);
    if (!safetyStockInput || !Number.isSafeInteger(val) || val < 1) {
      setSafetyStockError('Safety stock harus berupa angka bulat positif minimal 1.');
      return;
    }
    onSave({
      ...safetyStockItem,
      reorder: val,
      reason: `Penyesuaian batas safety stock menjadi ${val} ${safetyStockItem.unit || 'pcs'}`,
    });
    setNotice(`Safety stock untuk "${safetyStockItem.name}" (${safetyStockItem.sku}) berhasil diubah menjadi ${val} ${safetyStockItem.unit || 'pcs'}.`);
    setSafetyStockItem(null);
  }
  // Pisahkan produk aktif yang sah di inventaris gudang vs barang yang masih dalam proses Inbound
  const activeInventoryItems = items.filter((item) => {
    if (item.is_in_inventory === false) return false;
    if (item.current === 0 && (!item.location_id || item.rack === 'Unassigned' || item.rack === 'Dock Staging') && item.pending_inbound) {
      return false;
    }
    return true;
  });

  const pendingInboundItems = items.filter((item) => !activeInventoryItems.includes(item));

  const allUniqueRacks = Array.from(new Set(activeInventoryItems.map((i) => i.rack).filter(Boolean)));
  function openRackQr(rackCode, productName = '', sku = '', zone = '') {
    const clean = (rackCode || 'RACK-A1-01-A').replace('RACK-', '');
    const derivedZone = zone || (clean.length > 0 ? `Zone ${clean[0].toUpperCase()}` : 'Zone A');
    setRackQrTarget({
      rack: rackCode || 'RACK-A1-01-A',
      zone: derivedZone,
      productName,
      sku,
    });
  }
  const panelFocus = useRef(null), panelTrigger = useRef(null);
  const warehouses = [...new Set(activeInventoryItems.map((item) => item.warehouse))];
  const filtered = activeInventoryItems.filter((item) => `${item.name} ${item.sku} ${item.supplier} ${item.rack}`.toLowerCase().includes(query.toLowerCase()) && matchesText(category, item.category, "All Categories") && (status === "All Stock Status" || stockStatus(item) === status) && matchesText(location, item.warehouse, "All Warehouses")).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "stock-low" ? a.current - b.current : sort === "stock-high" ? b.current - a.current : 0);
  const pages = Math.max(1, Math.ceil(filtered.length / 9)), visible = filtered.slice((page - 1) * 9, page * 9);
  const currentProduct = activeInventoryItems.find((item) => item.sku === selected);
  if (currentProduct) {
    cachedProductRef.current = currentProduct;
  }
  const displayProduct = currentProduct || (isClosing ? cachedProductRef.current : null);
  const product = displayProduct;
  useEffect(() => setPage(1), [query, category, status, location, sort]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  useEffect(() => {
    if (selected && !isClosing) panelFocus.current?.querySelector("button")?.focus();
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (selected) {
        currentUrl.searchParams.set("sku", selected);
      } else {
        currentUrl.searchParams.delete("sku");
      }
      if (currentUrl.pathname === "/inventory") {
        window.history.replaceState(null, "", currentUrl.pathname + currentUrl.search);
      }
    }
  }, [selected, isClosing]);
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (initialRequest && mode === "edit") panelFocus.current?.querySelector(initialRequest.kind === "location" ? 'input[name="rack"]' : 'input[name="reorder"]')?.focus();
  }, [initialRequest, mode]);
  function close() {
    if (isClosing) return;
    setIsClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setSelected(null);
      setIsClosing(false);
      setExporting(false);
      panelTrigger.current?.focus();
    }, 240);
  }
  function select(item, event) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsClosing(false);
    panelTrigger.current = event.currentTarget;
    setSelected(item.sku);
    setMode("overview");
    setNotice("");
  }
  function navigate(label) {
    if (label === "Staff Management" || label === "Settings") {
      onNavigate(label === "Settings" ? "settings" : "staff-management");
      return;
    }
    if (label === "Dashboard") onNavigate("dashboard");
    else if (label === "Inbound") onNavigate("inbound");
    else if (label === "Outbound") onNavigate("outbound");
    else if (label === "Reports" || label === "Audit Trail") onNavigate(label === "Reports" ? "reports" : "audit-trail");
    else if (label === "Purchase Orders") onNavigate("purchase-orders");
    else if (label === "Suppliers") onNavigate("suppliers");
    else if (label === "AI Insight") onNavigate("ai-insight");
    else if (label !== "Inventory") setNotice(`${label} will be connected after its design is implemented.`);
  }
  const countFor = (array, value) => array.filter((item) => stockStatus(item) === value).length;
  const inStockCount = countFor(activeInventoryItems, "In Stock");
  const lowStockCount = countFor(activeInventoryItems, "Low") + countFor(activeInventoryItems, "Critical");
  const outOfStockCount = countFor(activeInventoryItems, "Out of Stock");
  const summaries = [
    ["Total Items", activeInventoryItems.length, "box", "green"],
    ["In Stock", inStockCount, "box", "green"],
    ["Low Stock", lowStockCount, "warning", "rose"],
    ["Out of Stock", outOfStockCount, "close", "rose"]
  ];
  return <div className="dashboard-layout"><DashboardSidebar activePage="Inventory" warehouseName={warehouse?.warehouseName || "Main Warehouse"} onNavigate={navigate} open={navOpen} onClose={() => setNavOpen(false)} /><div className="dashboard-main"><WarehouseHeader onViewProfile={() => onNavigate("settings-profile")} manager={manager} search={query} onSearch={setQuery} onMenu={() => setNavOpen(true)} onSignOut={onSignOut} onNavigate={onNavigate} shipments={shipments} /><main className="dashboard-content inventory-content"><div className="dashboard-intro"><div><p>WAREHOUSE OPERATIONS</p><h1>Inventory</h1><p className="inventory-description">Manage products, stock levels, and storage locations.</p></div><div className="dashboard-date"><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(/* @__PURE__ */ new Date())}</p><p>{warehouse?.warehouseName || "Main Warehouse"}</p><div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "14px", flexWrap: "wrap", justifyContent: "flex-end" }}><button type="button" className="inbound-secondary inventory-qr-history-btn" onClick={() => setShowQrHistory(true)} title="Lihat riwayat pembuatan dan pencetakan QR Code"><span aria-hidden="true">📜</span> Riwayat QR</button><button type="button" className="inbound-primary inventory-qr-standalone-btn" onClick={() => openRackQr(allUniqueRacks[0] || "RACK-A1-01-A")} title="Buka Generator QR Code Rak Gudang"><span aria-hidden="true">🏁</span> Generator QR Rak</button></div></div></div>
 {initialRequest && <div className="inventory-selection"><span>Opened from AI Insight · {initialRequest.sku}</span><button className="dashboard-link" onClick={() => onNavigate("ai-insight")}>‹ Back to AI Insight</button></div>}
 <div className={`inventory-grid${product ? " with-panel" : ""}`}><div className="inventory-primary"><section className="inventory-metrics" aria-label="Inventory summary">{summaries.map(([label, value, icon, tone], index) => <div className={`metric-card metric-${tone}`} key={label}><div><h2>{label}</h2><div className="inventory-metric-value"><Icon name={icon} size={42} /><strong>{formatNumber(value)}</strong></div><p><span>{activeInventoryItems.length > 0 ? "Stok terdata" : "Belum ada produk"}</span></p></div></div>)}</section>
 {pendingInboundItems.length > 0 && (
   <div
     style={{
       background: '#fffbeb',
       border: '1px solid #fde68a',
       borderRadius: '12px',
       padding: '12px 18px',
       display: 'flex',
       alignItems: 'center',
       justifyContent: 'space-between',
       marginBottom: '16px',
       gap: '12px',
       flexWrap: 'wrap'
     }}
   >
     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
       <span style={{ fontSize: '20px' }}>⏳</span>
       <div>
         <strong style={{ fontSize: '13px', color: '#92400e', display: 'block' }}>
           {pendingInboundItems.length} Produk Masih dalam Proses Inbound
         </strong>
         <span style={{ fontSize: '12px', color: '#b45309' }}>
           Barang belum diinspeksi fisik, belum ditempatkan di rak (Putaway), atau belum di-ACC oleh Manager sehingga belum masuk ke stok aktif gudang.
         </span>
       </div>
     </div>
     <button
       type="button"
       className="inbound-secondary"
       style={{ fontSize: '12px', padding: '6px 14px', background: '#ffffff', borderColor: '#fde68a', color: '#92400e', fontWeight: 600 }}
       onClick={() => onNavigate('inbound')}
     >
       Buka Modul Inbound ›
     </button>
   </div>
 )}
 <section className="inventory-list dashboard-card" aria-label="Inventory products"><div className="inventory-filters"><div className="inventory-filter-search"><Icon name="search" /><input aria-label="Search product, SKU or supplier" placeholder="Search product, SKU, or supplier..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><input type="text" autoComplete="off" placeholder="Search product type..." aria-label="Category filter" value={category === "All Categories" ? "" : category} onChange={(e) => setCategory(e.target.value)} /><select aria-label="Stock status filter" value={status} onChange={(e) => setStatus(e.target.value)}>{["All Stock Status", "Critical", "Low", "In Stock", "Out of Stock"].map((value) => <option key={value}>{value}</option>)}</select><input type="text" autoComplete="off" placeholder="Search warehouse..." aria-label="Warehouse filter" value={location === "All Warehouses" ? "" : location} onChange={(e) => setLocation(e.target.value)} /><select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}><option value="default">Sort</option><option value="name">Name A–Z</option><option value="stock-low">Stock ascending</option><option value="stock-high">Stock descending</option></select></div>
 {checks.length > 0 && <div className="inventory-selection">{checks.length} selected <button className="dashboard-link" onClick={() => setChecks([])}>Clear selection</button></div>}
            <div className="inventory-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select visible products"
                        checked={visible.length > 0 && visible.every((item) => checks.includes(item.sku))}
                        onChange={(e) =>
                          setChecks((current) =>
                            e.target.checked
                              ? [...new Set([...current, ...visible.map((item) => item.sku)])]
                              : current.filter((sku) => !visible.some((item) => item.sku === sku))
                          )
                        }
                      />
                    </th>
                    {["Product", "Code", "Product Type", "Current", "Safety Stock", "Rack", "Supplier", "Status", "Actions"].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item, index) => (
                    <tr key={item.sku} className={item.sku === selected ? "inventory-row-selected" : ""}>
                      <td>
                        <input
                          aria-label={`Select ${item.name}`}
                          type="checkbox"
                          checked={checks.includes(item.sku)}
                          onChange={(e) =>
                            setChecks((current) =>
                              e.target.checked ? [...current, item.sku] : current.filter((sku) => sku !== item.sku)
                            )
                          }
                        />
                      </td>
                      <td>
                        <div className="inventory-product-cell">
                          <div className="inventory-thumb" onClick={(event) => select(item, event)} title={`Lihat detail & foto ${item.name}`}>
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="inventory-thumb-img"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="inventory-thumb-fallback" style={{ display: item.image_url ? 'none' : 'flex' }}>
                              <Icon name="box" size={18} />
                            </div>
                          </div>
                          <div className="inventory-product-info">
                            <button className="inventory-product-link" onClick={(event) => select(item, event)}>
                              {item.name}
                            </button>
                            <span className="inventory-product-meta">{item.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td>{item.sku}</td>
                      <td>{item.category}</td>
                      <td className={item.current < 10 ? "critical-text" : ""}>{formatNumber(item.current)}</td>
                      <td><strong>{formatNumber(item.reorder)}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{item.rack}</span>
                          <button
                            type="button"
                            className="dashboard-link"
                            style={{ padding: '2px 6px', fontSize: 11, border: '1px solid #dfe4d9', borderRadius: 4, background: '#f8fafc', whiteSpace: 'nowrap' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openRackQr(item.rack, item.name, item.sku, item.zone);
                            }}
                            title={`Generate QR Code Label untuk Rak ${item.rack}`}
                          >
                            QR
                          </button>
                        </div>
                      </td>
                      <td>{item.supplier}</td>
                      <td>
                        <span className={`inventory-status status-${stockStatus(item).toLowerCase().replaceAll(" ", "-")}`}>
                          {stockStatus(item)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`inventory-dots ${selected === item.sku ? 'active' : ''}`}
                          aria-label={`Buka detail dan aksi untuk ${item.name}`}
                          onClick={(event) => select(item, event)}
                          title="Buka panel detail & aksi produk"
                        >
                          •••
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td colSpan="10" className="inventory-empty">
                        No products match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div><div className="inventory-pagination"><span>Showing {filtered.length ? (page - 1) * 9 + 1 : 0}–{Math.min(page * 9, filtered.length)} of {filtered.length} products</span><div>{Array.from({ length: pages }, (_, index) => <button key={index} className={page === index + 1 ? "active-page" : ""} aria-label={`Page ${index + 1}`} aria-current={page === index + 1 ? "page" : void 0} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button aria-label="Next page" disabled={page === pages} onClick={() => setPage((current) => current + 1)}>›</button></div></div></section></div>
 {product && <div ref={panelFocus} className={`inventory-panel-wrapper ${isClosing ? "is-closing" : "is-entering"}`} onKeyDown={(e) => {
    if (e.key === "Escape" && !exporting) close();
  }}><InventoryProductPanel key={product.sku} product={product} mode={mode} onMode={setMode} onClose={close} movements={movements} onReport={() => onReport(product.sku)} onExport={() => setExporting(true)} onOpenSafetyStock={() => openSafetyStock(product)} onOpenRackQr={openRackQr} onSave={(draft) => {
    onSave(draft);
    setMode("overview");
    setNotice("Changes saved to database.");
  }} /></div>}</div>{notice && <p className="form-notice inventory-notice" role="status">{notice}</p>}<p className="dashboard-demo">Total {activeInventoryItems.length} produk di inventaris aktif gudang.{pendingInboundItems.length > 0 ? ` (${pendingInboundItems.length} produk masih dalam antrean Inbound)` : ''}</p></main></div>{exporting && <MovementExport product={product} movements={movements} onClose={() => setExporting(false)} />}
{safetyStockItem && (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="safety-stock-dialog-title"
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(24, 35, 14, 0.45)',
      backdropFilter: 'blur(3px)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 9999,
      padding: 16,
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) setSafetyStockItem(null);
    }}
  >
    <div
      style={{
        background: '#ffffff',
        borderRadius: 16,
        boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
        width: '100%',
        maxWidth: 460,
        padding: 24,
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 id="safety-stock-dialog-title" style={{ margin: 0, fontSize: 18, color: '#191d17', fontWeight: 700 }}>
          🛡️ Tentukan Safety Stock
        </h2>
        <button
          type="button"
          onClick={() => setSafetyStockItem(null)}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 22,
            cursor: 'pointer',
            color: '#737b6c',
            lineHeight: 1,
            padding: 4,
          }}
          aria-label="Tutup dialog"
        >
          ×
        </button>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#555d4e', lineHeight: 1.5 }}>
        Atur batas minimum pengaman stok (<em>Safety Stock</em>) untuk produk ini. Sistem akan otomatis menandai status <em>Low / Critical</em> jika stok fisik berada di bawah batas ini.
      </p>

      <div
        style={{
          background: '#f8f9f5',
          border: '1px solid #dfe4d9',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px 14px',
          fontSize: 12,
        }}
      >
        <div>
          <span style={{ display: 'block', color: '#737b6c', fontSize: 11 }}>Produk:</span>
          <strong style={{ color: '#191d17' }}>{safetyStockItem.name}</strong>
        </div>
        <div>
          <span style={{ display: 'block', color: '#737b6c', fontSize: 11 }}>SKU:</span>
          <code style={{ background: '#eef3e9', padding: '1px 5px', borderRadius: 4, fontWeight: 700, color: '#425812' }}>
            {safetyStockItem.sku}
          </code>
        </div>
        <div>
          <span style={{ display: 'block', color: '#737b6c', fontSize: 11 }}>Stok Fisik Saat Ini:</span>
          <strong style={{ color: safetyStockItem.current < (safetyStockItem.reorder || 15) ? '#b91c1c' : '#166534' }}>
            {formatNumber(safetyStockItem.current)} {safetyStockItem.unit || 'pcs'}
          </strong>
        </div>
        <div>
          <span style={{ display: 'block', color: '#737b6c', fontSize: 11 }}>Lokasi Rak:</span>
          <strong style={{ color: '#191d17' }}>{safetyStockItem.rack || 'A-01'}</strong>
        </div>
      </div>

      <form onSubmit={handleSaveSafetyStock}>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Batas Safety Stock ({safetyStockItem.unit || 'pcs'}) <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              min="1"
              step="1"
              required
              autoFocus
              value={safetyStockInput}
              onChange={(e) => {
                setSafetyStockInput(e.target.value);
                setSafetyStockError('');
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1.5px solid #5c732b',
                background: '#ffffff',
                color: '#191d17',
                fontSize: 14,
                fontWeight: 600,
                outline: 'none',
              }}
              placeholder="Contoh: 15"
            />
            <span
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 12,
                color: '#737b6c',
                fontWeight: 600,
                pointerEvents: 'none',
              }}
            >
              {safetyStockItem.unit || 'pcs'}
            </span>
          </div>
          <small style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#64748b' }}>
            Nilai rekomendasi: 10–25 unit (sesuai laju keluar & lead time pengiriman vendor).
          </small>
        </div>

        {safetyStockError && (
          <p role="alert" className="field-error" style={{ margin: '0 0 14px', fontSize: 12 }}>
            {safetyStockError}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="inbound-secondary"
            onClick={() => setSafetyStockItem(null)}
            style={{ minWidth: 90, height: 38, fontSize: 12 }}
          >
            Batal
          </button>
          <button
            type="submit"
            className="inbound-primary"
            style={{ minWidth: 150, height: 38, fontSize: 12 }}
          >
            Simpan Safety Stock
          </button>
        </div>
      </form>
    </div>
  </div>
)}
{rackQrTarget && (
  <RackQrDialog
    rack={rackQrTarget.rack}
    zone={rackQrTarget.zone}
    productName={rackQrTarget.productName}
    sku={rackQrTarget.sku}
    warehouseName={warehouse?.warehouseName || "Main Warehouse"}
    allRacks={allUniqueRacks}
    onClose={() => setRackQrTarget(null)}
  />
)}
{showQrHistory && (
  <QrHistoryDialog
    onClose={() => setShowQrHistory(false)}
    onSelectQr={(item) => {
      if (item.type === "RACK") {
        openRackQr(item.code);
      }
    }}
  />
)}
</div>;
}
export {
  Inventory as default
};
