/**
 * Unit Test Suite for occupancyGrid.js (PF-01 through PF-06)
 * Native node:test and node:assert/strict runner. ESM format.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CellType, OccupancyGrid } from '../src/occupancyGrid.js';

describe('OccupancyGrid & CellType (PF-01 s/d PF-06)', () => {
  test('PF-01: Konstruksi OccupancyGrid menghitung cols dan rows secara tepat', () => {
    // 50,000mm x 80,000mm dengan cellSize 250mm
    const grid = new OccupancyGrid(50000, 80000, 250);
    assert.equal(grid.cols, 200);
    assert.equal(grid.rows, 320);
    assert.equal(grid.data.length, 200 * 320);
    assert.equal(grid.cellSize, 250);

    // Default cell value adalah WALKABLE (0)
    assert.equal(grid.get(0, 0), CellType.WALKABLE);
    assert.equal(grid.get(100, 150), CellType.WALKABLE);
  });

  test('PF-02: stampRect menandai sel sesuai CellType yang ditentukan', () => {
    const grid = new OccupancyGrid(2000, 2000, 250); // 8x8 grid
    // Stamp rak di koordinat (250, 250) ukuran 500x500 (2x2 cell)
    grid.stampRect(250, 250, 500, 500, CellType.RACK);

    assert.equal(grid.get(1, 1), CellType.RACK);
    assert.equal(grid.get(2, 1), CellType.RACK);
    assert.equal(grid.get(1, 2), CellType.RACK);
    assert.equal(grid.get(2, 2), CellType.RACK);

    // Di luar area tetap WALKABLE
    assert.equal(grid.get(0, 0), CellType.WALKABLE);
    assert.equal(grid.get(3, 3), CellType.WALKABLE);
  });

  test('PF-03: stampClearanceRing membuat zona buffer CLEARANCE di luar body obstacle', () => {
    const grid = new OccupancyGrid(3000, 3000, 250); // 12x12
    // Pillar di (1000, 1000) ukuran 250x250 dengan buffer clearance 250mm
    grid.stampClearanceRing(1000, 1000, 250, 250, 250, CellType.BLOCKED);

    // Body pillar di col=4, row=4 harus BLOCKED
    assert.equal(grid.get(4, 4), CellType.BLOCKED);

    // Ring perimeter harus CLEARANCE (misal col=3 row=4 atau col=4 row=3)
    assert.equal(grid.get(3, 4), CellType.CLEARANCE);
    assert.equal(grid.get(5, 4), CellType.CLEARANCE);
    assert.equal(grid.get(4, 3), CellType.CLEARANCE);
    assert.equal(grid.get(4, 5), CellType.CLEARANCE);

    // Di luar ring buffer tetap WALKABLE
    assert.equal(grid.get(1, 1), CellType.WALKABLE);
  });

  test('PF-04: Akses out-of-bounds selalu mengembalikan CellType.BLOCKED', () => {
    const grid = new OccupancyGrid(1000, 1000, 250); // 4x4
    assert.equal(grid.get(-1, 0), CellType.BLOCKED);
    assert.equal(grid.get(0, -1), CellType.BLOCKED);
    assert.equal(grid.get(4, 2), CellType.BLOCKED);
    assert.equal(grid.get(2, 4), CellType.BLOCKED);
    assert.equal(grid.get(999, 999), CellType.BLOCKED);
  });

  test('PF-05: mmToCell dan cellToMm presisi dan konsisten', () => {
    const grid = new OccupancyGrid(5000, 5000, 250);

    const cell = grid.mmToCell(750, 1250);
    assert.equal(cell.col, 3);
    assert.equal(cell.row, 5);

    const coord = grid.cellToMm(3, 5);
    // Titik tengah sel col=3 (750..1000) -> 875, row=5 (1250..1500) -> 1375
    assert.equal(coord.xMm, 875);
    assert.equal(coord.yMm, 1375);
  });

  test('PF-06: Passability dan neighbor lookup orthogonal & diagonal', () => {
    const grid = new OccupancyGrid(1000, 1000, 250); // 4x4
    // Set cell (1, 0) sebagai RACK (impassable)
    grid.set(1, 0, CellType.RACK);

    assert.equal(grid.isPassable(1, 0), false);
    assert.equal(grid.isPassable(0, 0), true);

    // Neighbors dari (0, 0): (1, 0) diblok, jadi hanya (0, 1) yang valid
    const n4 = grid.getNeighbors4(0, 0);
    assert.equal(n4.length, 1);
    assert.equal(n4[0].col, 0);
    assert.equal(n4[0].row, 1);

    // Diagonal cutting check: (1, 1) tidak boleh dipotong jika (1, 0) terblok
    const n8 = grid.getNeighbors8(0, 0);
    const hasDiag = n8.some((n) => n.col === 1 && n.row === 1);
    assert.equal(hasDiag, false, 'Diagonal move tidak boleh memotong sudut obstacle yang terblokir');
  });
});
