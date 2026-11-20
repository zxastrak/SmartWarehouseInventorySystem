/**
 * EditorToolbar for Warehouse Layout & Storage Mapping
 * 
 * Implements the 3-Tier Hierarchy requested by user:
 * 1. Top Header: Warehouse Title, Dimensions, 2D/3D toggle, Zoom, Undo/Redo & Save.
 * 2. Tabs Strip (Blue Line - "agak dibawah namun diatas hijau"): Home, Layout, and Direktori.
 * 3. Command Shelf (Green Line): Move tool, Grid Meter, Slot Modular, Matriks, Atur Slot,
 *    Tata Rak, Tata Aset, Layer (with RED-X Direktori button removed).
 * 
 * Styled in SUSUNO Modern Industrial Forest Design System (#3e5510 Deep Forest, #5c732b Olive Primary, #f8f9f5 Canvas).
 * Preserves 100% of existing features, handlers, props, hotkeys, and modals.
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
  // Tabs: ONLY 'home' | 'layout' | 'direktori' (default to 'layout')
  const [activeTab, setActiveTab] = useState('layout');
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const toolMenuRef = useRef(null);
  const [localName, setLocalName] = useState(warehouseName);
  const [localWidthM, setLocalWidthM] = useState(warehouseWidthM);
  const [localLengthM, setLocalLengthM] = useState(warehouseLengthM);
  const [localHeightM, setLocalHeightM] = useState(warehouseHeightM);
  const isEditingNameRef = useRef(false);

  // Close pointer tool popup on outside click
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

  // Hotkey handlers (Ctrl+Z, Ctrl+Y, Ctrl+S, Delete, R, V, H)
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
      {/* =========================================================================
          TIER 1: TOP HEADER BAR
          Main Warehouse, Dimension Badge, 2D/3D Mode, Zoom Controls, Undo/Redo & Save
          ========================================================================= */}
      <div className="ribbon-top-header">
        {/* Left: Identity & Dimension Badge */}
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
                fontSize: '0.74rem',
                padding: '2px 8px',
                borderRadius: '5px',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                fontWeight: 700,
              }}
            >
              {warehouseWidthM}m × {warehouseLengthM}m × {warehouseHeightM}m
            </span>
          </div>
        </div>

        {/* Right: 2D/3D, Zoom Controls, Undo/Redo, Unsaved Status & Save */}
        <div className="ribbon-quick-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* View Mode Toggle: 2D vs 3D */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#eaeedf',
              borderRadius: 6,
              padding: 2,
              border: '1px solid #d0d7c7',
            }}
            title="Pilih Mode Tampilan Denah 2D atau 3D"
          >
            <button
              type="button"
              onClick={() => onViewModeChange && onViewModeChange('2d')}
              style={{
                padding: '3px 8px',
                fontSize: '0.74rem',
                fontWeight: viewMode === '2d' ? 700 : 500,
                color: viewMode === '2d' ? '#3e5510' : '#525c48',
                backgroundColor: viewMode === '2d' ? '#ffffff' : 'transparent',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                boxShadow: viewMode === '2d' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.12s ease',
              }}
              title="Tampilan Denah 2D (Editor Top-View)"
            >
              🗺️ 2D
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange && onViewModeChange('3d')}
              style={{
                padding: '3px 8px',
                fontSize: '0.74rem',
                fontWeight: viewMode === '3d' ? 700 : 500,
                color: viewMode === '3d' ? '#3e5510' : '#525c48',
                backgroundColor: viewMode === '3d' ? '#ffffff' : 'transparent',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                boxShadow: viewMode === '3d' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.12s ease',
              }}
              title="Tampilan Isometrik 3D"
            >
              🧊 3D
            </button>
          </div>

          <div style={{ width: 1, height: 18, backgroundColor: '#d0d7c7', margin: '0 3px' }} />

          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button
              type="button"
              className="btn-layout-control"
              onClick={onZoomOut}
              style={{
                padding: '2px 7px',
                height: '26px',
                fontSize: '0.82rem',
                minWidth: '24px',
                borderRadius: 4,
                border: '1px solid #d0d7c7',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
              title="Perkecil Zoom Kanvas"
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
              style={{
                padding: '2px 7px',
                height: '26px',
                fontSize: '0.82rem',
                minWidth: '24px',
                borderRadius: 4,
                border: '1px solid #d0d7c7',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
              title="Perbesar Zoom Kanvas"
            >
              +
            </button>
            <button
              type="button"
              onClick={onFitScreen}
              style={{
                padding: '2px 9px',
                height: '26px',
                fontSize: '0.75rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                backgroundColor: '#5c732b',
                color: '#ffffff',
                border: '1px solid #485d1e',
                borderRadius: 4,
                cursor: 'pointer',
              }}
              title="Sesuaikan Denah ke Layar Penuh (Fit to Screen)"
            >
              Fit Screen
            </button>
          </div>

          <div style={{ width: 1, height: 18, backgroundColor: '#d0d7c7', margin: '0 3px' }} />

          {/* Undo / Redo */}
          <button
            type="button"
            className="btn-toolbar"
            onClick={onUndo}
            disabled={!canUndo}
            style={{
              padding: '2px 8px',
              height: '26px',
              fontSize: '0.76rem',
              borderRadius: 4,
              border: '1px solid #d0d7c7',
              backgroundColor: '#ffffff',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              opacity: canUndo ? 1 : 0.45,
            }}
            title="Batalkan Aksi Terakhir (Ctrl+Z)"
          >
            <span>↶</span> Undo
          </button>
          <button
            type="button"
            className="btn-toolbar"
            onClick={onRedo}
            disabled={!canRedo}
            style={{
              padding: '2px 8px',
              height: '26px',
              fontSize: '0.76rem',
              borderRadius: 4,
              border: '1px solid #d0d7c7',
              backgroundColor: '#ffffff',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              opacity: canRedo ? 1 : 0.45,
            }}
            title="Ulangi Aksi (Ctrl+Y)"
          >
            <span>↷</span> Redo
          </button>

          {isDirty && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#92400e',
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
            onClick={onSave}
            disabled={isSaving}
            style={{
              padding: '3px 12px',
              height: '28px',
              fontSize: '0.78rem',
              fontWeight: 700,
              backgroundColor: isDirty ? '#fef3c7' : '#5c732b',
              color: isDirty ? '#92400e' : '#ffffff',
              border: isDirty ? '1px solid #f59e0b' : '1px solid #485d1e',
              borderRadius: 4,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}
            title="Simpan Tata Letak Gudang (Ctrl+S)"
          >
            {isSaving ? 'Menyimpan...' : '💾 Simpan'}
          </button>
        </div>
      </div>

      {/* =========================================================================
          TIER 2: TABS STRIP (BLUE LINE: "agak dibawah namun diatas hijau")
          Home | Layout (Aktif) | Direktori
          ========================================================================= */}
      <div className="ribbon-tabs-strip">
        <div className="ribbon-tabs-list">
          <button
            type="button"
            className={`ribbon-tab-btn ${activeTab === 'home' ? 'ribbon-tab-active' : ''}`}
            onClick={() => {
              setActiveTab('home');
              if (isDirectoryOpen && onToggleDirectory) onToggleDirectory();
            }}
          >
            <span className="ribbon-tab-icon">🏠</span> Home
          </button>
          <button
            type="button"
            className={`ribbon-tab-btn ${activeTab === 'layout' ? 'ribbon-tab-active' : ''}`}
            onClick={() => {
              setActiveTab('layout');
              if (isDirectoryOpen && onToggleDirectory) onToggleDirectory();
            }}
          >
            <span className="ribbon-tab-icon">📐</span> Layout
          </button>
          <button
            type="button"
            className={`ribbon-tab-btn ${activeTab === 'direktori' ? 'ribbon-tab-active' : ''}`}
            onClick={() => {
              setActiveTab('direktori');
              if (onOpenDirectory) {
                onOpenDirectory();
              } else if (onToggleDirectory && !isDirectoryOpen) {
                onToggleDirectory();
              }
            }}
            title="Buka Panel Direktori Lokasi Rak"
          >
            <span className="ribbon-tab-icon">📋</span> Direktori
          </button>
        </div>

        {/* Right side helper info */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '0.72rem', color: '#737b6c', paddingBottom: 4 }}>
          <span>⌨️ Shortcut: <code style={{ backgroundColor: '#ffffff', padding: '1px 4px', borderRadius: 3, border: '1px solid #d0d7c7' }}>V</code> Pilih · <code style={{ backgroundColor: '#ffffff', padding: '1px 4px', borderRadius: 3, border: '1px solid #d0d7c7' }}>H</code> Geser Kanvas · <code style={{ backgroundColor: '#ffffff', padding: '1px 4px', borderRadius: 3, border: '1px solid #d0d7c7' }}>R</code> Rotasi · <code style={{ backgroundColor: '#ffffff', padding: '1px 4px', borderRadius: 3, border: '1px solid #d0d7c7' }}>Del</code> Hapus</span>
        </div>
      </div>

      {/* =========================================================================
          TIER 3: COMMAND SHELF (GREEN LINE)
          Peralatan Layout: Move, Grid, Slot, Matriks, Atur Slot, Tata Rak, Tata Aset, Layer.
          Move Tool Tersedia Permanen di SETIAP Tab (Home, Layout, Direktori).
          ========================================================================= */}
      <div className="ribbon-command-bar">
        {/* 1. Universal Pointer Tool Switcher (Move V / Hand H) - Ada di SETIAP tab */}
        <div style={{ position: 'relative', flexShrink: 0 }} ref={toolMenuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setToolMenuOpen((prev) => !prev);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={`Alat Aktif: ${activeTool === 'select' ? 'Move (V) - Pindahkan Objek/Rak' : 'Hand tool (H) - Geser Kanvas'} - Klik untuk membuka pilihan`}
            style={{
              height: 28,
              padding: '0 8px',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 5,
              border: '1px solid #d0d7c7',
              backgroundColor: activeTool === 'hand' ? '#f0fdf4' : (toolMenuOpen ? '#f1f4eb' : '#ffffff'),
              color: activeTool === 'hand' ? '#166534' : '#191d17',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {activeTool === 'select' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                </svg>
                <span>Move</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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

          {/* Tool Switcher Popover */}
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
                borderRadius: 6,
                border: '1px solid #dfe4d9',
                boxShadow: '0 8px 24px rgba(25, 29, 23, 0.12)',
                padding: '4px',
                minWidth: 215,
              }}
            >
              <div
                onClick={() => {
                  if (onSelectTool) onSelectTool('select');
                  setToolMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  backgroundColor: activeTool === 'select' ? '#eef3e2' : 'transparent',
                  color: activeTool === 'select' ? '#3e5510' : '#191d17',
                  fontSize: '0.78rem',
                  fontWeight: activeTool === 'select' ? 700 : 500,
                }}
              >
                <span style={{ width: 14 }}>{activeTool === 'select' && '✓'}</span>
                <span>Move (Pilih & Geser Objek)</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', color: '#737b6c' }}>V</span>
              </div>
              <div
                onClick={() => {
                  if (onSelectTool) onSelectTool('hand');
                  setToolMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  backgroundColor: activeTool === 'hand' ? '#eef3e2' : 'transparent',
                  color: activeTool === 'hand' ? '#3e5510' : '#191d17',
                  fontSize: '0.78rem',
                  fontWeight: activeTool === 'hand' ? 700 : 500,
                }}
              >
                <span style={{ width: 14 }}>{activeTool === 'hand' && '✓'}</span>
                <span>Hand tool (Geser Kanvas)</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', color: '#737b6c' }}>H</span>
              </div>
            </div>
          )}
        </div>

        <div className="ribbon-divider" style={{ flexShrink: 0 }} />

        {/* ======================= TAB: LAYOUT & DIREKTORI ======================= */}
        {(activeTab === 'layout' || activeTab === 'direktori') && (
          <div className="ribbon-panel-tab">

            {/* 2. Grid Meteran (1m) & Matriks (50cm) Group */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 10px',
                height: 28,
                borderRadius: 5,
                backgroundColor: '#ffffff',
                border: '1px solid #d0d7c7',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>
                📐 Grid:
              </span>

              {/* Meter Grid 1m */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: showMeterGrid ? '#166534' : '#737b6c',
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

              <div style={{ width: 1, height: 16, backgroundColor: '#d0d7c7' }} />

              {/* Matriks 50cm */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: (showGridMatrix ?? showGrid) ? '#166534' : '#737b6c',
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
                Matriks (50cm)
              </label>
            </div>

            <div className="ribbon-divider" />

            {/* 3. Slot Modular Group: Horizontal, Vertikal & Atur Slot */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 10px',
                height: 28,
                borderRadius: 5,
                backgroundColor: '#ffffff',
                border: '1px solid #d0d7c7',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: (showSlotHorizontal || showSlotVertical || showSlotGrid) ? '#6d28d9' : '#737b6c',
                }}
                title="Grid Kotak Slot Modular Rak"
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
                  color: showSlotHorizontal ? '#6d28d9' : '#737b6c',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                title={`Slot Horizontal (${slotConfig?.lengthMm ? slotConfig.lengthMm / 10 : 100} × ${slotConfig?.depthMm ? slotConfig.depthMm / 10 : 50} cm)`}
              >
                <input
                  type="checkbox"
                  checked={!!showSlotHorizontal}
                  onChange={() => {
                    if (onSelectSlotOrientation) onSelectSlotOrientation('horizontal');
                    else if (onToggleSlotHorizontal) onToggleSlotHorizontal();
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
                  color: showSlotVertical ? '#6d28d9' : '#737b6c',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                title={`Slot Vertikal (${slotConfig?.depthMm ? slotConfig.depthMm / 10 : 50} × ${slotConfig?.lengthMm ? slotConfig.lengthMm / 10 : 100} cm)`}
              >
                <input
                  type="checkbox"
                  checked={!!showSlotVertical}
                  onChange={() => {
                    if (onSelectSlotOrientation) onSelectSlotOrientation('vertical');
                    else if (onToggleSlotVertical) onToggleSlotVertical();
                  }}
                  style={{ accentColor: '#7c3aed', cursor: 'pointer', margin: 0 }}
                />
                Vertikal
              </label>
            </div>

            {/* Atur Slot Button */}
            <button
              type="button"
              className="ribbon-btn-compact ribbon-highlight-slot"
              onClick={onOpenSlotConfig}
              title="Atur Dimensi Slot Modular, Warna, dan Tingkat Rak"
            >
              <span>⚙️</span>
              <span>
                Atur Slot{' '}
                <span style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85 }}>
                  ({slotConfig
                    ? slotRotated
                      ? `${Math.round(slotConfig.depthMm / 10)}×${Math.round(slotConfig.lengthMm / 10)}cm`
                      : `${Math.round(slotConfig.lengthMm / 10)}×${Math.round(slotConfig.depthMm / 10)}cm`
                    : '100×50cm'})
                </span>
              </span>
            </button>

            <div className="ribbon-divider" />

            {/* 4. Entity Management Buttons: Tata Rak, Tata Aset, Layer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="ribbon-btn-compact"
                onClick={onAddRack}
                title="Kelola & Tambah Rak Penyimpanan Gudang"
              >
                <span style={{ fontSize: '0.86rem' }}>🏢</span>
                <span>Tata Rak</span>
              </button>

              <button
                type="button"
                className="ribbon-btn-compact"
                onClick={onOpenAssets || onAddAisle}
                title="Tata & Atur Fasilitas Aset Gudang (Pintu Masuk, Keluar, Dok, Jalan)"
              >
                <span style={{ fontSize: '0.86rem' }}>🏛️</span>
                <span>Tata Aset</span>
              </button>

              {onOpenLayers && (
                <button
                  type="button"
                  className="ribbon-btn-compact"
                  onClick={onOpenLayers}
                  title="Buka Panel Layer: Menampilkan semua rak dan aset di kanvas"
                  style={{ color: '#3e5510' }}
                >
                  <span style={{ fontSize: '0.86rem' }}>📑</span>
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

              {/* NOTE: Redundant Direktori button is removed as marked with red X! */}
            </div>
          </div>
        )}

        {/* ======================= TAB: HOME ======================= */}
        {activeTab === 'home' && (
          <div className="ribbon-panel-tab">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#525c48', whiteSpace: 'nowrap' }}>Nama Gudang:</span>
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
                style={{ padding: '3px 8px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid #d0d7c7', width: 150 }}
                placeholder="Nama Gudang..."
              />
            </div>

            <div className="ribbon-divider" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#525c48' }}>P(X):</span>
                <input
                  type="number"
                  value={localWidthM}
                  onChange={(e) => setLocalWidthM(e.target.value)}
                  min="5" max="1000"
                  style={{ width: 50, padding: '3px 4px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid #d0d7c7' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#737b6c' }}>m</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#525c48' }}>L(Y):</span>
                <input
                  type="number"
                  value={localLengthM}
                  onChange={(e) => setLocalLengthM(e.target.value)}
                  min="5" max="1000"
                  style={{ width: 50, padding: '3px 4px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid #d0d7c7' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#737b6c' }}>m</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#525c48' }}>T(Z):</span>
                <input
                  type="number"
                  value={localHeightM}
                  onChange={(e) => setLocalHeightM(e.target.value)}
                  min="2" max="100"
                  style={{ width: 44, padding: '3px 4px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid #d0d7c7' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#737b6c' }}>m</span>
              </div>

              <button
                type="button"
                onClick={handleApplyDimensions}
                style={{
                  padding: '3px 10px',
                  height: '26px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  borderRadius: 4,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Terapkan nama dan ukuran baru ke denah kanvas"
              >
                ✓ Terapkan Dimensi
              </button>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
