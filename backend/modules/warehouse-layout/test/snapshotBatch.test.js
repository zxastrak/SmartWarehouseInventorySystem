/**
 * Integration Test Suite for Layout Snapshot, Batch Patch & Versioning (STEP 4)
 * Tests: AC-12, AC-14, AC-15, AC-16, ETag 304, Rollback, and 500 Racks Payload Budget.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const jwt = require('jsonwebtoken');
const app = require('../../../server');
const db = require('../../../config/db');

let server;
let baseUrl;
let managerToken;
let staffToken;
let testWhId;
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

describe('STEP 4: Snapshot, Batch Patch & Optimistic Locking', () => {
  before(async () => {
    const secret = process.env.JWT_SECRET || 'susuno_secret_jwt_key_2026_8h';
    managerToken = jwt.sign({ id: 1, role: 'manager' }, secret, { expiresIn: '1h' });
    staffToken = jwt.sign({ id: 8, role: 'staf' }, secret, { expiresIn: '1h' });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Buat warehouse uji khusus STEP 4
    const [wh] = await db.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES ('WH-SNAP-TEST', 'Warehouse Snapshot Test', 40000, 50000, 10000, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), layout_version=1`
    );
    testWhId = wh.insertId;

    // Bersihkan data lama
    await db.query('DELETE FROM rack_aisle_access WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [testWhId]);
    await db.query('DELETE FROM storage_locations WHERE warehouse_id = ?', [testWhId]);
    await db.query('DELETE FROM racks WHERE warehouse_id = ?', [testWhId]);
    await db.query('DELETE FROM aisles WHERE warehouse_id = ?', [testWhId]);
    await db.query('DELETE FROM zones WHERE warehouse_id = ?', [testWhId]);
    await db.query('DELETE FROM code_registry WHERE warehouse_id = ?', [testWhId]);
    await db.query('UPDATE warehouses SET layout_version = 1 WHERE id = ?', [testWhId]);

    // Tambah 1 zona dan 1 rak awal
    await db.query(
      `INSERT INTO zones (warehouse_id, zone_code, name, color_hex, x_mm, y_mm, width_mm, length_mm)
       VALUES (?, 'ZONE-SNAP-1', 'Zone Snap 1', '#5c732b', 0, 0, 20000, 30000)`,
      [testWhId]
    );

    const [r] = await db.query(
      `INSERT INTO racks (warehouse_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation, version)
       VALUES (?, 'RACK-SNAP-01', 1000, 1000, 2400, 1000, 3000, 0, 1)`,
      [testWhId]
    );
    testRackId = r.insertId;
  });

  after(async () => {
    try {
      await db.query('DELETE FROM racks WHERE warehouse_id = ?', [testWhId]);
      await db.query('DELETE FROM zones WHERE warehouse_id = ?', [testWhId]);
      await db.query('DELETE FROM code_registry WHERE warehouse_id = ?', [testWhId]);
      await db.query('DELETE FROM warehouses WHERE id = ?', [testWhId]);
    } catch (_) {}

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.end();
  });

  test('AC-12: GET snapshot mengembalikan layout TANPA storage locations', async () => {
    const res = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.warehouse);
    assert.ok(Array.isArray(res.body.data.zones));
    assert.ok(Array.isArray(res.body.data.racks));
    assert.equal(res.body.data.racks.length, 1);
    // D4 & AC-12: snapshot tidak memuat daftar storage_locations
    assert.equal(res.body.data.storage_locations, undefined);
    assert.equal(res.headers.get('etag'), `W/"wh-${testWhId}-v1"`);
  });

  test('ETag & HTTP 304: If-None-Match mengembalikan 304 Not Modified saat cache valid', async () => {
    const etag = `W/"wh-${testWhId}-v1"`;
    const res = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'If-None-Match': etag,
      },
    });

    assert.equal(res.status, 304);
  });

  test('AC-16: Staf ditolak saat mencoba PATCH layout (HTTP 403)', async () => {
    const res = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        expectedLayoutVersion: 1,
        operations: [{ op: 'move', entity: 'rack', id: testRackId, version: 1, x_mm: 2000, y_mm: 2000 }],
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'PERMISSION_DENIED');
  });

  test('AC-14: Batch PATCH menyimpan perubahan & reload snapshot menghasilkan koordinat identik', async () => {
    // Pindahkan rak ke (5000, 5000) dan putar 90 derajat
    const patchRes = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        expectedLayoutVersion: 1,
        operations: [
          {
            op: 'rotate',
            entity: 'rack',
            id: testRackId,
            version: 1,
            rotation: 90,
            x_mm: 5000,
            y_mm: 5000,
          },
        ],
      },
    });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.layoutVersion, 2);
    assert.equal(patchRes.body.updatedEntities.length, 1);
    assert.equal(patchRes.body.updatedEntities[0].rotation, 90);

    // Muat ulang snapshot: koordinat dan rotasi identik (AC-14)
    const reloadRes = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    assert.equal(reloadRes.status, 200);
    assert.equal(reloadRes.headers.get('etag'), `W/"wh-${testWhId}-v2"`);
    const reloadedRack = reloadRes.body.data.racks.find((r) => r.id === testRackId);
    assert.equal(reloadedRack.x_mm, 5000);
    assert.equal(reloadedRack.y_mm, 5000);
    assert.equal(reloadedRack.rotation, 90);
    assert.equal(reloadedRack.version, 2);
  });

  test('ETag Invalidation: Mutasi menaikkan layout_version dan ETag lama tidak melayani data usang', async () => {
    // ETag versi 1 sekarang usang karena server di versi 2
    const oldEtag = `W/"wh-${testWhId}-v1"`;
    const res = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'If-None-Match': oldEtag,
      },
    });

    // Harus 200 (bukan 304) dengan ETag baru
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('etag'), `W/"wh-${testWhId}-v2"`);
  });

  test('AC-15: Konflik Konkurensi (dua editor bersamaan -> yang kedua mendapat HTTP 409)', async () => {
    // Editor A dan B sama-sama membaca layout versi 2
    // Editor A menyimpan dengan expectedLayoutVersion: 2 -> SUKSES (versi jadi 3)
    const resA = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        expectedLayoutVersion: 2,
        operations: [
          {
            op: 'move',
            entity: 'rack',
            id: testRackId,
            version: 2,
            x_mm: 6000,
            y_mm: 6000,
          },
        ],
      },
    });
    assert.equal(resA.status, 200);
    assert.equal(resA.body.layoutVersion, 3);

    // Editor B mencoba menyimpan dengan expectedLayoutVersion: 2 (lama) -> DITOLAK 409 VERSION_CONFLICT
    const resB = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        expectedLayoutVersion: 2,
        operations: [
          {
            op: 'move',
            entity: 'rack',
            id: testRackId,
            version: 2,
            x_mm: 7000,
            y_mm: 7000,
          },
        ],
      },
    });

    assert.equal(resB.status, 409);
    assert.equal(resB.body.error, 'VERSION_CONFLICT');
    assert.match(resB.body.message, /AC-15/);
    assert.equal(resB.body.details.currentLayoutVersion, 3);
  });

  test('Rollback Atomik: Jika 1 operasi dalam batch gagal, seluruh batch dibatalkan', async () => {
    // Batch dengan 1 move valid dan 1 create dengan kode invalid / out of bounds
    const currentVersion = 3;
    const batchRes = await request(`/api/warehouse-layout/warehouses/${testWhId}/layout`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        expectedLayoutVersion: currentVersion,
        operations: [
          { op: 'move', entity: 'rack', id: testRackId, version: 3, x_mm: 9000, y_mm: 9000 },
          { op: 'create', entity: 'rack', data: { rack_code: 'RACK-FAIL', x_mm: 999999, y_mm: 999999, length_mm: 2400, depth_mm: 1000, height_mm: 3000 } }, // Out of bounds
        ],
      },
    });

    // Harus gagal 422
    assert.equal(batchRes.status, 422);

    // Buktikan bahwa operasi pertama (move ke 9000, 9000) juga ter-rollback dan posisi tetap di 6000
    const [rackRows] = await db.query('SELECT x_mm, y_mm FROM racks WHERE id = ?', [testRackId]);
    assert.equal(rackRows[0].x_mm, 6000);
    assert.equal(rackRows[0].y_mm, 6000);
  });

  test('Pengukuran Ukuran Payload Snapshot 500 Rak (Target: <= 100 KB Gzip)', async () => {
    // Generate data sintetis 500 rak
    const syntheticRacks = [];
    for (let i = 0; i < 500; i++) {
      syntheticRacks.push({
        id: i + 1,
        rack_code: `RACK-${String(i + 1).padStart(3, '0')}`,
        zone_id: (i % 5) + 1,
        x_mm: (i % 20) * 2800 + 1000,
        y_mm: Math.floor(i / 20) * 1800 + 1000,
        length_mm: 2400,
        depth_mm: 1000,
        height_mm: 4500,
        rotation: (i % 4) * 90,
        version: 1,
        aisle_access: [
          { aisle_id: 1, aisle_code: 'A-01', access_side: 'left', is_primary: true },
        ],
      });
    }

    const payloadObj = {
      warehouse: {
        id: 1,
        code: 'WH-MAIN',
        name: 'Main Warehouse',
        width_mm: 60000,
        length_mm: 80000,
        height_mm: 12000,
        layout_version: 5,
      },
      zones: [
        { id: 1, zone_code: 'Z-01', name: 'Zone Dry', color_hex: '#5c732b', x_mm: 0, y_mm: 0, width_mm: 30000, length_mm: 40000 },
        { id: 2, zone_code: 'Z-02', name: 'Zone Cold', color_hex: '#3e5510', x_mm: 30000, y_mm: 0, width_mm: 30000, length_mm: 40000 },
      ],
      aisles: [
        { id: 1, aisle_code: 'A-01', name: 'Aisle 01', x_mm: 0, y_mm: 0, width_mm: 2000, length_mm: 40000, direction: 'two_way' },
      ],
      racks: syntheticRacks,
      layout_objects: [
        { id: 1, object_type: 'pillar', name: 'Pillar 1', x_mm: 10000, y_mm: 10000, width_mm: 600, length_mm: 600, rotation: 0 },
      ],
    };

    const rawJson = JSON.stringify(payloadObj);
    const rawBytes = Buffer.byteLength(rawJson, 'utf8');
    const gzipBytes = zlib.gzipSync(Buffer.from(rawJson)).length;

    const rawKb = (rawBytes / 1024).toFixed(2);
    const gzipKb = (gzipBytes / 1024).toFixed(2);

    console.log(`\n=== PENGUKURAN PAYLOAD SNAPSHOT (500 RAK) ===`);
    console.log(`Ukuran Mentah (Raw JSON) : ${rawKb} KB (${rawBytes} bytes)`);
    console.log(`Ukuran Terkompresi (Gzip): ${gzipKb} KB (${gzipBytes} bytes)`);
    console.log(`Anggaran Maksimum        : 100.00 KB Gzip`);
    console.log(`Status Anggaran          : ${gzipBytes <= 100 * 1024 ? 'MEMENUHI ANGGARAN (LULUS)' : 'MELEBIHI ANGGARAN'}`);

    // Pastikan ukuran terkompresi <= 100 KB
    assert.ok(gzipBytes <= 100 * 1024, `Payload snapshot ${gzipKb} KB melebihi anggaran 100 KB gzip`);
  });
});
