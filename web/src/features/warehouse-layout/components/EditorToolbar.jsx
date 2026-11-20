/**
 * Ribbon Toolbar for Warehouse Layout & Storage Mapping
 * Microsoft Office Ribbon style with 3 tabs: Home, Rak, and Zona.
 * Includes tool groups with vertical dividers and bottom captions.
 */

import React, { useState, useEffect, useRef } from 'react';

export default function EditorToolbar({
  canUndo,
  canRedo,
  isDirty,
  isSaving,
  hasSelection,
  selectedCount,
  selectedType = 'rak',
  onUndo,
  onRedo,
  onAddRack,
  onAddAisle,
  onOpenAssets,
  onRotate,
  onDelete,
  onGenerateLocations,
  onOpenDirectory,
  showGrid,
  showMeterGrid = true,
  showGridHorizontal = true,
  onToggleGridHorizontal,
  showGridVertical = true,
  onToggleGridVertical,
  showGridMatrix,
  onToggleGridMatrix,
  showSlotGrid = false,
  showSlotHorizontal = false,
  showSlotVertical = false,
  slotRotated = false,
  onToggleSlotHorizontal,
  onToggleSlotVertical,
  onSelectSlotOrientation,
  isFillSlotMode = false,
  activeRackColor = '#5c732b',
  onColorChange,
  activeLevelCount = 3,
  onLevelCountChange,
  maxLevelCount = 8,
  isPathMode,
  onToggleGrid,
  onToggleMeterGrid,
  onToggleSlotGrid,
  onToggleSlotRotate,
  onToggleFillSlotMode,
  onTogglePathMode,
  slotConfig,
  onOpenSlotConfig,
  onSave,
  // Navigation & Zoom
  zoomPercent = 100,
  onFitScreen,
  onZoomIn,
  onZoomOut,
  onOpenNav,
  // Zone & Facilities Handlers
  onAddZone,
  onAddLayoutObject,
  showZoneLabels = true,
  onToggleZoneLabels,
  // Warehouse identity & dimensions
  warehouseName = 'Main Warehouse',
  warehouseWidthM = 50,
  warehouseLengthM = 80,
  warehouseHeightM = 8,
  onUpdateWarehouse,
  onNameChange,
  // Pointer Tool Selection (Move / Hand)
  activeTool = 'select',
  onSelectTool,
  // Layers Drawer Handler
  onOpenLayers,
  totalLayersCount = 0,
  // 2D / 3D View Mode Handler
  viewMode = '2d',
  onViewModeChange,
  // Location Directory Handler
  onToggleDirectory,
  isDirectoryOpen = false,
}) {
  const [activeTab, setActiveTab] = useState('rack'); // 'rack' | 'home' | 'directory'
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const toolMenuRef = useRef(null);
  const [localName, setLocalName] = useState(warehouseName);
  const [localWidthM, setLocalWidthM] = useState(warehouseWidthM);
  const [localLengthM, setLocalLengthM] = useState(warehouseLengthM);
  const [localHeightM, setLocalHeightM] = useState(warehouseHeightM);
  const isEditingNameRef = useRef(false);

  // Close tool popup on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolMenuRef.current && !toolMenuRef.current.contains(e.target)) {
        setToolMenuOpen(false);
      }
    };
    if (toolMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [toolMenuOpen]);

  useEffect(() => {
    if (!isEditingNameRef.current) {
      setLocalName(warehouseName);
    }
  }, [warehouseName]);

  useEffect(() => {
    setLocalWidthM(warehouseWidthM);
  }, [warehouseWidthM]);

  useEffect(() => {
    setLocalLengthM(warehouseLengthM);
  }, [warehouseLengthM]);

  useEffect(() => {
    setLocalHeightM(warehouseHeightM);
  }, [warehouseHeightM]);

  const handleApplyDimensions = (e) => {
    if (e) e.preventDefault();
    if (onUpdateWarehouse) {
      onUpdateWarehouse(localName, Number(localWidthM), Number(localLengthM), Number(localHeightM));
    }
  };

  // Hotkey handlers (Ctrl+Z, Ctrl+Y, Ctrl+S, Delete, R)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (canUndo) onUndo();
      } else if (
        cmdOrCtrl &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        if (canRedo) onRedo();
      } else if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) onSave();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hasSelection) {
          e.preventDefault();
          onDelete();
        }
      } else if (e.key.toLowerCase() === 'r' && !cmdOrCtrl) {
        if (hasSelection) {
          e.preventDefault();
          onRotate();
        }
      } else if (e.key.toLowerCase() === 'v' && !cmdOrCtrl) {
        if (onSelectTool) onSelectTool('select');
      } else if (e.key.toLowerCase() === 'h' && !cmdOrCtrl) {
        if (onSelectTool) onSelectTool('hand');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, isDirty, isSaving, hasSelection, onUndo, onRedo, onSave, onDelete, onRotate, onSelectTool]);

  return (
    <div className="layout-ribbon-container">
      {/* 1. Unified Sleek Top Strip (Identity, Tabs, Zoom, Undo/Redo & Save) */}
      <div className="ribbon-tabs-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {onOpenNav && (
            <button
              type="button"
              className="dashboard-mobile-menu"
              onClick={onOpenNav}
              style={{ marginRight: 2 }}
              title="Buka Navigasi"
            >
              ☰
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#191d17' }}>
              {warehouseName}
            </span>
            <span
              className="warehouse-dim-badge"
              title="Dimensi Gudang (Lebar × Panjang × Tinggi)"
              style={{
                fontSize: '0.72rem',
                padding: '2px 7px',
                borderRadius: '4px',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                fontWeight: 600,
              }}
            >
              {warehouseWidthM}m × {warehouseLengthM}m × {warehouseHeightM}m
            </span>
          </div>

          <div style={{ width: 1, height: 18, backgroundColor: '#cbd5e1', margin: '0 4px' }} />

          {/* Ribbon Tabs List */}
          <div className="ribbon-tabs-list">
            <button
              type="button"
              className={`ribbon-tab-btn ${activeTab === 'home' ? 'ribbon-tab-active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <span className="ribbon-tab-icon">🏠</span> Home
            </button>
            <button
              type="button"
              className={`ribbon-tab-btn ${activeTab === 'rack' ? 'ribbon-tab-active' : ''}`}
              onClick={() => setActiveTab('rack')}
            >
              <span className="ribbon-tab-icon">📐</span> Layout
            </button>
            <button
              type="button"
              className={`ribbon-tab-btn ${activeTab === 'directory' ? 'ribbon-tab-active' : ''}`}
              onClick={() => {
                setActiveTab('directory');
                if (onOpenDirectory) onOpenDirectory();
              }}
            >
              <span className="ribbon-tab-icon">📋</span> Direktori
            </button>
          </div>

          <div style={{ width: 1, height: 18, backgroundColor: '#cbd5e1', margin: '0 4px' }} />

          {/* View Mode Toggle: 2D vs 3D */}
          <div className="ribbon-view-mode-toggle" title="Pilih Mode Tampilan Denah 2D atau 3D">
            <button
              type="button"
              className={`ribbon-view-btn ${viewMode === '2d' ? 'ribbon-view-active' : ''}`}
              onClick={() => onViewModeChange && onViewModeChange('2d')}
              title="Tampilan Denah 2D (Editor & Top-View)"
            >
              <span style={{ fontSize: '0.82rem' }}>🗺️</span> 2D
            </button>
            <button
              type="button"
              className={`ribbon-view-btn ${viewMode === '3d' ? 'ribbon-view-active' : ''}`}
              onClick={() => onViewModeChange && onViewModeChange('3d')}
              title="Tampilan 3D (Rotasi Kanan-Kiri & Atas)"
            >
              <span style={{ fontSize: '0.82rem' }}>🧊</span> 3D
            </button>
          </div>
        </div>

        {/* Quick Zoom, Undo, Redo, Save & Status on Right */}
        <div className="ribbon-quick-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button
              type="button"
              className="btn-layout-control"
              onClick={onZoomOut}
              style={{ padding: '2px 7px', height: '26px', fontSize: '0.8rem', minWidth: '24px' }}
              title="Zoom Out"
            >
              -
            </button>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px',
                height: '26px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#3e5510',
                backgroundColor: '#f1f4eb',
                borderRadius: '4px',
                border: '1px solid #d0d7c7',
                padding: '0 4px',
              }}
              title="Skala Zoom Kanvas"
            >
              {zoomPercent}%
            </span>
            <button
              type="button"
              className="btn-layout-control"
              onClick={onZoomIn}
              style={{ padding: '2px 7px', height: '26px', fontSize: '0.8rem', minWidth: '24px' }}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              className="btn-layout-control btn-layout-primary"
              onClick={onFitScreen}
              style={{ padding: '2px 8px', height: '26px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}
              title="Fit to Screen"
            >
              Fit Screen
            </button>
          </div>

          <div style={{ width: 1, height: 18, backgroundColor: '#cbd5e1', margin: '0 4px' }} />

          {/* Undo / Redo */}
          <button
            type="button"
            className="btn-toolbar"
            onClick={onUndo}
            disabled={!canUndo}
            style={{ padding: '2px 8px', height: '26px', fontSize: '0.76rem' }}
            title="Batalkan Aksi Terakhir (Ctrl+Z)"
          >
            <span>↶</span> Undo
          </button>
          <button
            type="button"
            className="btn-toolbar"
            onClick={onRedo}
            disabled={!canRedo}
            style={{ padding: '2px 8px', height: '26px', fontSize: '0.76rem' }}
            title="Ulangi Aksi (Ctrl+Y)"
          >
            <span>↷</span> Redo
          </button>

          {isDirty && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#b45309',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                padding: '2px 8px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
              title="Terdapat perubahan lokal yang belum tersimpan"
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              Belum Disimpan
            </span>
          )}

          <button
            type="button"
            className={`btn-toolbar btn-save-action ${isDirty ? 'btn-save-dirty' : ''}`}
            onClick={onSave}
            disabled={isSaving}
            style={{ padding: '3px 12px', height: '28px', fontSize: '0.8rem', fontWeight: 700 }}
            title="Simpan Perubahan (Ctrl+S)"
          >
            {isSaving ? 'Menyimpan...' : '💾 Simpan'}
          </button>
        </div>
      </div>

      {/* 2. Compact Ribbon Command Bar (Height ~38-42px) */}
      <div className="ribbon-command-bar" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* 0. Figma-Style Pointer & Navigation Tool Switcher (Move V / Hand H) - PERMANENT across all tabs! */}
        <div style={{ position: 'relative' }} ref={toolMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setToolMenuOpen((prev) => !prev);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={`Alat Aktif: ${activeTool === 'select' ? 'Move (V) - Pindahkan Barang' : 'Hand tool (H) - Switch / Geser Kanvas'} - Klik untuk membuka pilihan`}
            style={{
              height: 28,
              padding: '0 8px',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 5,
              border: '1px solid #cbd5e1',
              backgroundColor: activeTool === 'hand' ? '#f0fdf4' : (toolMenuOpen ? '#f1f5f9' : '#ffffff'),
              borderColor: activeTool === 'hand' ? '#86efac' : (toolMenuOpen ? '#94a3b8' : '#cbd5e1'),
              color: activeTool === 'hand' ? '#166534' : '#191d17',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {activeTool === 'select' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                </svg>
                <span>Move</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 11V6a2 2 0 0 0-4 0v4" />
                  <path d="M14 10V4a2 2 0 0 0-4 0v7" />
                  <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
                  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </svg>
                <span>Hand tool</span>
              </>
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 1 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Susuno Theme Tool Switcher Dropdown Popover */}
          {toolMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 99999,
                backgroundColor: '#ffffff',
                borderRadius: 8,
                border: '1px solid #dfe4d9',
                boxShadow: '0 10px 25px rgba(25, 29, 23, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
                padding: '6px',
                minWidth: 225,
              }}
            >
              {/* Item 1: Move (Memindahkan Barang & Rak) */}
              <div
                onClick={() => {
                  if (onSelectTool) onSelectTool('select');
                  setToolMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  backgroundColor: activeTool === 'select' ? '#f2f6ea' : 'transparent',
                  border: activeTool === 'select' ? '1px solid #dcebd9' : '1px solid transparent',
                  color: '#191d17',
                  userSelect: 'none',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeTool !== 'select') {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTool !== 'select') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeTool === 'select' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5c732b" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTool === 'select' ? '#5c732b' : '#525c48'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                  </svg>
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: activeTool === 'select' ? 700 : 600, color: activeTool === 'select' ? '#2e5b32' : '#191d17' }}>Move</span>
                  <span style={{ fontSize: '0.68rem', color: '#737b6c' }}>Pindahkan Barang / Objek</span>
                </div>
                <span style={{
                  color: activeTool === 'select' ? '#3e5510' : '#64748b',
                  fontSize: '0.74rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  padding: '2px 6px',
                  backgroundColor: activeTool === 'select' ? '#e2ebd6' : '#f1f5f9',
                  border: activeTool === 'select' ? '1px solid #d0dfc8' : '1px solid #cbd5e1',
                  borderRadius: 4
                }}>V</span>
              </div>

              {/* Item 2: Hand tool (Switch / Geser Kanvas) */}
              <div
                onClick={() => {
                  if (onSelectTool) onSelectTool('hand');
                  setToolMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  backgroundColor: activeTool === 'hand' ? '#f2f6ea' : 'transparent',
                  border: activeTool === 'hand' ? '1px solid #dcebd9' : '1px solid transparent',
                  color: '#191d17',
                  userSelect: 'none',
                  transition: 'all 0.12s ease',
                  marginTop: 2,
                }}
                onMouseEnter={(e) => {
                  if (activeTool !== 'hand') {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTool !== 'hand') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeTool === 'hand' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5c732b" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTool === 'hand' ? '#5c732b' : '#525c48'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 11V6a2 2 0 0 0-4 0v4" />
                    <path d="M14 10V4a2 2 0 0 0-4 0v7" />
                    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                  </svg>
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: activeTool === 'hand' ? 700 : 600, color: activeTool === 'hand' ? '#2e5b32' : '#191d17' }}>Hand tool</span>
                  <span style={{ fontSize: '0.68rem', color: '#737b6c' }}>Switch / Geser Kanvas</span>
                </div>
                <span style={{
                  color: activeTool === 'hand' ? '#3e5510' : '#64748b',
                  fontSize: '0.74rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  padding: '2px 6px',
                  backgroundColor: activeTool === 'hand' ? '#e2ebd6' : '#f1f5f9',
                  border: activeTool === 'hand' ? '1px solid #d0dfc8' : '1px solid #cbd5e1',
                  borderRadius: 4
                }}>H</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 20, backgroundColor: '#cbd5e1', margin: '0 2px' }} />

        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <div className="ribbon-panel-tab" style={{ display: 'flex', alignItems: 'center', gap: 12, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Nama:</span>
              <input
                type="text"
                value={localName}
                onFocus={() => { isEditingNameRef.current = true; }}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalName(val);
                  if (onNameChange) onNameChange(val);
                }}
                onBlur={() => {
                  isEditingNameRef.current = false;
                  if (onUpdateWarehouse && localName.trim()) {
                    onUpdateWarehouse(localName.trim(), Number(localWidthM), Number(localLengthM), Number(localHeightM));
                  }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                style={{ padding: '3px 8px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid #cbd5e1', width: 140 }}
                placeholder="Nama Gudang..."
              />
            </div>

            <div style={{ width: 1, height: 18, backgroundColor: '#e2e8f0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>P(X):</span>
                <input
                  type="number"
                  value={localWidthM}
                  onChange={(e) => setLocalWidthM(e.target.value)}
                  min="5" max="1000"
                  style={{ width: 50, padding: '3px 4px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>m</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>L(Y):</span>
                <input
                  type="number"
                  value={localLengthM}
                  onChange={(e) => setLocalLengthM(e.target.value)}
                  min="5" max="1000"
                  style={{ width: 50, padding: '3px 4px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>m</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>T(Z):</span>
                <input
                  type="number"
                  value={localHeightM}
                  onChange={(e) => setLocalHeightM(e.target.value)}
                  min="2" max="100"
                  style={{ width: 44, padding: '3px 4px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>m</span>
              </div>

              <button
                type="button"
                className="btn-layout-control btn-layout-primary"
                onClick={handleApplyDimensions}
                style={{ padding: '3px 10px', height: '26px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                title="Terapkan nama dan ukuran baru ke denah kanvas"
              >
                ✓ Terapkan Dimensi
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: LAYOUT */}
        {activeTab === 'rack' && (
          <div className="ribbon-panel-tab" style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', flexWrap: 'nowrap' }}>
            {/* 1. Grid Controls Group: Centang Pilihan (Meter, Slot Horizontal, Slot Vertikal, Matriks 50cm²) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 10px',
                height: 28,
                borderRadius: 5,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                📐 Grid:
              </span>

              {/* 1. Meter */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: showMeterGrid ? '#166534' : '#64748b',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                title="Tampilkan / Sembunyikan Grid Meteran Gudang (1m × 1m)"
              >
                <input
                  type="checkbox"
                  checked={showMeterGrid}
                  onChange={onToggleMeterGrid}
                  style={{ accentColor: '#5c732b', cursor: 'pointer', margin: 0 }}
                />
                Meter (1m)
              </label>

              <div style={{ width: 1, height: 16, backgroundColor: '#e2e8f0' }} />

              {/* 2 & 3. Slot Title & Orientation Checkboxes (Dasar Perhitungan Fill & Drop) */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: (showSlotHorizontal || showSlotVertical || showSlotGrid) ? '#6d28d9' : '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title="Grid Kotak Slot Modular Rak (Dasar Perhitungan Penataan Gudang)"
                >
                  📦 Slot:
                </span>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: showSlotHorizontal ? '#6d28d9' : '#64748b',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title={`Slot Horizontal (${slotConfig?.lengthMm ? slotConfig.lengthMm / 10 : 100} × ${slotConfig?.depthMm ? slotConfig.depthMm / 10 : 50} cm)`}
                >
                  <input
                    type="checkbox"
                    checked={!!showSlotHorizontal}
                    onChange={() => {
                      if (onSelectSlotOrientation) {
                        onSelectSlotOrientation('horizontal');
                      } else if (onToggleSlotHorizontal) {
                        onToggleSlotHorizontal();
                      }
                    }}
                    style={{ accentColor: '#7c3aed', cursor: 'pointer', margin: 0 }}
                  />
                  Horizontal
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: showSlotVertical ? '#6d28d9' : '#64748b',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title={`Slot Vertikal (${slotConfig?.depthMm ? slotConfig.depthMm / 10 : 50} × ${slotConfig?.lengthMm ? slotConfig.lengthMm / 10 : 100} cm)`}
                >
                  <input
                    type="checkbox"
                    checked={!!showSlotVertical}
                    onChange={() => {
                      if (onSelectSlotOrientation) {
                        onSelectSlotOrientation('vertical');
                      } else if (onToggleSlotVertical) {
                        onToggleSlotVertical();
                      }
                    }}
                    style={{ accentColor: '#7c3aed', cursor: 'pointer', margin: 0 }}
                  />
                  Vertikal
                </label>
              </div>

              <div style={{ width: 1, height: 16, backgroundColor: '#e2e8f0' }} />

              {/* 4. Matriks (50cm²) */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: (showGridMatrix ?? showGrid) ? '#166534' : '#64748b',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                title="Tampilkan Grid Matriks Dasar Pathfinding (Kotak 50cm × 50cm)"
              >
                <input
                  type="checkbox"
                  checked={!!(showGridMatrix ?? showGrid)}
                  onChange={onToggleGridMatrix || onToggleGrid}
                  style={{ accentColor: '#5c732b', cursor: 'pointer', margin: 0 }}
                />
                Matriks
              </label>
            </div>

            {/* Atur Slot Button */}
            <button
              type="button"
              onClick={onOpenSlotConfig}
              title="Atur Dimensi Slot Modular, Warna, dan Tingkat Rak"
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 5,
                border: '1px solid #ddd6fe',
                backgroundColor: '#faf5ff',
                color: '#6d28d9',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <span>⚙️</span>
              <span>
                Atur Slot{' '}
                <span style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85 }}>
                  ({slotConfig
                    ? slotRotated
                      ? `${Math.round(slotConfig.depthMm / 10)}×${Math.round(slotConfig.lengthMm / 10)}cm`
                      : `${Math.round(slotConfig.lengthMm / 10)}×${Math.round(slotConfig.depthMm / 10)}cm`
                    : '70×50cm'})
                </span>
              </span>
            </button>
            <div style={{ width: 1, height: 18, backgroundColor: '#cbd5e1', margin: '0 4px' }} />

            {/* Entity Management Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={onAddRack}
                title="Kelola Rak: Atur Dimensi, Jumlah Tingkat, Fill Color, dan Tambah Rak Baru"
                style={{
                  height: 28,
                  padding: '0 11px',
                  borderRadius: 5,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <span style={{ fontSize: '0.9rem' }}>🏢</span>
                <span>Tata Rak</span>
              </button>

              <button
                type="button"
                onClick={onOpenAssets || onAddAisle}
                title="Tata & Atur Aset Gudang (Pintu Masuk, Pintu Keluar, Dok, dan Jalan)"
                style={{
                  height: 28,
                  padding: '0 11px',
                  borderRadius: 5,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <span style={{ fontSize: '0.9rem' }}>🏛️</span>
                <span>Tata Aset</span>
              </button>

              {onOpenLayers && (
                <button
                  type="button"
                  onClick={onOpenLayers}
                  title="Buka Panel Layer: Menampilkan semua rak dan aset yang telah ditambahkan ke kanvas"
                  style={{
                    height: 28,
                    padding: '0 9px',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#3e5510',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>📑</span>
                  <span>Layer</span>
                  {totalLayersCount > 0 && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: '#f1f4eb',
                        color: '#3e5510',
                        padding: '1px 5px',
                        borderRadius: 10,
                        border: '1px solid #d0d7c7',
                      }}
                    >
                      {totalLayersCount}
                    </span>
                  )}
                </button>
              )}

              {onToggleDirectory && (
                <button
                  type="button"
                  onClick={onToggleDirectory}
                  title="Buka / Tutup Sidebar Direktori Rak & Lokasi"
                  style={{
                    height: 28,
                    padding: '0 9px',
                    borderRadius: 5,
                    border: isDirectoryOpen ? '1px solid #5c732b' : '1px solid #cbd5e1',
                    backgroundColor: isDirectoryOpen ? '#f0fdf4' : '#ffffff',
                    color: isDirectoryOpen ? '#3e5510' : '#1e293b',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>📋</span>
                  <span>Direktori</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DIREKTORI */}
        {activeTab === 'directory' && (
          <div className="ribbon-panel-tab" style={{ display: 'flex', alignItems: 'center', gap: 10, height: '100%', flexWrap: 'nowrap' }}>
            <button
              type="button"
              onClick={onOpenDirectory || onToggleDirectory}
              style={{
                height: 28,
                padding: '0 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#5c732b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 5,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(92, 115, 43, 0.25)',
                whiteSpace: 'nowrap',
              }}
              title="Buka / Tutup Panel Direktori Lokasi Penyimpanan"
            >
              <span>📋</span>
              <span>{isDirectoryOpen ? 'Tutup Direktori' : 'Buka Direktori Lokasi'}</span>
            </button>

            {onGenerateLocations && (
              <button
                type="button"
                className="btn-layout-control"
                onClick={onGenerateLocations}
                style={{
                  height: 28,
                  padding: '0 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 5,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Buka Generator Pembuatan Kode Lokasi Massal"
              >
                <span>⚡</span>
                <span>Generate Lokasi Massal</span>
              </button>
            )}

            <div style={{ width: 1, height: 18, backgroundColor: '#cbd5e1', margin: '0 4px' }} />

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600, color: '#166534' }}>ℹ️ Direktori Lokasi:</span>
              <span>Pencarian cepat, filter status, dan inspeksi detail bin/rak/bay gudang (Keyset Pagination O(log N)).</span>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
