/**
 * Authoritative Layout & Geometry Validation Service
 * Backed by pure geometry from shared/layout-core and rules from COLLISION-MATRIX.md.
 */

const {
  footprint,
  overlaps,
  inside,
  createRect,
} = require('../../../../shared/layout-core/src/index');

class LayoutValidationService {
  /**
   * Validates that an entity is strictly within the warehouse boundary.
   * @param {{ x_mm: number, y_mm: number, length_mm: number, depth_mm: number, rotation?: number }} entity
   * @param {{ width_mm: number, length_mm: number }} warehouse
   * @returns {{ valid: boolean, conflict?: Object }}
   */
  static validateWarehouseBoundary(entity, warehouse) {
    const box = footprint(entity.length_mm, entity.depth_mm, entity.rotation || 0);
    const entityRect = createRect(entity.x_mm, entity.y_mm, box.width, box.depth);
    const whBoundary = createRect(0, 0, warehouse.width_mm, warehouse.length_mm);

    if (!inside(entityRect, whBoundary)) {
      return {
        valid: false,
        conflict: {
          code: 'GEOMETRY_CONFLICT',
          conflictType: 'OUT_OF_BOUNDS',
          message: `Entitas berada di luar batas gudang (${warehouse.width_mm} x ${warehouse.length_mm} mm). Posisi X:${entityRect.x}, Y:${entityRect.y}, Lebar:${entityRect.width}, Kedalaman:${entityRect.depth}.`,
          entityRect,
          boundaryRect: whBoundary,
        },
      };
    }

    return { valid: true };
  }

  /**
   * Validates that a rack is strictly contained within its assigned zone footprint.
   * @param {{ x_mm: number, y_mm: number, length_mm: number, depth_mm: number, rotation?: number }} rack
   * @param {{ x_mm: number, y_mm: number, width_mm: number, length_mm: number, zone_code: string }} zone
   * @returns {{ valid: boolean, conflict?: Object }}
   */
  static validateZoneContainment(rack, zone) {
    const box = footprint(rack.length_mm, rack.depth_mm, rack.rotation || 0);
    const rackRect = createRect(rack.x_mm, rack.y_mm, box.width, box.depth);
    const zoneRect = createRect(zone.x_mm, zone.y_mm, zone.width_mm, zone.length_mm);

    if (!inside(rackRect, zoneRect)) {
      return {
        valid: false,
        conflict: {
          code: 'GEOMETRY_CONFLICT',
          conflictType: 'ZONE_BREACH',
          message: `Rak melanggar batas zona '${zone.zone_code}'. Seluruh fisik rak wajib berada di dalam area zona.`,
          rackRect,
          zoneRect,
        },
      };
    }

    return { valid: true };
  }

