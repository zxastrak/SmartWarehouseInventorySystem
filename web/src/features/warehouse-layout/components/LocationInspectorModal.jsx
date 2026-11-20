/**
 * Location Inspector Modal Dialog
 * Detailed inspector for a single storage location:
 * - General Info & Coordinates
 * - Physical Usable Dimensions & Weight Capacity
 * - Inventory Status (Strict AC-20: Disconnected state without dummy data)
 * - Operational Status Control (ACTIVE, BLOCKED, MAINTENANCE, RETIRED)
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

function getAuthToken() {
  return localStorage.getItem('susuno_auth_token') || localStorage.getItem('susuno_token') || 'demo_token';
}

export default function LocationInspectorModal({
  isOpen,
  locationId,
  onClose,
  onStatusUpdated
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationData, setLocationData] = useState(null);

  // Status update form states
  const [targetStatus, setTargetStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [statusSuccess, setStatusSuccess] = useState(null);

  // Load location detail when modal opens or locationId changes
  const loadLocationDetail = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setStatusError(null);
    setStatusSuccess(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/locations/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal mengambil detail lokasi.');
      }
      setLocationData(data.data);
      setTargetStatus(data.data.manual_status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && locationId) {
      loadLocationDetail(locationId);
      setActiveTab('general');
    } else {
      setLocationData(null);
      setError(null);
      setStatusError(null);
      setStatusSuccess(null);
    }
  }, [isOpen, locationId, loadLocationDetail]);

  // Handle manual status update (AC-16 RBAC)
  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!targetStatus || !locationId) return;

    setIsUpdatingStatus(true);
    setStatusError(null);
    setStatusSuccess(null);

    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/locations/${locationId}/manual-status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          manual_status: targetStatus,
          reason: statusReason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal mengubah status lokasi.');
      }

      setStatusSuccess(`Status berhasil diubah menjadi ${data.data.manual_status}.`);
      setLocationData((prev) => ({
        ...prev,
        ...data.data
      }));

      if (onStatusUpdated) {
        onStatusUpdated(data.data);
      }
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!isOpen) return null;

  const loc = locationData;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return { label: '🟢 Aktif', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
      case 'BLOCKED':
        return { label: '🔴 Terblokir', color: '#dc2626', bg: '#fdecec', border: '#fecaca' };
      case 'MAINTENANCE':
        return { label: '🟠 Pemeliharaan', color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
      case 'RETIRED':
        return { label: '⚫ Dipensiunkan', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' };
      default:
        return { label: status, color: '#475569', bg: '#f8fafc', border: '#cbd5e1' };
    }
  };

  const statusBadge = loc ? getStatusBadge(loc.manual_status) : null;

  return (
    <div className="layout-modal-backdrop" onClick={onClose}>
      <div
        className="layout-modal-container location-inspector-modal"
        style={{ maxWidth: '640px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="layout-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.25rem' }}>🔍</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#191d17' }}>
                  Inspeksi Lokasi
                </h2>
                {statusBadge && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: statusBadge.color,
                      backgroundColor: statusBadge.bg,
                      border: `1px solid ${statusBadge.border}`,
                      borderRadius: '12px',
                      padding: '2px 8px'
                    }}
                  >
                    {statusBadge.label}
                  </span>
                )}
              </div>
              {loc && (
                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#5c732b', fontWeight: 600, marginTop: '2px' }}>
                  ║▌║ {loc.location_code} ║▌║
                </div>
              )}
            </div>
          </div>
          <button className="btn-modal-close" onClick={onClose} title="Tutup Dialog">
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="inspector-tabs-nav" style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fafaf9', padding: '0 1rem' }}>
          {[
            { id: 'general', label: 'Umum & Koordinat' },
            { id: 'physical', label: 'Fisik & Kapasitas' },
            { id: 'inventory', label: 'Inventori & Stok' },
            { id: 'status', label: 'Kontrol Status' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`inspector-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.65rem 1rem',
                border: 'none',
                background: 'transparent',
                fontWeight: activeTab === tab.id ? 600 : 500,
                color: activeTab === tab.id ? '#5c732b' : '#64748b',
                borderBottom: activeTab === tab.id ? '2px solid #5c732b' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="layout-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.25rem' }}>
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#737b6c' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 0.75rem' }} />
              Memuat data inspeksi lokasi...
            </div>
          )}

          {error && (
            <div className="alert-banner alert-danger" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: '#fdecec', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c' }}>
              <strong>Gagal Memuat:</strong> {error}
            </div>
          )}

          {!loading && !error && loc && (
            <>
              {/* TAB 1: UMUM & KOORDINAT */}
              {activeTab === 'general' && (
                <div className="inspector-section">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div className="inspector-info-card" style={{ background: '#f8f9f5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e9ece4' }}>
                      <div style={{ fontSize: '0.75rem', color: '#737b6c' }}>Gudang</div>
                      <div style={{ fontWeight: 600, color: '#191d17', fontSize: '0.9rem' }}>{loc.warehouse_name} ({loc.warehouse_code})</div>
                    </div>
                    <div className="inspector-info-card" style={{ background: '#f8f9f5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e9ece4' }}>
                      <div style={{ fontSize: '0.75rem', color: '#737b6c' }}>Zona</div>
                      <div style={{ fontWeight: 600, color: '#191d17', fontSize: '0.9rem' }}>
                        {loc.zone_name ? `${loc.zone_name} (${loc.zone_code})` : '—'}
                      </div>
                    </div>
                    <div className="inspector-info-card" style={{ background: '#f8f9f5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e9ece4' }}>
                      <div style={{ fontSize: '0.75rem', color: '#737b6c' }}>Lorong Utama (Aisle)</div>
                      <div style={{ fontWeight: 600, color: '#191d17', fontSize: '0.9rem' }}>
                        {loc.primary_aisle_code ? `Lorong ${loc.primary_aisle_code}` : 'Tidak terhubung lorong'}
                      </div>
                    </div>
                    <div className="inspector-info-card" style={{ background: '#f8f9f5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e9ece4' }}>
                      <div style={{ fontSize: '0.75rem', color: '#737b6c' }}>Kode Rak</div>
                      <div style={{ fontWeight: 600, color: '#191d17', fontSize: '0.9rem' }}>{loc.rack_code}</div>
                    </div>
                  </div>

                  <div style={{ background: '#f8f9f5', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e9ece4', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3e5510', marginBottom: '0.5rem' }}>
                      📍 Matriks Kompartemen Rak
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Kolom Bay</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>#{loc.bay_number}</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Tingkat Level</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>#{loc.level_number}</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Slot Posisi</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#5c732b' }}>#{loc.position_number}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#737b6c', lineHeight: 1.6 }}>
                    <div><strong>Versi Pola:</strong> v{loc.pattern_version}</div>
                    <div><strong>Tanggal Terbit:</strong> {new Date(loc.created_at).toLocaleString('id-ID')}</div>
                    {loc.retired_at && (
                      <div style={{ color: '#b91c1c' }}>
                        <strong>Dipensiunkan Pada:</strong> {new Date(loc.retired_at).toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: FISIK & KAPASITAS */}
              {activeTab === 'physical' && (
                <div className="inspector-section">
                  <div style={{ background: '#f8f9f5', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e9ece4', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3e5510', marginBottom: '0.5rem' }}>
                      📐 Dimensi Fisik Bersih (Usable Space)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Lebar (Width)</div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{loc.usable_width_mm} mm</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Kedalaman (Depth)</div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{loc.usable_depth_mm} mm</div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Tinggi (Clear Height)</div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{loc.usable_height_mm} mm</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#f8f9f5', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e9ece4', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3e5510', marginBottom: '0.5rem' }}>
                      ⚖️ Batas Beban & Kubikasi
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ background: '#ffffff', padding: '0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Beban Maksimal</div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f766e' }}>
                          {loc.max_weight_kg ? `${loc.max_weight_kg} kg` : 'Tidak dibatasi'}
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Kubikasi Maksimal</div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f766e' }}>
                          {loc.max_volume_m3 ? `${loc.max_volume_m3} m³` : 'Tidak dibatasi'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>Label Identifikasi Fisik</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '2px', fontWeight: 700, color: '#1e293b' }}>
                      ║▌║ {loc.location_code} ║▌║
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: INVENTORI & STOK AKTUAL */}
              {activeTab === 'inventory' && (
                <div className="inspector-section">
                  {loc.inventory?.connected ? (
                    <div>
                      {/* Status Header Banner */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: '#f8f9f5',
                          borderRadius: '8px',
                          border: '1px solid #e9ece4',
                          marginBottom: '1rem',
                          flexWrap: 'wrap',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>📦</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#191d17' }}>
                              Status Sinkronisasi Inventori
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#5c732b', fontWeight: 500 }}>
                              ● Terhubung Langsung ke Basis Data Stok
                            </div>
                          </div>
                        </div>

                        {/* Occupancy Badge */}
                        <div>
                          {(() => {
                            const occ = loc.inventory.occupancy_status;
                            if (occ === 'OVERLOAD') {
                              return (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', background: '#fdecec', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: '12px' }}>
                                  ⚠️ Overload ({loc.inventory.weight_utilization_pct}%)
                                </span>
                              );
                            } else if (occ === 'FULL') {
                              return (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706', background: '#fef3c7', border: '1px solid #fde68a', padding: '3px 10px', borderRadius: '12px' }}>
                                  🟡 Penuh ({loc.inventory.weight_utilization_pct}%)
                                </span>
                              );
                            } else if (occ === 'OCCUPIED') {
                              return (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0e7490', background: '#ecfeff', border: '1px solid #a5f3fc', padding: '3px 10px', borderRadius: '12px' }}>
                                  🟢 Terisi ({loc.inventory.weight_utilization_pct || 0}%)
                                </span>
                              );
                            }
                            return (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: '12px' }}>
                                ⚪ Kosong (0%)
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Metrik Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total SKU</div>
                          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#1e293b', marginTop: '2px' }}>
                            {loc.inventory.total_items || 0}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#5c732b', fontWeight: 500 }}>
                            {loc.inventory.total_units || 0} unit fisik
                          </div>
                        </div>

                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Beban Aktual</div>
                          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#1e293b', marginTop: '2px' }}>
                            {loc.inventory.current_weight_kg || '0.00'} kg
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Maks: {loc.max_weight_kg ? `${loc.max_weight_kg} kg` : '∞'}
                          </div>
                        </div>

                        <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Utilisasi Beban</div>
                          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: loc.inventory.weight_utilization_pct > 100 ? '#dc2626' : '#5c732b', marginTop: '2px' }}>
                            {loc.inventory.weight_utilization_pct || 0}%
                          </div>
                          {/* Mini Progress Bar */}
                          <div style={{ width: '100%', background: '#e2e8f0', height: '4px', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, loc.inventory.weight_utilization_pct || 0)}%`,
                                height: '100%',
                                background: loc.inventory.weight_utilization_pct > 100 ? '#dc2626' : loc.inventory.weight_utilization_pct >= 90 ? '#d97706' : '#5c732b'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Items List or Empty State */}
                      {loc.inventory.items && loc.inventory.items.length > 0 ? (
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3e5510', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Daftar SKU Tersimpan:</span>
                            <span style={{ fontSize: '0.75rem', color: '#737b6c', fontWeight: 'normal' }}>
                              {loc.inventory.items.length} jenis produk
                            </span>
                          </div>

                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>SKU & Produk</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Kategori</th>
                                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Stok</th>
                                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Beban</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Aktivitas Terakhir</th>
                                </tr>
                              </thead>
                              <tbody>
                                {loc.inventory.items.map((item) => (
                                  <tr key={item.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {item.image_url ? (
                                          <img
                                            src={item.image_url}
                                            alt={item.name}
                                            style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                                          />
                                        ) : (
                                          <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                                            📦
                                          </div>
                                        )}
                                        <div>
                                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</div>
                                          <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#5c732b' }}>
                                            ║▌║ {item.sku}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>
                                      {item.category_name}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                                      <span style={{ fontWeight: 700, color: '#0f766e' }}>
                                        {item.stock_quantity}
                                      </span>{' '}
                                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.unit}</span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                                      {item.total_weight_kg} kg
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                                      {item.last_activity_at ? (
                                        <div>
                                          <span
                                            style={{
                                              padding: '1px 6px',
                                              borderRadius: '4px',
                                              fontSize: '0.65rem',
                                              fontWeight: 600,
                                              background: item.last_activity_type === 'in' ? '#f0fdf4' : '#fef2f2',
                                              color: item.last_activity_type === 'in' ? '#15803d' : '#b91c1c',
                                              marginRight: '4px'
                                            }}
                                          >
                                            {item.last_activity_type === 'in' ? 'IN' : 'OUT'}
                                          </span>
                                          {new Date(item.last_activity_at).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                          })}
                                        </div>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1.75rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                            Lokasi Ini Masih Kosong
                          </div>
                          <p style={{ margin: '0 auto 0.75rem auto', maxWidth: '380px', color: '#64748b', fontSize: '0.8rem', lineHeight: 1.5 }}>
                            Belum ada produk atau stok SKU yang dialokasikan pada kompartemen lokasi ini.
                          </p>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: '#15803d' }}>
                            <span>💡</span> Alokasikan barang melalui menu Putaway / Penerimaan Barang Inbound.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Fallback bila modul terputus */
                    <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#191d17', fontSize: '1.1rem' }}>
                        Belum Terhubung ke Inventori
                      </h4>
                      <p style={{ margin: '0 auto 1.5rem auto', maxWidth: '440px', color: '#737b6c', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        {loc.inventory?.message || 'Modul sedang memuat koneksi ke sistem inventori.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: KONTROL STATUS OPERASIONAL */}
              {activeTab === 'status' && (
                <div className="inspector-section">
                  <form onSubmit={handleUpdateStatus}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#191d17', marginBottom: '0.5rem' }}>
                        Pilih Status Operasional Lokasi:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                        {[
                          { id: 'ACTIVE', label: '🟢 ACTIVE (Siap Pakai)', desc: 'Lokasi normal dapat dialokasikan barang' },
                          { id: 'BLOCKED', label: '🔴 BLOCKED (Diblokir)', desc: 'Dilarang alokasi barang / bermasalah' },
                          { id: 'MAINTENANCE', label: '🟠 MAINTENANCE (Servis)', desc: 'Sedang diperbaiki atau inspeksi rel' },
                          { id: 'RETIRED', label: '⚫ RETIRED (Pensiun)', desc: 'Dinonaktifkan permanen dari operasi' }
                        ].map((st) => (
                          <div
                            key={st.id}
                            onClick={() => setTargetStatus(st.id)}
                            style={{
                              padding: '0.65rem',
                              borderRadius: '6px',
                              border: targetStatus === st.id ? '2px solid #5c732b' : '1px solid #e2e8f0',
                              background: targetStatus === st.id ? '#f0fdf4' : '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{st.label}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{st.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#191d17', marginBottom: '0.35rem' }}>
                        Alasan / Catatan Perubahan (Audit Log):
                      </label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={statusReason}
                        onChange={(e) => setStatusReason(e.target.value)}
                        placeholder="Contoh: Pallet rusak, sedang perbaikan rel, atau audit rutin..."
                        style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    {statusError && (
                      <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', background: '#fdecec', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.8rem' }}>
                        {statusError}
                      </div>
                    )}

                    {statusSuccess && (
                      <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#16a34a', fontSize: '0.8rem' }}>
                        {statusSuccess}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="submit"
                        className="btn-layout-control btn-layout-primary"
                        disabled={isUpdatingStatus || targetStatus === loc.manual_status}
                        style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                      >
                        {isUpdatingStatus ? 'Menyimpan...' : 'Simpan Perubahan Status'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="layout-modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            ID Sistem: #{locationId || '—'}
          </div>
          <button className="btn-layout-control" onClick={onClose} style={{ padding: '0.4rem 1rem' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
