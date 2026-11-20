/**
 * API Integration Test Suite for Rack Physical Structure (STEP 8)
 * Covers: AC-06, AC-07, AC-08, AC-09, AC-16, AC-24.
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

describe('STEP 8: Rack Physical Structure & Matrix (AC-06, AC-07, AC-08, AC-09, AC-16, AC-24)', () => {
  before(async () => {
    const secret = process.env.JWT_SECRET || 'susuno_secret_jwt_key_2026_8h';
    managerToken = jwt.sign({ id: 1, role: 'manager' }, secret, { expiresIn: '1h' });
    staffToken = jwt.sign({ id: 8, role: 'staf' }, secret, { expiresIn: '1h' });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Buat data master warehouse & zone untuk pengujian
    const [wh] = await db.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES ('WH-STRUCT-TEST', 'Warehouse Structure Test', 30000, 30000, 8000, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    testWarehouseId = wh.insertId;

    const [z] = await db.query(
      `INSERT INTO zones (warehouse_id, zone_code, name, color_hex, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'ZONE-STR', 'Zone Structure', '#5c732b', 0, 0, 15000, 15000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWarehouseId]
    );
    testZoneId = z.insertId;

    // Bersihkan rak pengujian lama
    await db.query(
      'DELETE FROM rack_bay_level_configs WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)',
      [testWarehouseId]
    );
    await db.query(
      'DELETE FROM rack_bays WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)',
      [testWarehouseId]
    );
    await db.query(
      'DELETE FROM rack_levels WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)',
      [testWarehouseId]
    );
    await db.query('DELETE FROM racks WHERE warehouse_id = ?', [testWarehouseId]);

    // Buat 1 rak master (Length: 2400 mm, Depth: 1000 mm, Height: 4000 mm)
    const [r] = await db.query(
      `INSERT INTO racks (warehouse_id, zone_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation, version)
       VALUES (?, ?, 'RACK-STR-01', 2000, 2000, 2400, 1000, 4000, 0, 1)`,
      [testWarehouseId, testZoneId]
    );
    testRackId = r.insertId;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.end();
  });

  test('AC-16: Staf tanpa wewenang location.configure ditolak saat memodifikasi struktur rak (HTTP 403)', async () => {
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        bays: [{ bay_number: 1, width_mm: 2400 }],
        levels: [{ level_number: 1, height_from_floor_mm: 0 }],
        configs: [{ bay_number: 1, level_number: 1, position_count: 2 }],
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'PERMISSION_DENIED');
  });

  test('AC-06: PUT struktur rak dengan total lebar bay tidak sama dengan panjang rak ditolak (HTTP 422 RACK_BAY_WIDTH_MISMATCH)', async () => {
    // Panjang rak = 2400 mm, tapi total lebar bay dikirim = 1000 + 1000 = 2000 mm (selisih 400 mm > 5 mm toleransi)
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        bays: [
          { bay_number: 1, width_mm: 1000 },
          { bay_number: 2, width_mm: 1000 },
        ],
        levels: [{ level_number: 1, height_from_floor_mm: 0 }],
        configs: [{ bay_number: 1, level_number: 1, position_count: 1 }],
      },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'RACK_BAY_WIDTH_MISMATCH');
    assert.equal(res.body.details.rackLengthMm, 2400);
    assert.equal(res.body.details.totalBayWidthMm, 2000);
    assert.equal(res.body.details.differenceMm, 400);
  });

  test('AC-07: PUT struktur rak dengan level teratas + clearance melebihi tinggi rak ditolak (HTTP 422 RACK_LEVEL_HEIGHT_INVALID)', async () => {
    // Tinggi rak = 4000 mm, tapi level teratas dikirim di 3800 mm + 300 mm clearance = 4100 mm > 4000 mm
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        bays: [{ bay_number: 1, width_mm: 2400 }],
        levels: [
          { level_number: 1, height_from_floor_mm: 0 },
          { level_number: 2, height_from_floor_mm: 3800 },
        ],
        configs: [
          { bay_number: 1, level_number: 1, position_count: 2 },
          { bay_number: 1, level_number: 2, position_count: 2 },
        ],
      },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'RACK_LEVEL_HEIGHT_INVALID');
  });

  test('AC-07: PUT struktur rak dengan ketinggian level tidak naik ketat ditolak (HTTP 422)', async () => {
    // Level 2 memiliki ketinggian lebih rendah daripada level 1 (500 mm <= 1000 mm)
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        bays: [{ bay_number: 1, width_mm: 2400 }],
        levels: [
          { level_number: 1, height_from_floor_mm: 1000 },
          { level_number: 2, height_from_floor_mm: 500 },
        ],
        configs: [
          { bay_number: 1, level_number: 1, position_count: 2 },
          { bay_number: 1, level_number: 2, position_count: 2 },
        ],
      },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'RACK_LEVEL_HEIGHT_INVALID');
  });

  test('AC-08: PUT struktur rak dengan position_count <= 0 ditolak (HTTP 422 INVALID_POSITION_COUNT)', async () => {
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        bays: [{ bay_number: 1, width_mm: 2400 }],
        levels: [{ level_number: 1, height_from_floor_mm: 0 }],
        configs: [{ bay_number: 1, level_number: 1, position_count: 0 }],
      },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'INVALID_POSITION_COUNT');
  });

  test('AC-09: POST preview diff menghitung delta proyeksi tanpa memodifikasi basis data', async () => {
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/structure/preview`, {
      method: 'POST',
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
          { bay_number: 1, level_number: 1, position_count: 2 },
          { bay_number: 1, level_number: 2, position_count: 2 },
          { bay_number: 2, level_number: 1, position_count: 3 },
          { bay_number: 2, level_number: 2, position_count: 3 },
        ],
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.projected.bays_count, 2);
    assert.equal(res.body.data.projected.levels_count, 2);
    assert.equal(res.body.data.projected.locations_count, 10); // 2 + 2 + 3 + 3 = 10

    // Pastikan database BELUM termutasi (preview bersifat read-only)
    const [baysInDb] = await db.query('SELECT COUNT(*) as count FROM rack_bays WHERE rack_id = ?', [testRackId]);
    assert.equal(baysInDb[0].count, 0, 'Database belum termutasi oleh preview');
  });

  test('AC-24: PUT konfigurasi valid berhasil secara atomik di dalam transaksi InnoDB (HTTP 200)', async () => {
    // 2 bays (1200 + 1200 = 2400 mm), 3 levels (0, 1200, 2400 mm), 6 configs (masing-masing 2 posisi)
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        bays: [
          { bay_number: 1, width_mm: 1200 },
          { bay_number: 2, width_mm: 1200 },
        ],
        levels: [
          { level_number: 1, height_from_floor_mm: 0, max_weight_kg: 500 },
          { level_number: 2, height_from_floor_mm: 1200, max_weight_kg: 500 },
          { level_number: 3, height_from_floor_mm: 2400, max_weight_kg: 300 },
        ],
        configs: [
          { bay_number: 1, level_number: 1, position_count: 2 },
          { bay_number: 1, level_number: 2, position_count: 2 },
          { bay_number: 1, level_number: 3, position_count: 2 },
          { bay_number: 2, level_number: 1, position_count: 2 },
          { bay_number: 2, level_number: 2, position_count: 2 },
          { bay_number: 2, level_number: 3, position_count: 2 },
        ],
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.summary.total_bays, 2);
    assert.equal(res.body.data.summary.total_levels, 3);
    assert.equal(res.body.data.summary.total_configs, 6);

    // Pastikan rack version naik dari 1 menjadi 2
    const [rackRows] = await db.query('SELECT version FROM racks WHERE id = ?', [testRackId]);
    assert.equal(rackRows[0].version, 2);

    // Pastikan relasi composite foreign key di DB konsisten
    const [cfgRows] = await db.query(
      'SELECT COUNT(*) as count FROM rack_bay_level_configs WHERE rack_id = ?',
      [testRackId]
    );
    assert.equal(cfgRows[0].count, 6);
  });

  test('GET /racks/:id/structure mengembalikan struktur lengkap dan ringkasan fisik rak', async () => {
    const res = await request(`/api/warehouse-layout/racks/${testRackId}/structure`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.rack.id, testRackId);
    assert.equal(res.body.data.bays.length, 2);
    assert.equal(res.body.data.levels.length, 3);
    assert.equal(res.body.data.configs.length, 6);
    assert.equal(res.body.data.summary.total_bays, 2);
    assert.equal(res.body.data.summary.total_levels, 3);
  });
});
