/**
 * Grid & Graph Builder Pipeline Module
 * Transforms a normalized LayoutSnapshot into an OccupancyGrid and NavGraph.
 * Zero external runtime dependencies. ESM format.
 */

import { CellType, OccupancyGrid } from './occupancyGrid.js';
import { NavGraph } from './navGraph.js';
import { footprint, overlaps } from './geometry.js';

/**
 * Builds a dense OccupancyGrid from a warehouse layout snapshot.
 *
 * @param {Object} snapshot - LayoutSnapshot container
 * @param {number} [cellWidthMm=700] - Slot length / cell width along X in mm
 * @param {number} [cellDepthMm=null] - Slot depth / cell depth along Y in mm
 * @returns {OccupancyGrid}
 */
function buildOccupancyGrid(snapshot, cellWidthMm = 700, cellDepthMm = null) {
  if (!snapshot || !snapshot.warehouse) {
    throw new Error('Snapshot warehouse wajib tersedia untuk membuat OccupancyGrid.');
  }

  const { warehouse, aisles = [], racks = [], layout_objects = [] } = snapshot;
  const grid = new OccupancyGrid(warehouse.width_mm, warehouse.length_mm, cellWidthMm, cellDepthMm);

  // 1. Stamp Aisles (Traversable corridor)
  for (const aisle of aisles) {
    if (aisle.retired_at) continue;
    grid.stampRect(aisle.x_mm, aisle.y_mm, aisle.width_mm, aisle.length_mm, CellType.AISLE);
  }

  // 2. Stamp Layout Objects (Walls, pillars, doors, docks, obstacles)
  for (const obj of layout_objects) {
    const fp = footprint(obj.width_mm, obj.length_mm, obj.rotation || 0);
    const clearance = obj.clearance_mm || 0;

    let bodyType = CellType.BLOCKED;
    if (obj.object_type === 'dock') {
      bodyType = CellType.DOCK;
    } else if (obj.object_type === 'door') {
      bodyType = CellType.DOOR;
    }

    if (clearance > 0) {
      grid.stampClearanceRing(obj.x_mm, obj.y_mm, fp.width, fp.depth, clearance, bodyType);
    } else {
      grid.stampRect(obj.x_mm, obj.y_mm, fp.width, fp.depth, bodyType);
    }
  }

  // 3. Stamp Racks (Physical structure & pick faces)
  for (const rack of racks) {
    if (rack.retired_at) continue;
    const fp = footprint(rack.length_mm, rack.depth_mm, rack.rotation || 0);

    // Body rack adalah blocked/impassable
    grid.stampRect(rack.x_mm, rack.y_mm, fp.width, fp.depth, CellType.RACK);

    // Tentukan strip muka akses (pick-face)
    const accessSide = rack.access_side || 'left';
    _stampRackPickFace(grid, rack.x_mm, rack.y_mm, fp.width, fp.depth, rack.rotation || 0, accessSide, grid.cellDepthMm);
  }

  return grid;
}

function _stampRackPickFace(grid, x, y, width, depth, rotation, accessSide, cellSize) {
  const stripDepth = cellSize;

  // Untuk rotasi 0 atau 180 (panjang di X, kedalaman di Y):
  // 'left' / 'front' biasanya mengarah ke -Y atau +Y tergantung hadap
  if (rotation === 0 || rotation === 180) {
    if (accessSide === 'left' || accessSide === 'both') {
      grid.stampRect(x, Math.max(0, y - stripDepth), width, stripDepth, CellType.PICK_FACE);
    }
    if (accessSide === 'right' || accessSide === 'both') {
      grid.stampRect(x, y + depth, width, stripDepth, CellType.PICK_FACE);
    }
  } else {
    // Rotasi 90 atau 270 (panjang di Y, kedalaman di X):
    if (accessSide === 'left' || accessSide === 'both') {
      grid.stampRect(Math.max(0, x - stripDepth), y, stripDepth, depth, CellType.PICK_FACE);
    }
    if (accessSide === 'right' || accessSide === 'both') {
      grid.stampRect(x + width, y, stripDepth, depth, CellType.PICK_FACE);
    }
  }
}