  /**
   * Validates that a zone does not overlap with any other zone in the warehouse.
   * @param {{ x_mm: number, y_mm: number, width_mm: number, length_mm: number }} newZone
   * @param {Array<Object>} existingZones
   * @param {number} [excludeZoneId]
   * @returns {{ valid: boolean, conflict?: Object }}
   */
  static validateNoZoneOverlap(newZone, existingZones, excludeZoneId = null) {
    const targetRect = createRect(
      newZone.x_mm,
      newZone.y_mm,
      newZone.width_mm,
      newZone.length_mm
    );

    for (const z of existingZones) {
      if (excludeZoneId && z.id === excludeZoneId) continue;
      const otherRect = createRect(z.x_mm, z.y_mm, z.width_mm, z.length_mm);
      if (overlaps(targetRect, otherRect)) {
        return {
          valid: false,
          conflict: {
            code: 'GEOMETRY_CONFLICT',
            conflictType: 'OVERLAP',
            message: `Zona bertabrakan dengan zona lain: '${z.zone_code}' (${z.name}). Zona tidak boleh saling tumpang tindih.`,
            conflictingEntity: { id: z.id, type: 'zone', code: z.zone_code, rect: otherRect },
            targetRect,
          },
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validates geometric collisions against other physical obstacles in the warehouse.
   * Enforces COLLISION-MATRIX.md rules.
   *
   * @param {Object} conn - MySQL Connection
   * @param {number} warehouseId
   * @param {'rack'|'aisle'|'obstacle'} targetType
   * @param {{ x_mm: number, y_mm: number, length_mm: number, depth_mm: number, rotation?: number }} entity
   * @param {number} [excludeId=null]
   * @returns {Promise<{ valid: boolean, conflict?: Object }>}
   */
  static async validatePhysicalCollisions(conn, warehouseId, targetType, entity, excludeId = null) {
    const box = footprint(entity.length_mm, entity.depth_mm, entity.rotation || 0);
    const targetRect = createRect(entity.x_mm, entity.y_mm, box.width, box.depth);

    // 1. Periksa tabrakan dengan RAK AKTIF LAINNYA
    const [racks] = await conn.query(
      `SELECT id, rack_code, x_mm, y_mm, length_mm, depth_mm, rotation
       FROM racks
       WHERE warehouse_id = ? AND retired_at IS NULL ${excludeId && targetType === 'rack' ? 'AND id <> ?' : ''}`,
      excludeId && targetType === 'rack' ? [warehouseId, excludeId] : [warehouseId]
    );

    for (const r of racks) {
      const rBox = footprint(r.length_mm, r.depth_mm, r.rotation || 0);
      const rRect = createRect(r.x_mm, r.y_mm, rBox.width, rBox.depth);
      if (overlaps(targetRect, rRect)) {
        return {
          valid: false,
          conflict: {
            code: 'GEOMETRY_CONFLICT',
            conflictType: 'OVERLAP',
            message: `Tabrakan dengan rak '${r.rack_code}'. Luas irisan positif terdeteksi.`,
            targetRect,
            conflictingEntity: { id: r.id, type: 'rack', code: r.rack_code, rect: rRect },
          },
        };
      }
    }

    // 2. Periksa tabrakan dengan LORONG (AISLE)
    // Aisle vs Aisle diizinkan (persimpangan), tetapi Rack vs Aisle DITOLAK
    if (targetType === 'rack') {
      const [aisles] = await conn.query(
        `SELECT id, aisle_code, x_mm, y_mm, width_mm, length_mm
         FROM aisles
         WHERE warehouse_id = ? AND retired_at IS NULL`,
        [warehouseId]
      );

      for (const a of aisles) {
        const aRect = createRect(a.x_mm, a.y_mm, a.width_mm, a.length_mm);
        if (overlaps(targetRect, aRect)) {
          return {
            valid: false,
            conflict: {
              code: 'GEOMETRY_CONFLICT',
              conflictType: 'OVERLAP',
              message: `Rak bertabrakan dengan lorong '${a.aisle_code}'. Rak tidak boleh memotong lorong.`,
              targetRect,
              conflictingEntity: { id: a.id, type: 'aisle', code: a.aisle_code, rect: aRect },
            },
          };
        }
      }
    }

    // 3. Periksa tabrakan dengan RINTANGAN LAYOUT (Walls, Pillars, Doors, Docks)
    const [objects] = await conn.query(
      `SELECT id, object_type, name, x_mm, y_mm, width_mm, length_mm, rotation, clearance_mm
       FROM layout_objects
       WHERE warehouse_id = ? ${excludeId && targetType === 'obstacle' ? 'AND id <> ?' : ''}`,
      excludeId && targetType === 'obstacle' ? [warehouseId, excludeId] : [warehouseId]
    );

    for (const o of objects) {
      const oBox = footprint(o.length_mm, o.width_mm, o.rotation || 0);
      const oRect = createRect(o.x_mm, o.y_mm, oBox.width, oBox.depth);
      if (overlaps(targetRect, oRect)) {
        return {
          valid: false,
          conflict: {
            code: 'GEOMETRY_CONFLICT',
            conflictType: 'OVERLAP',
            message: `Bertabrakan dengan rintangan fisik '${o.name}' (${o.object_type}).`,
            targetRect,
            conflictingEntity: { id: o.id, type: o.object_type, name: o.name, rect: oRect },
          },
        };
      }
    }

    return { valid: true };
  }
}

module.exports = LayoutValidationService;
