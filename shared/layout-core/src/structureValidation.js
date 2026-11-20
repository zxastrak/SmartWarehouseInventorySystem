/**
 * Rack Structural Rules & Integrity Validation (Pure Functions)
 * Enforces architectural constraints without I/O or database queries.
 */

import { validateInteger } from './geometry.js';

/**
 * Validates that the sum of bay widths equals the rack length within tolerance.
 *
 * @param {number[]} bayWidths - Array of widths in mm for each bay
 * @param {number} rackLength - Total physical length of the rack in mm
 * @param {number} [toleranceMm=5] - Permissible deviation in mm
 * @returns {{ valid: boolean, totalBayWidth: number, difference: number, message?: string }}
 */
function validateBayWidths(bayWidths, rackLength, toleranceMm = 5) {
  validateInteger(rackLength, 'rackLength', false);
  if (!Array.isArray(bayWidths) || bayWidths.length === 0) {
    return {
      valid: false,
      totalBayWidth: 0,
      difference: rackLength,
      message: 'Rak harus memiliki minimal satu bay fisik.',
    };
  }

  let totalBayWidth = 0;
  for (let i = 0; i < bayWidths.length; i++) {
    const width = bayWidths[i];
    if (typeof width !== 'number' || width <= 0 || !Number.isInteger(width)) {
      return {
        valid: false,
        totalBayWidth,
        difference: rackLength - totalBayWidth,
        message: `Lebar bay indeks ${i} (${width}) harus berupa integer milimeter positif.`,
      };
    }
    totalBayWidth += width;
  }

  const difference = Math.abs(totalBayWidth - rackLength);
  const valid = difference <= toleranceMm;

  return {
    valid,
    totalBayWidth,
    difference,
    message: valid
      ? 'Lebar bay valid'
      : `Total lebar bay (${totalBayWidth} mm) tidak sesuai dengan panjang rak (${rackLength} mm). Selisih: ${difference} mm (toleransi: ${toleranceMm} mm).`,
  };
}

/**
 * Validates vertical rack levels:
 * - Ketinggian dari lantai (height_from_floor_mm) naik secara ketat (strictly increasing).
 * - Jarak antar level berurutan >= minLevelClearance.
 * - Level paling atas + minLevelClearance <= total tinggi rak.
 *
 * @param {Array<{ level_number: number, height_from_floor_mm: number }>} levels
 * @param {number} rackHeight - Total rack height in mm
 * @param {number} [minLevelClearance=300] - Minimum clearance in mm between levels (default: 300 mm)
 * @returns {{ valid: boolean, message?: string, errors: string[] }}
 */
function validateLevels(levels, rackHeight, minLevelClearance = 300) {
  validateInteger(rackHeight, 'rackHeight', false);
  const errors = [];

  if (!Array.isArray(levels) || levels.length === 0) {
    return {
      valid: false,
      message: 'Rak harus memiliki minimal satu level.',
      errors: ['Rak harus memiliki minimal satu level.'],
    };
  }

  // Urutkan salinan level berdasarkan nomor level
  const sortedLevels = [...levels].sort((a, b) => a.level_number - b.level_number);

  let prevHeight = -1;

  for (let i = 0; i < sortedLevels.length; i++) {
    const lvl = sortedLevels[i];
    const h = lvl.height_from_floor_mm;

    if (typeof h !== 'number' || h < 0 || !Number.isInteger(h)) {
      errors.push(`Level ${lvl.level_number}: Ketinggian dari lantai harus berupa integer mm >= 0.`);
      continue;
    }

    if (i > 0) {
      if (h <= prevHeight) {
        errors.push(
          `Level ${lvl.level_number} (${h} mm) harus lebih tinggi dari level ${sortedLevels[i - 1].level_number} (${prevHeight} mm).`
        );
      } else if (h - prevHeight < minLevelClearance) {
        errors.push(
          `Jarak vertikal antara level ${sortedLevels[i - 1].level_number} dan ${lvl.level_number} (${h - prevHeight} mm) kurang dari batas minimum clearance (${minLevelClearance} mm).`
        );
      }
    }

    prevHeight = h;
  }

  // Periksa batas tinggi rak teratas
  const highestLevel = sortedLevels[sortedLevels.length - 1];
  if (highestLevel && highestLevel.height_from_floor_mm + minLevelClearance > rackHeight) {
    errors.push(
      `Level teratas (${highestLevel.height_from_floor_mm} mm) + clearance (${minLevelClearance} mm) melebihi tinggi total rak (${rackHeight} mm).`
    );
  }

  return {
    valid: errors.length === 0,
    message: errors.length === 0 ? 'Konfigurasi level valid' : errors[0],
    errors,
  };
}

/**
 * Validates position count matrix across bay-levels.
 * Position count must be an integer > 0 for every bay-level.
 *
 * @param {Array<{ bay_id?: any, level_id?: any, position_count: number }>} configs
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePositionConfigs(configs) {
  const errors = [];
  if (!Array.isArray(configs) || configs.length === 0) {
    return { valid: false, errors: ['Matriks konfigurasi posisi tidak boleh kosong.'] };
  }

  for (let i = 0; i < configs.length; i++) {
    const c = configs[i];
    if (typeof c.position_count !== 'number' || !Number.isInteger(c.position_count) || c.position_count <= 0) {
      errors.push(`Konfigurasi indeks ${i}: position_count harus berupa bilangan bulat positif (> 0).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export {
  validateBayWidths,
  validateLevels,
  validatePositionConfigs,
};

export default {
  validateBayWidths,
  validateLevels,
  validatePositionConfigs,
};
