import React, { useRef, useState, useEffect } from 'react';
import Icon from './DashboardIcon.jsx';

const links = [
  ['Dashboard', 'grid'],
  ['Inventory', 'box'],
  ['Inbound', 'inbound'],
  ['Outbound', 'outbound'],
  ['AI Insight', 'chart'],
  ['Purchase Orders', 'file'],
  ['Suppliers', 'users'],
  ['Reports', 'report'],
  ['Audit Trail', 'history'],
  ['Staff Management', 'users'],
  ['Settings', 'settings']
];

// Persistent module-level memory to remember position across page unmounts
let lastKnownPage = null;
let lastKnownTop = null;
let lastKnownHeight = 58;

try {
  const savedPage = sessionStorage.getItem('susuno_sidebar_page');
  const savedTop = sessionStorage.getItem('susuno_sidebar_top');
  const savedHeight = sessionStorage.getItem('susuno_sidebar_height');
  if (savedPage) lastKnownPage = savedPage;
  if (savedTop !== null && !isNaN(parseFloat(savedTop))) lastKnownTop = parseFloat(savedTop);
  if (savedHeight !== null && !isNaN(parseFloat(savedHeight))) lastKnownHeight = parseFloat(savedHeight);
} catch {}

export default function DashboardSidebar({ warehouseName, onNavigate, open, onClose, activePage = 'Dashboard' }) {
  const itemRefs = useRef({});
  // Mulai dari posisi menu sebelumnya agar animasi meluncur dari menu asal (bukan selalu dari atas)
  const [pillStyle, setPillStyle] = useState(() => ({
    top: lastKnownTop !== null ? lastKnownTop : 0,
    height: lastKnownHeight || 58,
    visible: lastKnownTop !== null,
    duration: 0,
  }));

  useEffect(() => {
    let timerId;

    const updatePill = () => {
      const currentIndex = links.findIndex(([l]) => l === activePage);
      const el = itemRefs.current[activePage];
      if (!el || currentIndex === -1) return;

      const isFirstVisit = lastKnownTop === null;
      const isSamePage = lastKnownPage === activePage;
      const prevIndex = lastKnownPage ? links.findIndex(([l]) => l === lastKnownPage) : -1;
      const delta = prevIndex !== -1 ? Math.abs(currentIndex - prevIndex) : 1;
      // Kecepatan adaptif: dekat (delta 1) santai (~0.26s), jauh (delta 5-10) lebih cepat & gesit (~0.35s - 0.46s)
      const duration = (isFirstVisit || isSamePage) ? 0 : 0.24 + Math.min(delta, 10) * 0.022;

      const applyTargetPosition = () => {
        setPillStyle({
          top: el.offsetTop,
          height: el.offsetHeight,
          visible: true,
          duration,
        });

        lastKnownPage = activePage;
        lastKnownTop = el.offsetTop;
        lastKnownHeight = el.offsetHeight;

        try {
          sessionStorage.setItem('susuno_sidebar_page', activePage);
          sessionStorage.setItem('susuno_sidebar_top', String(el.offsetTop));
          sessionStorage.setItem('susuno_sidebar_height', String(el.offsetHeight));
        } catch {}
      };

      if (isFirstVisit || isSamePage) {
        applyTargetPosition();
      } else {
        // Beri 1 frame agar browser me-render posisi awal (dari menu sebelumnya) sebelum meluncur ke menu baru
        timerId = setTimeout(applyTargetPosition, 25);
      }
    };

    updatePill();
    window.addEventListener('resize', updatePill);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('resize', updatePill);
    };
  }, [activePage, open]);

  return <>
    {open && <button className="dashboard-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`dashboard-sidebar${open ? ' is-open' : ''}`}>
      <button className="dashboard-logo-button" onClick={() => onNavigate('Dashboard')} aria-label="SUSUNO Dashboard"><img src="/assets/susuno-logo.png" alt="SUSUNO" /></button>
      <nav aria-label="Warehouse navigation" style={{ position: 'relative' }}>
        <div
          className="nav-indicator-pill"
          style={{
            transform: `translateY(${pillStyle.top}px)`,
            height: `${pillStyle.height}px`,
            opacity: pillStyle.visible ? 1 : 0,
            transition: pillStyle.duration > 0
              ? `transform ${pillStyle.duration}s cubic-bezier(0.22, 1, 0.36, 1), height ${pillStyle.duration}s ease, opacity 0.2s ease`
              : 'opacity 0.2s ease',
          }}
          aria-hidden="true"
        >
          <div key={activePage} className="nav-indicator-pulse" />
        </div>
        {links.map(([label, icon]) => (
          <button
            key={label}
            ref={(node) => { if (node) itemRefs.current[label] = node; }}
            type="button"
            className={label === activePage ? 'nav-active' : ''}
            aria-current={label === activePage ? 'page' : undefined}
            onClick={() => { onNavigate(label); onClose?.(); }}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <button className="dashboard-warehouse" onClick={() => onNavigate('Warehouse selection')}><Icon name="pin" /><strong>{warehouseName}</strong><span aria-hidden="true">⌄</span></button>
    </aside>
  </>;
}
