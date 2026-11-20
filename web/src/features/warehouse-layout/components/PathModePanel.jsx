import React from 'react';

/**
 * Floating Pathfinding & Spatial Routing Panel (A*)
 */
export default function PathModePanel({
  isOpen,
  onClose,
  pathStartNode,
  setPathStartNode,
  pathGoalNode,
  setPathGoalNode,
  pathAgentProfile,
  setPathAgentProfile,
  routingCandidates = { docks: [], racks: [] },
  activeRoute = null,
  onResetRoute,
}) {
  if (!isOpen) return null;

  return (
    <div className="layout-pathfinding-panel">
      <div className="path-panel-header">
        <span className="path-panel-title">
          <span>📍</span> Mode Navigasi & Rute Spasial (A*)
        </span>
        <button
          className="path-panel-close"
          onClick={onClose}
          title="Tutup Mode Rute"
        >
          ✕
        </button>
      </div>

      <div className="path-controls-row">
        <div className="path-node-selector">
          <label>Titik Asal (Start)</label>
          <select
            value={pathStartNode}
            onChange={(e) => setPathStartNode(e.target.value)}
          >
            <option value="">-- Pilih Asal --</option>
            <optgroup label="Dok & Pintu">
              {routingCandidates.docks.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </optgroup>
            <optgroup label="Rak Penyimpanan">
              {routingCandidates.racks.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="path-node-selector">
          <label>Titik Tujuan (Goal)</label>
          <select
            value={pathGoalNode}
            onChange={(e) => setPathGoalNode(e.target.value)}
          >
            <option value="">-- Pilih Tujuan --</option>
            <optgroup label="Rak Penyimpanan">
              {routingCandidates.racks.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </optgroup>
            <optgroup label="Dok & Pintu">
              {routingCandidates.docks.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="path-node-selector" style={{ maxWidth: 140 }}>
          <label>Profil Agen</label>
          <select
            value={pathAgentProfile}
            onChange={(e) => setPathAgentProfile(e.target.value)}
          >
            <option value="human">🚶 Manusia (60cm)</option>
            <option value="forklift">🚜 Forklift (≥3m)</option>
          </select>
        </div>

        {activeRoute && (
          <button
            className="btn-toolbar"
            onClick={onResetRoute}
            style={{ marginTop: 16, height: 32, fontSize: '0.78rem' }}
          >
            ↺ Reset
          </button>
        )}
      </div>

      {activeRoute ? (
        <div className="path-metric-badge">
          <span className="path-metric-item">
            📏 Jarak: <span className="path-metric-val">{(activeRoute.totalDistanceMm / 1000).toFixed(1)} m</span>
          </span>
          <span className="path-metric-item">
            ↪ Belokan: <span className="path-metric-val">{activeRoute.turns}</span>
          </span>
          <span className="path-metric-item">
            ⏱ Estimasi: <span className="path-metric-val">{Math.round(activeRoute.totalDistanceMm / (pathAgentProfile === 'forklift' ? 3000 : 1400))} dtk</span>
          </span>
          <span className="path-metric-item" style={{ color: '#047857' }}>
            ✓ Rute Optimal
          </span>
        </div>
      ) : (
        <span className="path-hint-text">
          💡 Tip: Kamu juga bisa langsung klik rak atau dok di kanvas untuk menentukan titik asal dan tujuan rute.
        </span>
      )}
    </div>
  );
}
