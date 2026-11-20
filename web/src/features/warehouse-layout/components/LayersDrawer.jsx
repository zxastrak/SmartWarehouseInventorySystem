/**
 * LayersDrawer Component
 * Panel Layer Denah Gudang ala CAD / Figma
 * Menampilkan daftar semua elemen rak dan aset (Pintu, Dok, Jalan Lorong, dsb.) yang telah ditambahkan ke denah.
 * Mendukung pencarian, filter kategori, seleksi & fokus kamera kanvas, toggle visibilitas (mata), dan hapus item.
 */

import React, { useState, useMemo } from 'react';

export default function LayersDrawer({
  isOpen,
  onClose,
  snapshot,
  selectedKeys = new Set(),
  onSelectEntity,
  onFocusEntity,
  onDeleteEntity,
  onDeleteSelectedEntity,
  hiddenLayers = new Set(),
  onToggleLayerVisibility,
  hiddenEntityIds = new Set(),
  onToggleEntityVisibility,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'rack' | 'door' | 'dock' | 'aisle'

  // Kumpulkan semua elemen dari snapshot
  const rawRacks = snapshot?.racks || [];
  const rawLayoutObjects = snapshot?.layout_objects || [];
  const rawAisles = snapshot?.aisles || [];

  // Kategorisasi layout_objects
  const rawDoors = useMemo(() => {
    return rawLayoutObjects.filter((o) => {
      const t = String(o.object_type || '').toLowerCase();
      return t.includes('door') || t.includes('entry') || t.includes('exit');
    });
  }, [rawLayoutObjects]);

  const rawDocks = useMemo(() => {
    return rawLayoutObjects.filter((o) => {
      const t = String(o.object_type || '').toLowerCase();
      return t.includes('dock');
    });
  }, [rawLayoutObjects]);

  const totalCount = rawRacks.length + rawDoors.length + rawDocks.length + rawAisles.length;

  // Format semua item menjadi unified layer items
  const allLayerItems = useMemo(() => {
    const items = [];

    // 1. Rak
    rawRacks.forEach((r) => {
      const rot = Number(r.rotation) || 0;
      const isRot = rot === 90 || rot === 270;
      const rawLen = Number(r.length_mm) || 2400;
      const rawDep = Number(r.depth_mm) || 1000;
      const rw = isRot ? rawDep : rawLen;
      const rl = isRot ? rawLen : rawDep;
      const isVert = Boolean(r.slot_rotated || isRot || (rl > rw));
      items.push({
        id: r.id || r.client_ref,
        entityType: 'rack',
        category: 'rack',
        name: r.code || r.rack_code || `Rak #${r.id || r.client_ref}`,
        subType: `${r.levels || r.level_count || 1} Tingkat`,
        orientation: isVert ? 'vertical' : 'horizontal',
        orientationLabel: isVert ? 'V' : 'H',
        color: r.color_hex || '#5c732b',
        widthM: (Number(r.length_mm) || 2000) / 1000,
        depthM: (Number(r.depth_mm) || 1000) / 1000,
        heightM: (Number(r.height_mm) || 5000) / 1000,
        levels: r.levels || r.level_count || 1,
        xM: (Number(r.x_mm) || 0) / 1000,
        yM: (Number(r.y_mm) || 0) / 1000,
        raw: r,
      });
    });

    // 2. Pintu
    rawDoors.forEach((d) => {
      const t = String(d.object_type || '').toLowerCase();
      const isBoth = t.includes('both') || t === 'door';
      const isExit = t.includes('exit') || t.includes('keluar');
      const label = isBoth
        ? 'Pintu Masuk & Keluar'
        : isExit
        ? 'Pintu Keluar'
        : 'Pintu Masuk';

      items.push({
        id: d.id || d.client_ref,
        entityType: 'layout_object',
        category: 'door',
        name: d.name || label,
        subType: label,
        color: isBoth ? '#2563eb' : isExit ? '#dc2626' : '#16a34a',
        widthM: (Math.max(Number(d.width_mm) || 3000, Number(d.length_mm) || 600)) / 1000,
        depthM: (Math.min(Number(d.width_mm) || 3000, Number(d.length_mm) || 600)) / 1000,
        heightM: (Number(d.height_mm) || 2500) / 1000,
        xM: (Number(d.x_mm) || 0) / 1000,
        yM: (Number(d.y_mm) || 0) / 1000,
        raw: d,
      });
    });

    // 3. Dok
    rawDocks.forEach((dk) => {
      items.push({
        id: dk.id || dk.client_ref,
        entityType: 'layout_object',
        category: 'dock',
        name: dk.name || 'Dok Bongkar Muat',
        subType: 'Area Parkir Truk',
        color: '#2563eb',
        widthM: (Number(dk.width_mm) || 4000) / 1000,
        depthM: (Number(dk.length_mm) || 6000) / 1000,
        heightM: 0,
        xM: (Number(dk.x_mm) || 0) / 1000,
        yM: (Number(dk.y_mm) || 0) / 1000,
        raw: dk,
      });
    });

    // 4. Jalan Lorong
    rawAisles.forEach((a) => {
      const isForklift = String(a.type || a.aisle_type || '').toLowerCase().includes('forklift');
      const isHoriz = (Number(a.width_mm) || 2000) >= (Number(a.length_mm) || 5000);
      items.push({
        id: a.id || a.client_ref,
        entityType: 'aisle',
        category: 'aisle',
        name: a.name || a.aisle_code || (isForklift ? 'Jalan Forklift' : 'Jalan Lorong'),
        subType: isForklift ? 'Jalur Forklift (Lebar)' : 'Lorong Standar',
        orientation: isHoriz ? 'horizontal' : 'vertical',
        orientationLabel: isHoriz ? 'H' : 'V',
        color: isForklift ? '#d97706' : '#854d0e',
        widthM: (Number(a.width_mm) || 2000) / 1000,
        depthM: (Number(a.length_mm) || 5000) / 1000,
        heightM: 0,
        xM: (Number(a.x_mm) || 0) / 1000,
        yM: (Number(a.y_mm) || 0) / 1000,
        raw: a,
      });
    });

    return items;
  }, [rawRacks, rawDoors, rawDocks, rawAisles]);

  // Filter berdasarkan tab dan input search
  const filteredItems = useMemo(() => {
    return allLayerItems.filter((item) => {
      if (activeTab !== 'all' && item.category !== activeTab) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.subType.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allLayerItems, activeTab, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      className="layout-drawer-panel"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '410px',
        maxWidth: '100%',
        backgroundColor: '#ffffff',
        boxShadow: '-6px 0 24px rgba(0, 0, 0, 0.15)',
        borderLeft: '1px solid #dfe4d9',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fafbfc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>📑</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#191d17' }}>
                Layer Denah Gudang
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#3e5510',
                  backgroundColor: '#f1f4eb',
                  border: '1px solid #d0d7c7',
                  padding: '1px 7px',
                  borderRadius: 12,
                }}
              >
                {totalCount} Item
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
              Daftar rak dan aset fisik yang telah terpasang
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#64748b',
            padding: '4px 8px',
            borderRadius: '6px',
          }}
          title="Tutup Panel Layer"
        >
          ✕
        </button>
      </div>

      {/* 2. Search & Category Filter */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <span style={{ position: 'absolute', left: 9, top: 7, fontSize: '0.85rem', color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari rak, pintu, dok, jalan..."
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              fontSize: '0.8rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: 8,
                top: 7,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '0.78rem',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={{
              padding: '4px 8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              borderRadius: 5,
              border: '1px solid',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeTab === 'all' ? '#3e5510' : '#f8fafc',
              borderColor: activeTab === 'all' ? '#3e5510' : '#cbd5e1',
              color: activeTab === 'all' ? '#ffffff' : '#475569',
            }}
          >
            Semua ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rack')}
            style={{
              padding: '4px 8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              borderRadius: 5,
              border: '1px solid',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeTab === 'rack' ? '#5c732b' : '#f8fafc',
              borderColor: activeTab === 'rack' ? '#5c732b' : '#cbd5e1',
              color: activeTab === 'rack' ? '#ffffff' : '#475569',
            }}
          >
            🏢 Rak ({rawRacks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('door')}
            style={{
              padding: '4px 8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              borderRadius: 5,
              border: '1px solid',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeTab === 'door' ? '#059669' : '#f8fafc',
              borderColor: activeTab === 'door' ? '#059669' : '#cbd5e1',
              color: activeTab === 'door' ? '#ffffff' : '#475569',
            }}
          >
            🚪 Pintu ({rawDoors.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dock')}
            style={{
              padding: '4px 8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              borderRadius: 5,
              border: '1px solid',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeTab === 'dock' ? '#2563eb' : '#f8fafc',
              borderColor: activeTab === 'dock' ? '#2563eb' : '#cbd5e1',
              color: activeTab === 'dock' ? '#ffffff' : '#475569',
            }}
          >
            🚚 Dok ({rawDocks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('aisle')}
            style={{
              padding: '4px 8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              borderRadius: 5,
              border: '1px solid',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeTab === 'aisle' ? '#d97706' : '#f8fafc',
              borderColor: activeTab === 'aisle' ? '#d97706' : '#cbd5e1',
              color: activeTab === 'aisle' ? '#ffffff' : '#475569',
            }}
          >
            🛣️ Jalan ({rawAisles.length})
          </button>
        </div>
      </div>

      {/* 2b. Selected Layers Bulk Action Bar */}
      {selectedKeys && selectedKeys.size > 0 && onDeleteSelectedEntity && (
        <div
          style={{
            padding: '8px 14px',
            backgroundColor: '#fef2f2',
            borderBottom: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 600 }}>
            ✓ {selectedKeys.size} layer terpilih
          </span>
          <button
            type="button"
            onClick={onDeleteSelectedEntity}
            style={{
              padding: '4px 10px',
              fontSize: '0.76rem',
              fontWeight: 700,
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Hapus semua layer yang sedang terpilih"
          >
            <span>🗑️</span> Hapus Layer Terpilih
          </button>
        </div>
      )}

      {/* 3. Layer Item List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filteredItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              color: '#64748b',
              fontSize: '0.82rem',
              backgroundColor: '#f8fafc',
              borderRadius: 8,
              border: '1px dashed #cbd5e1',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 600, color: '#334155' }}>
              {searchTerm ? 'Tidak ada elemen yang cocok dengan pencarian' : 'Belum ada elemen pada kategori ini'}
            </div>
            <div style={{ fontSize: '0.75rem', marginTop: 4, color: '#94a3b8' }}>
              Tambahkan rak lewat menu "Kelola Rak" atau pintu/dok/jalan lewat menu "Kelola Aset".
            </div>
          </div>
        ) : (
          filteredItems.map((item) => {
            const keyStr = `${item.entityType}:${item.id}`;
            const isSelected = selectedKeys instanceof Set ? selectedKeys.has(keyStr) : false;
            const isHidden =
              (hiddenLayers && hiddenLayers.has(item.category)) ||
              (hiddenEntityIds && hiddenEntityIds.has(item.id));

            return (
              <div
                key={`${item.entityType}-${item.id}`}
                onClick={() => {
                  if (onSelectEntity) onSelectEntity(item.entityType, item.id, item.raw);
                  if (onFocusEntity) onFocusEntity(item.entityType, item.raw);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 7,
                  border: isSelected ? '1.5px solid #5c732b' : '1px solid #e2e8f0',
                  backgroundColor: isSelected ? '#f0fdf4' : isHidden ? '#f8fafc' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  opacity: isHidden ? 0.55 : 1,
                  boxShadow: isSelected ? '0 2px 6px rgba(92, 115, 43, 0.12)' : 'none',
                }}
                title="Klik untuk memilih & memusatkan kamera kanvas pada elemen ini"
              >
                {/* Visibility Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleEntityVisibility) onToggleEntityVisibility(item.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    padding: '2px 4px',
                    color: isHidden ? '#94a3b8' : '#1e293b',
                    borderRadius: 4,
                  }}
                  title={isHidden ? 'Tampilkan pada kanvas' : 'Sembunyikan dari kanvas'}
                >
                  {isHidden ? '👁️‍🗨️' : '👁️'}
                </button>

                {/* Category Icon / Badge */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: `${item.color}18`,
                    border: `1.5px solid ${item.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.05rem',
                    flexShrink: 0,
                  }}
                >
                  {item.category === 'rack'
                    ? '🏢'
                    : item.category === 'door'
                    ? '🚪'
                    : item.category === 'dock'
                    ? '🚚'
                    : '🛣️'}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '0.83rem',
                        fontWeight: 700,
                        color: isSelected ? '#166534' : '#191d17',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </span>
                    {item.orientationLabel && (
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          backgroundColor: item.orientation === 'horizontal' ? '#fef3c7' : '#ede9fe',
                          color: item.orientation === 'horizontal' ? '#78350f' : '#5b21b6',
                          border: item.orientation === 'horizontal' ? '1px solid #fde68a' : '1px solid #ddd6fe',
                          padding: '1px 5px',
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        {item.orientationLabel}
                      </span>
                    )}
                    {isSelected && (
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          backgroundColor: '#5c732b',
                          color: '#ffffff',
                          padding: '1px 5px',
                          borderRadius: 4,
                        }}
                      >
                        Terpilih
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.71rem', color: '#64748b', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    <span style={{ fontWeight: 600, color: item.color }}>{item.subType}</span>
                    <span>•</span>
                    <span>
                      {item.widthM.toFixed(1)}m × {item.depthM.toFixed(1)}m
                      {item.heightM > 0 ? ` × ${item.heightM.toFixed(1)}m` : ''}
                    </span>
                    <span>•</span>
                    <span>(X:{item.xM.toFixed(1)}m, Y:{item.yM.toFixed(1)}m)</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={(e) => e.stopPropagation()}>
                  {/* Focus on Canvas Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectEntity) onSelectEntity(item.entityType, item.id, item.raw);
                      if (onFocusEntity) onFocusEntity(item.entityType, item.raw);
                    }}
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                    title="Pusatkan Kamera Kanvas (Fokus)"
                  >
                    🎯
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeleteEntity) {
                        const targetId = item.id || item.raw?.id || item.raw?.client_ref;
                        onDeleteEntity(item.entityType, targetId);
                      }
                    }}
                    style={{
                      padding: '3px 6px',
                      fontSize: '0.78rem',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fecaca',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: '#dc2626',
                    }}
                    title={`Hapus ${item.name}`}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Footer Summary */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#fafbfc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.74rem',
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <span>🏢 {rawRacks.length} Rak</span>
          <span>🚪 {rawDoors.length} Pintu</span>
          <span>🚚 {rawDocks.length} Dok</span>
          <span>🛣️ {rawAisles.length} Jalan</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '4px 10px',
            fontSize: '0.76rem',
            fontWeight: 600,
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 5,
            cursor: 'pointer',
            color: '#334155',
          }}
        >
          Selesai
        </button>
      </div>
    </div>
  );
}
