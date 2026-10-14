import React from 'react';
import Icon from './DashboardIcon.jsx';

const links = [ ['Dashboard','grid'], ['Inventory','box'], ['Inbound','inbound'], ['Outbound','outbound'], ['AI Insight','chart'], ['Purchase Orders','file'], ['Suppliers','users'], ['Reports','report'], ['Audit Trail','history'], ['Staff Management','users'], ['Settings','settings'] ];
export default function DashboardSidebar({ warehouseName, onNavigate, open, onClose, activePage = 'Dashboard' }) {
  return <>
    {open && <button className="dashboard-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`dashboard-sidebar${open ? ' is-open' : ''}`}>
      <button className="dashboard-logo-button" onClick={() => onNavigate('Dashboard')} aria-label="SUSUNO Dashboard"><img src="/assets/susuno-logo.png" alt="SUSUNO" /></button>
      <nav aria-label="Warehouse navigation">{links.map(([label,icon]) => <button key={label} type="button" className={label === activePage ? 'nav-active' : ''} aria-current={label === activePage ? 'page' : undefined} onClick={() => { onNavigate(label); onClose(); }}><Icon name={icon} /><span>{label}</span></button>)}</nav>
      <button className="dashboard-warehouse" onClick={() => onNavigate('Warehouse selection')}><Icon name="pin" /><strong>{warehouseName}</strong><span aria-hidden="true">⌄</span></button>
    </aside>
  </>;
}
