/**
 * Batch Patch Service for Atomic Layout Mutations
 * Enforces compare-and-swap optimistic locking, all-or-nothing rollback, and collision validation.
 */

const LayoutValidationService = require('./layoutValidationService');
const {
  normalizeCode,
  isValidCode,
  ALLOWED_ROTATIONS,
} = require('../../../../shared/layout-core/src/index');

class BatchPatchService {
  /**
   * Applies a batch of operations atomically with Compare-And-Swap (CAS) locking.
   *
   * @param {Object} conn - MySQL Connection (must be inside a transaction)
   * @param {number} warehouseId
   * @param {number} expectedLayoutVersion
   * @param {Array<Object>} operations
   * @param {string} requestId
   * @returns {Promise<{ newLayoutVersion: number, updatedEntities: Array<Object> }>}
   */
  static async executeBatchPatch(conn, warehouseId, expectedLayoutVersion, operations, requestId) {
    if (!Number.isInteger(expectedLayoutVersion) || expectedLayoutVersion < 1) {
      const err = new Error('expectedLayoutVersion harus berupa integer positif.');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    if (!Array.isArray(operations) || operations.length === 0) {
      const err = new Error('Daftar operations tidak boleh kosong.');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    // 1. Kunci baris warehouse untuk mencegah race condition (CAS)
    const [whRows] = await conn.query(
      'SELECT id, code, width_mm, length_mm, height_mm, layout_version FROM warehouses WHERE id = ? FOR UPDATE',
      [warehouseId]
    );

    if (whRows.length === 0) {
      const err = new Error('Warehouse tidak ditemukan.');
      err.code = 'RESOURCE_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const warehouse = whRows[0];

    // 2. Cek konflik versi layout (AC-15)
    if (warehouse.layout_version !== expectedLayoutVersion) {
      const err = new Error(
        `Konflik versi layout (AC-15). Versi server saat ini adalah v${warehouse.layout_version}, versi yang dikirim v${expectedLayoutVersion}. Muat ulang layout sebelum menyimpan.`
      );
      err.code = 'VERSION_CONFLICT';
      err.status = 409;
      err.details = {
        currentLayoutVersion: warehouse.layout_version,
        expectedLayoutVersion,
      };
      throw err;
    }

    const updatedEntities = [];

    // 3. Eksekusi setiap operasi sekuensial dalam transaksi yang sama
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const { op: action, entity, id, version, data } = op;

      if (!action || !entity) {
        const err = new Error(`Operasi ke-${i}: atribut 'op' dan 'entity' wajib diisi.`);
        err.code = 'VALIDATION_ERROR';
        err.status = 400;
        throw err;
      }

      if (entity === 'rack') {
        if (action === 'move' || action === 'rotate' || action === 'update') {
          // Kunci baris rak
          const [rackRows] = await conn.query(
            'SELECT * FROM racks WHERE id = ? AND warehouse_id = ? AND retired_at IS NULL FOR UPDATE',
            [id, warehouseId]
          );

          if (rackRows.length === 0) {
            const err = new Error(`Rak ID ${id} tidak ditemukan atau telah dinonaktifkan.`);
            err.code = 'RESOURCE_NOT_FOUND';
            err.status = 404;
            throw err;
          }

          const currentRack = rackRows[0];

          // Optimistic locking per entitas
          if (version !== undefined && currentRack.version !== version) {
            const err = new Error(
              `Konflik versi entitas rak '${currentRack.rack_code}' (server: v${currentRack.version}, klien: v${version}).`
            );
            err.code = 'VERSION_CONFLICT';
            err.status = 409;
            err.details = {
              entity: 'rack',
              id,
              currentVersion: currentRack.version,
              expectedVersion: version,
            };
            throw err;
          }

          const newX = data?.x_mm !== undefined ? Number(data.x_mm) : op.x_mm !== undefined ? Number(op.x_mm) : currentRack.x_mm;
          const newY = data?.y_mm !== undefined ? Number(data.y_mm) : op.y_mm !== undefined ? Number(op.y_mm) : currentRack.y_mm;
          const newLength = data?.length_mm !== undefined ? Number(data.length_mm) : currentRack.length_mm;
          const newDepth = data?.depth_mm !== undefined ? Number(data.depth_mm) : currentRack.depth_mm;
          const newRotation = data?.rotation !== undefined ? Number(data.rotation) : op.rotation !== undefined ? Number(op.rotation) : currentRack.rotation;

          if (!ALLOWED_ROTATIONS.includes(newRotation)) {
            const err = new Error(`Rotasi ${newRotation} tidak valid. Harus salah satu dari 0, 90, 180, 270.`);
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            throw err;
          }

          const candidate = {
            x_mm: newX,
            y_mm: newY,
            length_mm: newLength,
            depth_mm: newDepth,
            rotation: newRotation,
          };

          // Validasi batas gudang
          const boundCheck = LayoutValidationService.validateWarehouseBoundary(candidate, warehouse);
          if (!boundCheck.valid) {
            const err = new Error(boundCheck.conflict.message);
            err.code = boundCheck.conflict.code;
            err.conflictType = boundCheck.conflict.conflictType;
            err.status = 422;
            throw err;
          }

          // Validasi collision fisik (exclude self)
          const colCheck = await LayoutValidationService.validatePhysicalCollisions(
            conn,
            warehouseId,
            'rack',
            candidate,
            Number(id)
          );
          if (!colCheck.valid) {
            const err = new Error(colCheck.conflict.message);
            err.code = colCheck.conflict.code;
            err.conflictType = colCheck.conflict.conflictType;
            err.details = colCheck.conflict;
            err.status = 409;
            throw err;
          }

          const newColorHex = data?.color_hex !== undefined ? data.color_hex : currentRack.color_hex || '#5c732b';
          const newRackCode = data?.rack_code !== undefined ? data.rack_code.trim().toUpperCase() : currentRack.rack_code;
          const newHeight = data?.height_mm !== undefined ? Number(data.height_mm) : currentRack.height_mm;

          // Update rak & naikkan version rak (D14: id dan location_code tidak berubah)
          await conn.query(
            `UPDATE racks
             SET x_mm = ?, y_mm = ?, length_mm = ?, depth_mm = ?, height_mm = ?, rotation = ?, color_hex = ?, rack_code = ?, version = version + 1
             WHERE id = ? AND version = ?`,
            [newX, newY, newLength, newDepth, newHeight, newRotation, newColorHex, newRackCode, id, currentRack.version]
          );

          updatedEntities.push({
            type: 'rack',
            id,
            rack_code: newRackCode,
            color_hex: newColorHex,
            x_mm: newX,
            y_mm: newY,
            rotation: newRotation,
            version: currentRack.version + 1,
            action,
          });
        } else if (action === 'create') {
          const rackData = data || op;
          const normalizedCode = normalizeCode(rackData.rack_code);
          if (!isValidCode(normalizedCode)) {
            const err = new Error(`Format kode rak '${rackData.rack_code}' tidak valid.`);
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            throw err;
          }

          // Cek code registry
          const [reg] = await conn.query(
            'SELECT id FROM code_registry WHERE warehouse_id = ? AND code_type = ? AND normalized_code = ?',
            [warehouseId, 'RACK', normalizedCode]
          );
          if (reg.length > 0) {
            const err = new Error(`Kode rak '${normalizedCode}' sudah pernah diterbitkan.`);
            err.code = 'DUPLICATE_CODE';
            err.status = 409;
            throw err;
          }

          const candidate = {
            x_mm: Number(rackData.x_mm || 0),
            y_mm: Number(rackData.y_mm || 0),
            length_mm: Number(rackData.length_mm),
            depth_mm: Number(rackData.depth_mm),
            height_mm: Number(rackData.height_mm),
            rotation: Number(rackData.rotation || 0),
          };

          const boundCheck = LayoutValidationService.validateWarehouseBoundary(candidate, warehouse);
          if (!boundCheck.valid) {
            const err = new Error(boundCheck.conflict.message);
            err.code = boundCheck.conflict.code;
            err.status = 422;
            throw err;
          }

          const colCheck = await LayoutValidationService.validatePhysicalCollisions(
            conn,
            warehouseId,
            'rack',
            candidate
          );
          if (!colCheck.valid) {
            const err = new Error(colCheck.conflict.message);
            err.code = colCheck.conflict.code;
            err.status = 409;
            throw err;
          }

          const [ins] = await conn.query(
            `INSERT INTO racks (warehouse_id, zone_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation, color_hex, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              warehouseId,
              rackData.zone_id || null,
              normalizedCode,
              candidate.x_mm,
              candidate.y_mm,
              candidate.length_mm,
              candidate.depth_mm,
              candidate.height_mm,
              candidate.rotation,
              rackData.color_hex || '#5c732b',
            ]
          );

          await conn.query(
            `INSERT INTO code_registry (warehouse_id, code_type, normalized_code, entity_id)
             VALUES (?, 'RACK', ?, ?)`,
            [warehouseId, normalizedCode, ins.insertId]
          );

          updatedEntities.push({
            type: 'rack',
            id: ins.insertId,
            rack_code: normalizedCode,
            color_hex: rackData.color_hex || '#5c732b',
            version: 1,
            action: 'create',
          });
        } else if (action === 'retire' || action === 'delete') {
          await conn.query(
            'UPDATE racks SET retired_at = NOW(), version = version + 1 WHERE id = ? AND warehouse_id = ?',
            [id, warehouseId]
          );
          updatedEntities.push({
            type: 'rack',
            id,
            action: 'retire',
          });
        }
      } else if (entity === 'aisle') {
        if (action === 'create') {
          const aisleData = data || op;
          let normalizedCode = (aisleData.aisle_code || `A-${Date.now()}`).trim().toUpperCase();

          // Hindari konflik UNIQUE uq_aisles_code jika kode sudah pernah dipakai di gudang ini
          const [existing] = await conn.query(
            'SELECT id FROM aisles WHERE warehouse_id = ? AND aisle_code = ?',
            [warehouseId, normalizedCode]
          );
          if (existing.length > 0) {
            const prefix = normalizedCode.includes('-') ? normalizedCode.split('-')[0] : 'A';
            const [similar] = await conn.query(
              'SELECT aisle_code FROM aisles WHERE warehouse_id = ? AND aisle_code LIKE ?',
              [warehouseId, `${prefix}-%`]
            );
            const usedNumbers = similar.map((s) => {
              const m = s.aisle_code.match(/-(\d+)$/);
              return m ? parseInt(m[1], 10) : 0;
            });
            const nextIdx = (usedNumbers.length > 0 ? Math.max(...usedNumbers) : 0) + 1;
            normalizedCode = `${prefix}-${String(nextIdx).padStart(2, '0')}`;
          }

          const candidate = {
            x_mm: Number(aisleData.x_mm || 0),
            y_mm: Number(aisleData.y_mm || 0),
            length_mm: Number(aisleData.width_mm || 1500),
            depth_mm: Number(aisleData.length_mm || 5000),
            rotation: 0,
          };
          const boundCheck = LayoutValidationService.validateWarehouseBoundary(candidate, warehouse);
          if (!boundCheck.valid) {
            const err = new Error(boundCheck.conflict.message);
            err.code = boundCheck.conflict.code;
            err.status = 422;
            throw err;
          }

          const [ins] = await conn.query(
            `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm, direction)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              warehouseId,
              normalizedCode,
              (aisleData.name || normalizedCode).trim(),
              candidate.x_mm,
              candidate.y_mm,
              candidate.length_mm,
              candidate.depth_mm,
              aisleData.direction || 'two_way',
            ]
          );
          updatedEntities.push({
            type: 'aisle',
            id: ins.insertId,
            aisle_code: normalizedCode,
            action: 'create',
          });
        } else if (action === 'move' || action === 'update') {
          const newX = data?.x_mm !== undefined ? Number(data.x_mm) : op.x_mm !== undefined ? Number(op.x_mm) : undefined;
          const newY = data?.y_mm !== undefined ? Number(data.y_mm) : op.y_mm !== undefined ? Number(op.y_mm) : undefined;
          const newWidth = data?.width_mm !== undefined ? Number(data.width_mm) : undefined;
          const newLength = data?.length_mm !== undefined ? Number(data.length_mm) : undefined;

          const [aisleRows] = await conn.query(
            'SELECT * FROM aisles WHERE id = ? AND warehouse_id = ? AND retired_at IS NULL',
            [id, warehouseId]
          );
          if (aisleRows.length > 0) {
            const currentAisle = aisleRows[0];
            const candidate = {
              x_mm: newX !== undefined ? newX : currentAisle.x_mm,
              y_mm: newY !== undefined ? newY : currentAisle.y_mm,
              length_mm: newWidth !== undefined ? newWidth : currentAisle.width_mm,
              depth_mm: newLength !== undefined ? newLength : currentAisle.length_mm,
              rotation: 0,
            };
            const boundCheck = LayoutValidationService.validateWarehouseBoundary(candidate, warehouse);
            if (!boundCheck.valid) {
              const err = new Error(boundCheck.conflict.message);
              err.code = boundCheck.conflict.code;
              err.status = 422;
              throw err;
            }
          }

          await conn.query(
            `UPDATE aisles
             SET x_mm = COALESCE(?, x_mm),
                 y_mm = COALESCE(?, y_mm),
                 width_mm = COALESCE(?, width_mm),
                 length_mm = COALESCE(?, length_mm)
             WHERE id = ? AND warehouse_id = ? AND retired_at IS NULL`,
            [newX, newY, newWidth, newLength, id, warehouseId]
          );
          updatedEntities.push({
            type: 'aisle',
            id,
            action,
          });
        } else if (action === 'retire' || action === 'delete') {
          await conn.query(
            'UPDATE aisles SET retired_at = NOW() WHERE id = ? AND warehouse_id = ?',
            [id, warehouseId]
          );
          updatedEntities.push({
            type: 'aisle',
            id,
            action: 'retire',
          });
        }
      } else if (entity === 'layout_object') {
        if (action === 'create') {
          const objData = data || op;
          const candidate = {
            x_mm: Number(objData.x_mm || 0),
            y_mm: Number(objData.y_mm || 0),
            length_mm: Number(objData.width_mm || 3000),
            depth_mm: Number(objData.length_mm || 500),
            rotation: Number(objData.rotation || 0),
          };
          const boundCheck = LayoutValidationService.validateWarehouseBoundary(candidate, warehouse);
          if (!boundCheck.valid) {
            const err = new Error(boundCheck.conflict.message);
            err.code = boundCheck.conflict.code;
            err.status = 422;
            throw err;
          }

          const [ins] = await conn.query(
            `INSERT INTO layout_objects (warehouse_id, object_type, name, x_mm, y_mm, width_mm, length_mm, height_mm, rotation, clearance_mm)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              warehouseId,
              objData.object_type || 'door_entry',
              (objData.name || 'Aset Gudang').trim(),
              candidate.x_mm,
              candidate.y_mm,
              candidate.length_mm,
              candidate.depth_mm,
              objData.height_mm ? Number(objData.height_mm) : 2500,
              candidate.rotation,
              Number(objData.clearance_mm || 500),
            ]
          );
          updatedEntities.push({
            type: 'layout_object',
            id: ins.insertId,
            name: objData.name,
            object_type: objData.object_type,
            action: 'create',
          });
        } else if (action === 'move' || action === 'update') {
          const newX = data?.x_mm !== undefined ? Number(data.x_mm) : op.x_mm !== undefined ? Number(op.x_mm) : undefined;
          const newY = data?.y_mm !== undefined ? Number(data.y_mm) : op.y_mm !== undefined ? Number(op.y_mm) : undefined;
          const newWidth = data?.width_mm !== undefined ? Number(data.width_mm) : undefined;
          const newLength = data?.length_mm !== undefined ? Number(data.length_mm) : undefined;
          const newHeight = data?.height_mm !== undefined ? Number(data.height_mm) : undefined;
          const newRotation = data?.rotation !== undefined ? Number(data.rotation) : undefined;

          const [objRows] = await conn.query(
            'SELECT * FROM layout_objects WHERE id = ? AND warehouse_id = ?',
            [id, warehouseId]
          );
          if (objRows.length > 0) {
            const currentObj = objRows[0];
            const candidate = {
              x_mm: newX !== undefined ? newX : currentObj.x_mm,
              y_mm: newY !== undefined ? newY : currentObj.y_mm,
              length_mm: newWidth !== undefined ? newWidth : currentObj.width_mm,
              depth_mm: newLength !== undefined ? newLength : currentObj.length_mm,
              rotation: newRotation !== undefined ? newRotation : currentObj.rotation,
            };
            const boundCheck = LayoutValidationService.validateWarehouseBoundary(candidate, warehouse);
            if (!boundCheck.valid) {
              const err = new Error(boundCheck.conflict.message);
              err.code = boundCheck.conflict.code;
              err.status = 422;
              throw err;
            }
          }

          await conn.query(
            `UPDATE layout_objects
             SET x_mm = COALESCE(?, x_mm),
                 y_mm = COALESCE(?, y_mm),
                 width_mm = COALESCE(?, width_mm),
                 length_mm = COALESCE(?, length_mm),
                 height_mm = COALESCE(?, height_mm),
                 rotation = COALESCE(?, rotation)
             WHERE id = ? AND warehouse_id = ?`,
            [newX, newY, newWidth, newLength, newHeight, newRotation, id, warehouseId]
          );
          updatedEntities.push({
            type: 'layout_object',
            id,
            action,
          });
        } else if (action === 'retire' || action === 'delete') {
          await conn.query(
            'DELETE FROM layout_objects WHERE id = ? AND warehouse_id = ?',
            [id, warehouseId]
          );
          updatedEntities.push({
            type: 'layout_object',
            id,
            action: 'delete',
          });
        }
      }
    }

    // 4. Naikkan versi layout gudang secara atomik
    const newLayoutVersion = warehouse.layout_version + 1;
    await conn.query('UPDATE warehouses SET layout_version = ? WHERE id = ?', [
      newLayoutVersion,
      warehouseId,
    ]);

    return {
      newLayoutVersion,
      updatedEntities,
    };
  }
}

module.exports = BatchPatchService;
