/**
 * Add Rack Drawer Component (Sidebar Kanan Tambah Rak)
 * Slides in from the right underneath top bar to configure and place a new storage rack.
 * Features modular slot-based bay calculations, level setup, color picker (RGB & Presets),
 * and toggle for Canvas Drag-and-Fill Slot mode.
 */

import React, { useState, useEffect } from 'react';

const COLOR_PRESETS = [
  { hex: '#5c732b', name: 'Olive Green (Standar)' },
  { hex: '#2563eb', name: 'Royal Blue (Fast-Moving)' },
  { hex: '#d97706', name: 'Amber Orange (Buffer)' },
  { hex: '#7c3aed', name: 'Indigo Purple (Promo)' },
  { hex: '#dc2626', name: 'Crimson Red (Fragile/Hazmat)' },
  { hex: '#059669', name: 'Emerald (Makanan/Segar)' },
  { hex: '#0891b2', name: 'Cyan (Alkes/Farmasi)' },
  { hex: '#475569', name: 'Slate Gray (Bahan Baku)' },
];

export default function AddRackDrawer({
  isOpen,
  slotConfig = { lengthMm: 700, depthMm: 500, heightMm: 400 },
  slotRotated = false,
  existingRacks = [],
  selectedRacks = [],
  warehouseHeightMm = 10000,
  activeColor = '#5c732b',
  onColorChange,
  onApplyColorToSelected,
  onRackCodeChange,
  activeLevelCount = 3,
  onLevelCountChange,
  isFillSlotMode = false,
  onToggleFillSlotMode,
  onClose,
  onAddRack,
  onSaveRack,
  onSelectRack,
  onDeleteRack,
}) {
  const baseW_cm = Math.round((slotConfig.lengthMm || 700) / 10);
  const baseD_cm = Math.round((slotConfig.depthMm || 500) / 10);
  const slotW_cm = slotRotated ? baseD_cm : baseW_cm;
  const slotD_cm = slotRotated ? baseW_cm : baseD_cm;
  const slotH_cm = Math.round((slotConfig.heightMm || 400) / 10) || 50;

  // Batas aman atap gudang: Tinggi Gudang - 1.5 M (1500 mm)
  const maxSafeHeightMm = Math.max(1000, warehouseHeightMm - 1500);
  const maxLevels = Math.max(1, Math.floor(maxSafeHeightMm / (slotConfig.heightMm || 400)));

  const [editingRackId, setEditingRackId] = useState(null);
  const [rackCode, setRackCode] = useState('');
  const [color, setColor] = useState(activeColor);
  const [bayCount, setBayCount] = useState(3);       // 1 - 10 bay slot
  const [depthSlots, setDepthSlots] = useState(1);   // 1 - 3 slot kedalaman
  const [levelCount, setLevelCount] = useState(activeLevelCount || 3);   // 1 - 8 level
  const [heightCm, setHeightCm] = useState((activeLevelCount || 3) * slotH_cm); // total rack height cm

  useEffect(() => {
    if (isOpen) {
      if (selectedRacks && selectedRacks.length > 0) {
        const first = selectedRacks[0];
        setEditingRackId(first.id);
        setRackCode(first.rack_code || '');
        if (first.color_hex) setColor(first.color_hex);
        if (first.level_count) {
          setLevelCount(first.level_count);
          setHeightCm(first.level_count * slotH_cm);
        }
        if (first.bay_count) setBayCount(first.bay_count);
      } else {
        setEditingRackId(null);
        const nextNum = existingRacks.length + 1;
        const autoCode = `R-${String(nextNum).padStart(2, '0')}`;
        setRackCode(autoCode);
        if (activeColor) setColor(activeColor);
        if (activeLevelCount) {
          setLevelCount(activeLevelCount);
          setHeightCm(activeLevelCount * slotH_cm);
        }
      }
    }
  }, [isOpen, selectedRacks, existingRacks, activeColor, activeLevelCount, slotH_cm]);

  const handleSelectExistingRack = (r) => {
    setEditingRackId(r.id);
    setRackCode(r.rack_code || '');
    if (r.color_hex) setColor(r.color_hex);
    if (r.level_count) {
      setLevelCount(r.level_count);
      setHeightCm(r.level_count * slotH_cm);
    }
    if (r.bay_count) setBayCount(r.bay_count);
    if (onSelectRack) onSelectRack(r.id);
  };

  const handleCodeInputChange = (newVal) => {
    const formatted = newVal.toUpperCase();
    setRackCode(formatted);
    if (onRackCodeChange) {
      onRackCodeChange(formatted);
    }
  };

  const handleSelectColor = (newColor) => {
    setColor(newColor);
    if (onColorChange) onColorChange(newColor);
  };

  const handleLevelChange = (newLvl) => {
    const val = Math.max(1, Math.min(maxLevels, newLvl));
    setLevelCount(val);
    setHeightCm(val * slotH_cm);
    if (onLevelCountChange) onLevelCountChange(val);
  };

  if (!isOpen) return null;

  // Actual physical dimensions
  const isVertical = Boolean(slotRotated);
  const totalLengthCm = isVertical ? (bayCount * slotD_cm) : (bayCount * slotW_cm);
  const totalDepthCm = isVertical ? (depthSlots * slotW_cm) : (depthSlots * slotD_cm);

  // Handlers: "Simpan" = Menyimpan objek yang diedit (bukan tambah baru)
  const handleSaveClick = (e) => {
    if (e) e.preventDefault();
    if (!editingRackId) return;
    const finalCode = (rackCode || '').trim().toUpperCase();

    const rackPayload = {
      rack_code: finalCode,
      length_mm: totalLengthCm * 10,
      depth_mm: totalDepthCm * 10,
      height_mm: Math.max(heightCm * 10, 1000),
      rotation: isVertical ? 90 : 0,
      bay_count: bayCount,
      slot_width_mm: isVertical ? slotD_cm * 10 : slotW_cm * 10,
      slot_depth_mm: isVertical ? slotW_cm * 10 : slotD_cm * 10,
      slot_rotated: isVertical,
      level_count: levelCount,
      color_hex: color,
    };

    if (onSaveRack) {
      onSaveRack(rackPayload, editingRackId);
    }
  };

  // Handler: Tambah rak baru
  const handleAddClick = (e) => {
    if (e) e.preventDefault();
    const finalCode = (rackCode || `R-${existingRacks.length + 1}`).trim().toUpperCase();
    const rackPayload = {
      rack_code: finalCode,
      length_mm: totalLengthCm * 10,
      depth_mm: totalDepthCm * 10,
      height_mm: Math.max(heightCm * 10, 1000),
      rotation: isVertical ? 90 : 0,
      bay_count: bayCount,
      slot_width_mm: isVertical ? slotD_cm * 10 : slotW_cm * 10,
      slot_depth_mm: isVertical ? slotW_cm * 10 : slotD_cm * 10,
      slot_rotated: isVertical,
      level_count: levelCount,
      color_hex: color,
    };
    if (onAddRack) {
      onAddRack(rackPayload);
    }
  };

  return (
    <div
      className="layout-drawer-panel add-rack-drawer"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '440px',
        maxWidth: '100%',
        backgroundColor: '#ffffff',
        boxShadow: '-6px 0 24px rgba(0, 0, 0, 0.14)',
        borderLeft: '1px solid #e2e8f0',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Tata Rak */}
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
          <span style={{ fontSize: '1.4rem' }}>🏢</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#191d17' }}>
              Tata Rak
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#737b6c' }}>
              Edit properti rak terpilih, tingkat, dan pewarnaan
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-modal-close"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#64748b',
          }}
          title="Tutup Panel"
        >
          ✕
        </button>
      </div>

      {/* Body Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem',
        }}
      >
        {/* Active Selection Banner */}
        {editingRackId ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534' }}>
                ✏️ Mengedit Rak: {rackCode || editingRackId}
              </span>
              <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 1 }}>
                Sesuaikan properti di bawah lalu klik tombol "Simpan"
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingRackId(null);
                const nextNum = existingRacks.length + 1;
                setRackCode(`R-${String(nextNum).padStart(2, '0')}`);
              }}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                borderRadius: '5px',
                border: '1px solid #86efac',
                backgroundColor: '#ffffff',
                color: '#166534',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Batal Pilih
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
            <span style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
              Pilih rak di kanvas atau dari <strong>Daftar Rak Terpasang</strong> di bawah untuk mengedit propertinya.
            </span>
          </div>
        )}

        {/* Toggle Mode Drag & Fill Slot Rak */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: isFillSlotMode ? '#f0fdf4' : '#f8fafc',
            border: isFillSlotMode ? '2px solid #5c732b' : '1px solid #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isFillSlotMode ? '#3e5510' : '#334155' }}>
              🖊️ Mode Drag &amp; Fill Rak: {isFillSlotMode ? 'AKTIF' : 'NONAKTIF'}
            </span>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
              Klik &amp; seret mouse di kanvas untuk menggambar rak baru
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleFillSlotMode && onToggleFillSlotMode(!isFillSlotMode)}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              backgroundColor: isFillSlotMode ? '#5c732b' : '#ffffff',
              color: isFillSlotMode ? '#ffffff' : '#334155',
              border: isFillSlotMode ? 'none' : '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
          >
            {isFillSlotMode ? '✓ Aktif' : 'Aktifkan'}
          </button>
        </div>
        {/* Live SVG Rack Preview with Dynamic Color */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#334155',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Preview: {bayCount} Bay × {levelCount} Tingkat ({slotRotated ? 'Orientasi 90°' : 'Standar'})
          </div>

          <svg
            width="340"
            height="130"
            viewBox="0 0 340 130"
            style={{ overflow: 'visible', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.06))' }}
          >
            {/* Base platform */}
            <rect x="20" y="112" width="300" height="6" rx="3" fill="#cbd5e1" />

            {/* Uprights */}
            {Array.from({ length: bayCount + 1 }).map((_, i) => {
              const xPos = 30 + (i * (280 / bayCount));
              return (
                <g key={`upright-${i}`}>
                  <rect x={xPos - 3} y="16" width="6" height="96" rx="1" fill={color} />
                  <rect x={xPos - 6} y="112" width="12" height="4" rx="1" fill="#191d17" />
                </g>
              );
            })}

            {/* Shelf Beams & Bins */}
            {Array.from({ length: levelCount }).map((_, lvl) => {
              const yPos = 110 - (lvl * (88 / Math.max(1, levelCount - 1 || 1)));
              return (
                <g key={`beam-${lvl}`}>
                  <rect x="28" y={yPos - 2} width="284" height="4" rx="1" fill={color} opacity="0.9" />
                  {Array.from({ length: bayCount }).map((_, b) => {
                    const bx = 30 + (b * (280 / bayCount));
                    const bw = 280 / bayCount;
                    return (
                      <rect
                        key={`cell-${lvl}-${b}`}
                        x={bx + 3}
                        y={yPos - 12}
                        width={bw - 6}
                        height="10"
                        rx="2"
                        fill={`${color}28`}
                        stroke={color}
                        strokeWidth="1"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Dimension Badge overlay */}
            <rect x="85" y="2" width="170" height="18" rx="9" fill="#191d17" opacity="0.88" />
            <text x="170" y="14" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
              {totalLengthCm} cm × {totalDepthCm} cm × {heightCm} cm
            </text>
          </svg>
        </div>

        {/* Section: Fill Color (Warna Isi Rak & Slot) */}
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🎨</span> Fill Color (Warna Isi Rak & Slot)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="color"
                value={color}
                onChange={(e) => handleSelectColor(e.target.value)}
                style={{
                  width: '28px',
                  height: '28px',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  padding: 0,
                  backgroundColor: 'transparent',
                }}
                title="Pilih warna bebas (RGB / Hex Picker)"
              />
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#334155',
                  textTransform: 'uppercase',
                  backgroundColor: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0',
                }}
              >
                {color}
              </span>
            </div>
          </div>

          {/* Color Presets Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {COLOR_PRESETS.map((p) => {
              const isSelected = color.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => handleSelectColor(p.hex)}
                  title={p.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: isSelected ? `2px solid ${p.hex}` : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? `${p.hex}18` : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? p.hex : '#475569',
                    boxShadow: isSelected ? `0 0 0 1px ${p.hex}` : 'none',
                  }}
                >
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: p.hex,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tombol Terapkan Warna ke Rak Terpilih */}
          {selectedRacks && selectedRacks.length > 0 && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 600 }}>
                🎯 <strong>{selectedRacks.length} Rak Terpilih</strong> di kanvas
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onApplyColorToSelected) onApplyColorToSelected(color);
                  else if (onColorChange) onColorChange(color);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '5px',
                  border: `1.5px solid ${color}`,
                  backgroundColor: color,
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                ✓ Terapkan Warna Ini
              </button>
            </div>
          )}

          {/* Toggle Mode Drag & Fill Slot */}
          <div
            style={{
              marginTop: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              backgroundColor: isFillSlotMode ? '#f0fdf4' : '#ffffff',
              border: isFillSlotMode ? '1.5px solid #86efac' : '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: isFillSlotMode ? '#15803d' : '#334155' }}>
                🖌️ Mode Drag & Fill Slot: {isFillSlotMode ? 'AKTIF' : 'NONAKTIF'}
              </span>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                Seret mouse di kanvas untuk mengisi slot dengan warna ini
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleFillSlotMode}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                border: isFillSlotMode ? '1px solid #16a34a' : '1px solid #cbd5e1',
                backgroundColor: isFillSlotMode ? '#16a34a' : '#f8fafc',
                color: isFillSlotMode ? '#ffffff' : '#334155',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isFillSlotMode ? 'Matikan' : 'Aktifkan'}
            </button>
          </div>
        </div>

        {/* Input: Kode Rak */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 5 }}>
            Kode Rak
          </label>
          <input
            type="text"
            value={rackCode}
            onChange={(e) => handleCodeInputChange(e.target.value)}
            placeholder="Misal: A-01, R-02"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              boxSizing: 'border-box',
              outline: 'none',
              textTransform: 'uppercase',
            }}
          />
        </div>

        {/* Counter: Jumlah Slot Panjang (Bay) */}
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
              Jumlah Bay / Slot Panjang
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: color }}>
              {totalLengthCm} cm ({(totalLengthCm / 100).toFixed(2)} m)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setBayCount((prev) => Math.max(1, prev - 1))}
              disabled={bayCount <= 1}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
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
              {bayCount} Slot <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>(@{slotW_cm}cm)</span>
            </div>
            <button
              type="button"
              onClick={() => setBayCount((prev) => Math.min(10, prev + 1))}
              disabled={bayCount >= 10}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '1.1rem',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Counter: Kedalaman Rak */}
        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              Kedalaman Rak
            </label>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: color }}>
              {totalDepthCm} cm
            </span>
          </div>
          <select
            value={depthSlots}
            onChange={(e) => setDepthSlots(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              fontSize: '0.84rem',
              backgroundColor: '#ffffff',
            }}
          >
            <option value={1}>1 Slot ({slotD_cm} cm)</option>
            <option value={2}>2 Slot ({slotD_cm * 2} cm)</option>
            <option value={3}>3 Slot ({slotD_cm * 3} cm)</option>
          </select>
        </div>

        {/* Counter: Jumlah Tingkat (Level) - Stepper & Pill Options */}
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
              Jumlah Tingkat (Level)
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: color }}>
              {levelCount} Tingkat ({heightCm} cm total)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleLevelChange(levelCount - 1)}
              disabled={levelCount <= 1}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
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
              {levelCount} Tingkat <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>(@{slotH_cm}cm)</span>
            </div>
            <button
              type="button"
              onClick={() => handleLevelChange(levelCount + 1)}
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
                key={`lvl-pill-${lvl}`}
                type="button"
                onClick={() => handleLevelChange(lvl)}
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

          {/* Safety Clearance Banner */}
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              borderRadius: 6,
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              fontSize: '0.74rem',
              color: '#92400e',
              lineHeight: 1.35,
            }}
          >
            <span style={{ fontSize: '0.88rem' }}>⚠️</span>
            <div>
              <strong>Batas Aman Atap Gudang:</strong> Maksimal <strong>{maxLevels} Tingkat</strong> ({(maxSafeHeightMm / 1000).toFixed(1)}m).
              <div style={{ color: '#b45309', marginTop: 2, fontSize: '0.7rem' }}>
                Wajib menyisakan clearance bebas minimal 1.5m dari plafon gudang ({(warehouseHeightMm / 1000).toFixed(1)}m).
              </div>
            </div>
          </div>
        </div>

        {/* Input: Tinggi Rak */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 5 }}>
            Tinggi Rak (cm)
          </label>
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(Math.max(50, Math.min(1000, Number(e.target.value) || 200)))}
            step="10"
            min="50"
            max="1000"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Daftar Rak Terpasang */}
        <div style={{ marginTop: '0.8rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
              Daftar Rak Terpasang ({existingRacks.length})
            </span>
            {onAddRack && (
              <button
                type="button"
                onClick={handleAddClick}
                style={{
                  padding: '4px 9px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '5px',
                  border: '1px solid #5c732b',
                  backgroundColor: '#f4f6ef',
                  color: '#3e5510',
                  cursor: 'pointer',
                }}
                title="Letakkan rak baru di kanvas"
              >
                + Buat Rak Baru
              </button>
            )}
          </div>

          {existingRacks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.8rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
              Belum ada rak di denah. Gambar menggunakan Drag &amp; Fill atau klik "+ Buat Rak Baru".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '220px', overflowY: 'auto' }}>
              {existingRacks.map((r) => {
                const isSelected = editingRackId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectExistingRack(r)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #5c732b' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          backgroundColor: r.color_hex || '#5c732b',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#191d17' }}>
                          {r.rack_code || `Rak #${r.id}`}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {r.level_count || 3} Tingkat • {r.bay_count || 1} Bay • {Math.round((Number(r.height_mm) || 2000) / 100)} cm
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: isSelected ? '#dcfce7' : '#f1f5f9',
                          color: isSelected ? '#15803d' : '#475569',
                        }}
                      >
                        {isSelected ? 'Dipilih' : 'Pilih'}
                      </span>
                      {onDeleteRack && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRack(r.id);
                            if (editingRackId === r.id) setEditingRackId(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '2px 4px',
                          }}
                          title="Hapus Rak"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drawer Footer Actions */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fafaf9',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 16px',
            fontSize: '0.82rem',
            fontWeight: 600,
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          Tutup
        </button>
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={!editingRackId}
          style={{
            padding: '8px 20px',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: !editingRackId ? '#94a3b8' : '#5c732b',
            color: '#ffffff',
            cursor: !editingRackId ? 'not-allowed' : 'pointer',
            boxShadow: !editingRackId ? 'none' : '0 2px 6px rgba(92, 115, 43, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title={editingRackId ? 'Simpan perubahan properti rak yang diedit' : 'Pilih salah satu rak terlebih dahulu untuk menyimpan perubahan'}
        >
          💾 Simpan
        </button>
      </div>
    </div>
  );
}
