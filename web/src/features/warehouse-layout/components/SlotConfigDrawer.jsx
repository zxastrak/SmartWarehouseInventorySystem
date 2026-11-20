/**
 * Slot Configuration Drawer (Sidebar Kanan)
 * Sliding sidebar from right to configure modular slot dimensions (Length x Depth x Height in cm).
 * Includes an interactive 3D/Isometric box illustration that updates dynamically.
 */

import React, { useState, useEffect } from 'react';

const PRESETS = [
  {
    name: 'Modular Tote (Rekomendasi)',
    lengthCm: 70,
    depthCm: 50,
    heightCm: 40,
    desc: 'Keranjang modular standar gudang modern',
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
    desc: 'Footprint palet kargo gudang besar (1.2 × 1.0 m)',
  },
  {
    name: 'Small Parcel Bin',
    lengthCm: 40,
    depthCm: 30,
    heightCm: 25,
    desc: 'Wadah part kecil / suku cadang / farmasi',
  },
];

const COLOR_PRESETS = [
  { hex: '#5c732b', name: 'Olive Green (Standar)' },
  { hex: '#2563eb', name: 'Royal Blue (Fast-Moving)' },
  { hex: '#d97706', name: 'Amber Orange (Buffer)' },
  { hex: '#7c3aed', name: 'Indigo Purple (Promo)' },
  { hex: '#dc2626', name: 'Crimson Red (Fragile/Hazmat)' },
  { hex: '#059669', name: 'Emerald (Segar/Pangan)' },
  { hex: '#0891b2', name: 'Cyan (Alkes/Farmasi)' },
  { hex: '#475569', name: 'Slate Gray (Bahan Baku)' },
];

