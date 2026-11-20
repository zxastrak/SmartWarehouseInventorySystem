import React, { useEffect, useRef, useState } from "react";
import Icon from "./DashboardIcon.jsx";
export default function WarehouseHeader({
  manager,
  search = "",
  onSearch = () => {},
  onMenu = () => {},
  onSignOut = () => {},
  searchRef,
  onAlerts,
  onViewProfile,
  onNavigate,
  shipments = [],
  searchPlaceholder = "Search SKU, product or rack...",
  searchLabel = "Search SKU, product or rack"
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [time, setTime] = useState(() => {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta"
    }).format(new Date());
  });
  const localSearchRef = useRef(null);
  const inputRef = searchRef || localSearchRef;

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Jakarta"
        }).format(new Date())
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const inspected = shipments.filter((s) => ['Review', 'Inspected'].includes(s.status));
  const arrived = shipments.filter((s) => s.status === 'Arrived');
  const totalNotifs = inspected.length + arrived.length;

  useEffect(() => {
    const shortcut = (event) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [inputRef]);

  const displayName = manager?.fullName || manager?.name || "Manager";
  const name = displayName.trim().split(/\s+/)[0] || "Manager";

  function handleOpenShipment(shipmentId) {
    setNotificationsOpen(false);
    if (onNavigate) {
      onNavigate('inbound', { id: shipmentId });
    } else {
      window.location.href = `/inbound?id=${encodeURIComponent(shipmentId)}`;
    }
  }

  return (
    <header className="dashboard-topbar">
      <button className="dashboard-mobile-menu" aria-label="Open navigation" onClick={onMenu}>
        <Icon name="menu" />
      </button>

      <div className="dashboard-search">
        <Icon name="search" />
        <label className="sr-only" htmlFor="warehouse-search">{searchLabel}</label>
        <input ref={inputRef} id="warehouse-search" placeholder={searchPlaceholder} value={search} onChange={(event) => onSearch(event.target.value)} />
        <kbd>/</kbd>
      </div>

      <div className="dashboard-live-clock" title="Waktu Operasional Gudang (WIB)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="live-clock-icon">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="live-clock-time">{time}</span>
        <span className="live-clock-badge">WIB</span>
      </div>

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="notification-button"
          aria-label={`Notifications: ${totalNotifs} items`}
          onClick={() => {
            setProfileOpen(false);
            setNotificationsOpen((cur) => !cur);
          }}
        >
          <Icon name="bell" />
          {totalNotifs > 0 ? (
            <span className="notification-counter">{totalNotifs}</span>
          ) : (
            <i />
          )}
        </button>

        {notificationsOpen && (
          <div className="notifications-dropdown">
            <div className="notifications-header">
              <strong>Notifikasi & Tugas Masuk</strong>
              {totalNotifs > 0 && <span className="notifications-badge">{totalNotifs} Baru</span>}
            </div>

            {inspected.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#0891b2', marginBottom: 6 }}>
                  📱 SIAP REVIEW & ACC MANAGER ({inspected.length})
                </span>
                {inspected.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="notification-item"
                    onClick={() => handleOpenShipment(s.id)}
                  >
                    <span className="notification-badge-acc">✓ Selesai Diinspeksi Staf Dok</span>
                    <strong>{s.id} · {s.supplier}</strong>
                    <p>
                      PO: {s.po} · {s.units} unit fisik telah dicek & barcode unit terverifikasi. Klik untuk buka lembar Review & ACC.
                    </p>
                  </button>
                ))}
              </div>
            )}

            {arrived.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                  🚚 MENUNGGU CEK STAF DI DOK ({arrived.length})
                </span>
                {arrived.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="notification-item"
                    onClick={() => handleOpenShipment(s.id)}
                  >
                    <span className="notification-badge-arrived">Armada Tiba Dok {s.dock}</span>
                    <strong>{s.id} · {s.supplier}</strong>
                    <p>
                      Ditugaskan ke: {s.staff || 'Staf Lapangan'}. Menunggu staf memindai barcode via Mobile.
                    </p>
                  </button>
                ))}
              </div>
            )}

            {totalNotifs === 0 && (
              <p style={{ margin: '14px 0', fontSize: 12, color: '#737b6c', textAlign: 'center' }}>
                Tidak ada notifikasi pengiriman baru. Semua aktivitas gudang berjalan normal.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="dashboard-profile">
        <button
          onClick={() => {
            setNotificationsOpen(false);
            setProfileOpen((current) => !current);
          }}
          aria-expanded={profileOpen}
        >
          <span className="profile-avatar">
            {manager?.photo ? <img src={manager.photo} alt="Manager avatar" /> : name[0].toUpperCase()}
          </span>
          <span className="profile-text">
            <strong>{name.toUpperCase()}</strong>
            <small>{manager?.jobTitle || "Warehouse Manager"}</small>
          </span>
          <span aria-hidden="true">⌄</span>
        </button>

        {profileOpen && (
          <div className="profile-dropdown">
            {onViewProfile && (
              <button
                onClick={() => {
                  setProfileOpen(false);
                  onViewProfile();
                }}
              >
                View profile
              </button>
            )}
            <button onClick={onSignOut}>Sign Out</button>
          </div>
        )}
      </div>
    </header>
  );
}
