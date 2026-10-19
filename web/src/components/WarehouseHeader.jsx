import React, { useEffect, useRef, useState } from "react";
import Icon from "./DashboardIcon.jsx";
export default function WarehouseHeader({ manager, search, onSearch, onMenu, onSignOut, searchRef, onAlerts, onViewProfile, isBackendConnected, syncStatus, onSync }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const localSearchRef = useRef(null);
  const inputRef = searchRef || localSearchRef;
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
  const name = manager?.fullName?.trim().split(/\s+/)[0] || "Naura";
  return <header className="dashboard-topbar">
  <button className="dashboard-mobile-menu" aria-label="Open navigation" onClick={onMenu}><Icon name="menu" /></button>
  <div className="dashboard-search"><Icon name="search" /><label className="sr-only" htmlFor="warehouse-search">Search SKU, product or rack</label><input ref={inputRef} id="warehouse-search" placeholder="Search SKU, product or rack..." value={search} onChange={(event) => onSearch(event.target.value)} /><kbd>/</kbd></div>
  <div style={{ display: 'flex', alignItems: 'center' }}>
    {isBackendConnected ? (
      <button
        type="button"
        onClick={onSync}
        title={syncStatus === 'syncing' ? 'Menyinkronkan data dengan mobile & backend...' : 'Data tersinkronisasi dengan Backend & Mobile (Klik untuk sinkronisasi manual)'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: '600',
          borderRadius: '16px',
          border: '1px solid #c3dbc0',
          backgroundColor: syncStatus === 'syncing' ? '#f0f7ee' : '#eaf5e9',
          color: '#2d6328',
          cursor: 'pointer',
          marginRight: '8px'
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: syncStatus === 'syncing' ? '#e29b1b' : '#3da633', display: 'inline-block' }} />
        {syncStatus === 'syncing' ? 'Syncing...' : 'Live Sync'}
      </button>
    ) : (
      <span
        title="Mode Offline/Demo — Nyalakan backend (node server.js) untuk menghubungkan data real-time dengan aplikasi mobile."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: '600',
          borderRadius: '16px',
          border: '1px solid #e0e0e0',
          backgroundColor: '#f5f5f5',
          color: '#777',
          marginRight: '8px'
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#bbb', display: 'inline-block' }} />
        Demo / Offline
      </span>
    )}
  </div>
  <button className="notification-button" aria-label={onAlerts ? "Notifications: 3 actions required" : "View inventory alerts"} onClick={() => onAlerts ? onAlerts() : onSearch("WH-3382")}><Icon name="bell" /><i /></button>
  <div className="dashboard-profile"><button onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen}><span className="profile-avatar">{name[0].toUpperCase()}</span><span className="profile-text"><strong>{name.toUpperCase()}</strong><small>Warehouse Manager</small></span><span aria-hidden="true">⌄</span></button>{profileOpen && <div className="profile-dropdown">{onViewProfile && <button onClick={() => {
    setProfileOpen(false);
    onViewProfile();
  }}>View profile</button>}<button onClick={onSignOut}>Sign Out</button></div>}</div>
 </header>;
}
