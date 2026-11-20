/**
 * Pathfinding Service for Warehouse Layout
 * Resolves spatial routing between Docks, Doors, and Storage Racks/Locations.
 * Features in-memory caching keyed by (warehouse_id, layout_version) to avoid redundant rasterization.
 */

const db = require('../../../config/db');
const {
  createLayoutSnapshot,
  buildLayoutRouting,
  astar,
  dijkstraMultiTarget,
} = require('../../../../shared/layout-core/src/index');

// Cache mapping: `${warehouseId}_v${layoutVersion}` -> { grid, graph, cachedAt }
const routingCache = new Map();

class PathService {
  /**
   * Retrieves or builds the routing NavGraph for a given warehouse.
   * Cached by layout_version.
   *
   * @param {number} warehouseId
   * @returns {Promise<{ warehouse: Object, graph: Object, grid: Object } | null>}
   */
  static async getRoutingForWarehouse(warehouseId) {
    const id = parseInt(warehouseId, 10);
    if (!id || id <= 0) return null;

    // 1. Ambil data master warehouse
    const [whRows] = await db.query('SELECT * FROM warehouses WHERE id = ?', [id]);
    if (whRows.length === 0) return null;
    const warehouse = whRows[0];

    const cacheKey = `${warehouse.id}_v${warehouse.layout_version}`;
    if (routingCache.has(cacheKey)) {
      const cached = routingCache.get(cacheKey);
      return { warehouse, graph: cached.graph, grid: cached.grid };
    }

    // 2. Fetch seluruh komponen layout dari DB
    const [zones] = await db.query('SELECT * FROM zones WHERE warehouse_id = ?', [id]);
    const [aisles] = await db.query(
      'SELECT * FROM aisles WHERE warehouse_id = ? AND retired_at IS NULL',
      [id]
    );
    const [racks] = await db.query(
      'SELECT * FROM racks WHERE warehouse_id = ? AND retired_at IS NULL',
      [id]
    );
    const [layoutObjects] = await db.query(
      'SELECT * FROM layout_objects WHERE warehouse_id = ?',
      [id]
    );

    // Ambil akses lorong untuk rak
    if (racks.length > 0) {
      const rackIds = racks.map((r) => r.id);
      const [accessRows] = await db.query(
        'SELECT * FROM rack_aisle_access WHERE rack_id IN (?)',
        [rackIds]
      );
      const accessMap = new Map();
      for (const acc of accessRows) {
        if (!accessMap.has(acc.rack_id)) accessMap.set(acc.rack_id, []);
        accessMap.get(acc.rack_id).push(acc);
      }
      for (const r of racks) {
        r.aisle_access = accessMap.get(r.id) || [];
        const primary = r.aisle_access.find((a) => a.is_primary);
        if (primary) {
          r.access_side = primary.access_side;
        }
      }
    }

    // 3. Bangun LayoutSnapshot container
    const snapshot = createLayoutSnapshot({
      warehouse,
      zones,
      aisles,
      racks,
      layoutObjects,
    });

    // 4. Bangun OccupancyGrid & NavGraph
    const routing = buildLayoutRouting(snapshot, 250);

    // Simpan ke cache (bersihkan cache versi lama untuk warehouse ini)
    for (const key of routingCache.keys()) {
      if (key.startsWith(`${warehouse.id}_v`)) {
        routingCache.delete(key);
      }
    }
    routingCache.set(cacheKey, { ...routing, cachedAt: Date.now() });

    return { warehouse, graph: routing.graph, grid: routing.grid };
  }

