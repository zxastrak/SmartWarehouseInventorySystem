/**
 * DTOs and Type Constants for Warehouse Layout & Storage Mapping
 * Pure JavaScript module shared across frontend and backend.
 */

const ALLOWED_ROTATIONS = Object.freeze([0, 90, 180, 270]);
const ACCESS_SIDES = Object.freeze(['left', 'right', 'both']);
const OBJECT_TYPES = Object.freeze(['wall', 'pillar', 'door', 'dock', 'obstacle']);
const MANUAL_STATUSES = Object.freeze(['ACTIVE', 'BLOCKED', 'MAINTENANCE', 'RETIRED']);

/**
 * Creates a normalized 2D AABB Rect object.
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} depth
 * @returns {{ x: number, y: number, width: number, depth: number }}
 */
function createRect(x, y, width, depth) {
  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.floor(width),
    depth: Math.floor(depth),
  };
}

/**
 * Validates whether a rotation value is one of 0, 90, 180, 270.
 * @param {number} rot
 * @returns {boolean}
 */
function isValidRotation(rot) {
  return typeof rot === 'number' && Number.isInteger(rot) && ALLOWED_ROTATIONS.includes(rot);
}

/**
 * Validates access side.
 * @param {string} side
 * @returns {boolean}
 */
function isValidAccessSide(side) {
  return typeof side === 'string' && ACCESS_SIDES.includes(side.toLowerCase());
}

/**
 * Creates a clean LayoutSnapshot data container.
 * @param {Object} params
 * @returns {Object}
 */
function createLayoutSnapshot({
  warehouse,
  zones = [],
  aisles = [],
  racks = [],
  layoutObjects = [],
}) {
  return {
    warehouse: {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      width_mm: Math.floor(warehouse.width_mm),
      length_mm: Math.floor(warehouse.length_mm),
      height_mm: Math.floor(warehouse.height_mm),
      layout_version: warehouse.layout_version || 1,
    },
    zones: zones.map((z) => ({
      id: z.id,
      zone_code: z.zone_code,
      name: z.name,
      color_hex: z.color_hex,
      x_mm: Math.floor(z.x_mm),
      y_mm: Math.floor(z.y_mm),
      width_mm: Math.floor(z.width_mm),
      length_mm: Math.floor(z.length_mm),
    })),
    aisles: aisles.map((a) => ({
      id: a.id,
      aisle_code: a.aisle_code,
      name: a.name,
      x_mm: Math.floor(a.x_mm),
      y_mm: Math.floor(a.y_mm),
      width_mm: Math.floor(a.width_mm),
      length_mm: Math.floor(a.length_mm),
      direction: a.direction || 'two_way',
      retired_at: a.retired_at || null,
    })),
    racks: racks.map((r) => ({
      id: r.id,
      rack_code: r.rack_code,
      zone_id: r.zone_id || null,
      x_mm: Math.floor(r.x_mm),
      y_mm: Math.floor(r.y_mm),
      length_mm: Math.floor(r.length_mm),
      depth_mm: Math.floor(r.depth_mm),
      height_mm: Math.floor(r.height_mm),
      rotation: r.rotation || 0,
      color_hex: r.color_hex || '#5c732b',
      version: r.version || 1,
      aisle_access: r.aisle_access || [],
      retired_at: r.retired_at || null,
    })),
    layout_objects: layoutObjects.map((o) => ({
      id: o.id,
      object_type: o.object_type,
      name: o.name,
      x_mm: Math.floor(o.x_mm),
      y_mm: Math.floor(o.y_mm),
      width_mm: Math.floor(o.width_mm),
      length_mm: Math.floor(o.length_mm),
      rotation: o.rotation || 0,
      clearance_mm: Math.floor(o.clearance_mm || 0),
    })),
  };
}

export {
  ALLOWED_ROTATIONS,
  ACCESS_SIDES,
  OBJECT_TYPES,
  MANUAL_STATUSES,
  createRect,
  isValidRotation,
  isValidAccessSide,
  createLayoutSnapshot,
};

export default {
  ALLOWED_ROTATIONS,
  ACCESS_SIDES,
  OBJECT_TYPES,
  MANUAL_STATUSES,
  createRect,
  isValidRotation,
  isValidAccessSide,
  createLayoutSnapshot,
};
