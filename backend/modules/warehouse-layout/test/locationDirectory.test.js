/**
 * Integration Test Suite for Location Directory & Inspector (STEP 12)
 * Covers: AC-13 (Keyset pagination), AC-16 (RBAC), AC-17 (Navigation), AC-20 (Inventory disconnection), AC-26 (Performance).
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../../../server');
const db = require('../../../config/db');
const runLargeSeed = require('../scripts/seedLarge');

let server;
let baseUrl;
let staffToken;
let managerToken;
let perfWarehouseId;
let testLocationId;
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

describe('STEP 12: Location Directory & Inspector (AC-13, AC-16, AC-17, AC-20, AC-26)', () => {
  before(async () => {
    const secret = process.env.JWT_SECRET || 'susuno_secret_jwt_key_2026_8h';
    managerToken = jwt.sign({ id: 1, role: 'manager' }, secret, { expiresIn: '1h' });
    staffToken = jwt.sign({ id: 8, role: 'staf' }, secret, { expiresIn: '1h' });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Temukan ID warehouse benchmark (atau jalankan seed jika belum ada)
    let [[wh]] = await db.query("SELECT id FROM warehouses WHERE code = 'WH-PERF-500'");
    if (!wh) {
      await runLargeSeed();
      const [[newWh]] = await db.query("SELECT id FROM warehouses WHERE code = 'WH-PERF-500'");
      wh = newWh;
    }
    perfWarehouseId = wh.id;

    const [[loc]] = await db.query('SELECT id, rack_id FROM storage_locations WHERE warehouse_id = ? LIMIT 1', [perfWarehouseId]);
    testLocationId = loc ? loc.id : 1;
    testRackId = loc ? loc.rack_id : 1;

    // Warm-up query & connection
    await request(`/api/warehouse-layout/warehouses/${perfWarehouseId}/locations/overview`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.end();
  });

  test('1. GET /warehouses/:id/locations/overview - Ringkasan metrik gudang (AC-20)', async () => {
    const res = await request(`/api/warehouse-layout/warehouses/${perfWarehouseId}/locations/overview`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.total_locations >= 99000);
    assert.ok(res.body.data.total_racks >= 500);
    assert.ok(typeof res.body.data.active_locations === 'number');
    assert.ok(typeof res.body.data.blocked_locations === 'number');
    assert.ok(typeof res.body.data.maintenance_locations === 'number');
  });

  test('2. GET /warehouses/:id/locations - Keyset Pagination Halaman Pertama (AC-13, AC-26)', async () => {
    const res = await request(`/api/warehouse-layout/warehouses/${perfWarehouseId}/locations?limit=50&with_total=true`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;
    assert.equal(data.locations.length, 50);
    assert.equal(data.has_more, true);
    assert.ok(data.next_cursor !== null);
    assert.ok(data.total_count >= 99000);
  });

  test('3. GET /warehouses/:id/locations - Keyset Pagination Halaman Kedua dengan Cursor', async () => {
    // Ambil halaman pertama untuk memperoleh next_cursor
    const res1 = await request(`/api/warehouse-layout/warehouses/${perfWarehouseId}/locations?limit=50`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const cursor = res1.body.data.next_cursor;
    assert.ok(cursor);

    // Ambil halaman kedua
    const start = performance.now();
    const res2 = await request(`/api/warehouse-layout/warehouses/${perfWarehouseId}/locations?limit=50&cursor=${encodeURIComponent(cursor)}`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const duration = performance.now() - start;

    assert.equal(res2.status, 200);
    const data2 = res2.body.data;
    assert.equal(data2.locations.length, 50);
    assert.equal(data2.total_count, null, 'Halaman cursor tidak perlu menghitung ulang total_count');

    // Pastikan kode lokasi halaman kedua berurutan setelah halaman pertama
    const lastLoc1 = res1.body.data.locations[49].location_code;
    const firstLoc2 = data2.locations[0].location_code;
    assert.ok(firstLoc2 > lastLoc1, `Halaman kedua (${firstLoc2}) harus setelah halaman pertama (${lastLoc1})`);
    assert.ok(duration < 300, `Durasi keyset page 2 (${duration.toFixed(2)} ms) harus < 300 ms`);
  });

  test('4. GET /warehouses/:id/locations - Prefix Search dengan Index (p95 < 300 ms)', async () => {
    const start = performance.now();
    const res = await request(`/api/warehouse-layout/warehouses/${perfWarehouseId}/locations?search=A-01-RACK-001`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const duration = performance.now() - start;

    assert.equal(res.status, 200);
    assert.ok(res.body.data.locations.length > 0);
    for (const loc of res.body.data.locations) {
      assert.ok(loc.location_code.startsWith('A-01-RACK-001'));
    }
    assert.ok(duration < 300, `Pencarian prefix (${duration.toFixed(2)} ms) harus < 300 ms`);
  });

  test('5. GET /warehouses/:id/locations - Filter Rack ID', async () => {
    const res = await request(`/api/warehouse-layout/warehouses/${perfWarehouseId}/locations?rack_id=${testRackId}&limit=20`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.locations.length > 0);
    for (const loc of res.body.data.locations) {
      assert.equal(loc.rack_id, testRackId);
    }
  });

  test('6. GET /locations/:id - Inspeksi Lokasi Lengkap & Status Inventori Terputus (AC-20)', async () => {
    const res = await request(`/api/warehouse-layout/locations/${testLocationId}`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const loc = res.body.data;
    assert.equal(loc.id, testLocationId);
    assert.ok(loc.location_code);
    assert.ok(loc.rack_code);
    assert.ok(loc.bay_number);
    assert.ok(loc.level_number);

    // Kriteria AC-20: Empty state inventori jelas, tidak ada data dummy
    assert.equal(loc.inventory.connected, false);
    assert.equal(loc.inventory.message, 'Belum terhubung ke inventori (Phase 3)');
    assert.deepEqual(loc.inventory.items, []);
  });

  test('7. PATCH /locations/:id/manual-status - Ditolak 403 untuk Peran Staf (AC-16)', async () => {
    const res = await request(`/api/warehouse-layout/locations/${testLocationId}/manual-status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { manual_status: 'BLOCKED', reason: 'Pemeliharaan rel' }
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'PERMISSION_DENIED');
  });

  test('8. PATCH /locations/:id/manual-status - Sukses Diperbarui oleh Manager & Masuk Audit Log', async () => {
    // 1. Ubah ke BLOCKED
    const resBlocked = await request(`/api/warehouse-layout/locations/${testLocationId}/manual-status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { manual_status: 'BLOCKED', reason: 'Uji inspeksi blokir' }
    });

    assert.equal(resBlocked.status, 200);
    assert.equal(resBlocked.body.data.manual_status, 'BLOCKED');

    // 2. Verifikasi di DB
    const [[dbLoc]] = await db.query('SELECT manual_status FROM storage_locations WHERE id = ?', [testLocationId]);
    assert.equal(dbLoc.manual_status, 'BLOCKED');

    // 3. Verifikasi Log Audit tercatat
    const [auditRows] = await db.query(
      "SELECT * FROM audit_logs WHERE table_affected = 'storage_locations' AND record_id = ? ORDER BY id DESC LIMIT 1",
      [testLocationId]
    );
    assert.ok(auditRows.length > 0);
    assert.equal(auditRows[0].action, 'UPDATE_LOCATION_STATUS_BLOCKED');

    // 4. Kembalikan ke ACTIVE
    const resActive = await request(`/api/warehouse-layout/locations/${testLocationId}/manual-status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { manual_status: 'ACTIVE', reason: 'Selesai uji coba' }
    });

    assert.equal(resActive.status, 200);
    assert.equal(resActive.body.data.manual_status, 'ACTIVE');
  });

  test('9. Benchmark Latensi Keyset Search p95 pada 99.000 Lokasi (AC-26)', async () => {
    const latencies = [];
    const samplePrefixes = ['A-01-RACK-001', 'A-01-RACK-010', 'A-01-RACK-050', 'A-01-RACK-100', 'A-01-RACK-200'];

    for (const prefix of samplePrefixes) {
      const start = performance.now();
      const res = await request(`/api/warehouse-layout/warehouses/${perfWarehouseId}/locations?search=${prefix}&limit=50`, {
        headers: { Authorization: `Bearer ${managerToken}` }
      });
      const dur = performance.now() - start;
      assert.equal(res.status, 200);
      latencies.push(dur);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    console.log(`\n    ⚡ Keyset Search Latencies (ms): ${latencies.map(l => l.toFixed(1)).join(', ')} | p95: ${p95.toFixed(1)} ms`);
    assert.ok(p95 < 300, `p95 Latensi (${p95.toFixed(2)} ms) harus di bawah target 300 ms`);
  });
});
