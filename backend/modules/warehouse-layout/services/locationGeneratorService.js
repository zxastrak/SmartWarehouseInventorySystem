/**
 * Location Generator Service (STEP 10)
 * Generates storage locations in bulk using customizable code patterns.
 * Enforces:
 * - Append-first expansion (AC-13): only generates new positions without altering existing ones.
 * - Code immutability (AC-10): generated location codes cannot be updated.
 * - Permanent registry (AC-23): all generated codes are registered in code_registry.
 * - Chunked inserts: batches of 5,000 rows to ensure high throughput.
 */

const {
  renderPattern,
  validatePattern,
  DEFAULT_PATTERN,
  normalizeCode,
} = require('../../../../shared/layout-core/src/index');

const CHUNK_SIZE = 5000;

class LocationGeneratorService {
  /**
   * Previews location generation without modifying the database.
   *
   * @param {Object} conn - MySQL Connection
   * @param {number} rackId
   * @param {Object} options - { pattern, separator }
   * @returns {Promise<Object>}
   */
  static async preview(conn, rackId, options = {}) {
    const pattern = options.pattern || DEFAULT_PATTERN;
    const separator = options.separator || '-';

    const patVal = validatePattern(pattern);
    if (!patVal.valid) {
      const err = new Error(
        `Pattern tidak valid. Token yang hilang: ${patVal.missingTokens.join(', ')}`
      );
      err.code = 'INVALID_PATTERN_FORMAT';
      err.status = 422;
      err.details = { pattern, missingTokens: patVal.missingTokens };
      throw err;
    }

    const { rack, configs, aisleCode } = await this._loadRackAndConfigs(conn, rackId);

    const plannedLocations = [];
    let alreadyIssuedCount = 0;

    for (const c of configs) {
      const startPos = c.last_issued_position_number + 1;
      const targetPos = c.position_count;

      alreadyIssuedCount += c.last_issued_position_number;

      if (targetPos >= startPos) {
        for (let p = startPos; p <= targetPos; p++) {
          const code = renderPattern(
            {
              aisle: aisleCode,
              rack: rack.rack_code,
              bay: c.bay_number,
              level: c.level_number,
              position: p,
            },
            pattern,
            separator
          );

          plannedLocations.push({
            bay_number: c.bay_number,
            level_number: c.level_number,
            position: p,
            code,
          });
        }
      }
    }

    return {
      rack_id: rack.id,
      rack_code: rack.rack_code,
      pattern_used: pattern,
      separator_used: separator,
      already_issued_count: alreadyIssuedCount,
      new_locations_count: plannedLocations.length,
      sample_codes: plannedLocations.slice(0, 10).map((l) => l.code),
    };
  }

