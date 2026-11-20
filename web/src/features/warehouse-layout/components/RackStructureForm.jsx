/**
 * Interactive Form for Configuring Physical Rack Structure (Bays, Levels, Matrix)
 * Performs real-time client-side validation and debounced server preview diff (AC-09).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

function getAuthToken() {
  return localStorage.getItem('susuno_auth_token') || localStorage.getItem('susuno_token') || 'demo_token';
}

export default function RackStructureForm({
  rack,
  initialBays = [],
  initialLevels = [],
  initialConfigs = [],
  onStructureChange,
  onHighlightChange,
}) {
  const rackLength = rack?.length_mm || 2400;
  const rackHeight = rack?.height_mm || 4000;

  // Local working state of the form
  const [bays, setBays] = useState(initialBays);
  const [levels, setLevels] = useState(initialLevels);
  const [configs, setConfigs] = useState(initialConfigs);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Sync with initial props when rack changes
  useEffect(() => {
    setBays(initialBays.length > 0 ? initialBays : [{ bay_number: 1, width_mm: rackLength }]);
    setLevels(
      initialLevels.length > 0
        ? initialLevels
        : [
            { level_number: 1, height_from_floor_mm: 0, max_weight_kg: 500 },
            { level_number: 2, height_from_floor_mm: 1200, max_weight_kg: 500 },
          ]
    );
    setConfigs(initialConfigs);
  }, [rack?.id]);

  // Client-Side Validation Computations
  const totalBayWidth = useMemo(() => {
    return bays.reduce((sum, b) => sum + (Number(b.width_mm) || 0), 0);
  }, [bays]);

  const bayWidthDiff = Math.abs(totalBayWidth - rackLength);
  const isBayWidthValid = bayWidthDiff <= 5;

  const isLevelsValid = useMemo(() => {
    if (levels.length === 0) return false;
    const sorted = [...levels].sort((a, b) => a.level_number - b.level_number);
    let prev = -1;
    for (let i = 0; i < sorted.length; i++) {
      const h = Number(sorted[i].height_from_floor_mm);
      if (isNaN(h) || h < 0) return false;
      if (i > 0 && h <= prev) return false;
      if (i > 0 && h - prev < 300) return false;
      prev = h;
    }
    const highest = sorted[sorted.length - 1];
    if (highest && Number(highest.height_from_floor_mm) + 300 > rackHeight) {
      return false;
    }
    return true;
  }, [levels, rackHeight]);

  // Ensure configs matrix exists for every bay x level pair
  useEffect(() => {
    const newConfigs = [];
    for (const b of bays) {
      for (const l of levels) {
        const existing = configs.find(
          (c) => c.bay_number === b.bay_number && c.level_number === l.level_number
        );
        newConfigs.push({
          bay_number: b.bay_number,
          level_number: l.level_number,
          position_count: existing?.position_count || 2,
        });
      }
    }
    setConfigs(newConfigs);
  }, [bays.length, levels.length]);

  // Notify parent of updated structure
  useEffect(() => {
    if (onStructureChange) {
      onStructureChange({
        bays,
        levels,
        configs,
        isValid: isBayWidthValid && isLevelsValid,
      });
    }
  }, [bays, levels, configs, isBayWidthValid, isLevelsValid, onStructureChange]);

  // Debounced API Preview Diff (AC-09)
  const fetchPreviewDiff = useCallback(
    async (currentBays, currentLevels, currentConfigs) => {
      if (!rack?.id || !isBayWidthValid || !isLevelsValid) {
        setPreviewData(null);
        return;
      }

      setPreviewLoading(true);
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE_URL}/warehouse-layout/racks/${rack.id}/structure/preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          body: JSON.stringify({
            bays: currentBays,
            levels: currentLevels,
            configs: currentConfigs,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          setPreviewData(json.data);
          setValidationError(null);
        } else {
          const errJson = await res.json().catch(() => ({}));
          setValidationError(errJson.message || 'Gagal memuat preview');
        }
      } catch (err) {
        console.error('[PREVIEW ERROR]', err);
      } finally {
        setPreviewLoading(false);
      }
    },
    [rack?.id, isBayWidthValid, isLevelsValid]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreviewDiff(bays, levels, configs);
    }, 350);
    return () => clearTimeout(timer);
  }, [bays, levels, configs, fetchPreviewDiff]);

  // Handlers for Bay
  const handleAddBay = () => {
    const nextNum = bays.length + 1;
    // Bagi rata sisa panjang atau tetapkan proporsional
    const currentTotal = bays.reduce((sum, b) => sum + (Number(b.width_mm) || 0), 0);
    const remaining = Math.max(rackLength - currentTotal, 600);

    setBays([...bays, { bay_number: nextNum, width_mm: remaining }]);
  };

  const handleUpdateBayWidth = (index, val) => {
    const next = [...bays];
    next[index] = { ...next[index], width_mm: Math.max(1, parseInt(val, 10) || 0) };
    setBays(next);
  };

  const handleRemoveBay = (index) => {
    if (bays.length <= 1) return;
    const next = bays.filter((_, i) => i !== index).map((b, i) => ({ ...b, bay_number: i + 1 }));
    setBays(next);
  };

  // Handlers for Level
  const handleAddLevel = () => {
    const nextNum = levels.length + 1;
    const lastHeight = levels[levels.length - 1]?.height_from_floor_mm || 0;
    const nextHeight = Math.min(lastHeight + 1000, rackHeight - 400);

    setLevels([
      ...levels,
      { level_number: nextNum, height_from_floor_mm: nextHeight, max_weight_kg: 500 },
    ]);
  };

  const handleUpdateLevel = (index, field, val) => {
    const next = [...levels];
    next[index] = {
      ...next[index],
      [field]: field === 'height_from_floor_mm' ? Math.max(0, parseInt(val, 10) || 0) : parseFloat(val) || null,
    };
    setLevels(next);
  };

  const handleRemoveLevel = (index) => {
    if (levels.length <= 1) return;
    const next = levels.filter((_, i) => i !== index).map((l, i) => ({ ...l, level_number: i + 1 }));
    setLevels(next);
  };

  // Handlers for Position Count
  const handleUpdatePosCount = (bayNum, lvlNum, val) => {
    const count = Math.max(1, parseInt(val, 10) || 1);
    setConfigs((prev) =>
      prev.map((c) =>
        c.bay_number === bayNum && c.level_number === lvlNum ? { ...c, position_count: count } : c
      )
    );
  };

  return (
    <div className="rack-structure-form">
      {/* 1. Header & Rack Geometry Info */}
      <div className="form-section-header">
        <h4>Dimensi Fisik Rak</h4>
        <span className="rack-dim-tag">
          Panjang: {rackLength} mm | Tinggi: {rackHeight} mm | Kedalaman: {rack?.depth_mm || 1000} mm
        </span>
      </div>

      {/* 2. Bay Configuration */}
      <div className="form-group-card">
        <div className="group-card-header">
          <div className="group-title-wrapper">
            <h5>Kolom Bay ({bays.length})</h5>
            <span
              className={`pill-validation ${isBayWidthValid ? 'pill-valid' : 'pill-invalid'}`}
              title="Total lebar bay harus sama dengan panjang rak (toleransi 5mm)"
            >
              {isBayWidthValid ? '✓ Presisi Sesuai' : `⚠️ Selisih ${bayWidthDiff} mm (${totalBayWidth} / ${rackLength} mm)`}
            </span>
          </div>
          <button className="btn-small-action" onClick={handleAddBay}>
            + Tambah Bay
          </button>
        </div>

        <div className="bays-input-list">
          {bays.map((b, idx) => (
            <div
              key={`bay-input-${b.bay_number}`}
              className="bay-input-row"
              onMouseEnter={() => onHighlightChange && onHighlightChange(b.bay_number, null)}
              onMouseLeave={() => onHighlightChange && onHighlightChange(null, null)}
            >
              <span className="row-label">Bay {b.bay_number}:</span>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="100"
                  max={rackLength}
                  step="50"
                  value={b.width_mm}
                  onChange={(e) => handleUpdateBayWidth(idx, e.target.value)}
                />
                <span className="unit-label">mm</span>
              </div>
              {bays.length > 1 && (
                <button
                  className="btn-icon-danger"
                  onClick={() => handleRemoveBay(idx)}
                  title="Hapus Bay"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Level Configuration */}
      <div className="form-group-card">
        <div className="group-card-header">
          <div className="group-title-wrapper">
            <h5>Tingkat Level Vertikal ({levels.length})</h5>
            <span className={`pill-validation ${isLevelsValid ? 'pill-valid' : 'pill-invalid'}`}>
              {isLevelsValid ? '✓ Ketinggian Valid' : '⚠️ Ketinggian / Clearance Tidak Valid'}
            </span>
          </div>
          <button className="btn-small-action" onClick={handleAddLevel}>
            + Tambah Level
          </button>
        </div>

        <div className="levels-input-list">
          {levels.map((l, idx) => (
            <div
              key={`level-input-${l.level_number}`}
              className="level-input-row"
              onMouseEnter={() => onHighlightChange && onHighlightChange(null, l.level_number)}
              onMouseLeave={() => onHighlightChange && onHighlightChange(null, null)}
            >
              <span className="row-label">Level {l.level_number}:</span>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="0"
                  max={rackHeight - 300}
                  step="100"
                  value={l.height_from_floor_mm}
                  onChange={(e) => handleUpdateLevel(idx, 'height_from_floor_mm', e.target.value)}
                  title="Ketinggian dari lantai dalam mm"
                />
                <span className="unit-label">mm</span>
              </div>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="50"
                  max="5000"
                  step="50"
                  placeholder="Kapasitas"
                  value={l.max_weight_kg || ''}
                  onChange={(e) => handleUpdateLevel(idx, 'max_weight_kg', e.target.value)}
                  title="Kapasitas beban maksimum (kg)"
                />
                <span className="unit-label">kg</span>
              </div>
              {levels.length > 1 && (
                <button
                  className="btn-icon-danger"
                  onClick={() => handleRemoveLevel(idx)}
                  title="Hapus Level"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Position Count Matrix */}
      <div className="form-group-card">
        <div className="group-card-header">
          <h5>Slot Posisi per Kompartemen (Position Count)</h5>
        </div>
        <div className="matrix-table-wrapper">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Level \ Bay</th>
                {bays.map((b) => (
                  <th key={`th-bay-${b.bay_number}`}>Bay {b.bay_number}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...levels]
                .sort((a, b) => b.level_number - a.level_number)
                .map((l) => (
                  <tr key={`tr-lvl-${l.level_number}`}>
                    <td className="row-header">Level {l.level_number}</td>
                    {bays.map((b) => {
                      const cfg = configs.find(
                        (c) => c.bay_number === b.bay_number && c.level_number === l.level_number
                      );
                      const val = cfg?.position_count || 1;
                      return (
                        <td key={`cell-${b.bay_number}-${l.level_number}`}>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={val}
                            onChange={(e) =>
                              handleUpdatePosCount(b.bay_number, l.level_number, e.target.value)
                            }
                            className="matrix-cell-input"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Live Server Preview Diff Summary (AC-09) */}
      <div className="preview-diff-card">
        <h6>Proyeksi Lokasi (AC-09 Preview)</h6>
        {previewLoading ? (
          <p className="preview-loading-text">Menghitung proyeksi diff...</p>
        ) : previewData ? (
          <div className="preview-stat-grid">
            <div className="preview-stat-box">
              <span className="p-label">Total Slot Posisi</span>
              <span className="p-val">{previewData.projected.locations_count}</span>
            </div>
            <div className="preview-stat-box">
              <span className="p-label">Perubahan Lokasi</span>
              <span
                className="p-val"
                style={{
                  color:
                    previewData.diff.delta_locations >= 0 ? '#16a34a' : '#ea580c',
                }}
              >
                {previewData.diff.delta_locations >= 0
                  ? `+${previewData.diff.delta_locations}`
                  : previewData.diff.delta_locations}
              </span>
            </div>
            <div className="preview-stat-box">
              <span className="p-label">Delta Bay / Level</span>
              <span className="p-val">
                {previewData.diff.delta_bays >= 0 ? `+${previewData.diff.delta_bays}` : previewData.diff.delta_bays} B /{' '}
                {previewData.diff.delta_levels >= 0 ? `+${previewData.diff.delta_levels}` : previewData.diff.delta_levels} L
              </span>
            </div>
          </div>
        ) : (
          <p className="preview-empty-hint">
            {validationError || 'Perbaiki konfigurasi agar dimensi valid untuk melihat proyeksi diff.'}
          </p>
        )}
      </div>
    </div>
  );
}