/**
 * Builds a sparse NavGraph from a warehouse layout snapshot.
 *
 * @param {Object} snapshot - LayoutSnapshot container
 * @param {OccupancyGrid} [occupancyGrid] - Optional pre-built grid for passability checks
 * @returns {NavGraph}
 */
function buildNavGraph(snapshot, occupancyGrid = null) {
  if (!snapshot || !snapshot.warehouse) {
    throw new Error('Snapshot warehouse wajib tersedia untuk membuat NavGraph.');
  }

  const graph = new NavGraph();
  const { aisles = [], racks = [], layout_objects = [] } = snapshot;

  const activeAisles = aisles.filter((a) => !a.retired_at);
  const aisleNodesMap = new Map(); // aisleId -> Array<nodeId>

  // 1. Buat simpul-simpul untuk setiap lorong (start, center, end)
  for (const a of activeAisles) {
    const isHorizontal = a.width_mm >= a.length_mm;
    const startId = `aisle_${a.id}_start`;
    const midId = `aisle_${a.id}_mid`;
    const endId = `aisle_${a.id}_end`;

    let startPos, midPos, endPos;
    if (isHorizontal) {
      const centerY = Math.floor(a.y_mm + a.length_mm / 2);
      startPos = { x: a.x_mm + 500, y: centerY };
      midPos = { x: Math.floor(a.x_mm + a.width_mm / 2), y: centerY };
      endPos = { x: a.x_mm + a.width_mm - 500, y: centerY };
    } else {
      const centerX = Math.floor(a.x_mm + a.width_mm / 2);
      startPos = { x: centerX, y: a.y_mm + 500 };
      midPos = { x: centerX, y: Math.floor(a.y_mm + a.length_mm / 2) };
      endPos = { x: centerX, y: a.y_mm + a.length_mm - 500 };
    }

    graph.addNode(startId, startPos.x, startPos.y, 'ENDPOINT', { aisleId: a.id });
    graph.addNode(midId, midPos.x, midPos.y, 'WAYPOINT', { aisleId: a.id });
    graph.addNode(endId, endPos.x, endPos.y, 'ENDPOINT', { aisleId: a.id });

    const isOneWay = a.direction === 'one_way';
    const aisleWidth = isHorizontal ? a.length_mm : a.width_mm;

    // Hubungkan start -> mid -> end
    graph.addEdge(startId, midId, null, { aisleId: a.id, aisleWidthMm: aisleWidth }, !isOneWay);
    graph.addEdge(midId, endId, null, { aisleId: a.id, aisleWidthMm: aisleWidth }, !isOneWay);

    aisleNodesMap.set(a.id, [startId, midId, endId]);
  }

  // 2. Deteksi persimpangan lorong (Aisle Intersections)
  for (let i = 0; i < activeAisles.length; i++) {
    for (let j = i + 1; j < activeAisles.length; j++) {
      const a = activeAisles[i];
      const b = activeAisles[j];

      const boxA = { x: a.x_mm, y: a.y_mm, width: a.width_mm, depth: a.length_mm };
      const boxB = { x: b.x_mm, y: b.y_mm, width: b.width_mm, depth: b.length_mm };

      if (overlaps(boxA, boxB)) {
        // Hitung titik tengah area irisan
        const interMinX = Math.max(boxA.x, boxB.x);
        const interMaxX = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
        const interMinY = Math.max(boxA.y, boxB.y);
        const interMaxY = Math.min(boxA.y + boxA.depth, boxB.y + boxB.depth);

        const interX = Math.floor((interMinX + interMaxX) / 2);
        const interY = Math.floor((interMinY + interMaxY) / 2);
        const interId = `inter_${a.id}_${b.id}`;

        graph.addNode(interId, interX, interY, 'INTERSECTION', { aisleA: a.id, aisleB: b.id });

        // Hubungkan titik persimpangan ke simpul terdekat di lorong A dan lorong B
        _connectToClosestAisleNode(graph, interId, aisleNodesMap.get(a.id));
        _connectToClosestAisleNode(graph, interId, aisleNodesMap.get(b.id));
      }
    }
  }

  // 3. Tambahkan titik Dock & Door
  for (const obj of layout_objects) {
    if (obj.object_type === 'dock' || obj.object_type === 'door') {
      const fp = footprint(obj.width_mm, obj.length_mm, obj.rotation || 0);
      const centerX = Math.floor(obj.x_mm + fp.width / 2);
      const centerY = Math.floor(obj.y_mm + fp.depth / 2);
      const nodeId = `${obj.object_type}_${obj.id}`;

      graph.addNode(nodeId, centerX, centerY, obj.object_type.toUpperCase(), {
        objectId: obj.id,
        name: obj.name,
      });

      // Hubungkan ke simpul terdekat di seluruh graf lorong
      _connectToNearestGraphNode(graph, nodeId, ['ENDPOINT', 'WAYPOINT', 'INTERSECTION']);
    }
  }

  // 4. Tambahkan titik Pick-Face untuk setiap Rak
  for (const rack of racks) {
    if (rack.retired_at) continue;
    const fp = footprint(rack.length_mm, rack.depth_mm, rack.rotation || 0);

    // Titik pick-face di depan rak
    const pickFacePos = _calculateRackPickFaceCoord(rack.x_mm, rack.y_mm, fp.width, fp.depth, rack.rotation || 0, rack.access_side);
    const pickNodeId = `pick_rack_${rack.id}`;

    graph.addNode(pickNodeId, pickFacePos.x, pickFacePos.y, 'PICK_FACE', {
      rackId: rack.id,
      rackCode: rack.rack_code,
    });

    // Hubungkan pick-face ke simpul lorong terdekat
    _connectToNearestGraphNode(graph, pickNodeId, ['ENDPOINT', 'WAYPOINT', 'INTERSECTION']);
  }

  return graph;
}

