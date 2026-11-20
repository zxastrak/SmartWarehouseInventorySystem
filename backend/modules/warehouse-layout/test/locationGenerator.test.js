/**
 * Integration Test Suite for Bulk Location Generator (STEP 10)
 * Covers: AC-10 (Immutability), AC-13 (Append-First), AC-16 (RBAC), AC-23 (Code Registry), AC-24 (Transaction).
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../../../server');
const db = require('../../../config/db');

let server;
let baseUrl;
let staffToken;
let managerToken;
let testWarehouseId;
let testZoneId;
let testAisleId;
let testRackId;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return {
    status: response.status,
    headers: response.headers,
    body: json,
  };
}

describe('STEP 10: Bulk Location Generator & Pattern Expansion (AC-10, AC-13, AC-16, AC-23)', () => {
  before(async () => {
    const secret = process.env.JWT_SECRET || 'susuno_secret_jwt_key_2026_8h';
    managerToken = jwt.sign({ id: 1, role: 'manager' }, secret, { expiresIn: '1h' });
    staffToken = jwt.sign({ id: 8, role: 'staf' }, secret, { expiresIn: '1h' });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Buat warehouse & zone
    const [wh] = await db.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES ('WH-GEN-TEST', 'Warehouse Gen Test', 30000, 30000, 8000, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    testWarehouseId = wh.insertId;

    const [z] = await db.query(
      `INSERT INTO zones (warehouse_id, zone_code, name, color_hex, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'ZN-GEN', 'Zone Gen', '#5c732b', 0, 0, 15000, 15000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWarehouseId]
    );
    testZoneId = z.insertId;

    // 2. Buat lorong primer
    const [a] = await db.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'A01', 'Aisle 01', 1000, 1000, 2000, 10000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWarehouseId]
    );
    testAisleId = a.insertId;

    // Bersihkan rak pengujian lama
    await db.query('DELETE FROM storage_locations WHERE warehouse_id = ?', [testWarehouseId]);
    await db.query('DELETE FROM code_registry WHERE warehouse_id = ?', [testWarehouseId]);
    await db.query('DELETE FROM rack_bay_level_configs WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWarehouseId]);
    await db.query('DELETE FROM rack_bays WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWarehouseId]);
    await db.query('DELETE FROM rack_levels WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWarehouseId]);
    await db.query('DELETE FROM rack_aisle_access WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWarehouseId]);
    await db.query('DELETE FROM racks WHERE warehouse_id = ?', [testWarehouseId]);

    // 3. Buat rak master
    const [r] = await db.query(
      `INSERT INTO racks (warehouse_id, zone_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation, version)
       VALUES (?, ?, 'RK-01', 3500, 2000, 2400, 1000, 4000, 0, 1)`,
      [testWarehouseId, testZoneId]
    );
    testRackId = r.insertId;

    // Hubungkan primary aisle
    await db.query(
      'INSERT INTO rack_aisle_access (rack_id, aisle_id, access_side, is_primary) VALUES (?, ?, "left", 1)',
      [testRackId, testAisleId]
    );

    // 4. Siapkan konfigurasi struktur awal: 2 bays (1200 + 1200), 2 levels (0, 1500), masing-masing 2 posisi
    await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        bays: [
          { bay_number: 1, width_mm: 1200 },
          { bay_number: 2, width_mm: 1200 },
        ],
        levels: [
          { level_number: 1, height_from_floor_mm: 0, max_weight_kg: 500 },
          { level_number: 2, height_from_floor_mm: 1500, max_weight_kg: 500 },
        ],
        configs: [
          { bay_number: 1, level_number: 1, position_count: 2 },
          { bay_number: 1, level_number: 2, position_count: 2 },
          { bay_number: 2, level_number: 1, position_count: 2 },
          { bay_number: 2, level_number: 2, position_count: 2 },
        ],
      },
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.end();
  });

  test('AC-16: Staf tanpa wewenang location.configure ditolak saat generate lokasi (HTTP 403)', async () => {
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/generate-locations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        pattern: '{aisle}-{rack}-{bay}-{level}-{position}',
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'PERMISSION_DENIED');
  });

  test('Pola kode tidak valid (kurang token wajib) ditolak (HTTP 422 INVALID_PATTERN_FORMAT)', async () => {
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/generate-locations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        pattern: '{aisle}-{rack}-{bay}', // Kurang {level} dan {position}
      },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'INVALID_PATTERN_FORMAT');
    assert.ok(res.body.details.missingTokens.includes('{level}'));
    assert.ok(res.body.details.missingTokens.includes('{position}'));
  });

  test('Preview Generator menampilkan estimasi kode tanpa memodifikasi DB', async () => {
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/generate-locations/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        pattern: '{aisle}-{rack}-{bay}-{level}-{position}',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.new_locations_count, 8); // 2 bay * 2 level * 2 pos = 8
    assert.equal(res.body.data.sample_codes.length, 8);
    assert.equal(res.body.data.sample_codes[0], 'A01-RK-01-01-01-01');

    // Pastikan belum ada baris di DB
    const [rows] = await db.query('SELECT COUNT(*) as count FROM storage_locations WHERE rack_id = ?', [testRackId]);
    assert.equal(rows[0].count, 0);
  });

  test('AC-23 & AC-24: Generate awal menerbitkan 8 lokasi dan mendaftarkan ke code_registry (HTTP 201)', async () => {
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/generate-locations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        pattern: '{aisle}-{rack}-{bay}-{level}-{position}',
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.generated_count, 8);
    assert.equal(res.body.data.total_active_locations, 8);

    // 1. Verifikasi tabel storage_locations
    const [locRows] = await db.query(
      'SELECT location_code, position_number, manual_status FROM storage_locations WHERE rack_id = ? ORDER BY location_code ASC',
      [testRackId]
    );
    assert.equal(locRows.length, 8);
    assert.equal(locRows[0].location_code, 'A01-RK-01-01-01-01');
    assert.equal(locRows[0].manual_status, 'ACTIVE');

    // 2. Verifikasi tabel code_registry (AC-23)
    const [regRows] = await db.query(
      'SELECT normalized_code FROM code_registry WHERE warehouse_id = ? AND code_type = "LOCATION"',
      [testWarehouseId]
    );
    assert.equal(regRows.length, 8);

    // 3. Verifikasi last_issued_position_number pada configs terbarui ke 2
    const [cfgRows] = await db.query(
      'SELECT last_issued_position_number FROM rack_bay_level_configs WHERE rack_id = ?',
      [testRackId]
    );
    for (const c of cfgRows) {
      assert.equal(c.last_issued_position_number, 2);
    }
  });

  test('AC-13: Append-First Expansion saat position_count bertambah tanpa mengganggu lokasi lama', async () => {
    // Tambah position_count dari 2 menjadi 4 pada Bay 1, Level 1 (tambah 2 posisi: P3 dan P4)
    await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        bays: [
          { bay_number: 1, width_mm: 1200 },
          { bay_number: 2, width_mm: 1200 },
        ],
        levels: [
          { level_number: 1, height_from_floor_mm: 0 },
          { level_number: 2, height_from_floor_mm: 1500 },
        ],
        configs: [
          { bay_number: 1, level_number: 1, position_count: 4 }, // Naik ke 4!
          { bay_number: 1, level_number: 2, position_count: 2 },
          { bay_number: 2, level_number: 1, position_count: 2 },
          { bay_number: 2, level_number: 2, position_count: 2 },
        ],
      },
    });

    // Jalankan generator kembali
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/generate-locations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        pattern: '{aisle}-{rack}-{bay}-{level}-{position}',
      },
    });

    assert.equal(res.status, 201);
    // Hanya 2 lokasi baru yang diterbitkan (P3 dan P4 dari Bay 1 Level 1)
    assert.equal(res.body.data.generated_count, 2);
    assert.equal(res.body.data.total_active_locations, 10); // 8 + 2 = 10

    // Verifikasi bahwa kode lokasi baru adalah P3 dan P4
    const [newLocRows] = await db.query(
      `SELECT location_code, position_number
       FROM storage_locations
       WHERE rack_id = ? AND position_number IN (3, 4)
       ORDER BY position_number ASC`,
      [testRackId]
    );
    assert.equal(newLocRows.length, 2);
    assert.equal(newLocRows[0].location_code, 'A01-RK-01-01-01-03');
    assert.equal(newLocRows[1].location_code, 'A01-RK-01-01-01-04');
  });

  test('AC-10: Trigger basis data menolak UPDATE langsung pada location_code (Immutability)', async () => {
    const [locs] = await db.query('SELECT id, location_code FROM storage_locations WHERE rack_id = ? LIMIT 1', [testRackId]);
    const targetLoc = locs[0];

    await assert.rejects(
      async () => {
        await db.query('UPDATE storage_locations SET location_code = "ALTERED-CODE" WHERE id = ?', [targetLoc.id]);
      },
      (err) => {
        assert.ok(err.message.includes('AC-10: location_code bersifat immutable'));
        return true;
      }
    );
  });
});
