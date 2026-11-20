/**
 * API Integration Test Suite for Warehouse Layout CRUD & Geometry Validation
 * Tests directly against Express HTTP server endpoints.
 * Covers: AC-01, AC-02, AC-04, AC-05, AC-11, AC-16, AC-21, AC-27, AC-28.
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
let testAisle1Id;
let testAisle2Id;
let testWh2Id;
let testAisleWh2Id;

// Helper fetch wrapper
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

describe('Warehouse Layout API Endpoints (CRUD + Geometry Validation)', () => {
  before(async () => {
    // Generate JWT tokens
    const secret = process.env.JWT_SECRET || 'susuno_secret_jwt_key_2026_8h';
    managerToken = jwt.sign({ id: 1, role: 'manager' }, secret, { expiresIn: '1h' });
    staffToken = jwt.sign({ id: 8, role: 'staf' }, secret, { expiresIn: '1h' });

    // Setup ephemeral HTTP server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Buat data master warehouse uji di DB
    const [wh] = await db.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES ('WH-API-TEST', 'Warehouse API Test', 30000, 40000, 10000, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    testWarehouseId = wh.insertId;

    const [wh2] = await db.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES ('WH-API-DIFF', 'Warehouse Diff WH', 20000, 20000, 10000, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    testWh2Id = wh2.insertId;

    // Bersihkan sisa data sebelumnya jika ada
    await db.query('DELETE FROM rack_aisle_access WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWarehouseId]);
    await db.query('DELETE FROM storage_locations WHERE warehouse_id = ?', [testWarehouseId]);
    await db.query('DELETE FROM rack_bays WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWarehouseId]);
    await db.query('DELETE FROM rack_levels WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWarehouseId]);
    await db.query('DELETE FROM racks WHERE warehouse_id = ?', [testWarehouseId]);
    await db.query('DELETE FROM aisles WHERE warehouse_id IN (?, ?)', [testWarehouseId, testWh2Id]);
    await db.query('DELETE FROM zones WHERE warehouse_id = ?', [testWarehouseId]);
    await db.query('DELETE FROM code_registry WHERE warehouse_id IN (?, ?)', [testWarehouseId, testWh2Id]);

    // Buat zona di warehouse 1
    const [z] = await db.query(
      `INSERT INTO zones (warehouse_id, zone_code, name, color_hex, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'ZONE-API', 'Zone API', '#5c732b', 0, 0, 15000, 20000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWarehouseId]
    );
    testZoneId = z.insertId;

    // Buat lorong di warehouse 1 (Aisle 1 di X: 0..1500, Aisle 2 di X: 4500..6000)
    const [a1] = await db.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'AISLE-API-1', 'Aisle API 1', 0, 0, 1500, 10000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWarehouseId]
    );
    testAisle1Id = a1.insertId;

    const [a2] = await db.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'AISLE-API-2', 'Aisle API 2', 4500, 0, 1500, 10000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWarehouseId]
    );
    testAisle2Id = a2.insertId;

    // Buat lorong di warehouse 2
    const [aWh2] = await db.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'AISLE-DIFF-WH', 'Aisle Diff WH', 0, 0, 2000, 10000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWh2Id]
    );
    testAisleWh2Id = aWh2.insertId;
  });

  after(async () => {
    // Cleanup database
    try {
      await db.query('DELETE FROM rack_aisle_access WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWarehouseId]);
      await db.query('DELETE FROM storage_locations WHERE warehouse_id = ?', [testWarehouseId]);
      await db.query('DELETE FROM racks WHERE warehouse_id = ?', [testWarehouseId]);
      await db.query('DELETE FROM aisles WHERE warehouse_id IN (?, ?)', [testWarehouseId, testWh2Id]);
      await db.query('DELETE FROM zones WHERE warehouse_id = ?', [testWarehouseId]);
      await db.query('DELETE FROM code_registry WHERE warehouse_id IN (?, ?)', [testWarehouseId, testWh2Id]);
      await db.query('DELETE FROM warehouses WHERE id IN (?, ?)', [testWarehouseId, testWh2Id]);
    } catch (_) {}

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.end();
  });

  test('AC-16: Staf tanpa wewenang layout.edit ditolak saat membuat rak (HTTP 403)', async () => {
    const res = await request('/api/warehouse-layout/racks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        warehouse_id: testWarehouseId,
        rack_code: 'RACK-STAF-FAIL',
        x_mm: 500,
        y_mm: 500,
        length_mm: 2400,
        depth_mm: 1000,
        height_mm: 3000,
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'PERMISSION_DENIED');
    assert.match(res.body.message, /tidak memiliki izin 'layout.edit'/);
    assert.ok(res.body.requestId); // AC-27
  });

  test('AC-01 & AC-27: Manager berhasil membuat rak dalam batas & tanpa tabrakan (HTTP 201)', async () => {
    const res = await request('/api/warehouse-layout/racks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: testWarehouseId,
        zone_id: testZoneId,
        rack_code: 'RACK-01-OK',
        x_mm: 1800,
        y_mm: 1000,
        length_mm: 2400,
        depth_mm: 1000,
        height_mm: 3000,
        rotation: 0,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, 'Rak berhasil dibuat');
    assert.equal(res.body.rack_code, 'RACK-01-OK');
    assert.ok(res.body.rackId);
    assert.ok(res.body.requestId);
  });

  test('AC-02 & AC-27: Pembuatan rak yang overlap dengan rak lain ditolak (HTTP 409 GEOMETRY_CONFLICT)', async () => {
    // Rak overlap dengan RACK-01-OK di (1800..4200, 1000..2000)
    const res = await request('/api/warehouse-layout/racks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: testWarehouseId,
        rack_code: 'RACK-OVERLAP',
        x_mm: 2000, // Irisan positif dengan 1800..4200
        y_mm: 1200,
        length_mm: 2400,
        depth_mm: 1000,
        height_mm: 3000,
      },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'GEOMETRY_CONFLICT');
    assert.equal(res.body.conflictType, 'OVERLAP');
    assert.match(res.body.message, /Tabrakan dengan rak 'RACK-01-OK'/);
    assert.ok(res.body.requestId);
  });

  test('AC-04: Pembuatan rak yang keluar batas gudang ditolak (HTTP 422 OUT_OF_BOUNDS)', async () => {
    // Gudang berukuran width: 30000, length: 40000
    // Rak diposisikan di X: 29000 dengan length: 2400 -> total X = 31400 (melebihi 30000)
    const res = await request('/api/warehouse-layout/racks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: testWarehouseId,
        rack_code: 'RACK-OUT-BOUNDS',
        x_mm: 29000,
        y_mm: 1000,
        length_mm: 2400,
        depth_mm: 1000,
        height_mm: 3000,
        rotation: 0,
      },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'GEOMETRY_CONFLICT');
    assert.equal(res.body.conflictType, 'OUT_OF_BOUNDS');
    assert.match(res.body.message, /Entitas berada di luar batas gudang/);
  });

  test('AC-04: Pembuatan rak yang keluar batas setelah rotasi 90 derajat ditolak', async () => {
    // Rak di Y: 39000 dengan length: 2400, depth: 1000, rotasi 90
    // Saat rotasi 90, kedalaman fisik menjadi panjang Y = 2400. Y = 39000 + 2400 = 41400 > 40000 (keluar batas)
    const res = await request('/api/warehouse-layout/racks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: testWarehouseId,
        rack_code: 'RACK-ROT-OUT',
        x_mm: 5000,
        y_mm: 39000,
        length_mm: 2400,
        depth_mm: 1000,
        height_mm: 3000,
        rotation: 90,
      },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'GEOMETRY_CONFLICT');
    assert.equal(res.body.conflictType, 'OUT_OF_BOUNDS');
  });

  test('AC-05: Menghubungkan satu rak ke beberapa lorong dengan penanda primary eksplisit (HTTP 200)', async () => {
    // Ambil ID RACK-01-OK
    const [racks] = await db.query('SELECT id FROM racks WHERE rack_code = ?', ['RACK-01-OK']);
    const rackId = racks[0].id;

    const res = await request(`/api/warehouse-layout/racks/${rackId}/aisles`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        aisles: [
          { aisle_id: testAisle1Id, access_side: 'left', is_primary: true },
          { aisle_id: testAisle2Id, access_side: 'right', is_primary: false },
        ],
      },
    });

    assert.equal(res.status, 200);
    assert.match(res.body.message, /Akses lorong rak berhasil diperbarui/);

    // Verifikasi data di DB
    const [access] = await db.query('SELECT * FROM rack_aisle_access WHERE rack_id = ? ORDER BY aisle_id ASC', [rackId]);
    assert.equal(access.length, 2);
    assert.equal(access[0].is_primary, 1);
    assert.equal(access[1].is_primary, 0);
  });

  test('AC-21: Menghubungkan rak ke lorong dari gudang berbeda ditolak (HTTP 422)', async () => {
    const [racks] = await db.query('SELECT id FROM racks WHERE rack_code = ?', ['RACK-01-OK']);
    const rackId = racks[0].id;

    const res = await request(`/api/warehouse-layout/racks/${rackId}/aisles`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        aisles: [
          { aisle_id: testAisleWh2Id, access_side: 'left', is_primary: true }, // Aisle di Warehouse 2
        ],
      },
    });

    assert.equal(res.status, 422);
    assert.match(res.body.message, /berada di warehouse berbeda/);
  });

  test('AC-28: Menghapus lorong yang masih digunakan sebagai akses rak aktif ditolak (HTTP 409)', async () => {
    // testAisle1Id masih menjadi akses untuk RACK-01-OK
    const res = await request(`/api/warehouse-layout/aisles/${testAisle1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'RELATION_CONFLICT');
    assert.match(res.body.message, /Lorong tidak dapat dinonaktifkan\/dihapus karena masih menjadi akses/);
  });

  test('AC-11: Rak dengan riwayat inventori hanya di-retire (soft delete), bukan di-hard delete', async () => {
    const rackCode = `RACK-HIST-${Date.now()}`;
    const locCode = `LOC-HIST-${Date.now()}`;

    // Buat rak RACK-WITH-STOCK
    const createRes = await request('/api/warehouse-layout/racks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: testWarehouseId,
        rack_code: rackCode,
        x_mm: 8000,
        y_mm: 8000,
        length_mm: 2400,
        depth_mm: 1000,
        height_mm: 3000,
      },
    });
    assert.equal(createRes.status, 201);
    const rackId = createRes.body.rackId;

    // Buat bay, level, dan lokasi pada rak ini
    const [bay] = await db.query('INSERT INTO rack_bays (rack_id, bay_number, width_mm) VALUES (?, 1, 2400)', [rackId]);
    const [lvl] = await db.query('INSERT INTO rack_levels (rack_id, level_number, height_from_floor_mm) VALUES (?, 1, 300)', [rackId]);
    const [loc] = await db.query(
      `INSERT INTO storage_locations (warehouse_id, rack_id, bay_id, level_id, position_number, location_code)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [testWarehouseId, rackId, bay.insertId, lvl.insertId, locCode]
    );

    // Simulasikan riwayat inventori: tautkan product_id ke lokasi ini
    await db.query('UPDATE products SET location_id = ? WHERE id = 1', [loc.insertId]);

    // Sekarang lakukan DELETE pada rak
    const deleteRes = await request(`/api/warehouse-layout/racks/${rackId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.retired, true);
    assert.match(deleteRes.body.message, /RETIRED \(soft-delete, AC-11\)/);

    // Verifikasi di DB bahwa baris rak masih ada tetapi retired_at terisi
    const [checkRack] = await db.query('SELECT retired_at FROM racks WHERE id = ?', [rackId]);
    assert.equal(checkRack.length, 1);
    assert.ok(checkRack[0].retired_at !== null);

    // Reset product location_id
    await db.query('UPDATE products SET location_id = NULL WHERE id = 1');
  });
});