export default function SlotConfigDrawer({
  isOpen,
  initialConfig = { lengthMm: 700, depthMm: 500, heightMm: 400 },
  activeColor = '#5c732b',
  onColorChange,
  activeLevelCount = 3,
  onLevelCountChange,
  isFillSlotMode = false,
  onToggleFillSlotMode,
  warehouseHeightMm = 10000,
  onClose,
  onSave,
}) {
  const [lengthCm, setLengthCm] = useState(70);
  const [depthCm, setDepthCm] = useState(50);
  const [heightCm, setHeightCm] = useState(40);
  const [color, setColor] = useState(activeColor);
  const [levelCount, setLevelCount] = useState(activeLevelCount || 3);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && initialConfig) {
      setLengthCm(Math.round((initialConfig.lengthMm || 700) / 10));
      setDepthCm(Math.round((initialConfig.depthMm || 500) / 10));
      setHeightCm(Math.round((initialConfig.heightMm || 400) / 10));
      if (activeColor) setColor(activeColor);
      if (activeLevelCount) setLevelCount(activeLevelCount);
      setError('');
    }
  }, [isOpen, initialConfig, activeColor, activeLevelCount]);

  if (!isOpen) return null;

  // Batas aman atap gudang: Tinggi Gudang - 1.5 M (1500 mm)
  const maxSafeHeightMm = Math.max(1000, warehouseHeightMm - 1500);
  const currentSlotHMm = Math.max(50, (Number(heightCm) || 40) * 10);
  const maxLevels = Math.max(1, Math.floor(maxSafeHeightMm / currentSlotHMm));

  const applyPreset = (preset) => {
    setLengthCm(preset.lengthCm);
    setDepthCm(preset.depthCm);
    setHeightCm(preset.heightCm);
    setError('');
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
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

    if (onColorChange && color) {
      onColorChange(color);
    }

    onSave({
      lengthMm: Math.round(l * 10),
      depthMm: Math.round(d * 10),
      heightMm: Math.round(h * 10),
    });
    onClose();
  };

  // Isometric SVG 3D Box calculations
  const numL = Math.max(10, Math.min(200, parseFloat(lengthCm) || 70));
  const numD = Math.max(10, Math.min(200, parseFloat(depthCm) || 50));
  const numH = Math.max(10, Math.min(200, parseFloat(heightCm) || 40));

  // Aspect-ratio scaling to fit nicely in 320x170 box
  const maxDim = Math.max(numL, numD, numH * 1.5, 60);
  const scale = 80 / maxDim;

  const w = numL * scale;
  const d = numD * scale * 0.75;
  const h = numH * scale * 0.65;

  const originX = 160;
  const originY = 125;

  const pFront = { x: originX, y: originY };
  const pRight = { x: originX + w * 0.866, y: originY - w * 0.5 };
  const pLeft = { x: originX - d * 0.866, y: originY - d * 0.5 };
  const pBack = { x: pLeft.x + (pRight.x - pFront.x), y: pLeft.y + (pRight.y - pFront.y) };

  const pFrontTop = { x: pFront.x, y: pFront.y - h };
  const pRightTop = { x: pRight.x, y: pRight.y - h };
  const pLeftTop = { x: pLeft.x, y: pLeft.y - h };
  const pBackTop = { x: pBack.x, y: pBack.y - h };

  return (
    <div
      className="layout-drawer-panel slot-config-drawer"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '440px',
        maxWidth: '100%',
        backgroundColor: '#ffffff',
        boxShadow: '-6px 0 20px rgba(0, 0, 0, 0.12)',
        borderLeft: '1px solid #e2e8f0',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafaf9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📦</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#191d17' }}>
                Atur Ukuran Slot Gudang
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#737b6c' }}>
                Dimensi acuan grid denah & ukuran kompartemen rak
              </p>
            </div>
          </div>
          <button
            type="button"
            className="layout-modal-close"
            onClick={onClose}
            title="Tutup Panel"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: '#737b6c',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {/* Card: Mode Isi Slot (Drag & Fill) */}
          <div
            style={{
              background: isFillSlotMode ? '#f0fdf4' : '#f8fafc',
              border: isFillSlotMode ? '1.5px solid #86efac' : '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '1.1rem' }}>🖌️</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: isFillSlotMode ? '#166534' : '#1e293b' }}>
                  Mode Isi Slot (Drag & Fill)
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: isFillSlotMode ? '#dcfce7' : '#e2e8f0',
                    color: isFillSlotMode ? '#15803d' : '#64748b',
                  }}
                >
                  {isFillSlotMode ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: isFillSlotMode ? '#166534' : '#64748b', lineHeight: 1.35 }}>
                {isFillSlotMode
                  ? 'Klik & seret mouse di atas kanvas gudang untuk langsung mengisi slot menjadi baris rak.'
                  : 'Aktifkan untuk mengisi slot modular langsung via klik & drag mouse di kanvas.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleFillSlotMode}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: isFillSlotMode ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                backgroundColor: isFillSlotMode ? '#16a34a' : '#ffffff',
                color: isFillSlotMode ? '#ffffff' : '#334155',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {isFillSlotMode ? 'Matikan' : 'Aktifkan'}
            </button>
          </div>

          {/* 1. Interactive 3D Box Illustration */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f8f9f5 0%, #edf1e6 100%)',
              border: '1px solid #d4dec4',
              borderRadius: 12,
              padding: '12px 8px',
              marginBottom: 18,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3e5510', textTransform: 'uppercase', marginBottom: 4 }}>
              Ilustrasi Kotak Slot Modular: {lengthCm} × {depthCm} × {heightCm} cm
            </div>

            <svg viewBox="0 0 320 170" style={{ width: '100%', height: '150px', overflow: 'visible' }}>
              {/* Back & Base shadow */}
              <polygon
                points={`${pFront.x},${pFront.y} ${pRight.x},${pRight.y} ${pBack.x},${pBack.y} ${pLeft.x},${pLeft.y}`}
                fill="rgba(0, 0, 0, 0.05)"
              />

              {/* Front-Left Face (Depth Y) */}
              <polygon
                points={`${pFront.x},${pFront.y} ${pLeft.x},${pLeft.y} ${pLeftTop.x},${pLeftTop.y} ${pFrontTop.x},${pFrontTop.y}`}
                fill={`${color}30`}
                stroke={color}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />

              {/* Front-Right Face (Length X) */}
              <polygon
                points={`${pFront.x},${pFront.y} ${pRight.x},${pRight.y} ${pRightTop.x},${pRightTop.y} ${pFrontTop.x},${pFrontTop.y}`}
                fill={`${color}20`}
                stroke={color}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />

              {/* Top Face */}
              <polygon
                points={`${pFrontTop.x},${pFrontTop.y} ${pRightTop.x},${pRightTop.y} ${pBackTop.x},${pBackTop.y} ${pLeftTop.x},${pLeftTop.y}`}
                fill={`${color}45`}
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Length (X) Dimension Arrow & Label */}
              <text
                x={(pFront.x + pRight.x) / 2 + 10}
                y={(pFront.y + pRight.y) / 2 + 14}
                fill="#4c1d95"
                fontSize="11"
                fontWeight="700"
              >
                Panjang: {lengthCm} cm
              </text>

              {/* Depth (Y) Dimension Arrow & Label */}
              <text
                x={(pFront.x + pLeft.x) / 2 - 20}
                y={(pFront.y + pLeft.y) / 2 + 14}
                fill="#4c1d95"
                fontSize="11"
                fontWeight="700"
                textAnchor="end"
              >
                Lebar: {depthCm} cm
              </text>

              {/* Height (Z) Dimension Arrow & Label */}
              <text
                x={pFrontTop.x}
                y={pFrontTop.y - 8}
                fill="#3e5510"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
              >
                Tinggi (Z): {heightCm} cm
              </text>
            </svg>
          </div>

          {/* 2. Preset Selection */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#3e5510',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            >
              Pilih Ukuran Standar Cepat:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PRESETS.map((p) => {
                const isSelected = p.lengthCm === parseFloat(lengthCm) && p.depthCm === parseFloat(depthCm);
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid #5c732b' : '1px solid #d4dacb',
                      backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isSelected ? '#2b5212' : '#191d17' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#5c732b', fontWeight: 600, marginTop: 2 }}>
                      {p.lengthCm} × {p.depthCm} cm
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Custom Input Form */}
          <div
            style={{
              background: '#f8f9f5',
              border: '1px solid #e2e5dc',
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#3e5510',
                marginBottom: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            >
              Kustomisasi Ukuran (cm):
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#525c48', marginBottom: 4 }}>
                  Panjang (X)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 26px 6px 8px',
                      borderRadius: 6,
                      border: '1px solid #c5cdbb',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  />
                  <span style={{ position: 'absolute', right: 6, top: 7, fontSize: '0.72rem', color: '#737b6c', fontWeight: 600 }}>
                    cm
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#525c48', marginBottom: 4 }}>
                  Lebar (Y)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={depthCm}
                    onChange={(e) => setDepthCm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 26px 6px 8px',
                      borderRadius: 6,
                      border: '1px solid #c5cdbb',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  />
                  <span style={{ position: 'absolute', right: 6, top: 7, fontSize: '0.72rem', color: '#737b6c', fontWeight: 600 }}>
                    cm
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#525c48', marginBottom: 4 }}>
                  Tinggi (Z)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 26px 6px 8px',
                      borderRadius: 6,
                      border: '1px solid #c5cdbb',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                    }}
                  />
                  <span style={{ position: 'absolute', right: 6, top: 7, fontSize: '0.72rem', color: '#737b6c', fontWeight: 600 }}>
                    cm
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 600, marginTop: 8 }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Section: Warna Default Slot & Rak */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                Warna Standar Slot & Rak
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    if (onColorChange) onColorChange(e.target.value);
                  }}
                  style={{
                    width: '26px',
                    height: '26px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    padding: 0,
                    backgroundColor: 'transparent',
                  }}
                  title="Pilih warna custom"
                />
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  {color}
                </span>
              </div>
            </div>
            {/* Color Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {COLOR_PRESETS.map((p) => {
                const isSelected = color.toLowerCase() === p.hex.toLowerCase();
                return (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => {
                      setColor(p.hex);
                      if (onColorChange) onColorChange(p.hex);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid #191d17' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#ffffff' : '#f8fafc',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: p.hex }} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Jumlah Tingkat (Level) Default */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                Jumlah Tingkat Rak Default
              </label>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: color }}>
                {levelCount} Tingkat ({levelCount * Math.round((Number(heightCm) || 40))} cm total)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  const val = Math.max(1, levelCount - 1);
                  setLevelCount(val);
                  if (onLevelCountChange) onLevelCountChange(val);
                }}
                disabled={levelCount <= 1}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  cursor: levelCount <= 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}
              >
                -
              </button>
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  color: '#1e293b',
                }}
              >
                {levelCount} Tingkat <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>(@{heightCm}cm)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const val = Math.min(maxLevels, levelCount + 1);
                  setLevelCount(val);
                  if (onLevelCountChange) onLevelCountChange(val);
                }}
                disabled={levelCount >= maxLevels}
                title={levelCount >= maxLevels ? `Batas maksimum tercapai (Tinggi gudang ${(warehouseHeightMm / 1000).toFixed(1)}m - 1.5m clearance atap)` : 'Tambah tingkat'}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  backgroundColor: levelCount >= maxLevels ? '#f1f5f9' : '#ffffff',
                  cursor: levelCount >= maxLevels ? 'not-allowed' : 'pointer',
                  opacity: levelCount >= maxLevels ? 0.45 : 1,
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}
              >
                +
              </button>
            </div>

            {/* Quick Pill Buttons */}
            <div style={{ display: 'flex', gap: '6px', marginTop: 10, flexWrap: 'wrap' }}>
              {Array.from({ length: Math.min(maxLevels, 6) }, (_, i) => i + 1).map((lvl) => (
                <button
                  key={`slot-lvl-pill-${lvl}`}
                  type="button"
                  onClick={() => {
                    setLevelCount(lvl);
                    if (onLevelCountChange) onLevelCountChange(lvl);
                  }}
                  style={{
                    flex: 1,
                    minWidth: '42px',
                    padding: '5px 0',
                    borderRadius: 6,
                    border: levelCount === lvl ? `1.5px solid ${color}` : '1px solid #cbd5e1',
                    background: levelCount === lvl ? `${color}18` : '#ffffff',
                    color: levelCount === lvl ? color : '#475569',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {lvl} Lt
                </button>
              ))}
            </div>
          </div>

          {/* Safety Clearance Banner */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 8,
              fontSize: '0.76rem',
              color: '#92400e',
              lineHeight: 1.4,
              marginBottom: 16,
            }}
          >
            ⚠️ <strong>Batas Aman Atap Gudang:</strong> Berdasarkan tinggi gudang saat ini ({(warehouseHeightMm / 1000).toFixed(1)}m) dengan clearance atap minimum 1.5m, rak dengan tinggi slot {heightCm} cm maksimal dapat memiliki <strong>{maxLevels} Tingkat</strong> (maks. {(maxSafeHeightMm / 1000).toFixed(1)}m).
          </div>

          {/* 4. Information Box */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              fontSize: '0.78rem',
              color: '#166534',
              lineHeight: 1.45,
            }}
          >
            💡 <strong>Panduan Slot Modular:</strong> Ukuran slot ini menjadi standar grid snapping saat menambahkan rak baru dan menentukan pembagian kompartemen penyimpanan fisik di gudang.
          </div>
        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#fafaf9',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn-layout-control"
            style={{ padding: '8px 16px' }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-layout-control btn-layout-primary"
            style={{
              padding: '8px 18px',
              backgroundColor: '#5c732b',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            ✓ Simpan & Terapkan Slot
          </button>
        </div>
      </div>
  );
}
