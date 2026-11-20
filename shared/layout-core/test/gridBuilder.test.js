/**
 * Unit Test Suite for gridBuilder.js (Snapshot -> Grid -> Graph -> Pathfinder Pipeline)
 * Native node:test and node:assert/strict runner. ESM format.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutSnapshot } from '../src/dto.js';
import { CellType } from '../src/occupancyGrid.js';
import { buildOccupancyGrid, buildNavGraph, buildLayoutRouting } from '../src/gridBuilder.js';
import { astar } from '../src/pathfinder.js';

describe('gridBuilder Pipeline (LayoutSnapshot -> Grid & Graph)', () => {
  const mockSnapshot = createLayoutSnapshot({
    warehouse: {
      id: 1,
      code: 'WH-TEST',
      name: 'Warehouse Test 50x50m',
      width_mm: 50000,
      length_mm: 50000,
      height_mm: 10000,
    },
    zones: [
      { id: 1, zone_code: 'Z-IN', name: 'Inbound Zone', color_hex: '#5c732b', x_mm: 0, y_mm: 0, width_mm: 50000, length_mm: 10000 },
    ],
    aisles: [
      { id: 1, aisle_code: 'AISLE-01', name: 'Main Aisle 1', x_mm: 5000, y_mm: 0, width_mm: 3000, length_mm: 40000, direction: 'two_way' },
      { id: 2, aisle_code: 'AISLE-CROSS', name: 'Cross Aisle', x_mm: 0, y_mm: 15000, width_mm: 40000, length_mm: 3000, direction: 'two_way' },
    ],
    racks: [
      { id: 101, rack_code: 'R-01', x_mm: 9000, y_mm: 5000, length_mm: 4000, depth_mm: 1200, height_mm: 6000, rotation: 0, access_side: 'left' },
    ],
    layoutObjects: [
      { id: 501, object_type: 'dock', name: 'Dock 1', x_mm: 0, y_mm: 0, width_mm: 4000, length_mm: 4000, rotation: 0, clearance_mm: 500 },
      { id: 502, object_type: 'pillar', name: 'Pillar A', x_mm: 20000, y_mm: 20000, width_mm: 1000, length_mm: 1000, rotation: 0, clearance_mm: 500 },
    ],
  });

  test('buildOccupancyGrid menghasilkan matriks raster yang lengkap', () => {
    const grid = buildOccupancyGrid(mockSnapshot, 500); // 500mm cell
    assert.equal(grid.cols, 100);
    assert.equal(grid.rows, 100);

    // Cek sel lorong
    const aisleCell = grid.mmToCell(6000, 5000);
    assert.equal(grid.get(aisleCell.col, aisleCell.row), CellType.AISLE);

    // Cek sel body rak
    const rackCell = grid.mmToCell(10000, 5500);
    assert.equal(grid.get(rackCell.col, rackCell.row), CellType.RACK);

    // Cek sel pick-face di depan rak
    const pickFaceCell = grid.mmToCell(10000, 4700);
    assert.equal(grid.get(pickFaceCell.col, pickFaceCell.row), CellType.PICK_FACE);

    // Cek sel dock
    const dockCell = grid.mmToCell(2000, 2000);
    assert.equal(grid.get(dockCell.col, dockCell.row), CellType.DOCK);

    // Cek sel pillar
    const pillarCell = grid.mmToCell(20500, 20500);
    assert.equal(grid.get(pillarCell.col, pillarCell.row), CellType.BLOCKED);
  });

  test('buildNavGraph mendeteksi persimpangan lorong dan menghubungkan dock ke rak', () => {
    const { grid, graph } = buildLayoutRouting(mockSnapshot, 500);

    assert.ok(graph.size > 0);
    // Harus ada simpul persimpangan antara AISLE-01 dan AISLE-CROSS
    const interNode = graph.getNode('inter_1_2');
    assert.ok(interNode, 'Simpul persimpangan inter_1_2 wajib ada');
    assert.equal(interNode.type, 'INTERSECTION');

    // Harus ada simpul dock dan pick-face rak
    const dockNode = graph.getNode('dock_501');
    assert.ok(dockNode, 'Simpul dock_501 wajib ada');

    const pickNode = graph.getNode('pick_rack_101');
    assert.ok(pickNode, 'Simpul pick_rack_101 wajib ada');

    // Eksekusi A* dari Dock 1 ke Rak R-01
    const route = astar(graph, 'dock_501', 'pick_rack_101');
    assert.ok(route, 'Harus ada rute yang valid dari Dock 1 ke Rak R-01');
    assert.ok(route.totalDistanceMm > 0);
    assert.ok(route.path.length >= 3);
  });
});
