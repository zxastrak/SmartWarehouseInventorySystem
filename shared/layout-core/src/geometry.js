/**
 * Pure Geometry Module (AABB 2D in Integer Millimeters)
 * No DOM, no Node-specific APIs, zero external runtime dependencies.
 */

import { ALLOWED_ROTATIONS } from './dto.js';

/**
 * Validates that a value is a strictly valid finite integer.
 * @param {any} val
 * @param {string} fieldName
 * @param {boolean} [allowZero=false]
 * @throws {TypeError|RangeError}
 */
function validateInteger(val, fieldName = 'value', allowZero = false) {
  if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
    throw new TypeError(`${fieldName} harus berupa angka numerik finite, diterima: ${val}`);
  }
  if (!Number.isInteger(val)) {
    throw new TypeError(`${fieldName} harus berupa bilangan bulat (integer mm), diterima: ${val}`);
  }
  if (allowZero ? val < 0 : val <= 0) {
    throw new RangeError(
      `${fieldName} harus bernilai ${allowZero ? '>= 0' : '> 0'}, diterima: ${val}`
    );
  }
  return val;
}

/**
 * Computes 2D axis-aligned bounding box dimensions (width along X, depth along Y)
 * based on physical length, physical depth, and rotation angle.
 * @param {number} lengthMm - Physical length of entity (X axis when rot=0)
 * @param {number} depthMm - Physical depth of entity (Y axis when rot=0)
 * @param {number} rotation - 0, 90, 180, or 270 degrees
 * @returns {{ width: number, depth: number }}
 */
function footprint(lengthMm, depthMm, rotation = 0) {
  validateInteger(lengthMm, 'lengthMm', false);
  validateInteger(depthMm, 'depthMm', false);

  if (!ALLOWED_ROTATIONS.includes(rotation)) {
    throw new RangeError(
      `Rotasi harus salah satu dari [0, 90, 180, 270], diterima: ${rotation}`
    );
  }

  if (rotation === 0 || rotation === 180) {
    return { width: lengthMm, depth: depthMm };
  } else {
    // 90 or 270 degrees
    return { width: depthMm, depth: lengthMm };
  }
}

/**
 * Rotates an entity 90 degrees clockwise around its bounding box center.
 * Coordinate system: origin (0,0) at top-left, X increases right, Y increases down.
 * Coordinates are rounded deterministically with Math.floor.
 *
 * @param {number} x - Current top-left X in mm
 * @param {number} y - Current top-left Y in mm
 * @param {number} lengthMm - Physical length in mm
 * @param {number} depthMm - Physical depth in mm
 * @param {number} currentRotation - 0, 90, 180, 270
 * @returns {{ x: number, y: number, rotation: number, width: number, depth: number }}
 */
function rotate90(x, y, lengthMm, depthMm, currentRotation = 0) {
  validateInteger(x, 'x', true);
  validateInteger(y, 'y', true);
  validateInteger(lengthMm, 'lengthMm', false);
  validateInteger(depthMm, 'depthMm', false);

  if (!ALLOWED_ROTATIONS.includes(currentRotation)) {
    throw new RangeError(`Rotasi tidak valid: ${currentRotation}`);
  }

  // Bounding box saat ini
  const currentBox = footprint(lengthMm, depthMm, currentRotation);
  const cx = x + currentBox.width / 2;
  const cy = y + currentBox.depth / 2;

  // Rotasi baru (searah jarum jam / CW)
  const nextRotation = (currentRotation + 90) % 360;
  const nextBox = footprint(lengthMm, depthMm, nextRotation);

  // Sudut kiri atas baru mengitari titik pusat yang sama
  const nextX = Math.floor(cx - nextBox.width / 2);
  const nextY = Math.floor(cy - nextBox.depth / 2);

  return {
    x: Math.max(0, nextX),
    y: Math.max(0, nextY),
    rotation: nextRotation,
    width: nextBox.width,
    depth: nextBox.depth,
  };
}

/**
 * Checks if two axis-aligned bounding boxes (AABBs) overlap with positive area.
 * Edge-touching (berhimpitan tepat di garis tepi) TIDAK dihitung sebagai tabrakan (diperbolehkan).
 *
 * @param {{ x: number, y: number, width: number, depth: number }} a
 * @param {{ x: number, y: number, width: number, depth: number }} b
 * @returns {boolean} True jika bertabrakan (luas irisan > 0)
 */
function overlaps(a, b) {
  if (!a || !b) return false;

  const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
  const overlapY = a.y < b.y + b.depth && a.y + a.depth > b.y;

  return overlapX && overlapY;
}

/**
 * Checks if rect A is strictly contained inside boundary rect B.
 *
 * @param {{ x: number, y: number, width: number, depth: number }} inner
 * @param {{ x: number, y: number, width: number, depth: number }} boundary
 * @returns {boolean}
 */
function inside(inner, boundary) {
  if (!inner || !boundary) return false;

  return (
    inner.x >= boundary.x &&
    inner.y >= boundary.y &&
    inner.x + inner.width <= boundary.x + boundary.width &&
    inner.y + inner.depth <= boundary.y + boundary.depth
  );
}

/**
 * Snaps a 1D value to the nearest grid line if within tolerance.
 *
 * @param {number} value
 * @param {number} grid
 * @param {number} tolerance
 * @returns {number}
 */
function snap(value, grid, tolerance) {
  if (grid <= 0 || tolerance <= 0) return value;

  const remainder = ((value % grid) + grid) % grid;
  const diff = remainder < grid / 2 ? -remainder : grid - remainder;

  if (Math.abs(diff) <= tolerance) {
    return value + diff;
  }
  return value;
}

/**
 * Converts millimeter (domain model) to pixel (presentation layer).
 * @param {number} mm
 * @param {number} scale - pixels per mm
 * @returns {number}
 */
function mmToPx(mm, scale) {
  if (typeof mm !== 'number' || typeof scale !== 'number') return 0;
  return mm * scale;
}

/**
 * Converts pixel (presentation layer) to millimeter (domain model).
 * @param {number} px
 * @param {number} scale - pixels per mm
 * @returns {number}
 */
function pxToMm(px, scale) {
  if (typeof px !== 'number' || typeof scale !== 'number' || scale === 0) return 0;
  return Math.round(px / scale);
}

export {
  validateInteger,
  footprint,
  rotate90,
  overlaps,
  inside,
  snap,
  mmToPx,
  pxToMm,
};

export default {
  validateInteger,
  footprint,
  rotate90,
  overlaps,
  inside,
  snap,
  mmToPx,
  pxToMm,
};
