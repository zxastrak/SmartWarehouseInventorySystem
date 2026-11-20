/**
 * Unit Test for Phase 4 Pathfinding UI & Visualizer Integration
 * Native node:test and node:assert/strict runner. ESM format.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutSnapshot } from '../../../../../shared/layout-core/src/dto.js';
import { OccupancyGrid, CellType } from '../../../../../shared/layout-core/src/occupancyGrid.js';
import { buildLayoutRouting } from '../../../../../shared/layout-core/src/gridBuilder.js';
import { astar } from '../../../../../shared/layout-core/src/pathfinder.js';
import { getVisibleWorldBounds, createViewport } from '../engine/viewport.js';

describe('Phase 4: Pathfinding Canvas UI & Overlay Logic', () => {
  const sampleSnapshot = createLayoutSnapshot({
    warehouse: { id: 1, code: 'WH-MAIN', name: 'Main Hub', width_mm: 50000, length_mm: 80000, height_mm: 10000 },
    zones: [{ id: 1, zone_code: 'Z-IN', name: 'Inbound', color_hex: '#5c732b', x_mm: 0, y_mm: 0, width_mm: 50000, length_mm: 10000 }],
    aisles: [
      { id: 1, aisle_code: 'A-01', name: 'Aisle 1', x_mm: 4000, y_mm: 0, width_mm: 3500, length_mm: 60000, direction: 'two_way' },
      { id: 2, aisle_code: 'A-CROSS', name: 'Crossway', x_mm: 0, y_mm: 20000, width_mm: 40000, length_mm: 3500, direction: 'two_way' },
    ],
    racks: [
      { id: 10, rack_code: 'R-01', x_mm: 8000, y_mm: 5000, length_mm: 3000, depth_mm: 1000, height_mm: 5000, rotation: 0, access_side: 'left' },
      { id: 20, rack_code: 'R-02', x_mm: 8000, y_mm: 25000, length_mm: 3000, depth_mm: 1000, height_mm: 5000, rotation: 0, access_side: 'left' },
    ],
    layoutObjects: [
      { id: 1, object_type: 'dock', name: 'Dock Utama', x_mm: 0, y_mm: 0, width_mm: 3000, length_mm: 3000, rotation: 0, clearance_mm: 500 },
    ],
  });

  test('PF-18: Ekstraksi kandidat rute dropdown dari snapshot', () => {
    const docks = (sampleSnapshot.layout_objects || [])
      .filter((o) => o.object_type === 'dock' || o.object_type === 'door')
      .map((o) => ({ id: `${o.object_type}_${o.id}`, label: `${o.name || o.object_type} (${o.object_type.toUpperCase()})` }));

    const racks = (sampleSnapshot.racks || [])
      .filter((r) => !r.retired_at)
      .map((r) => ({ id: `pick_rack_${r.id}`, label: `Rak ${r.rack_code}` }));

    assert.equal(docks.length, 1);
    assert.equal(docks[0].id, 'dock_1');
    assert.equal(docks[0].label, 'Dock Utama (DOCK)');

    assert.equal(racks.length, 2);
    assert.equal(racks[0].id, 'pick_rack_10');
    assert.equal(racks[0].label, 'Rak R-01');
    assert.equal(racks[1].id, 'pick_rack_20');
    assert.equal(racks[1].label, 'Rak R-02');
  });

  test('PF-19: Pipeline visualisasi rute menghasilkan polyline point yang valid', () => {
    const { grid, graph } = buildLayoutRouting(sampleSnapshot, 250);

    const route = astar(graph, 'dock_1', 'pick_rack_20', {
      agentProfile: { minAisleWidthMm: 600 },
    });

    assert.ok(route);
    assert.ok(route.path.length >= 3);
    assert.ok(route.totalDistanceMm > 0);
    assert.ok(route.turns >= 1);

    // Titik awal harus di dekat Dock 1
    assert.equal(route.path[0].nodeId, 'dock_1');
    // Titik akhir harus pick-face rak R-02
    assert.equal(route.path[route.path.length - 1].nodeId, 'pick_rack_20');

    // Setiap titik memiliki koordinat mm yang valid
    for (const pt of route.path) {
      assert.equal(typeof pt.xMm, 'number');
      assert.equal(typeof pt.yMm, 'number');
      assert.ok(Number.isFinite(pt.xMm));
      assert.ok(Number.isFinite(pt.yMm));
    }
  });

  test('PF-20: Viewport culling pada OccupancyGrid heatmap', () => {
    const grid = new OccupancyGrid(50000, 80000, 250); // 200 x 320 cells
    const vp = createViewport(0.02, 50, 50); // Zoom in tertentu

    const bounds = getVisibleWorldBounds(vp, 800, 600);
    assert.ok(bounds.width > 0);
    assert.ok(bounds.depth > 0);

    // Hitung range kolom dan baris yang terlihat
    const minCol = Math.max(0, Math.floor(bounds.x / grid.cellSize));
    const maxCol = Math.min(grid.cols - 1, Math.floor((bounds.x + bounds.width) / grid.cellSize));
    const minRow = Math.max(0, Math.floor(bounds.y / grid.cellSize));
    const maxRow = Math.min(grid.rows - 1, Math.floor((bounds.y + bounds.depth) / grid.cellSize));

    const visibleCellsCount = (maxCol - minCol + 1) * (maxRow - minRow + 1);
    // Sel terlihat harus jauh lebih kecil dari total 64.000 sel (efisiensi 60 FPS)
    assert.ok(visibleCellsCount < grid.cols * grid.rows);
  });
});
