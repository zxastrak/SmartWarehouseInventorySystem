/**
 * Rack Elevation & Structure Modal Dialog
 * Combines SVG Front Elevation visualization and interactive configuration form.
 */

import React, { useState, useEffect, useCallback } from 'react';
import RackElevationSvg from './RackElevationSvg.jsx';
import RackStructureForm from './RackStructureForm.jsx';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

function getAuthToken() {
  return localStorage.getItem('susuno_auth_token') || localStorage.getItem('susuno_token') || 'demo_token';
}

export default function RackElevationModal({
  isOpen,
  rack,
  onClose,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [structureData, setStructureData] = useState(null);

  // Form working state
  const [currentFormState, setCurrentFormState] = useState(null);
  const [highlightedBay, setHighlightedBay] = useState(null);
  const [highlightedLevel, setHighlightedLevel] = useState(null);

  // Fetch rack structure from backend
  const loadStructure = useCallback(async () => {
    if (!rack?.id) return;
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/racks/${rack.id}/structure`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Gagal mengambil struktur rak (HTTP ${res.status})`);
      }

      const json = await res.json();
      setStructureData(json.data);
      setLoading(false);
    } catch (err) {
      console.error('[LOAD STRUCTURE ERROR]', err);
      setError(err.message);
      setLoading(false);
    }
  }, [rack?.id]);

  useEffect(() => {
    if (isOpen && rack?.id) {
      loadStructure();
    }
  }, [isOpen, rack?.id, loadStructure]);

  const handleFormChange = useCallback((formState) => {
    setCurrentFormState(formState);
  }, []);

  const handleHighlight = useCallback((bayNum, lvlNum) => {
    setHighlightedBay(bayNum);
    setHighlightedLevel(lvlNum);
  }, []);

  const handleSave = async () => {
    if (!currentFormState || !currentFormState.isValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/racks/${rack.id}/structure`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          bays: currentFormState.bays,
          levels: currentFormState.levels,
          configs: currentFormState.configs,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Gagal menyimpan struktur rak (HTTP ${res.status})`);
      }

      setSaving(false);
      if (onSaved) {
        onSaved(json.data);
      }
      onClose();
    } catch (err) {
      console.error('[SAVE STRUCTURE ERROR]', err);
      setError(err.message);
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="layout-modal-backdrop">
      <div className="rack-elevation-modal-card">
        {/* Modal Header */}
        <div className="elevation-modal-header">
          <div>
            <h3 className="elevation-modal-title">
              Konfigurasi Struktur Rak: {rack?.rack_code || 'Rak'}
            </h3>
            <p className="elevation-modal-subtitle">
              Atur kolom bay, ketinggian level dari lantai, dan matriks kapasitas bin penyimpanan.
            </p>
          </div>
          <button className="btn-modal-close" onClick={onClose} title="Tutup Dialog">
            ✕
          </button>
        </div>

        {/* Modal Body: Dual Pane (Visual SVG on Left, Form on Right) */}
        <div className="elevation-modal-body">
          {loading ? (
            <div className="elevation-loading-pane">
              <div className="layout-state-spinner" />
              <p>Memuat struktur rak...</p>
            </div>
          ) : error && !structureData ? (
            <div className="elevation-error-pane">
              <p style={{ color: '#dc2626' }}>⚠️ {error}</p>
              <button className="btn-layout-control" onClick={loadStructure}>
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              {/* Left Pane: Interactive SVG Elevation */}
              <div className="elevation-visual-pane">
                <div className="pane-title-badge">Tampak Depan Visual (Elevation)</div>
                <RackElevationSvg
                  rack={structureData?.rack || rack}
                  bays={currentFormState?.bays || structureData?.bays || []}
                  levels={currentFormState?.levels || structureData?.levels || []}
                  configs={currentFormState?.configs || structureData?.configs || []}
                  highlightedBay={highlightedBay}
                  highlightedLevel={highlightedLevel}
                />
              </div>

              {/* Right Pane: Configuration Form */}
              <div className="elevation-form-pane">
                {error && <div className="form-error-banner">⚠️ {error}</div>}
                <RackStructureForm
                  rack={structureData?.rack || rack}
                  initialBays={structureData?.bays || []}
                  initialLevels={structureData?.levels || []}
                  initialConfigs={structureData?.configs || []}
                  onStructureChange={handleFormChange}
                  onHighlightChange={handleHighlight}
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="elevation-modal-footer">
          <button className="btn-layout-control" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button
            className="btn-layout-control btn-layout-primary"
            onClick={handleSave}
            disabled={saving || !currentFormState?.isValid}
          >
            {saving ? 'Menyimpan Struktur...' : '💾 Simpan Struktur Rak'}
          </button>
        </div>
      </div>
    </div>
  );
}
