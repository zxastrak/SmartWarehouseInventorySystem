import React, { useEffect, useRef, useState } from "react";
import Icon from "./DashboardIcon.jsx";
export default function WarehouseHeader({ manager, search, onSearch, onMenu, onSignOut, searchRef, onAlerts, onViewProfile }) {
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
  <button className="notification-button" aria-label={onAlerts ? "Notifications: 3 actions required" : "View inventory alerts"} onClick={() => onAlerts ? onAlerts() : onSearch("WH-3382")}><Icon name="bell" /><i /></button>
  <div className="dashboard-profile"><button onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen}><span className="profile-avatar">{name[0].toUpperCase()}</span><span className="profile-text"><strong>{name.toUpperCase()}</strong><small>Warehouse Manager</small></span><span aria-hidden="true">⌄</span></button>{profileOpen && <div className="profile-dropdown">{onViewProfile && <button onClick={() => {
    setProfileOpen(false);
    onViewProfile();
  }}>View profile</button>}<button onClick={onSignOut}>Sign Out</button></div>}</div>
 </header>;
}
