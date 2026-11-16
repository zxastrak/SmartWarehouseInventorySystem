/**
 * Formatter utilitas SUSUNO
 * Standar format angka dan pemisah ribuan titik Indonesia (id-ID)
 */

/**
 * Format angka dengan pemisah ribuan titik (contoh: 1000 -> "1.000", 1500000 -> "1.500.000").
 * Angka <= 999 tetap tampil apa adanya tanpa titik.
 */
export function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '0';
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  return num.toLocaleString('id-ID');
}

/**
 * Format mata uang Rupiah (contoh: 15000 -> "Rp 15.000")
 */
export function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return 'Rp 0';
  const num = Number(val);
  if (Number.isNaN(num)) return `Rp ${val}`;
  return `Rp ${num.toLocaleString('id-ID')}`;
}

