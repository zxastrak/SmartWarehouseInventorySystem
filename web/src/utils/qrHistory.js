import { apiFetch } from './api.js';

// Bersihkan cache lama di localStorage agar riwayat sepenuhnya bersumber dari MySQL Database
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('susuno_qr_history');
  } catch (err) {
    console.error('Gagal membersihkan cache localStorage QR:', err);
  }
}

/**
 * Format datetime ke waktu lokal Indonesia
 */
export function formatQrDate(isoString) {
  if (!isoString) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

const actionMap = {
  GENERATE: 'Dibuat (Generated)',
  PRINT: 'Dicetak Fisik',
  DOWNLOAD: 'Diunduh (PNG)',
};

/**
 * Ambil seluruh riwayat QR dari MySQL Database via REST API
 */
export async function getQrHistory(limit = 100) {
  try {
    const res = await apiFetch(`/qr-history?limit=${limit}`);
    if (!res.ok || !Array.isArray(res.data)) {
      return [];
    }
    return res.data.map((row) => ({
      id: row.id,
      timestamp: row.created_at,
      type: row.qr_type,
      code: row.code,
      name: row.name,
      action: row.action,
      actionLabel: actionMap[row.action] || row.action,
      details: row.details || {},
      userName: row.user_name || 'Manager',
    }));
  } catch (err) {
    console.error('Gagal mengambil riwayat QR dari database:', err);
    return [];
  }
}

let lastGeneratedCode = null;
let lastGeneratedTime = 0;

/**
 * Catat event baru riwayat QR ke MySQL Database
 * @param {Object} param0 
 * @param {'RACK'|'INBOUND_ITEM'} param0.type
 * @param {string} param0.code - Kode rak atau SKU barang
 * @param {string} param0.name - Nama rak atau nama barang
 * @param {'GENERATE'|'PRINT'|'DOWNLOAD'} param0.action
 * @param {Object} [param0.details]
 */
export async function recordQrEvent({ type, code, name = '', action = 'GENERATE', details = {} }) {
  if (!code) return null;

  // Mencegah debounce dobel GENERATE dalam selang 2 detik untuk kode yang sama
  const now = Date.now();
  if (action === 'GENERATE') {
    if (lastGeneratedCode === code && now - lastGeneratedTime < 2000) {
      return null;
    }
    lastGeneratedCode = code;
    lastGeneratedTime = now;
  }

  try {
    const payload = {
      qr_type: type || 'RACK',
      code: String(code).trim().toUpperCase(),
      name: name || (type === 'RACK' ? `Lokasi Rak ${code}` : `Barang ${code}`),
      action: action || 'GENERATE',
      details: details || {},
    };

    const res = await apiFetch('/qr-history', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return res.ok ? res.data : null;
  } catch (err) {
    console.error('Gagal mencatat riwayat QR ke database:', err);
    return null;
  }
}

/**
 * Hapus satu rekaman riwayat berdasarkan ID dari MySQL Database
 */
export async function deleteQrEvent(id) {
  if (!id) return;
  try {
    await apiFetch(`/qr-history/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.error('Gagal menghapus qr event dari database:', err);
  }
}

/**
 * Bersihkan seluruh riwayat QR di MySQL Database
 */
export async function clearQrHistory() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('susuno_qr_history');
    }
    await apiFetch('/qr-history', {
      method: 'DELETE',
    });
  } catch (err) {
    console.error('Gagal mengosongkan riwayat QR di database:', err);
  }
}
