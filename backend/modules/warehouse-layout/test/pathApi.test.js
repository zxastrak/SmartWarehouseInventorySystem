/**
 * API Integration Test Suite for Pathfinding Endpoint (POST /warehouses/:id/path)
 * Tests PF-22, PF-23, and PF-24 against live Express server and MySQL database.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../../../server');
const db = require('../../../config/db');

let server;
let baseUrl;
let managerToken;
let testWhId;
let dockObjId;
let aisle1Id;
let rack1Id;
let bay1Id;
let level1Id;
let loc1Id;

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

describe('Phase 5: Pathfinding Backend API (POST /warehouses/:id/path)', () => {
  before(async () => {
    const secret = process.env.JWT_SECRET || 'susuno_secret_jwt_key_2026_8h';
    managerToken = jwt.sign({ id: 1, role: 'manager' }, secret, { expiresIn: '1h' });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Buat warehouse uji
    const [wh] = await db.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES ('WH-PATH-TEST', 'Warehouse Pathfinding Test', 40000, 50000, 10000, 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
    );
    testWhId = wh.insertId;

    // 2. Buat dock object
    const [dock] = await db.query(
      `INSERT INTO layout_objects (warehouse_id, object_type, name, x_mm, y_mm, width_mm, length_mm, rotation, clearance_mm)
       VALUES (?, 'dock', 'Dock Inbound 1', 1000, 1000, 3000, 3000, 0, 500)`,
      [testWhId]
    );
    dockObjId = dock.insertId;

    // 3. Buat lorong
    const [aisle] = await db.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm, direction)
       VALUES (?, 'AISLE-P01', 'Lorong Utama', 4000, 0, 3500, 40000, 'two_way')
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWhId]
    );
    aisle1Id = aisle.insertId;

    // 4. Buat rak
    const [rack] = await db.query(
      `INSERT INTO racks (warehouse_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation)
       VALUES (?, 'R-PATH-01', 8000, 10000, 3000, 1000, 5000, 0)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWhId]
    );
    rack1Id = rack.insertId;

    // 5. Hubungkan rak ke lorong
    await db.query(
      `INSERT INTO rack_aisle_access (rack_id, aisle_id, access_side, is_primary)
       VALUES (?, ?, 'left', 1)
       ON DUPLICATE KEY UPDATE is_primary=1`,
      [rack1Id, aisle1Id]
    );

    // 6. Buat struktur fisik bay, level, dan 1 storage location
    const [bay] = await db.query(
      `INSERT INTO rack_bays (rack_id, bay_number, width_mm) VALUES (?, 1, 3000)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [rack1Id]
    );
    bay1Id = bay.insertId;

    const [level] = await db.query(
      `INSERT INTO rack_levels (rack_id, level_number, height_from_floor_mm) VALUES (?, 1, 0)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [rack1Id]
    );
    level1Id = level.insertId;

    const [loc] = await db.query(
      `INSERT INTO storage_locations (warehouse_id, rack_id, bay_id, level_id, position_number, location_code)
       VALUES (?, ?, ?, ?, 1, 'R-PATH-01-B01-L01-P1')
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [testWhId, rack1Id, bay1Id, level1Id]
    );
    loc1Id = loc.insertId;
  });

  after(async () => {
    // Cleanup data uji
    await db.query('DELETE FROM storage_locations WHERE warehouse_id = ?', [testWhId]);
    await db.query('DELETE FROM rack_bays WHERE rack_id = ?', [rack1Id]);
    await db.query('DELETE FROM rack_levels WHERE rack_id = ?', [rack1Id]);
    await db.query('DELETE FROM rack_aisle_access WHERE rack_id = ?', [rack1Id]);
    await db.query('DELETE FROM racks WHERE warehouse_id = ?', [testWhId]);
    await db.query('DELETE FROM aisles WHERE warehouse_id = ?', [testWhId]);
    await db.query('DELETE FROM layout_objects WHERE warehouse_id = ?', [testWhId]);
    await db.query('DELETE FROM warehouses WHERE id = ?', [testWhId]);

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.end();
  });

  test('PF-22: POST /warehouses/:id/path mengembalikan rute optimal polyline dan metrik', async () => {
    const res = await request(`/api/warehouse-layout/warehouses/${testWhId}/path`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        from: `dock_${dockObjId}`,
        to: `pick_rack_${rack1Id}`,
        agent: 'human',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    assert.equal(data.warehouse_id, testWhId);
    assert.equal(data.from_node, `dock_${dockObjId}`);
    assert.equal(data.to_node, `pick_rack_${rack1Id}`);
    assert.equal(data.agent, 'human');
    assert.ok(data.total_distance_mm > 0);
    assert.ok(data.total_distance_m > 0);
    assert.ok(typeof data.turns === 'number');
    assert.ok(typeof data.estimated_time_sec === 'number');
    assert.ok(Array.isArray(data.path));
    assert.ok(data.path.length >= 2);
  });

  test('PF-23: Resolusi titik tujuan berbasis Location Code (e.g. R-PATH-01-B01-L01-P1)', async () => {
    const res = await request(`/api/warehouse-layout/warehouses/${testWhId}/path`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        from: `dock_${dockObjId}`,
        to: 'R-PATH-01-B01-L01-P1',
        agent: 'forklift',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    // Titik tujuan otomatis di-resolve ke pick-face rak penampung lokasi tersebut
    assert.equal(data.to_node, `pick_rack_${rack1Id}`);
    assert.equal(data.agent, 'forklift');
    assert.ok(data.path.length >= 2);
  });

  test('PF-24: Error handling validasi parameter dan titik tidak ditemukan', async () => {
    // 1. Missing from
    const res1 = await request(`/api/warehouse-layout/warehouses/${testWhId}/path`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { to: 'R-PATH-01-B01-L01-P1' },
    });
    assert.equal(res1.status, 400);
    assert.equal(res1.body.error, 'VALIDATION_ERROR');

    // 2. Missing to
    const res2 = await request(`/api/warehouse-layout/warehouses/${testWhId}/path`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { from: `dock_${dockObjId}` },
    });
    assert.equal(res2.status, 400);

    // 3. Unknown node id
    const res3 = await request(`/api/warehouse-layout/warehouses/${testWhId}/path`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        from: `dock_${dockObjId}`,
        to: 'NON_EXISTENT_LOCATION_CODE_123',
      },
    });
    assert.equal(res3.status, 400);
    assert.equal(res3.body.error, 'INVALID_GOAL_NODE');

    // 4. Unknown warehouse
    const res4 = await request('/api/warehouse-layout/warehouses/999999/path', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        from: `dock_${dockObjId}`,
        to: `pick_rack_${rack1Id}`,
      },
    });
    assert.equal(res4.status, 404);
  });
});
