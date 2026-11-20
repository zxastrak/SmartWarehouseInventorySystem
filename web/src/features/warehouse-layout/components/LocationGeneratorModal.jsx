/**
 * Location Generator Modal Dialog (STEP 11)
 * Combines PatternConfigurator, debounced backend preview diff, and bulk execution.
 */

import React, { useState, useEffect, useCallback } from 'react';
import PatternConfigurator from './PatternConfigurator.jsx';
import codeUtils from '../../../../../shared/layout-core/src/code.js';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

function getAuthToken() {
  return localStorage.getItem('susuno_auth_token') || localStorage.getItem('susuno_token') || 'demo_token';
}

const { DEFAULT_PATTERN } = codeUtils;

export default function LocationGeneratorModal({
  isOpen,
  rack,
  onClose,
  onGenerated,
}) {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [separator, setSeparator] = useState('-');
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Debounced preview calculation from backend
  const fetchBackendPreview = useCallback(async (currPattern, currSep) => {
    if (!rack?.id) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/racks/${rack.id}/generate-locations/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          pattern: currPattern,
          separator: currSep,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Gagal menghitung pratinjau (HTTP ${res.status})`);
      }

      setPreviewData(json.data);
    } catch (err) {
      console.error('[GENERATOR PREVIEW ERROR]', err);
      setError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  }, [rack?.id]);

  useEffect(() => {
    if (!isOpen || !rack?.id) return;
    const timer = setTimeout(() => {
      fetchBackendPreview(pattern, separator);
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, rack?.id, pattern, separator, fetchBackendPreview]);

  // Execute bulk generation
  const handleExecuteGenerate = async () => {
    if (!rack?.id || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/racks/${rack.id}/generate-locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          pattern,
          separator,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Gagal menerbitkan lokasi (HTTP ${res.status})`);
      }

      setGenerating(false);
      if (onGenerated) {
        onGenerated(json.data);
      }
      onClose();
    } catch (err) {
      console.error('[GENERATE EXECUTE ERROR]', err);
      setError(err.message);
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="layout-modal-backdrop">
      <div className="location-generator-modal-card">
        {/* Modal Header */}
        <div className="elevation-modal-header">
          <div>
            <h3 className="elevation-modal-title">
              Terbitkan Lokasi Penyimpanan: {rack?.rack_code || 'Rak'}
            </h3>
            <p className="elevation-modal-subtitle">
              Penerbitan otomatis kode slot bin menggunakan pola format terstandardisasi (Append-First).
            </p>
          </div>
          <button className="btn-modal-close" onClick={onClose} title="Tutup Dialog">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="location-generator-modal-body">
          {error && <div className="form-error-banner">⚠️ {error}</div>}

          {/* Pattern Configurator */}
          <PatternConfigurator
            pattern={pattern}
            separator={separator}
            onChangePattern={setPattern}
            onChangeSeparator={setSeparator}
            sampleSegments={{
              aisle: 'A01',
              rack: rack?.rack_code || 'RK01',
              bay: 1,
              level: 1,
              position: 1,
            }}
          />

          {/* Backend Impact & Stats Card */}
          <div className="generator-impact-section">
            <h5 className="section-title">Dampak Penerbitan Lokasi (Append-First AC-13)</h5>
            {loadingPreview ? (
              <p className="preview-loading-text">Menghitung pratinjau lokasi dari server...</p>
            ) : previewData ? (
              <>
                <div className="generator-stat-grid">
                  <div className="generator-stat-box">
                    <span className="stat-label">Lokasi Sudah Terbit</span>
                    <span className="stat-val">{previewData.already_issued_count}</span>
                  </div>
                  <div className="generator-stat-box stat-highlight-box">
                    <span className="stat-label">Lokasi Baru Terbit</span>
                    <span className="stat-val" style={{ color: '#16a34a' }}>
                      +{previewData.new_locations_count}
                    </span>
                  </div>
                  <div className="generator-stat-box">
                    <span className="stat-label">Total Setelah Terbit</span>
                    <span className="stat-val">
                      {previewData.already_issued_count + previewData.new_locations_count}
                    </span>
                  </div>
                </div>

                {/* Sample Codes List */}
                {previewData.sample_codes && previewData.sample_codes.length > 0 && (
                  <div className="sample-codes-preview-box">
                    <span className="sample-codes-label">
                      Sampel Kode Lokasi Baru ({previewData.sample_codes.length} dari {previewData.new_locations_count}):
                    </span>
                    <div className="sample-codes-tags">
                      {previewData.sample_codes.map((code) => (
                        <span key={code} className="sample-code-chip">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="preview-empty-hint">Masukkan pola yang valid untuk melihat proyeksi.</p>
            )}
          </div>

          {/* Immutability Notice (AC-10) */}
          <div className="generator-immutable-notice">
            <span className="notice-icon">ℹ️</span>
            <p className="notice-text">
              <strong>Aturan Immutabilitas Kode (AC-10):</strong> Kode lokasi yang telah diterbitkan
              bersifat permanen dan tidak dapat diedit kembali. Lokasi baru akan diterbitkan tanpa
              mengubah lokasi yang sudah terbit sebelumnya.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="elevation-modal-footer">
          <button className="btn-layout-control" onClick={onClose} disabled={generating}>
            Batal
          </button>
          <button
            className="btn-layout-control btn-layout-primary"
            onClick={handleExecuteGenerate}
            disabled={generating || !previewData || previewData.new_locations_count === 0}
          >
            {generating ? 'Menerbitkan Lokasi...' : `⚡ Terbitkan ${previewData?.new_locations_count || 0} Lokasi Sekarang`}
          </button>
        </div>
      </div>
    </div>
  );
}