  /**
   * Resolves a raw string input (Node ID, location code, or entity reference) into a valid graph nodeId.
   *
   * @param {number} warehouseId
   * @param {Object} graph - NavGraph instance
   * @param {string} rawInput
   * @returns {Promise<string | null>}
   */
  static async resolveNodeId(warehouseId, graph, rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const clean = rawInput.trim();

    // 1. Cek langsung jika ID sudah ada di graf (e.g. 'dock_1', 'pick_rack_10', 'aisle_1_start')
    if (graph.getNode(clean)) {
      return clean;
    }

    // 2. Cek format short pick rack (e.g. 'rack_10' -> 'pick_rack_10')
    if (clean.startsWith('rack_')) {
      const cand = `pick_${clean}`;
      if (graph.getNode(cand)) return cand;
    }

    // 3. Cek apakah ini ID angka langsung (kemungkinan dock atau rack ID)
    if (/^\d+$/.test(clean)) {
      if (graph.getNode(`dock_${clean}`)) return `dock_${clean}`;
      if (graph.getNode(`door_${clean}`)) return `door_${clean}`;
      if (graph.getNode(`pick_rack_${clean}`)) return `pick_rack_${clean}`;
    }

    // 4. Cek apakah ini kode rak langsung (e.g. 'R-01')
    const [rackByCode] = await db.query(
      'SELECT id FROM racks WHERE warehouse_id = ? AND rack_code = ? AND retired_at IS NULL LIMIT 1',
      [warehouseId, clean]
    );
    if (rackByCode.length > 0) {
      const rackNode = `pick_rack_${rackByCode[0].id}`;
      if (graph.getNode(rackNode)) return rackNode;
    }

    // 5. Cek apakah ini kode lokasi penyimpanan (e.g. 'R-01-B01-L01-P1')
    const [locRows] = await db.query(
      'SELECT rack_id FROM storage_locations WHERE warehouse_id = ? AND location_code = ? LIMIT 1',
      [warehouseId, clean]
    );
    if (locRows.length > 0) {
      const rackNode = `pick_rack_${locRows[0].rack_id}`;
      if (graph.getNode(rackNode)) return rackNode;
    }

    return null;
  }

  /**
   * Calculates the shortest and most optimal route between two points.
   *
   * @param {number} warehouseId
   * @param {string} fromInput - Start node ID or location code
   * @param {string} toInput - Destination node ID or location code
   * @param {string} [agentType='human'] - 'human' or 'forklift'
   * @returns {Promise<Object>}
   */
  static async calculatePath(warehouseId, fromInput, toInput, agentType = 'human') {
    const routingData = await this.getRoutingForWarehouse(warehouseId);
    if (!routingData) {
      const error = new Error('Warehouse tidak ditemukan.');
      error.statusCode = 404;
      error.code = 'WAREHOUSE_NOT_FOUND';
      throw error;
    }

    const { graph } = routingData;

    // Resolve node IDs
    const startNodeId = await this.resolveNodeId(warehouseId, graph, fromInput);
    if (!startNodeId) {
      const error = new Error(`Titik asal (from: '${fromInput}') tidak ditemukan di tata letak gudang.`);
      error.statusCode = 400;
      error.code = 'INVALID_START_NODE';
      throw error;
    }

    const goalNodeId = await this.resolveNodeId(warehouseId, graph, toInput);
    if (!goalNodeId) {
      const error = new Error(`Titik tujuan (to: '${toInput}') tidak ditemukan di tata letak gudang.`);
      error.statusCode = 400;
      error.code = 'INVALID_GOAL_NODE';
      throw error;
    }

    // Profil agen (Forklift butuh lebar lorong >= 3m, Manusia >= 0.6m)
    const normalizedAgent = agentType?.toLowerCase() === 'forklift' ? 'forklift' : 'human';
    const agentProfile =
      normalizedAgent === 'forklift'
        ? { minAisleWidthMm: 3000, speedMmPerSec: 3000 }
        : { minAisleWidthMm: 600, speedMmPerSec: 1400 };

    const routeResult = astar(graph, startNodeId, goalNodeId, { agentProfile });

    if (!routeResult) {
      const error = new Error(
        `Tidak ada jalur yang terhubung antara '${startNodeId}' dan '${goalNodeId}' untuk agen '${normalizedAgent}'.`
      );
      error.statusCode = 404;
      error.code = 'PATH_NOT_FOUND';
      throw error;
    }

    const totalDistMm = routeResult.totalDistanceMm;
    const totalDistM = parseFloat((totalDistMm / 1000).toFixed(2));
    const estimatedTimeSec = Math.max(1, Math.round(totalDistMm / agentProfile.speedMmPerSec));

    return {
      warehouse_id: parseInt(warehouseId, 10),
      from_node: startNodeId,
      to_node: goalNodeId,
      agent: normalizedAgent,
      total_distance_mm: totalDistMm,
      total_distance_m: totalDistM,
      turns: routeResult.turns,
      estimated_time_sec: estimatedTimeSec,
      steps_count: routeResult.path.length,
      path: routeResult.path,
    };
  }

  /**
   * Clears the in-memory cache for a warehouse.
   * Useful when layout is modified.
   * @param {number} warehouseId
   */
  static invalidateCache(warehouseId) {
    const id = parseInt(warehouseId, 10);
    for (const key of routingCache.keys()) {
      if (key.startsWith(`${id}_v`)) {
        routingCache.delete(key);
      }
    }
  }
}

module.exports = PathService;
