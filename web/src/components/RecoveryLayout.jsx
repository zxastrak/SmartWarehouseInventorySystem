import React from 'react';
import BrandPanel from './BrandPanel.jsx';
import '../styles/recovery.css';

export default function RecoveryLayout({ eyebrow = 'ACCOUNT RECOVERY', title, description, children }) {
  return (
    <main className="signup-layout">
      <BrandPanel />
      <section className="form-panel recovery-panel" aria-labelledby="recovery-title">
        <div className="signup-content">
          <header className="signup-header">
            <p className="form-eyebrow">{eyebrow}</p>
            <h2 id="recovery-title">{title}</h2>
            <p className="form-description">{description}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  );
}
