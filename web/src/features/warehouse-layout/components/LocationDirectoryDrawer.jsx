/**
 * Location Directory Drawer Component
 * High-performance Keyset Pagination Directory & Rack Management Drawer
 * Features:
 * - Dual-Tab Architecture:
 *   1. 🏢 Direktori & Manajemen Tiap Rak (Kode/Nama, Warna Presets, Dimensi, Bay & Level, Aksi Spasial)
 *   2. 📍 Direktori Lokasi / Kompartemen (Keyset Cursor Pagination O(log N) skala 100.000 lokasi)
 * - Real-time Overview Statistics Banner
 * - Search with 250ms Debounce and AbortController request cancellation
 * - Status Filter Chips (All, Active, Blocked, Maintenance, Retired)
 * - Row Inspection & Spasial Navigation
 * - Standard SUSUNO Industrial Forest & Clean Ergonomic Design
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

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

function getAuthToken() {
  return localStorage.getItem('susuno_auth_token') || localStorage.getItem('susuno_token') || 'demo_token';
}

export function getStatusBadge(status) {
  switch (status) {
    case 'ACTIVE':
      return { label: '🟢 Aktif', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
    case 'BLOCKED':
      return { label: '🔴 Terblokir', color: '#dc2626', bg: '#fdecec', border: '#fecaca' };
    case 'MAINTENANCE':
      return { label: '🟠 Servis', color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
    case 'RETIRED':
      return { label: '⚫ Retired', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' };
    default:
      return { label: status || 'UNKNOWN', color: '#475569', bg: '#f8fafc', border: '#cbd5e1' };
  }
}

export function formatBarcodeBadge(code) {
  return `║▌║ ${code} ║▌║`;
}

export default function LocationDirectoryDrawer({
  isOpen,
  warehouseId,
  racks = [],
  slotConfig = { lengthMm: 1000, depthMm: 500, heightMm: 400 },
  slotRotated = false,
  onClose,
  onInspectLocation,
  onFocusLocation,
  onSelectRack,
  onFocusRack,
  onSaveRack,
  onDeleteRack,
  onOpenLocationGenerator,
}) {
  // Navigation Tabs: 'racks' (Direktori & Pengaturan Rak) | 'locations' (Direktori Lokasi)
  const [activeTab, setActiveTab] = useState('racks');

  // Search & Filter State untuk Rak
  const [rackSearchTerm, setRackSearchTerm] = useState('');
  const [editingRackId, setEditingRackId] = useState(null);
  const [editForm, setEditForm] = useState({
    rackCode: '',
    color: '#5c732b',
    bayCount: 3,
    levelCount: 3,
  });
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);

  // Search & Filter State untuk Lokasi
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRackId, setSelectedRackId] = useState('');
  const [includeRetired, setIncludeRetired] = useState(false);

  // Data & Pagination State untuk Lokasi
  const [locations, setLocations] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Overview Statistics State
  const [overview, setOverview] = useState(null);

  // AbortController Ref for cancelling in-flight searches
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // 1. Fetch Overview Statistics
  const loadOverview = useCallback(async () => {
    if (!warehouseId) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/warehouses/${warehouseId}/locations/overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setOverview(json.data);
      }
    } catch {
      // Abaikan error background overview
    }
  }, [warehouseId]);

  // 2. Fetch Locations (First Page / Reset)
  const fetchLocations = useCallback(async (query, status, rackId, retired) => {
    if (!warehouseId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const params = new URLSearchParams({
        limit: '50',
        with_total: 'true'
      });
      if (query && query.trim()) params.append('search', query.trim());
      if (status) params.append('manual_status', status);
      if (rackId) params.append('rack_id', rackId);
      if (retired) params.append('include_retired', 'true');

      const res = await fetch(
        `${API_BASE_URL}/warehouse-layout/warehouses/${warehouseId}/locations?${params.toString()}`,
        {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal memuat direktori lokasi.');
      }

      setLocations(json.data.locations || []);
      setNextCursor(json.data.next_cursor || null);
      setHasMore(Boolean(json.data.has_more));
      setTotalCount(json.data.total_count ?? 0);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  // 3. Load More Locations using Keyset Cursor
  const loadMoreLocations = async () => {
    if (!nextCursor || loadingMore || !warehouseId) return;

    setLoadingMore(true);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams({
        limit: '50',
        cursor: nextCursor
      });
      if (searchTerm && searchTerm.trim()) params.append('search', searchTerm.trim());
      if (statusFilter) params.append('manual_status', statusFilter);
      if (selectedRackId) params.append('rack_id', selectedRackId);
      if (includeRetired) params.append('include_retired', 'true');

      const res = await fetch(
        `${API_BASE_URL}/warehouse-layout/warehouses/${warehouseId}/locations?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Gagal memuat halaman berikutnya.');
      }

      setLocations((prev) => [...prev, ...(json.data.locations || [])]);
      setNextCursor(json.data.next_cursor || null);
      setHasMore(Boolean(json.data.has_more));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Trigger search with 250ms debounce
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchLocations(searchTerm, statusFilter, selectedRackId, includeRetired);
    }, 250);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isOpen, searchTerm, statusFilter, selectedRackId, includeRetired, fetchLocations]);

  // Load overview saat drawer dibuka
  useEffect(() => {
    if (isOpen) {
      loadOverview();
    }
  }, [isOpen, loadOverview]);

  // Filter Racks berdasarkan kata kunci
  const filteredRacks = useMemo(() => {
    if (!racks || !Array.isArray(racks)) return [];
    if (!rackSearchTerm.trim()) return racks;
    const term = rackSearchTerm.trim().toLowerCase();
    return racks.filter((r) => {
      const code = String(r.rack_code || r.code || '').toLowerCase();
      const id = String(r.id || '').toLowerCase();
      return code.includes(term) || id.includes(term);
    });
  }, [racks, rackSearchTerm]);

  // Rack Inline Edit Handlers
  const handleStartEditRack = (rack) => {
    setEditingRackId(rack.id);
    setEditForm({
      rackCode: rack.rack_code || rack.code || '',
      color: rack.color_hex || '#5c732b',
      bayCount: Number(rack.bay_count) || 3,
      levelCount: Number(rack.level_count) || 3,
    });
  };

  const handleCancelEditRack = () => {
    setEditingRackId(null);
  };

  const handleSaveEditRack = async (rack) => {
    if (!onSaveRack) return;
    const finalCode = (editForm.rackCode || '').trim().toUpperCase();
    if (!finalCode) {
      alert('Kode rak wajib diisi!');
      return;
    }

    const cellW = slotConfig?.lengthMm || 1000;
    const cellD = slotConfig?.depthMm || 500;
    const cellH = slotConfig?.heightMm || 400;

    const isVert = Boolean(rack.slot_rotated || rack.rotation === 90 || rack.rotation === 270);
    const newLen = isVert ? editForm.bayCount * cellD : editForm.bayCount * cellW;
    const newDep = isVert ? 1 * cellW : 1 * cellD;
    const newH = Math.max(1000, editForm.levelCount * cellH);

    const updatedPayload = {
      rack_code: finalCode,
      color_hex: editForm.color,
      bay_count: Number(editForm.bayCount),
      level_count: Number(editForm.levelCount),
      length_mm: newLen,
      depth_mm: newDep,
      height_mm: newH,
    };

    try {
      await onSaveRack(updatedPayload, rack.id);
      setEditingRackId(null);
      setActionSuccessMessage(`✓ Rak ${finalCode} berhasil disimpan & diselaraskan!`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
    } catch {
      alert('Gagal menyimpan perubahan rak.');
    }
  };

  const handleDeleteRackConfirm = (rack) => {
    const code = rack.rack_code || rack.code || rack.id;
    if (window.confirm(`Hapus Rak "${code}" dari denah gudang?`)) {
      if (onDeleteRack) {
        onDeleteRack(rack.id);
        setActionSuccessMessage(`✓ Rak "${code}" berhasil dihapus.`);
        setTimeout(() => setActionSuccessMessage(null), 3000);
      }
    }
  };

  const handleFocusRackItem = (rack) => {
    if (onFocusRack) onFocusRack(rack);
    if (onSelectRack) onSelectRack(rack.id);
  };

  if (!isOpen) return null;

  return (
    <div
      className="layout-drawer-panel location-directory-drawer"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '520px',
        maxWidth: '100%',
        backgroundColor: '#ffffff',
        boxShadow: '-6px 0 24px rgba(0, 0, 0, 0.12)',
        borderLeft: '1px solid #e2e8f0',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header Panel Sleek (Industrial Forest Theme) */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid #e2e8e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #fbfcf9 0%, #f4f6f0 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#eef3e6',
                border: '1px solid #d4dec6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                color: '#3e5510',
                boxShadow: '0 2px 5px rgba(62, 85, 16, 0.08)',
              }}
            >
              📋
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.12rem',
                  fontWeight: 800,
                  color: '#191d17',
                  letterSpacing: '-0.02em',
                }}
              >
                Direktori Gudang & Rak
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#737b6c', marginTop: '2px', fontWeight: 500 }}>
                Pusat Kendali Pengaturan Tiap Rak & Navigasi Lokasi Spasial
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Tutup Panel Direktori"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #dce2d6',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '1rem',
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#1e293b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            ✕
          </button>
        </div>

        {/* 2. Success Alert Notification Banner */}
        {actionSuccessMessage && (
          <div
            style={{
              padding: '0.65rem 1.4rem',
              background: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span>✨</span>
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* 3. Segmented Navigation Tabs (Dual-Mode: Rak vs Lokasi) */}
        <div
          style={{
            padding: '0.65rem 1.4rem',
            background: '#ffffff',
            borderBottom: '1px solid #e9ece4',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: '#f1f4eb',
              padding: '3px',
              borderRadius: '8px',
              width: '100%',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('racks')}
              style={{
                padding: '7px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: activeTab === 'racks' ? 700 : 600,
                cursor: 'pointer',
                background: activeTab === 'racks' ? '#3e5510' : 'transparent',
                color: activeTab === 'racks' ? '#ffffff' : '#525c48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                transition: 'all 0.18s ease',
                boxShadow: activeTab === 'racks' ? '0 2px 6px rgba(62, 85, 16, 0.25)' : 'none',
              }}
            >
              <span>🏢</span>
              <span>Daftar & Atur Rak</span>
              <span
                style={{
                  background: activeTab === 'racks' ? 'rgba(255,255,255,0.25)' : '#e2e8d8',
                  color: activeTab === 'racks' ? '#ffffff' : '#3e5510',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {racks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('locations')}
              style={{
                padding: '7px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: activeTab === 'locations' ? 700 : 600,
                cursor: 'pointer',
                background: activeTab === 'locations' ? '#3e5510' : 'transparent',
                color: activeTab === 'locations' ? '#ffffff' : '#525c48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                transition: 'all 0.18s ease',
                boxShadow: activeTab === 'locations' ? '0 2px 6px rgba(62, 85, 16, 0.25)' : 'none',
              }}
            >
              <span>📍</span>
              <span>Direktori Lokasi</span>
              <span
                style={{
                  background: activeTab === 'locations' ? 'rgba(255,255,255,0.25)' : '#e2e8d8',
                  color: activeTab === 'locations' ? '#ffffff' : '#3e5510',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {totalCount > 0 ? totalCount.toLocaleString('id-ID') : locations.length}
              </span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: DAFTAR & PENGATURAN TIAP RAK
            ========================================================================= */}
        {activeTab === 'racks' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Search Box & Quick Stats Bar */}
            <div
              style={{
                padding: '0.85rem 1.4rem',
                background: '#fafaf9',
                borderBottom: '1px solid #e9ece4',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              {/* Search Rack Input */}
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#8c9584',
                    fontSize: '0.9rem',
                  }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Cari kode rak (misal: R-01, A-01, dsb)..."
                  value={rackSearchTerm}
                  onChange={(e) => setRackSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 2rem 0.55rem 2.4rem',
                    borderRadius: '8px',
                    border: '1px solid #d4dec6',
                    fontSize: '0.84rem',
                    background: '#ffffff',
                    color: '#191d17',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#5c732b')}
                  onBlur={(e) => (e.target.style.borderColor = '#d4dec6')}
                />
                {rackSearchTerm && (
                  <button
                    onClick={() => setRackSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Rack Summary Metric Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.74rem',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#191d17' }}>{racks.length}</span> Total Rak
                </div>
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.74rem',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#3e5510' }}>
                    {racks.reduce((s, r) => s + (Number(r.bay_count) || 1), 0)}
                  </span>{' '}
                  Total Bay
                </div>
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.74rem',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#16a34a' }}>
                    {racks.reduce((s, r) => s + (Number(r.bay_count) || 1) * (Number(r.level_count) || 1), 0)}
                  </span>{' '}
                  Kapasitas Kompartemen
                </div>
              </div>
            </div>

            {/* List Kartu Tiap Rak (Scrollable) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1.4rem' }}>
              {filteredRacks.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3rem 1.5rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                    marginTop: '1rem',
                  }}
                >
                  <div style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>🏢</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>
                    {rackSearchTerm ? 'Tidak ada rak yang cocok' : 'Belum ada rak di denah gudang'}
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#64748b', lineHeight: 1.5 }}>
                    {rackSearchTerm
                      ? 'Coba gunakan kata kunci pencarian kode rak lain.'
                      : 'Tambahkan rak baru melalui toolbar Layout -> Kelola Rak -> Tambah Rak.'}
                  </div>
                </div>
              )}

              {filteredRacks.map((rack) => {
                const isEditing = editingRackId === rack.id;
                const rackCodeStr = rack.rack_code || rack.code || `Rak #${rack.id}`;
                const rackColor = rack.color_hex || '#5c732b';
                const isVert = Boolean(rack.slot_rotated || rack.rotation === 90 || rack.rotation === 270);
                const bayCount = Number(rack.bay_count) || 3;
                const levelCount = Number(rack.level_count) || 3;
                const lenM = ((Number(rack.length_mm) || 2000) / 1000).toFixed(1);
                const depM = ((Number(rack.depth_mm) || 1000) / 1000).toFixed(1);
                const heiM = ((Number(rack.height_mm) || 4000) / 1000).toFixed(1);

                return (
                  <div
                    key={rack.id}
                    style={{
                      borderRadius: '12px',
                      border: isEditing ? '1.5px solid #5c732b' : '1px solid #e2e8f0',
                      background: '#ffffff',
                      marginBottom: '0.85rem',
                      overflow: 'hidden',
                      boxShadow: isEditing
                        ? '0 4px 14px rgba(92, 115, 43, 0.14)'
                        : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.2s ease',
                      borderLeft: `5px solid ${rackColor}`,
                    }}
                  >
                    {/* Header Kartu Rak */}
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: isEditing ? '#f8faf5' : '#ffffff',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        {/* Barcode Badge Item */}
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            color: '#191d17',
                            background: '#f8f9f5',
                            border: '1px solid #d0d7c7',
                            padding: '2px 8px',
                            borderRadius: '5px',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {formatBarcodeBadge(rackCodeStr)}
                        </span>

                        {/* Color Swatch Dot */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#f8fafc',
                            padding: '2px 7px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.72rem',
                            color: '#475569',
                          }}
                        >
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: rackColor,
                              border: '1px solid rgba(0,0,0,0.15)',
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>{rackColor}</span>
                        </div>

                        {/* Orientation Tag */}
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isVert ? '#ede9fe' : '#fef3c7',
                            color: isVert ? '#5b21b6' : '#78350f',
                            border: isVert ? '1px solid #ddd6fe' : '1px solid #fde68a',
                          }}
                        >
                          {isVert ? 'V • Vertikal (90°)' : 'H • Horizontal (0°)'}
                        </span>
                      </div>

                      {/* Tombol Toggle Edit */}
                      <button
                        onClick={() => (isEditing ? handleCancelEditRack() : handleStartEditRack(rack))}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: isEditing ? '1px solid #cbd5e1' : '1px solid #d4dec6',
                          background: isEditing ? '#ffffff' : '#f4f6f0',
                          color: isEditing ? '#64748b' : '#3e5510',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isEditing ? '✕ Batal' : '✏️ Atur Rak'}
                      </button>
                    </div>

                    {/* Mode Normal: Info Grid & Action Bar */}
                    {!isEditing && (
                      <div style={{ padding: '0.75rem 1rem' }}>
                        {/* Metrics Pills Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '0.5rem',
                            marginBottom: '0.75rem',
                            fontSize: '0.74rem',
                          }}
                        >
                          <div
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ color: '#64748b', fontSize: '0.68rem' }}>Dimensi Fisik</div>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>
                              {lenM}m × {depM}m × {heiM}m
                            </div>
                          </div>
                          <div
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ color: '#64748b', fontSize: '0.68rem' }}>Struktur Bay & Lvl</div>
                            <div style={{ fontWeight: 700, color: '#3e5510' }}>
                              {bayCount} Bay × {levelCount} Level
                            </div>
                          </div>
                          <div
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ color: '#64748b', fontSize: '0.68rem' }}>Kapasitas Kompartemen</div>
                            <div style={{ fontWeight: 700, color: '#16a34a' }}>
                              {bayCount * levelCount} Posisi
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.4rem',
                            flexWrap: 'wrap',
                            paddingTop: '0.5rem',
                            borderTop: '1px solid #f1f5f9',
                          }}
                        >
                          <button
                            onClick={() => handleFocusRackItem(rack)}
                            title="Fokuskan kamera denah pada rak ini"
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid #5c732b',
                              background: '#f0fdf4',
                              color: '#3e5510',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            🎯 Sorot di Denah
                          </button>

                          <button
                            onClick={() => onOpenLocationGenerator && onOpenLocationGenerator(rack)}
                            title="Generate barcode & kode lokasi otomatis untuk semua kompartemen rak ini"
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            🏷️ Gen Lokasi
                          </button>

                          <button
                            onClick={() => handleDeleteRackConfirm(rack)}
                            title="Hapus rak ini dari denah gudang"
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid #fecaca',
                              background: '#fff5f5',
                              color: '#dc2626',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              marginLeft: 'auto',
                            }}
                          >
                            🗑️ Hapus
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Mode Inline Editing: Form Pengaturan Lengkap */}
                    {isEditing && (
                      <div
                        style={{
                          padding: '0.9rem 1rem',
                          background: '#fafbf9',
                          borderTop: '1px solid #e9ece4',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                        }}
                      >
                        {/* 1. Input Nama / Kode Rak */}
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#191d17',
                              marginBottom: '4px',
                            }}
                          >
                            Kode / Nama Rak:
                          </label>
                          <input
                            type="text"
                            value={editForm.rackCode}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, rackCode: e.target.value.toUpperCase() }))
                            }
                            placeholder="Contoh: A-01, FAST-01, dsb."
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.85rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        {/* 2. Pilihan Warna Rak (Color Presets & Picker) */}
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#191d17',
                              marginBottom: '6px',
                            }}
                          >
                            Warna Rak (Indikator Zona / Kategori):
                          </label>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {COLOR_PRESETS.map((p) => {
                              const isSelected = editForm.color === p.hex;
                              return (
                                <button
                                  key={p.hex}
                                  type="button"
                                  onClick={() => setEditForm((prev) => ({ ...prev, color: p.hex }))}
                                  title={p.name}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: p.hex,
                                    border: isSelected ? '2px solid #191d17' : '1px solid rgba(0,0,0,0.2)',
                                    cursor: 'pointer',
                                    outline: isSelected ? '2px solid #5c732b' : 'none',
                                    outlineOffset: '1px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                  }}
                                >
                                  {isSelected ? '✓' : ''}
                                </button>
                              );
                            })}

                            {/* Custom Hex Color Picker Input */}
                            <input
                              type="color"
                              value={editForm.color}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, color: e.target.value }))}
                              title="Pilih warna custom"
                              style={{
                                width: '28px',
                                height: '26px',
                                padding: '1px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                background: '#ffffff',
                              }}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                              {editForm.color}
                            </span>
                          </div>
                        </div>

                        {/* 3. Pengaturan Jumlah Bay & Level */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: '#191d17',
                                marginBottom: '4px',
                              }}
                            >
                              Jumlah Bay (Kolom):
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((prev) => ({ ...prev, bayCount: Math.max(1, prev.bayCount - 1) }))
                                }
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={15}
                                value={editForm.bayCount}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    bayCount: Math.max(1, Math.min(15, Number(e.target.value) || 1)),
                                  }))
                                }
                                style={{
                                  width: '45px',
                                  textAlign: 'center',
                                  padding: '4px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  fontWeight: 700,
                                  fontSize: '0.84rem',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((prev) => ({ ...prev, bayCount: Math.min(15, prev.bayCount + 1) }))
                                }
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: '#191d17',
                                marginBottom: '4px',
                              }}
                            >
                              Jumlah Level (Tingkat):
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((prev) => ({ ...prev, levelCount: Math.max(1, prev.levelCount - 1) }))
                                }
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={8}
                                value={editForm.levelCount}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    levelCount: Math.max(1, Math.min(8, Number(e.target.value) || 1)),
                                  }))
                                }
                                style={{
                                  width: '45px',
                                  textAlign: 'center',
                                  padding: '4px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  fontWeight: 700,
                                  fontSize: '0.84rem',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditForm((prev) => ({ ...prev, levelCount: Math.min(8, prev.levelCount + 1) }))
                                }
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 4. Action Buttons Save / Cancel */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.5rem',
                            justifyContent: 'flex-end',
                            marginTop: '4px',
                            paddingTop: '6px',
                            borderTop: '1px solid #e9ece4',
                          }}
                        >
                          <button
                            type="button"
                            onClick={handleCancelEditRack}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#64748b',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditRack(rack)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#3e5510',
                              color: '#ffffff',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 2px 5px rgba(62, 85, 16, 0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            💾 Simpan Perubahan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: DIREKTORI LOKASI (100.000+ LOKASI DENGAN KEYSET CURSOR)
            ========================================================================= */}
        {activeTab === 'locations' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Overview Statistics Banner */}
            {overview && (
              <div
                style={{
                  padding: '0.75rem 1.4rem',
                  background: '#f8f9f5',
                  borderBottom: '1px solid #e9ece4',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.5rem',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    padding: '0.45rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Total Lokasi</div>
                  <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#191d17', marginTop: '2px' }}>
                    {overview.total_locations.toLocaleString('id-ID')}
                  </div>
                </div>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '0.45rem',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 600 }}>Aktif</div>
                  <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#16a34a', marginTop: '2px' }}>
                    {overview.active_locations.toLocaleString('id-ID')}
                  </div>
                </div>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '0.45rem',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 600 }}>Terblokir</div>
                  <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#dc2626', marginTop: '2px' }}>
                    {overview.blocked_locations.toLocaleString('id-ID')}
                  </div>
                </div>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '0.45rem',
                    borderRadius: '8px',
                    border: '1px solid #fde68a',
                  }}
                >
                  <div style={{ fontSize: '0.65rem', color: '#d97706', fontWeight: 600 }}>Servis</div>
                  <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#d97706', marginTop: '2px' }}>
                    {overview.maintenance_locations.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            )}

            {/* Search & Filter Controls */}
            <div style={{ padding: '0.85rem 1.4rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
              {/* Search Box */}
              <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#8c9584',
                    fontSize: '0.9rem',
                  }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Cari kode lokasi kompartemen (misal: A-01-RACK-001)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 2rem 0.55rem 2.4rem',
                    borderRadius: '8px',
                    border: '1px solid #d4dec6',
                    fontSize: '0.84rem',
                    background: '#ffffff',
                    color: '#191d17',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Chips & Rack Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {[
                    { id: '', label: 'Semua' },
                    { id: 'ACTIVE', label: '🟢 Aktif' },
                    { id: 'BLOCKED', label: '🔴 Blokir' },
                    { id: 'MAINTENANCE', label: '🟠 Servis' },
                    { id: 'RETIRED', label: '⚫ Retired' },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setStatusFilter(chip.id)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '12px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        border: statusFilter === chip.id ? '1px solid #5c732b' : '1px solid #e2e8f0',
                        background: statusFilter === chip.id ? '#f0fdf4' : '#ffffff',
                        color: statusFilter === chip.id ? '#3e5510' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Rack Filter Dropdown */}
                {racks.length > 0 && (
                  <select
                    value={selectedRackId}
                    onChange={(e) => setSelectedRackId(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.74rem',
                      color: '#334155',
                      marginLeft: 'auto',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                  >
                    <option value="">Semua Rak ({racks.length})</option>
                    {racks.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.rack_code || r.code || r.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Results Counter Header */}
            <div
              style={{
                padding: '0.45rem 1.4rem',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '0.75rem',
                color: '#64748b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                Menampilkan <strong>{locations.length}</strong>{' '}
                {totalCount > 0 ? `dari ${totalCount.toLocaleString('id-ID')}` : ''} lokasi
              </span>
              {loading && <span style={{ color: '#5c732b', fontWeight: 700 }}>Mencari lokasi...</span>}
            </div>

            {/* Table Content List Lokasi */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem 1.4rem' }}>
              {error && (
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#fdecec',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#b91c1c',
                    fontSize: '0.8rem',
                    margin: '0.5rem 0',
                  }}
                >
                  <strong>Error:</strong> {error}
                </div>
              )}

              {!loading && locations.length === 0 && !error && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3rem 1.5rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                    marginTop: '1rem',
                  }}
                >
                  <div style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>🔍</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>
                    Tidak ada lokasi yang cocok
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#64748b' }}>
                    Coba ubah kata kunci pencarian atau sesuaikan filter status / rak.
                  </div>
                </div>
              )}

              {locations.map((loc) => {
                const badge = getStatusBadge(loc.manual_status);
                return (
                  <div
                    key={loc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.7rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      marginBottom: '0.5rem',
                      gap: '0.75rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#5c732b')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '3px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: '#191d17',
                          }}
                        >
                          {loc.location_code}
                        </span>
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            color: badge.color,
                            background: badge.bg,
                            border: `1px solid ${badge.border}`,
                            borderRadius: '10px',
                            padding: '1px 6px',
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Rak: <strong style={{ color: '#191d17' }}>{loc.rack_code}</strong> | Bay #{loc.bay_number} |
                        Lvl #{loc.level_number} | Pos #{loc.position_number}
                        {loc.aisle_code ? ` | Lorong ${loc.aisle_code}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        onClick={() => onInspectLocation && onInspectLocation(loc.id)}
                        title="Inspeksi Detail Lokasi"
                        style={{
                          padding: '5px 9px',
                          borderRadius: '5px',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        👁️ Detail
                      </button>
                      <button
                        onClick={() => onFocusLocation && onFocusLocation(loc)}
                        title="Sorot Posisi Rak di Denah"
                        style={{
                          padding: '5px 9px',
                          borderRadius: '5px',
                          border: '1px solid #5c732b',
                          background: '#f0fdf4',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#3e5510',
                          cursor: 'pointer',
                        }}
                      >
                        🎯 Sorot
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Keyset Cursor Load More Button */}
              {hasMore && (
                <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                  <button
                    onClick={loadMoreLocations}
                    disabled={loadingMore}
                    style={{
                      padding: '0.55rem 1.25rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      width: '100%',
                      background: '#f8f9f5',
                      border: '1px dashed #5c732b',
                      borderRadius: '8px',
                      color: '#3e5510',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {loadingMore ? 'Memuat 50 lokasi berikutnya...' : '⬇️ Muat 50 Lokasi Berikutnya'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Drawer Footer */}
        <div
          style={{
            padding: '0.75rem 1.4rem',
            borderTop: '1px solid #e2e8e0',
            background: '#fafaf9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
            <span>SUSUNO Directory Engine (O(log N) Keyset Cursor)</span>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.4rem 0.95rem',
              fontSize: '0.76rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Tutup
          </button>
        </div>
      </div>
  );
}
