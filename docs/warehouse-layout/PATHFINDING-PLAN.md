# 🗺️ Warehouse Pathfinding — Implementation Plan

> **Status:** ✅ Selesai (100% Terverifikasi, 24/24 AC Pass)  
> **Author:** AI Agent (Senior Software Engineer Consultation)  
> **Tanggal:** 2026-11-18  
> **Terkait:** [`docs/warehouse-layout/README.md`](../warehouse-layout/README.md), [`docs/warehouse-layout/PROGRESS.md`](../warehouse-layout/PROGRESS.md)

---

## 📋 Daftar Isi

1. [Diagnosis Kondisi Saat Ini](#1-diagnosis-kondisi-saat-ini)
2. [Arsitektur Target: Dual-Layer Grid + Graph](#2-arsitektur-target-dual-layer-grid--graph)
3. [Analisis Cell Size](#3-analisis-cell-size)
4. [Spesifikasi Occupancy Grid](#4-spesifikasi-occupancy-grid)
5. [Spesifikasi Navigation Graph](#5-spesifikasi-navigation-graph)
6. [Pathfinding Algorithm (A*)](#6-pathfinding-algorithm-a)
7. [File & Module Structure](#7-file--module-structure)
8. [Integrasi Frontend (Canvas)](#8-integrasi-frontend-canvas)
9. [Integrasi Backend (API)](#9-integrasi-backend-api)
10. [Incremental Update Strategy](#10-incremental-update-strategy)
11. [Multi-Agent Clearance](#11-multi-agent-clearance)
12. [Performance Budget](#12-performance-budget)
13. [Phased Roadmap](#13-phased-roadmap)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Keputusan yang Perlu Diambil](#15-keputusan-yang-perlu-diambil)

---

## 1. Diagnosis Kondisi Saat Ini

### ✅ Foundation yang Sudah Solid

| Komponen | File | Fungsi |
|---|---|---|
| Coordinate System | `shared/layout-core/src/geometry.js` | Integer mm, origin (0,0) top-left, X→right Y→down |
| AABB Collision | `shared/layout-core/src/geometry.js` | `overlaps()`, `inside()`, `footprint()`, `rotate90()` |
| Spatial Indexing | `shared/layout-core/src/spatialHash.js` | Uniform grid 1m cell, broad/narrow phase query |
| Entity Model | `shared/layout-core/src/dto.js` | Racks, Aisles, Layout Objects (wall/pillar/door/dock/obstacle) |
| Aisle Direction | DB `aisles.direction` | `two_way` default, bisa one-way |
| Obstacle Clearance | DB `layout_objects.clearance_mm` | Buffer zone per obstacle |
| Rack Access Points | DB `rack_aisle_access` | Rack ↔ Aisle mapping + `access_side` (left/right/both) |
| Canvas Engine | `web/src/features/warehouse-layout/engine/renderer.js` | Top-view render zones, aisles, racks, objects |
| Layout Snapshot | `shared/layout-core/src/dto.js` → `createLayoutSnapshot()` | Normalized data container |

### ❌ Gap Kritis (Belum Ada)

| Gap | Impact | Priority |
|---|---|---|
| **Occupancy Grid** | Tidak ada representasi lantai sebagai matriks walkable/blocked | 🔴 Critical |
| **Navigation Graph** | Tidak ada node/edge dari layout untuk algoritma A*/Dijkstra | 🔴 Critical |
| **Pick-Face Nodes** | Rack access points belum di-encode sebagai target navigasi | 🟡 High |
| **Cost Model** | Belum ada cost function (jarak, belokan, kepadatan) | 🟡 High |
| **Path Visualization** | Canvas engine belum bisa render jalur navigasi | 🟡 High |
| **NavMesh (optional)** | Simplified polygon mesh untuk agen besar (forklift) | 🔵 Future |

---

## 2. Arsitektur Target: Dual-Layer Grid + Graph

### Mengapa Dual-Layer?

Bukan hanya satu occupancy grid mentah, tapi **dua layer yang saling melengkapi**:

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 1: OCCUPANCY GRID (Dense Matrix)                  │
│  ─────────────────────────────────────                   │
│  • Uint8Array flat, 250mm per cell                       │
│  • Setiap cell = CellType enum (WALKABLE/BLOCKED/etc)    │
│  • Digunakan untuk: collision preview, heatmap, clearance│
│                                                          │
│  ┌──────────────────────────────────────────┐             │
│  │ 0 0 0 0 0 1 1 1 1 0 0 0 0 0 0          │             │
│  │ 0 0 0 0 0 1 1 1 1 0 0 0 0 0 0          │             │
│  │ 2 2 2 2 0 1 1 1 1 0 2 2 2 2 0          │             │
│  │ 2 2 2 2 0 0 0 0 0 0 2 2 2 2 0          │             │
│  │ 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3          │             │
│  └──────────────────────────────────────────┘             │
│                       │                                  │
│                       ▼ extract                          │
│  LAYER 2: NAVIGATION GRAPH (Sparse Weighted)             │
│  ─────────────────────────────────────────               │
│  • ~200-300 nodes dari titik strategis                   │
│  • Weighted edges (jarak + turn penalty + agent profile) │
│  • Digunakan untuk: A* pathfinding, route optimization   │
│                                                          │
│  ┌──────────────────────────────────────────┐             │
│  │     N1 ——— N2 ——— N3                   │             │
│  │     |             |                     │             │
│  │     N4    [rack]  N5 ← pick-face        │             │
│  │     |             |                     │             │
│  │     N6 ——— N7 ——— N8 ——→ DOCK          │             │
│  └──────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────┘
```

### Perbandingan Pendekatan

| Aspek | Grid Only | Graph Only | **Dual-Layer ✓** |
|---|---|---|---|
| Collision preview (drag) | ✅ | ❌ | ✅ |
| A* performance (50×80m) | ⚠️ 64K cells | ✅ ~300 nodes | ✅ graph untuk path |
| Path display on canvas | ⚠️ pixelated | ✅ smooth polyline | ✅ best of both |
| Clearance validation | ✅ cell-based | ❌ | ✅ |
| Incremental update | ✅ local region | ⚠️ rebuild graph | ✅ grid→graph partial |
| Forklift vs human path | ⚠️ separate grids | ✅ edge weights | ✅ |

---

## 3. Analisis Cell Size

### Warehouse Reference: 50m × 80m = 50,000mm × 80,000mm

| Cell Size | Grid Dimensions | Total Cells | Memory | Use Case |
|---|---|---|---|---|
| 1000mm (1m) | 50 × 80 | 4,000 | 4 KB | Terlalu kasar |
| **500mm** | 100 × 160 | **16,000** | **16 KB** | Standar, cukup baik |
| **250mm ✓** | 200 × 320 | **64,000** | **64 KB** | Presisi, human-width granularity |
| 100mm | 500 × 800 | 400,000 | 400 KB | Berlebihan, tanpa benefit |

### Rekomendasi: **250mm**

**Alasan:**
- Lebar minimum aisle forklift ≈ 3000mm = **12 cells** → cukup granular untuk navigasi
- Lebar manusia berjalan ≈ 600mm = **2.4 cells** → adequate
- 64K cells trivial untuk A* modern → ~2ms di JavaScript
- `Uint8Array(64000)` = 64 KB RAM → negligible
- Bisa di-transfer ke Web Worker tanpa serialization overhead (`Transferable`)

---

## 4. Spesifikasi Occupancy Grid

### 4.1 Cell Type Enum

```javascript
const CellType = Object.freeze({
  WALKABLE:   0,  // Lantai terbuka, bisa dilalui semua agent
  BLOCKED:    1,  // Wall, pillar, obstacle → impassable
  RACK:       2,  // Area ditempati rak → impassable
  AISLE:      3,  // Jalur lorong → walkable, preferred path
  DOCK:       4,  // Loading dock → entry/exit node
  DOOR:       5,  // Pintu → chokepoint node
  CLEARANCE:  6,  // Buffer zone obstacle/rack → passable tapi mahal (cost penalty)
  PICK_FACE:  7,  // Muka rak yang bisa diakses → destination node
});
```

### 4.2 OccupancyGrid Class

```javascript
class OccupancyGrid {
  /**
   * @param {number} widthMm  - Warehouse width (X) in mm
   * @param {number} lengthMm - Warehouse length (Y) in mm
   * @param {number} cellSize - Cell size in mm (default: 250)
   */
  constructor(widthMm, lengthMm, cellSize = 250) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(widthMm / cellSize);   // X axis count
    this.rows = Math.ceil(lengthMm / cellSize);   // Y axis count
    this.data = new Uint8Array(this.cols * this.rows); // flat, row-major
  }

  /** Get cell type at (col, row). Out-of-bounds = BLOCKED */
  get(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows)
      return CellType.BLOCKED;
    return this.data[row * this.cols + col];
  }

  /** Set cell type at (col, row) */
  set(col, row, cellType) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows)
      this.data[row * this.cols + col] = cellType;
  }

  /** Convert mm coordinate → grid cell */
  mmToCell(xMm, yMm) {
    return {
      col: Math.floor(xMm / this.cellSize),
      row: Math.floor(yMm / this.cellSize),
    };
  }

  /** Convert grid cell → mm (center of cell) */
  cellToMm(col, row) {
    return {
      xMm: col * this.cellSize + this.cellSize / 2,
      yMm: row * this.cellSize + this.cellSize / 2,
    };
  }

  /** Stamp a rectangle area with a cell type */
  stampRect(xMm, yMm, widthMm, depthMm, cellType) {
    const minCol = Math.floor(xMm / this.cellSize);
    const maxCol = Math.floor((xMm + widthMm - 1) / this.cellSize);
    const minRow = Math.floor(yMm / this.cellSize);
    const maxRow = Math.floor((yMm + depthMm - 1) / this.cellSize);
    for (let r = minRow; r <= maxRow; r++)
      for (let c = minCol; c <= maxCol; c++)
        this.set(c, r, cellType);
  }

  /** Stamp clearance ring around a rectangle */
  stampClearanceRing(xMm, yMm, widthMm, depthMm, clearanceMm) {
    // Stamp outer ring (body + clearance) as CLEARANCE
    this.stampRect(
      xMm - clearanceMm, yMm - clearanceMm,
      widthMm + 2 * clearanceMm, depthMm + 2 * clearanceMm,
      CellType.CLEARANCE
    );
    // Then stamp body back (overwrites inner cells)
    this.stampRect(xMm, yMm, widthMm, depthMm, CellType.BLOCKED);
  }

  /** Check if a cell is passable for a given agent profile */
  isPassable(col, row, agentProfile = null) {
    const cell = this.get(col, row);
    if (cell === CellType.BLOCKED || cell === CellType.RACK) return false;
    if (cell === CellType.CLEARANCE && agentProfile?.cannotEnterClearance) return false;
    return true;
  }

  /** Get 4-connected neighbors (up/down/left/right) */
  getNeighbors4(col, row) {
    return [
      { col: col - 1, row },     // left
      { col: col + 1, row },     // right
      { col, row: row - 1 },     // up
      { col, row: row + 1 },     // down
    ].filter(n => this.isPassable(n.col, n.row));
  }

  /** Get 8-connected neighbors (includes diagonals) */
  getNeighbors8(col, row) {
    return [
      { col: col - 1, row },         // left
      { col: col + 1, row },         // right
      { col, row: row - 1 },         // up
      { col, row: row + 1 },         // down
      { col: col - 1, row: row - 1 }, // top-left
      { col: col + 1, row: row - 1 }, // top-right
      { col: col - 1, row: row + 1 }, // bottom-left
      { col: col + 1, row: row + 1 }, // bottom-right
    ].filter(n => this.isPassable(n.col, n.row));
  }
}
```

### 4.3 Rasterization Pipeline

Urutan stamp **penting** (later stamps overwrite earlier):

```
Step  Action                               CellType Written
────────────────────────────────────────────────────────────
1     Init seluruh grid                    WALKABLE (0)
2     Stamp aisles (jalur lorong)          AISLE (3)
3     Stamp layout_objects + clearance:
      a. Ring clearance_mm                 CLEARANCE (6)
      b. Object body                       BLOCKED (1) / DOCK (4) / DOOR (5)
4     Stamp racks:
      a. Rack body                         RACK (2)
      b. Rack access side (1 cell strip)   PICK_FACE (7)
5     Stamp docks (object_type='dock')     DOCK (4)
6     Stamp doors (object_type='door')     DOOR (5)
```

> **Catatan:** Stamp order memastikan bahwa BLOCKED selalu menang atas WALKABLE, dan PICK_FACE hanya muncul di sisi yang sudah dideklarasikan `access_side` di tabel `rack_aisle_access`.

---

## 5. Spesifikasi Navigation Graph

### 5.1 Graph Structure

```javascript
class NavGraph {
  constructor() {
    this.nodes = new Map();  // nodeId → { xMm, yMm, type, metadata }
    this.edges = new Map();  // nodeId → [{ to: nodeId, cost, metadata }]
  }

  addNode(id, xMm, yMm, type, metadata = {}) { ... }
  addEdge(fromId, toId, cost, metadata = {}) { ... }
  getNeighbors(nodeId) { ... }
  removeNode(nodeId) { ... }
}
```

### 5.2 Node Extraction dari Layout

Bukan setiap grid cell jadi node. Hanya **titik strategis**:

| Node Type | Source Data | Estimasi Count (50×80m) |
|---|---|---|
| `INTERSECTION` | Aisle ∩ Aisle junction | ~20-50 |
| `ENDPOINT` | Aisle start/end | ~20-40 |
| `PICK_FACE` | Rack access point (dari `rack_aisle_access`) | = jumlah rak |
| `DOCK` | `layout_objects` where `object_type='dock'` | ~2-10 |
| `DOOR` | `layout_objects` where `object_type='door'` | ~2-10 |
| `WAYPOINT` | Midpoint aisle panjang (> 10m) | ~optional |
| **Total** | | **~100-300 nodes** |

### 5.3 Edge Construction

```
Edges connect:
─────────────────────────────────────────────────────
ENDPOINT ↔ INTERSECTION       Along aisle center line
INTERSECTION ↔ INTERSECTION   Along aisle center line
INTERSECTION ↔ PICK_FACE      Perpendicular from aisle to rack face
ENDPOINT ↔ DOCK               If aisle reaches dock
ENDPOINT ↔ DOOR               If aisle reaches door
─────────────────────────────────────────────────────

Edge validation: Path between two nodes must NOT cross
any BLOCKED or RACK cell on the occupancy grid.
```

### 5.4 Cost Function

```javascript
function computeEdgeCost(fromNode, toNode, agentType = 'human') {
  // Base: Euclidean distance in mm
  const dx = toNode.xMm - fromNode.xMm;
  const dy = toNode.yMm - fromNode.yMm;
  let cost = Math.sqrt(dx * dx + dy * dy);

  // Penalty: Turn (reduce zig-zag paths)
  // Applied during A* traversal, not edge construction

  // Penalty: Clearance zone traversal
  if (toNode.inClearanceZone) cost *= 1.5;

  // Block: One-way aisle violation
  if (toNode.aisleDirection === 'one_way' && isAgainstFlow(fromNode, toNode)) {
    cost = Infinity;
  }

  // Block: Narrow aisle for forklift
  if (agentType === 'forklift' && toNode.aisleWidthMm < 3000) {
    cost = Infinity;
  }

  return cost;
}
```

---

## 6. Pathfinding Algorithm (A*)

### 6.1 MinHeap (Priority Queue)

```javascript
class MinHeap {
  constructor() { this.data = []; }

  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  isEmpty() { return this.data.length === 0; }

  _bubbleUp(i) { /* standard heap bubble up by .f */ }
  _sinkDown(i) { /* standard heap sink down by .f */ }
}
```

### 6.2 A* Core

```javascript
/**
 * @param {NavGraph} graph
 * @param {string} startId - Node ID asal
 * @param {string} goalId  - Node ID tujuan
 * @param {Function} costFn - (fromNode, toNode) → number
 * @returns {{ path: Array<{xMm, yMm}>, totalCost: number, turns: number } | null}
 */
function astar(graph, startId, goalId, costFn) {
  const open = new MinHeap();
  const gScore = new Map();    // nodeId → cheapest cost from start
  const cameFrom = new Map();  // nodeId → { prevId, edge }

  gScore.set(startId, 0);
  open.push({
    nodeId: startId,
    f: heuristic(graph.nodes.get(startId), graph.nodes.get(goalId)),
    g: 0,
  });

  while (!open.isEmpty()) {
    const current = open.pop();

    if (current.nodeId === goalId) {
      return reconstructPath(graph, cameFrom, goalId, current.g);
    }

    for (const edge of graph.getNeighbors(current.nodeId)) {
      const tentativeG = current.g + costFn(
        graph.nodes.get(current.nodeId),
        graph.nodes.get(edge.to)
      );

      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, current.nodeId);
        gScore.set(edge.to, tentativeG);
        open.push({
          nodeId: edge.to,
          f: tentativeG + heuristic(graph.nodes.get(edge.to), graph.nodes.get(goalId)),
          g: tentativeG,
        });
      }
    }
  }

  return null; // No path found
}

function heuristic(nodeA, nodeB) {
  // Euclidean distance (admissible, consistent)
  const dx = nodeA.xMm - nodeB.xMm;
  const dy = nodeA.yMm - nodeB.yMm;
  return Math.sqrt(dx * dx + dy * dy);
}

function reconstructPath(graph, cameFrom, goalId, totalCost) {
  const path = [];
  let current = goalId;
  let turns = 0;

  while (current !== undefined) {
    const node = graph.nodes.get(current);
    path.unshift({ xMm: node.xMm, yMm: node.yMm, nodeId: current });
    current = cameFrom.get(current);
  }

  // Count turns
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1], curr = path[i], next = path[i + 1];
    const d1 = Math.atan2(curr.yMm - prev.yMm, curr.xMm - prev.xMm);
    const d2 = Math.atan2(next.yMm - curr.yMm, next.xMm - curr.xMm);
    if (Math.abs(d1 - d2) > 0.01) turns++;
  }

  return { path, totalCost, turns };
}
```

### 6.3 Dijkstra Variant (Multi-Destination)

Untuk skenario "cari rak terdekat dari dock yang punya slot kosong":

```javascript
function dijkstraMultiTarget(graph, startId, targetIds, costFn) {
  // Same as A* tapi tanpa heuristic (f = g)
  // Berhenti saat salah satu targetIds ditemukan
  // Return: { targetId, path, totalCost }
}
```

---

## 7. File & Module Structure

### Target Structure

```
shared/layout-core/src/
├── dto.js                      ← EXISTING (tidak diubah)
├── geometry.js                 ← EXISTING (tidak diubah)
├── spatialHash.js              ← EXISTING (tetap untuk collision, bukan pathfinding)
├── code.js                     ← EXISTING (tidak diubah)
├── structureValidation.js      ← EXISTING (tidak diubah)
│
├── occupancyGrid.js            ← NEW: OccupancyGrid class + CellType enum
├── navGraph.js                 ← NEW: NavGraph class + node/edge management
├── pathfinder.js               ← NEW: A* + Dijkstra + MinHeap + path utilities
├── gridBuilder.js              ← NEW: LayoutSnapshot → OccupancyGrid → NavGraph pipeline
│
├── index.js                    ← UPDATED: re-export 4 modul baru
└── package.json                ← EXISTING (tidak diubah, sudah ESM)

shared/layout-core/test/
├── occupancyGrid.test.js       ← NEW
├── navGraph.test.js            ← NEW
├── pathfinder.test.js          ← NEW
├── gridBuilder.test.js         ← NEW
└── ...existing tests...
```

### Prinsip Desain

| Prinsip | Implementasi |
|---|---|
| **Pure functions** | Tanpa I/O, tanpa DOM, tanpa Node API |
| **Isomorphic** | Dipakai frontend (canvas) DAN backend (task routing) |
| **Zero dependencies** | Tidak ada npm package tambahan |
| **Testable** | Setiap fungsi bisa di-unit test tanpa mock |
| **Consistent** | Format sama dengan modul existing (ESM + dual export) |

---

## 8. Integrasi Frontend (Canvas)

### 8.1 Architecture Flow

```
WarehouseLayoutPage
│
├── Canvas Renderer (existing)
│   ├── Zone Layer
│   ├── Aisle Layer
│   ├── Rack Layer
│   └── Object Layer
│
├── Grid Overlay Layer (NEW)              ← Toggle "Show Grid"
│   └── Render occupancy grid as color-coded cells
│       WALKABLE  → transparent
│       BLOCKED   → rgba(255,0,0,0.15)
│       RACK      → rgba(255,0,0,0.25)
│       AISLE     → rgba(92,115,43,0.1)    ← Olive muted
│       DOCK      → rgba(139,92,246,0.3)
│       DOOR      → rgba(59,130,246,0.3)
│       CLEARANCE → rgba(251,191,36,0.15)   ← Amber muted
│       PICK_FACE → rgba(16,185,129,0.25)
│
└── Path Overlay Layer (NEW)              ← Click-to-path
    └── Render A* result as polyline
        • Stroke: #3e5510 (Deep Forest) 3px
        • Start marker: green circle
        • End marker: red circle
        • Info tooltip: "24.3m | 3 turns | ~2 min"
```

### 8.2 User Interaction Flow

```
1. Toggle "🗺️ Show Grid" button di toolbar
   → gridBuilder.build(snapshot) → OccupancyGrid
   → Canvas renders grid overlay

2. Toggle "📍 Path Mode" button
   → User clicks source (dock/rack/any point)
   → User clicks destination (rack/dock/any point)
   → pathfinder.astar(graph, source, dest)
   → Canvas renders polyline path + info panel

3. Drag rack in layout
   → updateGridIncremental() → partial rebuild
   → Path auto-recalculates if active
```

---

## 9. Integrasi Backend (API)

### 9.1 New Endpoint

```
POST /api/warehouse-layout/:warehouseId/path

Request Body:
{
  "from": {
    "type": "dock",          // dock | door | location | coordinate
    "id": 1                  // entity ID (atau xMm/yMm untuk coordinate)
  },
  "to": {
    "type": "location",
    "code": "R-A01-B02-L03-P1"
  },
  "agent": "forklift"       // human | hand_pallet | forklift | reach_truck
}

Response:
{
  "path": [
    { "xMm": 2000, "yMm": 500 },
    { "xMm": 2000, "yMm": 15000 },
    { "xMm": 8000, "yMm": 15000 },
    { "xMm": 8000, "yMm": 22500 }
  ],
  "distance_mm": 24300,
  "turns": 3,
  "estimated_time_sec": 120,
  "agent": "forklift"
}
```

### 9.2 Backend Service Flow

```
Request → pathController.findPath()
  → layoutService.getSnapshot(warehouseId)
  → gridBuilder.build(snapshot)
  → pathfinder.astar(graph, fromNode, toNode, costFn)
  → Response with path + metadata
```

### 9.3 Database: Tidak Perlu Skema Baru

Grid dan graph dihitung **on-the-fly** dari layout snapshot. Tidak perlu tabel tambahan.

**Future optimization (opsional):**
- Cache `Uint8Array` di memory (invalidate saat `layout_version` berubah)
- Atau kolom `grid_cache MEDIUMBLOB` di tabel `warehouses`

---

## 10. Incremental Update Strategy

Saat user memindahkan rak atau menambah obstacle di canvas editor:

```javascript
function updateGridIncremental(grid, navGraph, change) {
  // 1. Hapus posisi lama → kembalikan ke WALKABLE
  grid.stampRect(
    change.old.xMm, change.old.yMm,
    change.old.widthMm, change.old.depthMm,
    CellType.WALKABLE
  );

  // 2. Stamp posisi baru
  grid.stampRect(
    change.new.xMm, change.new.yMm,
    change.new.widthMm, change.new.depthMm,
    CellType.RACK
  );

  // 3. Rebuild graph hanya di region yang terpengaruh
  const affectedRegion = mergeAABB(change.old, change.new);
  navGraph.rebuildRegion(affectedRegion);
}
```

**Benefit:**
- Tidak perlu rebuild seluruh grid 64K cells
- Hanya region yang berubah (biasanya <100 cells)
- Path auto-recalculate jika path aktif melewati affected region

---

## 11. Multi-Agent Clearance

### Agent Profiles

| Agent Type | Min Aisle Width | Cell Buffer (250mm) | Speed |
|---|---|---|---|
| Human | 600mm (2.4 cells) | 1 cell | Walk |
| Hand Pallet | 900mm (3.6 cells) | 2 cells | Walk |
| Forklift | 3000mm (12 cells) | 3 cells | Drive |
| Reach Truck | 2700mm (10.8 cells) | 3 cells | Drive |

### Implementation

```javascript
const AGENT_PROFILES = {
  human:        { bufferCells: 1, minAisleWidthMm: 600,  canEnterClearance: true,  speedMmPerSec: 1400 },
  hand_pallet:  { bufferCells: 2, minAisleWidthMm: 900,  canEnterClearance: true,  speedMmPerSec: 1000 },
  forklift:     { bufferCells: 3, minAisleWidthMm: 3000, canEnterClearance: false, speedMmPerSec: 3000 },
  reach_truck:  { bufferCells: 3, minAisleWidthMm: 2700, canEnterClearance: false, speedMmPerSec: 2500 },
};
```

**Satu occupancy grid, multiple agent passability check** — tidak perlu rebuild grid per agent type.

---

## 12. Performance Budget

| Operation | Target | Complexity | Method |
|---|---|---|---|
| Grid build (full 64K cells) | < 10ms | O(entities × entity_area) | Loop + stampRect |
| Graph extraction (~300 nodes) | < 5ms | O(aisles × aisles) | Scan aisle intersections |
| A* pathfinding | < 2ms | O(N log N), N=300 | MinHeap priority queue |
| Incremental update (1 rack) | < 1ms | O(affected_cells) | Local region rebuild |
| Grid transfer to Web Worker | < 1ms | O(1) | Transferable Uint8Array |
| Canvas grid overlay render | 60fps | O(visible_cells) | Only render viewport |
| Canvas path polyline render | 60fps | O(path_length) | Simple line drawing |

---

## 13. Phased Roadmap

### Phase 1: Core Occupancy Grid 🟢

**Scope:** `occupancyGrid.js` + `gridBuilder.js` (partial)

| Task | Detail |
|---|---|
| `CellType` enum | 8 cell types |
| `OccupancyGrid` class | Constructor, get/set, mmToCell, cellToMm, stampRect, stampClearanceRing |
| `buildFromSnapshot()` | LayoutSnapshot → OccupancyGrid (full rasterization pipeline) |
| Unit tests | Grid creation, stamp, boundary, conversion |

**Output:** Grid matriks yang bisa digunakan untuk visualisasi dan pathfinding.

---

### Phase 2: Navigation Graph 🟡

**Scope:** `navGraph.js` + `gridBuilder.js` (complete)

| Task | Detail |
|---|---|
| `NavGraph` class | Node/edge CRUD, neighbor lookup |
| Node extraction | Aisle intersections, endpoints, pick-faces, docks, doors |
| Edge construction | Connect nodes along aisle center lines |
| Grid-to-graph pipeline | `buildFromSnapshot()` → OccupancyGrid → NavGraph |
| Unit tests | Graph construction, topology validation |

**Output:** Sparse weighted graph siap digunakan oleh pathfinder.

---

### Phase 3: Pathfinding Algorithm 🟡

**Scope:** `pathfinder.js`

| Task | Detail |
|---|---|
| `MinHeap` class | Pure JS priority queue |
| `astar()` | A* with Euclidean heuristic |
| `dijkstraMultiTarget()` | Find nearest target from multiple candidates |
| Cost function | Distance + turn penalty + agent profile |
| Path reconstruction | Coordinate array + distance + turns |
| Unit tests | Shortest path, unreachable, multi-agent, turn counting |

**Output:** Fully functional pathfinding ready for integration.

---

### Phase 4: Canvas Integration 🔵

**Scope:** Frontend overlay layers

| Task | Detail |
|---|---|
| Grid overlay renderer | Heatmap per CellType, toggle on/off |
| Path overlay renderer | Polyline + markers + info tooltip |
| Toolbar buttons | "Show Grid", "Path Mode" |
| Interactive click-to-path | Source → Destination → auto-calculate |
| Editor store integration | Grid/graph state management |

**Output:** Visual pathfinding on the warehouse layout canvas.

---

### Phase 5: Backend API 🔵

**Scope:** REST endpoint + service integration

| Task | Detail |
|---|---|
| Path controller | `POST /path` endpoint |
| Path service | Build grid → graph → A* pipeline |
| Response format | Path coordinates + metadata |
| Cache strategy | In-memory, invalidate on layout_version change |
| Integration | Connect to putaway/picking task assignment |

**Output:** Server-side pathfinding API for task routing.

---

## 14. Acceptance Criteria

### Phase 1: Core Occupancy Grid
- [x] `PF-01`: `OccupancyGrid` created from warehouse dimensions with correct cols/rows (LULUS)
- [x] `PF-02`: `stampRect()` correctly marks cells for all 8 CellType values (LULUS)
- [x] `PF-03`: `stampClearanceRing()` creates buffer ring around obstacles (LULUS)
- [x] `PF-04`: `buildFromSnapshot()` correctly rasterizes all entity types (LULUS)
- [x] `PF-05`: Out-of-bounds access returns `CellType.BLOCKED` (LULUS)
- [x] `PF-06`: `mmToCell()` / `cellToMm()` roundtrip accuracy within 1 cell (LULUS)

### Phase 2: Navigation Graph
- [x] `PF-07`: Graph nodes extracted from aisle intersections (LULUS)
- [x] `PF-08`: Pick-face nodes generated from `rack_aisle_access` (LULUS)
- [x] `PF-09`: Dock/door nodes generated from `layout_objects` (LULUS)
- [x] `PF-10`: Edges connect adjacent nodes along aisle center lines (LULUS)
- [x] `PF-11`: Edge weights = Euclidean distance in mm (LULUS)

### Phase 3: Pathfinder & A* Routing
- [x] `PF-12`: A* finds shortest path between two connected nodes (LULUS)
- [x] `PF-13`: A* returns `null` for unreachable destinations (LULUS)
- [x] `PF-14`: Turn count correctly computed from path (LULUS)
- [x] `PF-15`: Forklift blocked from narrow aisles (< 3000mm) (LULUS)
- [x] `PF-16`: One-way aisle direction enforced (LULUS)
- [x] `PF-17`: Performance: A* < 2ms for 300-node graph (LULUS)

### Phase 4: Canvas UI & Path Overlay
- [x] `PF-18`: Grid overlay toggleable on canvas (LULUS)
- [x] `PF-19`: Path polyline rendered correctly (LULUS)
- [x] `PF-20`: Click source → click destination → path shown (LULUS)
- [x] `PF-21`: Path auto-recalculates on rack move / selection change (LULUS)

### Phase 5: Backend Pathfinding REST API
- [x] `PF-22`: `POST /path` endpoint returns valid path & metrics (LULUS)
- [x] `PF-23`: Agent type affects path result & location code resolution (LULUS)
- [x] `PF-24`: Invalid from/to returns 400 / 404 cleanly (LULUS)

---

## 15. Keputusan yang Perlu Diambil

> **Sebelum implementasi dimulai, perlu keputusan dari tim:**

| # | Keputusan | Opsi | Rekomendasi |
|---|---|---|---|
| 1 | Cell size | 250mm vs 500mm | **250mm** (lebih presisi, cost minimal) |
| 2 | Multi-agent | Langsung semua agent vs human-only dulu | **Human-only dulu** (Phase 1-3), tambah agent di Phase 4+ |
| 3 | Neighbor connectivity | 4-connected vs 8-connected | **4-connected** (lebih natural untuk lorong warehouse) |
| 4 | Phase prioritas | Phase 1 → 2 → 3 → 4 → 5 | **Sequential** (tiap phase bergantung sebelumnya) |
| 5 | Visualisasi grid | Heatmap overlay vs debug-only | **Heatmap overlay** (value untuk manager) |
| 6 | Path caching (backend) | In-memory vs DB BLOB | **In-memory dulu**, DB BLOB nanti |

---

> **Dokumen ini adalah planning document. Tidak ada kode yang diubah sampai ada persetujuan.**
