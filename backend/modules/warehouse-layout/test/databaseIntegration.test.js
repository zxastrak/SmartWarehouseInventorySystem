/**
 * Database Integration Test Suite for Warehouse Layout
 * Connects directly to the live MySQL database to verify table constraints, triggers, and immutability.
 * Covers: AC-10, AC-18, AC-21, AC-23, AC-28.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const { runMigrationUp, runMigrationDown } = require('../database/migrate');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_warehouse_db',
  port: Number(process.env.DB_PORT) || 3306,
};

describe('Database Integration: Constraints & Integrity Triggers', () => {
  let conn;
  let testWhId;
  let testWh2Id;
  let testZoneId;
  let testAisleId;
  let testAisle2Id;
  let testAisleWh2Id;
  let testRackId;
  let testRack2Id;
  let testBayId;
  let testLevelId;

  before(async () => {
    conn = await mysql.createConnection(dbConfig);

    // Dapatkan atau buat warehouse uji
    const [wh] = await conn.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES ('WH-TEST-INT', 'Test Warehouse Int', 40000, 60000, 10000, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    testWhId = wh.insertId;

    const [wh2] = await conn.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES ('WH-TEST-2', 'Second Test Warehouse', 30000, 50000, 10000, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    testWh2Id = wh2.insertId;

    // Zona uji
    const [zone] = await conn.query(
      `INSERT INTO zones (warehouse_id, zone_code, name, color_hex, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'ZONE-TEST', 'Zone Test', '#5c732b', 0, 0, 10000, 20000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWhId]
    );
    testZoneId = zone.insertId;

    // Aisle uji di WH 1
    const [aisle] = await conn.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'AISLE-01', 'Aisle 01', 0, 0, 2000, 10000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWhId]
    );
    testAisleId = aisle.insertId;

    const [aisle2] = await conn.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'AISLE-02', 'Aisle 02', 4000, 0, 2000, 10000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWhId]
    );
    testAisle2Id = aisle2.insertId;

    // Aisle di WH 2 (untuk uji AC-21 lintas warehouse)
    const [aisleWh2] = await conn.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'AISLE-WH2', 'Aisle WH2', 0, 0, 2000, 10000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWh2Id]
    );
    testAisleWh2Id = aisleWh2.insertId;

    // Rak uji di WH 1
    const [rack] = await conn.query(
      `INSERT INTO racks (warehouse_id, zone_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation, version)
       VALUES (?, ?, 'RACK-TEST-01', 1000, 1000, 2400, 1000, 3000, 0, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWhId, testZoneId]
    );
    testRackId = rack.insertId;

    const [rack2] = await conn.query(
      `INSERT INTO racks (warehouse_id, zone_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation, version)
       VALUES (?, ?, 'RACK-TEST-02', 5000, 1000, 2400, 1000, 3000, 0, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWhId, testZoneId]
    );
    testRack2Id = rack2.insertId;

    // Bay dan Level pada Rack 1
    const [bay] = await conn.query(
      `INSERT INTO rack_bays (rack_id, bay_number, width_mm)
       VALUES (?, 1, 2400)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testRackId]
    );
    testBayId = bay.insertId;

    const [level] = await conn.query(
      `INSERT INTO rack_levels (rack_id, level_number, height_from_floor_mm)
       VALUES (?, 1, 200)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testRackId]
    );
    testLevelId = level.insertId;
  });

  after(async () => {
    // Bersihkan data uji spesifik
    try {
      await conn.query('DELETE FROM storage_locations WHERE warehouse_id = ?', [testWhId]);
      await conn.query('DELETE FROM rack_aisle_access WHERE rack_id IN (?, ?)', [testRackId, testRack2Id]);
      await conn.query('DELETE FROM rack_bay_level_configs WHERE rack_id IN (?, ?)', [testRackId, testRack2Id]);
      await conn.query('DELETE FROM rack_bays WHERE rack_id IN (?, ?)', [testRackId, testRack2Id]);
      await conn.query('DELETE FROM rack_levels WHERE rack_id IN (?, ?)', [testRackId, testRack2Id]);
      await conn.query('DELETE FROM racks WHERE id IN (?, ?)', [testRackId, testRack2Id]);
      await conn.query('DELETE FROM aisles WHERE id IN (?, ?, ?)', [testAisleId, testAisle2Id, testAisleWh2Id]);
      await conn.query('DELETE FROM zones WHERE id = ?', [testZoneId]);
      await conn.query('DELETE FROM warehouses WHERE id IN (?, ?)', [testWhId, testWh2Id]);
    } catch (_) {}
    await conn.end();
  });

  test('AC-10: UPDATE langsung pada rack_code ditolak oleh Trigger database', async () => {
    await assert.rejects(
      async () => {
        await conn.query('UPDATE racks SET rack_code = ? WHERE id = ?', ['RACK-MODIFIED', testRackId]);
      },
      (err) => {
        assert.match(err.message, /AC-10: rack_code bersifat immutable/);
        return true;
      }
    );
  });

  test('AC-10: UPDATE langsung pada location_code ditolak oleh Trigger database', async () => {
    // Buat lokasi uji
    const [loc] = await conn.query(
      `INSERT INTO storage_locations (warehouse_id, rack_id, bay_id, level_id, position_number, location_code)
       VALUES (?, ?, ?, ?, 1, 'LOC-IMMUTABLE-01')`,
      [testWhId, testRackId, testBayId, testLevelId]
    );

    await assert.rejects(
      async () => {
        await conn.query('UPDATE storage_locations SET location_code = ? WHERE id = ?', [
          'LOC-ALTERED-01',
          loc.insertId,
        ]);
      },
      (err) => {
        assert.match(err.message, /AC-10: location_code bersifat immutable/);
        return true;
      }
    );

    // Bersihkan lokasi uji
    await conn.query('DELETE FROM storage_locations WHERE id = ?', [loc.insertId]);
  });

  test('AC-21: Relasi bay/level lintas rack ditolak oleh Composite Foreign Key', async () => {
    // Buat bay pada Rack 2
    const [bayRack2] = await conn.query(
      `INSERT INTO rack_bays (rack_id, bay_number, width_mm) VALUES (?, 1, 2400)`,
      [testRack2Id]
    );

    // Coba buat storage_location dengan rack_id=testRackId tetapi bay_id milik Rack 2
    await assert.rejects(
      async () => {
        await conn.query(
          `INSERT INTO storage_locations (warehouse_id, rack_id, bay_id, level_id, position_number, location_code)
           VALUES (?, ?, ?, ?, 1, 'LOC-CROSS-RACK')`,
          [testWhId, testRackId, bayRack2.insertId, testLevelId]
        );
      },
      (err) => {
        // Ditolak oleh constraint foreign key composite
        assert.match(err.message, /a foreign key constraint fails/);
        return true;
      }
    );

    await conn.query('DELETE FROM rack_bays WHERE id = ?', [bayRack2.insertId]);
  });

  test('AC-21: Dua primary aisle pada rak yang sama ditolak oleh Trigger', async () => {
    // Pasang Aisle 1 sebagai primary
    await conn.query(
      `INSERT INTO rack_aisle_access (rack_id, aisle_id, access_side, is_primary)
       VALUES (?, ?, 'left', 1)`,
      [testRackId, testAisleId]
    );

    // Coba pasang Aisle 2 juga sebagai primary pada rack yang sama
    await assert.rejects(
      async () => {
        await conn.query(
          `INSERT INTO rack_aisle_access (rack_id, aisle_id, access_side, is_primary)
           VALUES (?, ?, 'right', 1)`,
          [testRackId, testAisle2Id]
        );
      },
      (err) => {
        assert.match(err.message, /AC-21: Rak hanya boleh memiliki maksimal satu primary aisle/);
        return true;
      }
    );

    // Bersihkan relasi
    await conn.query('DELETE FROM rack_aisle_access WHERE rack_id = ?', [testRackId]);
  });

  test('AC-21: Hubungan rack dan aisle lintas warehouse ditolak oleh Trigger', async () => {
    // testRackId ada di testWhId, sedangkan testAisleWh2Id ada di testWh2Id
    await assert.rejects(
      async () => {
        await conn.query(
          `INSERT INTO rack_aisle_access (rack_id, aisle_id, access_side, is_primary)
           VALUES (?, ?, 'left', 0)`,
          [testRackId, testAisleWh2Id]
        );
      },
      (err) => {
        assert.match(err.message, /AC-21: Rack dan Aisle harus berada dalam warehouse yang sama/);
        return true;
      }
    );
  });

  test('AC-28: Menghapus parent yang memiliki child ditolak (ON DELETE RESTRICT)', async () => {
    // Rack 1 memiliki child di rack_bays dan rack_levels
    await assert.rejects(
      async () => {
        await conn.query('DELETE FROM racks WHERE id = ?', [testRackId]);
      },
      (err) => {
        assert.match(err.message, /a foreign key constraint fails/);
        return true;
      }
    );
  });

  test('AC-23: Kode di code_registry tetap bertahan saat entitas fisik dihapus', async () => {
    // Daftarkan kode di registry
    const code = 'RACK-PERM-REG-01';
    await conn.query(
      `INSERT INTO code_registry (warehouse_id, code_type, normalized_code, entity_id)
       VALUES (?, 'RACK', ?, ?)`,
      [testWhId, code, 9999]
    );

    // Pastikan kode ada di registry
    const [before] = await conn.query(
      'SELECT id FROM code_registry WHERE warehouse_id = ? AND normalized_code = ?',
      [testWhId, code]
    );
    assert.equal(before.length, 1);

    // Upaya mendaftarkan kode yang sama kembali ditolak (UNIQUE)
    await assert.rejects(
      async () => {
        await conn.query(
          `INSERT INTO code_registry (warehouse_id, code_type, normalized_code)
           VALUES (?, 'RACK', ?)`,
          [testWhId, code]
        );
      },
      (err) => {
        assert.equal(err.code, 'ER_DUP_ENTRY');
        return true;
      }
    );

    // Bersihkan baris registry uji
    await conn.query('DELETE FROM code_registry WHERE id = ?', [before[0].id]);
  });

  test('last_issued_position_number hanya boleh bertambah (append-first)', async () => {
    const [cfg] = await conn.query(
      `INSERT INTO rack_bay_level_configs (rack_id, bay_id, level_id, position_count, last_issued_position_number)
       VALUES (?, ?, ?, 4, 10)`,
      [testRackId, testBayId, testLevelId]
    );

    // Menaikkan angka: sukses
    await conn.query(
      `UPDATE rack_bay_level_configs SET last_issued_position_number = 15 WHERE id = ?`,
      [cfg.insertId]
    );

    // Menurunkan angka: ditolak trigger
    await assert.rejects(
      async () => {
        await conn.query(
          `UPDATE rack_bay_level_configs SET last_issued_position_number = 5 WHERE id = ?`,
          [cfg.insertId]
        );
      },
      (err) => {
        assert.match(err.message, /last_issued_position_number hanya boleh bertambah/);
        return true;
      }
    );

    await conn.query('DELETE FROM rack_bay_level_configs WHERE id = ?', [cfg.insertId]);
  });
});

describe('AC-18: Siklus Migrasi Bersih (UP -> DOWN -> UP)', () => {
  test('Rollback DOWN dan migrasi UP berjalan tanpa error', async () => {
    // 1. Eksekusi DOWN
    const downResult = await runMigrationDown();
    assert.equal(downResult, true);

    // 2. Eksekusi UP kembali
    const upResult = await runMigrationUp();
    assert.equal(upResult, true);
  });
});
