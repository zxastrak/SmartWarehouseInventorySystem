/**
 * Slot Configuration Modal
 * Lets the user configure the standard modular slot dimensions (Length x Width x Height) in cm.
 * This directly sets the base grid unit for the warehouse floor plan, magnetic snapping, and pathfinding matrix.
 */

import React, { useState, useEffect } from 'react';

const PRESETS = [
  {
    name: 'Modular Tote (Rekomendasi)',
    lengthCm: 70,
    depthCm: 50,
    heightCm: 40,
    desc: 'Standar keranjang plastik gudang modern (70 × 50 cm)',
  },
  {
    name: 'Euro Box (KLT)',
    lengthCm: 60,
    depthCm: 40,
    heightCm: 32,
    desc: 'Standar logistik industri manufaktur & e-commerce',
  },
  {
    name: 'Standard Pallet',
    lengthCm: 120,
    depthCm: 100,
    heightCm: 140,
    desc: 'Footprint palet kayu kargo gudang besar (1.2 × 1.0 m)',
  },
  {
    name: 'Small Parcel Bin',
    lengthCm: 40,
    depthCm: 30,
    heightCm: 25,
    desc: 'Kotak suku cadang kecil / farmasi / retail ringan',
  },
];

export default function SlotConfigModal({
  isOpen,
  initialConfig = { lengthMm: 700, depthMm: 500, heightMm: 400 },
  onClose,
  onSave,
}) {
  const [lengthCm, setLengthCm] = useState(70);
  const [depthCm, setDepthCm] = useState(50);
  const [heightCm, setHeightCm] = useState(40);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && initialConfig) {
      setLengthCm(Math.round((initialConfig.lengthMm || 700) / 10));
      setDepthCm(Math.round((initialConfig.depthMm || 500) / 10));
      setHeightCm(Math.round((initialConfig.heightMm || 400) / 10));
      setError('');
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const applyPreset = (preset) => {
    setLengthCm(preset.lengthCm);
    setDepthCm(preset.depthCm);
    setHeightCm(preset.heightCm);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const l = parseFloat(lengthCm);
    const d = parseFloat(depthCm);
    const h = parseFloat(heightCm);

    if (isNaN(l) || l < 10 || l > 500) {
      setError('Panjang slot harus antara 10 cm sampai 500 cm.');
      return;
    }
    if (isNaN(d) || d < 10 || d > 500) {
      setError('Lebar/kedalaman slot harus antara 10 cm sampai 500 cm.');
      return;
    }
    if (isNaN(h) || h < 5 || h > 500) {
      setError('Tinggi slot harus antara 5 cm sampai 500 cm.');
      return;
    }

    onSave({
      lengthMm: Math.round(l * 10),
      depthMm: Math.round(d * 10),
      heightMm: Math.round(h * 10),
    });
    onClose();
  };

  return (
    <div className="layout-modal-backdrop" onClick={onClose}>
      <div
        className="layout-modal-card"
        style={{ maxWidth: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="layout-modal-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span>📐</span> Ukuran Slot Standar Gudang
            </h2>
            <p style={{ margin: '4px 0 0', color: '#737b6c', fontSize: '0.82rem' }}>
              Panjang dan lebar slot ini menjadi <strong>patokan dasar seluruh matriks grid</strong> denah dan rute navigasi.
            </p>
          </div>
          <button className="layout-modal-close" onClick={onClose} title="Tutup">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="layout-modal-body">
          {/* Preset Buttons */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#525c48',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              Pilih Ukuran Standar Cepat:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PRESETS.map((p) => {
                const isSelected = p.lengthCm === lengthCm && p.depthCm === depthCm;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid #5c732b' : '1px solid #d4dec4',
                      backgroundColor: isSelected ? '#f4f7ee' : '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#191d17' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#5c732b', fontWeight: 600 }}>
                      {p.lengthCm} × {p.depthCm} cm
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Dimensions Input */}
          <div
            style={{
              background: '#f8f9f5',
              border: '1px solid #e2e5dc',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#3e5510',
                    marginBottom: 4,
                  }}
                >
                  Panjang (X)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    max="500"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 32px 8px 10px',
                      borderRadius: 6,
                      border: '1px solid #c5cdbb',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                    required
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      fontSize: '0.75rem',
                      color: '#737b6c',
                      fontWeight: 600,
                    }}
                  >
                    cm
                  </span>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#3e5510',
                    marginBottom: 4,
                  }}
                >
                  Lebar / Tebal (Y)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    max="500"
                    value={depthCm}
                    onChange={(e) => setDepthCm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 32px 8px 10px',
                      borderRadius: 6,
                      border: '1px solid #c5cdbb',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                    required
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      fontSize: '0.75rem',
                      color: '#737b6c',
                      fontWeight: 600,
                    }}
                  >
                    cm
                  </span>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#3e5510',
                    marginBottom: 4,
                  }}
                >
                  Tinggi (Z)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max="500"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 32px 8px 10px',
                      borderRadius: 6,
                      border: '1px solid #c5cdbb',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                    required
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      fontSize: '0.75rem',
                      color: '#737b6c',
                      fontWeight: 600,
                    }}
                  >
                    cm
                  </span>
                </div>
              </div>
            </div>

            {/* Live Dimension Preview Info */}
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                background: '#eef3e2',
                borderRadius: 6,
                fontSize: '0.78rem',
                color: '#3e5510',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>ℹ️</span>
              <span>
                Setiap petak grid lantai akan berukuran tepat{' '}
                <strong>
                  {lengthCm} cm × {depthCm} cm
                </strong>{' '}
                ({lengthCm * 10} mm × {depthCm * 10} mm).
              </span>
            </div>
          </div>

          {error && (
            <div
              style={{
                color: '#dc2626',
                background: '#fee2e2',
                padding: '8px 12px',
                borderRadius: 6,
                marginBottom: 12,
                fontSize: '0.8rem',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div className="layout-modal-actions">
            <button type="button" className="btn-toolbar" onClick={onClose}>
              Batal
            </button>
            <button
              type="submit"
              className="btn-toolbar btn-toolbar-action"
              style={{ background: '#5c732b', color: '#ffffff', fontWeight: 700 }}
            >
              ✓ Simpan & Terapkan Grid
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
