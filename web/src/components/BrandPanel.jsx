import React from 'react';

export default function BrandPanel() {
  return (
    <aside className="brand-panel" aria-label="SUSUNO Manager Workspace">
      <div className="brand-content">
        <img className="brand-logo" src="/assets/susuno-logo.png" alt="SUSUNO" />
        <p className="brand-eyebrow">MANAGER WORKSPACE</p>
        <h1>One clear view of your<br className="desktop-break" /> entire warehouse.</h1>
        <p className="brand-description">Monitor inventory, approve operations, manage staff,<br className="desktop-break" /> and act before stock problems interrupt the workflow.</p>
        <div className="brand-cards">
          <div className="brand-card"><span>REAL-TIME CONTROL</span><strong>Inventory &amp; Orders</strong></div>
          <div className="brand-card"><span>SECURE ACCESS</span><strong>Manager Only</strong></div>
        </div>
      </div>
    </aside>
  );
}