function _calculateRackPickFaceCoord(x, y, width, depth, rotation, accessSide = 'left') {
  const offset = 400; // 400mm di luar sisi rak
  if (rotation === 0 || rotation === 180) {
    const centerX = Math.floor(x + width / 2);
    const targetY = accessSide === 'right' ? y + depth + offset : Math.max(0, y - offset);
    return { x: centerX, y: targetY };
  } else {
    const centerY = Math.floor(y + depth / 2);
    const targetX = accessSide === 'right' ? x + width + offset : Math.max(0, x - offset);
    return { x: targetX, y: centerY };
  }
}

function _connectToClosestAisleNode(graph, fromId, targetNodeIds) {
  if (!targetNodeIds || targetNodeIds.length === 0) return;
  const fromNode = graph.getNode(fromId);
  if (!fromNode) return;

  let bestId = null;
  let minDistance = Infinity;

  for (const tid of targetNodeIds) {
    const tNode = graph.getNode(tid);
    if (!tNode) continue;
    const dist = Math.hypot(tNode.xMm - fromNode.xMm, tNode.yMm - fromNode.yMm);
    if (dist < minDistance) {
      minDistance = dist;
      bestId = tid;
    }
  }

  if (bestId) {
    graph.addEdge(fromId, bestId, minDistance, {}, true);
  }
}

function _connectToNearestGraphNode(graph, fromId, validTypes) {
  const fromNode = graph.getNode(fromId);
  if (!fromNode) return;

  let bestId = null;
  let minDistance = Infinity;

  for (const [id, node] of graph.nodes.entries()) {
    if (id === fromId) continue;
    if (validTypes && !validTypes.includes(node.type)) continue;

    const dist = Math.hypot(node.xMm - fromNode.xMm, node.yMm - fromNode.yMm);
    if (dist < minDistance) {
      minDistance = dist;
      bestId = id;
    }
  }

  if (bestId && minDistance < 100000) {
    // Sambungkan jika berjarak wajar
    graph.addEdge(fromId, bestId, minDistance, {}, true);
  }
}

/**
 * Unified pipeline function: builds both OccupancyGrid and NavGraph.
 * @param {Object} snapshot
 * @param {number} [cellWidthMm=700]
 * @param {number} [cellDepthMm=null]
 * @returns {{ grid: OccupancyGrid, graph: NavGraph }}
 */
function buildLayoutRouting(snapshot, cellWidthMm = 700, cellDepthMm = null) {
  const grid = buildOccupancyGrid(snapshot, cellWidthMm, cellDepthMm);
  const graph = buildNavGraph(snapshot, grid);
  return { grid, graph };
}

export { buildOccupancyGrid, buildNavGraph, buildLayoutRouting };
export default { buildOccupancyGrid, buildNavGraph, buildLayoutRouting };
