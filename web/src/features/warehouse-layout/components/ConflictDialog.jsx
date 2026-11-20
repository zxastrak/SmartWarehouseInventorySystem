/**
 * Conflict Dialog Modal for Concurrent Layout Modifications (AC-15)
 * Triggered when a PATCH request returns HTTP 409 VERSION_CONFLICT.
 */

import React from 'react';

export default function ConflictDialog({
  isOpen,
  conflictDetails,
  onReload,
  onDismiss,
}) {
  if (!isOpen) return null;

  return (
    <div className="layout-modal-backdrop">
      <div className="layout-modal-card">
        <div className="layout-modal-header">
          <div className="layout-modal-icon-warning">⚠️</div>
          <div>
            <h3 className="layout-modal-title">Konflik Versi Layout Terdeteksi</h3>
            <p className="layout-modal-subtitle">
              Layout di server telah diperbarui oleh pengguna lain atau sistem.
            </p>
          </div>
        </div>

        <div className="layout-modal-body">
          <div className="conflict-info-box">
            <div className="conflict-row">
              <span className="conflict-label">Versi Dokumen Lokal:</span>
              <span className="conflict-val">v{conflictDetails?.base_version || 1}</span>
            </div>
            <div className="conflict-row">
              <span className="conflict-label">Versi Terbaru di Server:</span>
              <span className="conflict-val server-val">
                v{conflictDetails?.current_version || (conflictDetails?.base_version || 1) + 1}
              </span>
            </div>
            {conflictDetails?.message && (
              <p className="conflict-server-msg">{conflictDetails.message}</p>
            )}
          </div>

          <p className="conflict-advice">
            Untuk mencegah data tertimpa secara tidak sengaja, perubahan lokal Anda tidak dapat
            disimpan langsung ke versi lama. Silakan muat ulang layout terbaru untuk melihat tata
            letak terkini.
          </p>
        </div>

        <div className="layout-modal-footer">
          <button className="btn-layout-control" onClick={onDismiss}>
            Tinjau Draft Lokal
          </button>
          <button className="btn-layout-control btn-layout-primary" onClick={onReload}>
            Muat Ulang Layout Terbaru
          </button>
        </div>
      </div>
    </div>
  );
}