  /**
   * Generates and commits storage locations using append-first expansion inside transaction (AC-10, AC-13, AC-23).
   *
   * @param {Object} conn - MySQL Connection (must be inside transaction)
   * @param {number} rackId
   * @param {Object} options - { pattern, separator, pattern_version }
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  static async generate(conn, rackId, options = {}, user) {
    const pattern = options.pattern || DEFAULT_PATTERN;
    const separator = options.separator || '-';
    const patternVersion = parseInt(options.pattern_version, 10) || 1;

    // 1. Validasi Pattern
    const patVal = validatePattern(pattern);
    if (!patVal.valid) {
      const err = new Error(
        `Pattern tidak valid. Token yang hilang: ${patVal.missingTokens.join(', ')}`
      );
      err.code = 'INVALID_PATTERN_FORMAT';
      err.status = 422;
      err.details = { pattern, missingTokens: patVal.missingTokens };
      throw err;
    }

    // 2. Kunci dan muat data rak serta konfigurasi
    const { rack, configs, aisleCode } = await this._loadRackAndConfigs(conn, rackId, true);

    const locationRowsBatch = [];
    const registryRowsBatch = [];
    const updatedConfigs = [];
    const generatedSampleCodes = [];

    // 3. Bangun baris lokasi secara append-first
    for (const c of configs) {
      const startPos = c.last_issued_position_number + 1;
      const targetPos = c.position_count;

      if (targetPos >= startPos) {
        for (let p = startPos; p <= targetPos; p++) {
          const locCode = renderPattern(
            {
              aisle: aisleCode,
              rack: rack.rack_code,
              bay: c.bay_number,
              level: c.level_number,
              position: p,
            },
            pattern,
            separator
          );

          // Hitung estimasi lebar per slot posisi
          const usableWidth = Math.max(100, Math.floor((c.bay_width - 60) / targetPos));
          const usableDepth = rack.depth_mm || 1000;
          const usableHeight = 800; // Standar clearance kompartemen
          const maxWeight = c.max_weight_kg ? parseFloat((c.max_weight_kg / targetPos).toFixed(2)) : null;
          const maxVolume = c.max_volume_m3 ? parseFloat((c.max_volume_m3 / targetPos).toFixed(4)) : null;

          locationRowsBatch.push([
            rack.warehouse_id,
            rack.id,
            c.bay_id,
            c.level_id,
            p,
            locCode,
            patternVersion,
            usableWidth,
            usableDepth,
            usableHeight,
            maxWeight,
            maxVolume,
            'ACTIVE',
          ]);

          registryRowsBatch.push([rack.warehouse_id, 'LOCATION', locCode, null]);

          if (generatedSampleCodes.length < 10) {
            generatedSampleCodes.push(locCode);
          }

          // Flush chunk jika mencapai CHUNK_SIZE
          if (locationRowsBatch.length >= CHUNK_SIZE) {
            await this._flushBatch(conn, locationRowsBatch, registryRowsBatch);
            locationRowsBatch.length = 0;
            registryRowsBatch.length = 0;
          }
        }

        updatedConfigs.push({
          config_id: c.config_id,
          new_last_issued: targetPos,
        });
      }
    }

    // Flush sisa baris terakhir
    if (locationRowsBatch.length > 0) {
      await this._flushBatch(conn, locationRowsBatch, registryRowsBatch);
    }

    // 4. Perbarui last_issued_position_number pada rack_bay_level_configs (AC-13)
    for (const uc of updatedConfigs) {
      await conn.query(
        'UPDATE rack_bay_level_configs SET last_issued_position_number = ? WHERE id = ?',
        [uc.new_last_issued, uc.config_id]
      );
    }

    // 5. Hitung total lokasi aktif saat ini
    const [totRows] = await conn.query(
      'SELECT COUNT(*) as count FROM storage_locations WHERE rack_id = ? AND retired_at IS NULL',
      [rackId]
    );

    return {
      rack_id: rack.id,
      rack_code: rack.rack_code,
      generated_count: generatedSampleCodes.length > 0 ? updatedConfigs.reduce((sum, u) => sum + (u.new_last_issued - (configs.find(c => c.config_id === u.config_id)?.last_issued_position_number || 0)), 0) : 0,
      total_active_locations: totRows[0]?.count || 0,
      sample_codes: generatedSampleCodes,
      pattern_used: pattern,
    };
  }

  /**
   * Helper to flush a chunk of location and registry rows
   */
  static async _flushBatch(conn, locationRows, registryRows) {
    if (locationRows.length === 0) return;

    try {
      // 1. Simpan ke storage_locations
      await conn.query(
        `INSERT INTO storage_locations
           (warehouse_id, rack_id, bay_id, level_id, position_number, location_code,
            pattern_version, usable_width_mm, usable_depth_mm, usable_height_mm,
            max_weight_kg, max_volume_m3, manual_status)
         VALUES ?`,
        [locationRows]
      );

      // 2. Daftarkan kode secara permanen ke code_registry (AC-23)
      await conn.query(
        `INSERT INTO code_registry (warehouse_id, code_type, normalized_code, entity_id)
         VALUES ?
         ON DUPLICATE KEY UPDATE entity_id = VALUES(entity_id)`,
        [registryRows]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        const customErr = new Error(
          `Gagal menerbitkan lokasi: ditemukan kode duplikat yang sudah terdaftar di warehouse (${err.sqlMessage}).`
        );
        customErr.code = 'DUPLICATE_LOCATION_CODE';
        customErr.status = 409;
        throw customErr;
      }
      throw err;
    }
  }

  /**
   * Helper to load rack, primary aisle, and bay-level configs
   */
  static async _loadRackAndConfigs(conn, rackId, forUpdate = false) {
    const lockClause = forUpdate ? ' FOR UPDATE' : '';

    const [rackRows] = await conn.query(
      `SELECT r.*, w.code as warehouse_code
       FROM racks r
       JOIN warehouses w ON w.id = r.warehouse_id
       WHERE r.id = ?${lockClause}`,
      [rackId]
    );

    if (rackRows.length === 0) {
      const err = new Error(`Rak #${rackId} tidak ditemukan.`);
      err.code = 'RESOURCE_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const rack = rackRows[0];

    // Ambil primary aisle jika ada
    const [aisleRows] = await conn.query(
      `SELECT a.aisle_code
       FROM rack_aisle_access raa
       JOIN aisles a ON a.id = raa.aisle_id
       WHERE raa.rack_id = ?
       ORDER BY raa.is_primary DESC, raa.id ASC
       LIMIT 1`,
      [rackId]
    );

    const aisleCode = aisleRows[0]?.aisle_code || 'A';

    // Ambil konfigurasi bay-level
    const [configs] = await conn.query(
      `SELECT c.id as config_id, c.bay_id, c.level_id, c.position_count, c.last_issued_position_number,
              b.bay_number, b.width_mm as bay_width,
              l.level_number, l.height_from_floor_mm, l.max_weight_kg, l.max_volume_m3
       FROM rack_bay_level_configs c
       JOIN rack_bays b ON b.id = c.bay_id
       JOIN rack_levels l ON l.id = c.level_id
       WHERE c.rack_id = ? AND b.retired_at IS NULL AND l.retired_at IS NULL
       ORDER BY b.bay_number ASC, l.level_number ASC${lockClause}`,
      [rackId]
    );

    return { rack, configs, aisleCode };
  }
}

module.exports = LocationGeneratorService;
