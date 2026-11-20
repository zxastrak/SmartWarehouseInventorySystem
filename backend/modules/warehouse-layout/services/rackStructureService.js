/**
 * Rack Structure Service
 * Manages physical rack internal layout: Bays, Levels, and Position Count matrix.
 * Enforces structural integrity rules from layout-core (AC-06, AC-07, AC-08, AC-09, AC-24).
 */

const {
  validateBayWidths,
  validateLevels,
  validatePositionConfigs,
} = require('../../../../shared/layout-core/src/index');

class RackStructureService {
  /**
   * Retrieves full physical internal structure of a rack.
   *
   * @param {Object} conn - MySQL connection
   * @param {number} rackId
   * @returns {Promise<Object>}
   */
  static async getRackStructure(conn, rackId) {
    const [rackRows] = await conn.query(
      `SELECT r.id, r.warehouse_id, r.zone_id, r.rack_code, r.x_mm, r.y_mm,
              r.length_mm, r.depth_mm, r.height_mm, r.rotation, r.version, r.retired_at,
              w.name as warehouse_name
       FROM racks r
       JOIN warehouses w ON w.id = r.warehouse_id
       WHERE r.id = ?`,
      [rackId]
    );

    if (rackRows.length === 0) {
      const err = new Error(`Rak dengan ID ${rackId} tidak ditemukan.`);
      err.code = 'RESOURCE_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const rack = rackRows[0];

    // 1. Ambil bays
    const [bays] = await conn.query(
      `SELECT id, rack_id, bay_number, width_mm, retired_at
       FROM rack_bays
       WHERE rack_id = ? AND retired_at IS NULL
       ORDER BY bay_number ASC`,
      [rackId]
    );

    // 2. Ambil levels
    const [levels] = await conn.query(
      `SELECT id, rack_id, level_number, height_from_floor_mm, max_weight_kg, max_volume_m3, retired_at
       FROM rack_levels
       WHERE rack_id = ? AND retired_at IS NULL
       ORDER BY level_number ASC`,
      [rackId]
    );

    // 3. Ambil configs
    const [configs] = await conn.query(
      `SELECT c.id, c.rack_id, c.bay_id, c.level_id, c.position_count, c.last_issued_position_number,
              b.bay_number, l.level_number
       FROM rack_bay_level_configs c
       JOIN rack_bays b ON b.id = c.bay_id
       JOIN rack_levels l ON l.id = c.level_id
       WHERE c.rack_id = ? AND b.retired_at IS NULL AND l.retired_at IS NULL
       ORDER BY b.bay_number ASC, l.level_number ASC`,
      [rackId]
    );

    // 4. Hitung lokasi penyimpanan aktif yang sudah terdaftar
    const [locCountRows] = await conn.query(
      `SELECT COUNT(*) as active_locations
       FROM storage_locations
       WHERE rack_id = ? AND retired_at IS NULL`,
      [rackId]
    );

    const activeLocations = locCountRows[0]?.active_locations || 0;

    return {
      rack,
      bays,
      levels,
      configs,
      summary: {
        total_bays: bays.length,
        total_levels: levels.length,
        total_configs: configs.length,
        active_storage_locations: activeLocations,
      },
    };
  }

  /**
   * Previews the structural diff and projected locations without modifying the database (AC-09).
   *
   * @param {Object} conn - MySQL connection
   * @param {number} rackId
   * @param {Object} newStructure - { bays, levels, configs }
   * @returns {Promise<Object>}
   */
  static async previewDiff(conn, rackId, newStructure) {
    const current = await this.getRackStructure(conn, rackId);
    const { rack } = current;

    const { bays = [], levels = [], configs = [] } = newStructure;

    // 1. Validasi Bay Widths (AC-06)
    const bayWidths = bays.map((b) => b.width_mm);
    const bayVal = validateBayWidths(bayWidths, rack.length_mm, 5);
    if (!bayVal.valid) {
      const err = new Error(bayVal.message);
      err.code = 'RACK_BAY_WIDTH_MISMATCH';
      err.status = 422;
      err.details = {
        rackLengthMm: rack.length_mm,
        totalBayWidthMm: bayVal.totalBayWidth,
        differenceMm: bayVal.difference,
        toleranceMm: 5,
      };
      throw err;
    }

    // 2. Validasi Levels (AC-07)
    const levelVal = validateLevels(levels, rack.height_mm, 300);
    if (!levelVal.valid) {
      const err = new Error(levelVal.message);
      err.code = 'RACK_LEVEL_HEIGHT_INVALID';
      err.status = 422;
      err.details = {
        rackHeightMm: rack.height_mm,
        errors: levelVal.errors,
      };
      throw err;
    }

    // 3. Validasi Position Configs (AC-08)
    const posVal = validatePositionConfigs(configs);
    if (!posVal.valid) {
      const err = new Error(posVal.errors[0]);
      err.code = 'INVALID_POSITION_COUNT';
      err.status = 422;
      err.details = {
        errors: posVal.errors,
      };
      throw err;
    }

    // 4. Hitung proyeksi total lokasi
    let projectedLocations = 0;
    for (const c of configs) {
      projectedLocations += c.position_count;
    }

    const currentBayNumbers = new Set(current.bays.map((b) => b.bay_number));
    const newBayNumbers = new Set(bays.map((b) => b.bay_number));

    const currentLevelNumbers = new Set(current.levels.map((l) => l.level_number));
    const newLevelNumbers = new Set(levels.map((l) => l.level_number));

    const addedBays = bays.filter((b) => !currentBayNumbers.has(b.bay_number));
    const removedBays = current.bays.filter((b) => !newBayNumbers.has(b.bay_number));

    const addedLevels = levels.filter((l) => !currentLevelNumbers.has(l.level_number));
    const removedLevels = current.levels.filter((l) => !newLevelNumbers.has(l.level_number));

    return {
      rack: {
        id: rack.id,
        rack_code: rack.rack_code,
        length_mm: rack.length_mm,
        height_mm: rack.height_mm,
      },
      current: {
        bays_count: current.bays.length,
        levels_count: current.levels.length,
        locations_count: current.summary.active_storage_locations,
      },
      projected: {
        bays_count: bays.length,
        levels_count: levels.length,
        locations_count: projectedLocations,
      },
      diff: {
        delta_bays: bays.length - current.bays.length,
        delta_levels: levels.length - current.levels.length,
        delta_locations: projectedLocations - current.summary.active_storage_locations,
        added_bays: addedBays.map((b) => b.bay_number),
        removed_bays: removedBays.map((b) => b.bay_number),
        added_levels: addedLevels.map((l) => l.level_number),
        removed_levels: removedLevels.map((l) => l.level_number),
        requires_location_regeneration: true,
      },
    };
  }

  /**
   * Commits an atomic update to the rack's physical structure inside an InnoDB transaction (AC-24).
   *
   * @param {Object} conn - MySQL connection (inside transaction)
   * @param {number} rackId
   * @param {Object} newStructure - { bays, levels, configs }
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  static async updateRackStructure(conn, rackId, newStructure, user) {
    // 1. Kunci baris rak dengan FOR UPDATE untuk mencegah konkurensi (AC-24)
    const [rackRows] = await conn.query('SELECT * FROM racks WHERE id = ? FOR UPDATE', [rackId]);
    if (rackRows.length === 0) {
      const err = new Error(`Rak #${rackId} tidak ditemukan.`);
      err.code = 'RESOURCE_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    const rack = rackRows[0];

    const { bays = [], levels = [], configs = [] } = newStructure;

    // 2. Validasi struktural (AC-06, AC-07, AC-08)
    const bayVal = validateBayWidths(
      bays.map((b) => b.width_mm),
      rack.length_mm,
      5
    );
    if (!bayVal.valid) {
      const err = new Error(bayVal.message);
      err.code = 'RACK_BAY_WIDTH_MISMATCH';
      err.status = 422;
      err.details = {
        rackLengthMm: rack.length_mm,
        totalBayWidthMm: bayVal.totalBayWidth,
        differenceMm: bayVal.difference,
      };
      throw err;
    }

    const levelVal = validateLevels(levels, rack.height_mm, 300);
    if (!levelVal.valid) {
      const err = new Error(levelVal.message);
      err.code = 'RACK_LEVEL_HEIGHT_INVALID';
      err.status = 422;
      err.details = { errors: levelVal.errors };
      throw err;
    }

    const posVal = validatePositionConfigs(configs);
    if (!posVal.valid) {
      const err = new Error(posVal.errors[0]);
      err.code = 'INVALID_POSITION_COUNT';
      err.status = 422;
      err.details = { errors: posVal.errors };
      throw err;
    }

    // 3. Ambil data bay & level yang ada saat ini
    const [currBays] = await conn.query('SELECT * FROM rack_bays WHERE rack_id = ?', [rackId]);
    const [currLevels] = await conn.query('SELECT * FROM rack_levels WHERE rack_id = ?', [rackId]);

    const bayMap = new Map(currBays.map((b) => [b.bay_number, b]));
    const levelMap = new Map(currLevels.map((l) => [l.level_number, l]));

    // 4. Update / Insert Bays
    const activeBayIds = new Map(); // bay_number -> id
    for (const b of bays) {
      const existing = bayMap.get(b.bay_number);
      if (existing) {
        await conn.query(
          'UPDATE rack_bays SET width_mm = ?, retired_at = NULL WHERE id = ?',
          [b.width_mm, existing.id]
        );
        activeBayIds.set(b.bay_number, existing.id);
      } else {
        const [insertRes] = await conn.query(
          'INSERT INTO rack_bays (rack_id, bay_number, width_mm) VALUES (?, ?, ?)',
          [rackId, b.bay_number, b.width_mm]
        );
        activeBayIds.set(b.bay_number, insertRes.insertId);
      }
    }

    // Soft-retire bays yang tidak ada di konfigurasi baru
    const newBayNums = new Set(bays.map((b) => b.bay_number));
    for (const curr of currBays) {
      if (!newBayNums.has(curr.bay_number) && !curr.retired_at) {
        await conn.query('UPDATE rack_bays SET retired_at = NOW() WHERE id = ?', [curr.id]);
      }
    }

    // 5. Update / Insert Levels
    const activeLevelIds = new Map(); // level_number -> id
    for (const l of levels) {
      const existing = levelMap.get(l.level_number);
      const maxWeight = l.max_weight_kg !== undefined ? l.max_weight_kg : null;
      const maxVol = l.max_volume_m3 !== undefined ? l.max_volume_m3 : null;

      if (existing) {
        await conn.query(
          `UPDATE rack_levels
           SET height_from_floor_mm = ?, max_weight_kg = ?, max_volume_m3 = ?, retired_at = NULL
           WHERE id = ?`,
          [l.height_from_floor_mm, maxWeight, maxVol, existing.id]
        );
        activeLevelIds.set(l.level_number, existing.id);
      } else {
        const [insertRes] = await conn.query(
          `INSERT INTO rack_levels (rack_id, level_number, height_from_floor_mm, max_weight_kg, max_volume_m3)
           VALUES (?, ?, ?, ?, ?)`,
          [rackId, l.level_number, l.height_from_floor_mm, maxWeight, maxVol]
        );
        activeLevelIds.set(l.level_number, insertRes.insertId);
      }
    }

    // Soft-retire levels yang tidak ada di konfigurasi baru
    const newLevelNums = new Set(levels.map((l) => l.level_number));
    for (const curr of currLevels) {
      if (!newLevelNums.has(curr.level_number) && !curr.retired_at) {
        await conn.query('UPDATE rack_levels SET retired_at = NOW() WHERE id = ?', [curr.id]);
      }
    }

    // 6. Update / Upsert `rack_bay_level_configs`
    for (const c of configs) {
      const bayId = activeBayIds.get(c.bay_number);
      const levelId = activeLevelIds.get(c.level_number);

      if (!bayId || !levelId) {
        continue;
      }

      await conn.query(
        `INSERT INTO rack_bay_level_configs
           (rack_id, bay_id, level_id, position_count, last_issued_position_number)
         VALUES (?, ?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE position_count = VALUES(position_count)`,
        [rackId, bayId, levelId, c.position_count]
      );
    }

    // 7. Increment version pada tabel racks
    await conn.query('UPDATE racks SET version = version + 1 WHERE id = ?', [rackId]);

    // 8. Ambil snapshot struktur terbarui
    return await this.getRackStructure(conn, rackId);
  }
}

module.exports = RackStructureService;
