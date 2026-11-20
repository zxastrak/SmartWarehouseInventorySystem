/**
 * Occupancy Grid Matrix (2D Integer Millimeters Rasterization)
 * Flat Uint8Array representation of warehouse floor for fast spatial walkability and pathfinding.
 * Zero external runtime dependencies. ESM format.
 */

import { validateInteger } from './geometry.js';

/**
 * Enumeration of cell occupancy types
 */
const CellType = Object.freeze({
  WALKABLE: 0,   // Open floor, traversable
  BLOCKED: 1,    // Wall, pillar, impassable obstacle
  RACK: 2,       // Physical rack storage footprint (impassable)
  AISLE: 3,      // Designated traffic corridor (preferred walkable)
  DOCK: 4,       // Inbound/Outbound loading dock (entry/exit point)
  DOOR: 5,       // Warehouse passage door (chokepoint)
  CLEARANCE: 6,  // Safety buffer around obstacles/racks (penalized walkability)
  PICK_FACE: 7,  // Accessible rack face (navigation destination)
});

class OccupancyGrid {
  /**
   * @param {number} widthMm - Warehouse width (X axis) in mm
   * @param {number} lengthMm - Warehouse length (Y axis) in mm
   * @param {number} [cellWidthMm=700] - Modular slot length / cell width along X in mm (default: 700 mm / 70 cm)
   * @param {number} [cellDepthMm=null] - Modular slot depth / cell depth along Y in mm (default: 500 mm / 50 cm or cellWidthMm)
   */
  constructor(widthMm, lengthMm, cellWidthMm = 700, cellDepthMm = null) {
    validateInteger(widthMm, 'widthMm', false);
    validateInteger(lengthMm, 'lengthMm', false);
    validateInteger(cellWidthMm, 'cellWidthMm', false);

    const actualCellDepth = cellDepthMm !== null && cellDepthMm !== undefined ? cellDepthMm : cellWidthMm;
    validateInteger(actualCellDepth, 'cellDepthMm', false);

    this.widthMm = widthMm;
    this.lengthMm = lengthMm;
    this.cellWidthMm = cellWidthMm;
    this.cellDepthMm = actualCellDepth;
    this.cellSize = cellWidthMm; // backward compatibility
    this.cols = Math.ceil(widthMm / this.cellWidthMm);
    this.rows = Math.ceil(lengthMm / this.cellDepthMm);
    this.data = new Uint8Array(this.cols * this.rows);
  }

  /**
   * Reads cell type at discrete coordinate (col, row).
   * Out-of-bounds coordinates return CellType.BLOCKED.
   * @param {number} col
   * @param {number} row
   * @returns {number} CellType
   */
  get(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return CellType.BLOCKED;
    }
    return this.data[row * this.cols + col];
  }

  /**
   * Writes cell type at discrete coordinate (col, row).
   * Silently ignores out-of-bounds writes.
   * @param {number} col
   * @param {number} row
   * @param {number} cellType
   */
  set(col, row, cellType) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.data[row * this.cols + col] = cellType;
    }
  }

  /**
   * Converts continuous physical millimeter coordinate to grid cell indices.
   * Clamped to valid range.
   * @param {number} xMm
   * @param {number} yMm
   * @returns {{ col: number, row: number }}
   */
  mmToCell(xMm, yMm) {
    return {
      col: Math.max(0, Math.min(this.cols - 1, Math.floor(xMm / this.cellWidthMm))),
      row: Math.max(0, Math.min(this.rows - 1, Math.floor(yMm / this.cellDepthMm))),
    };
  }

  /**
   * Converts grid cell indices to continuous physical millimeter coordinate (center of cell).
   * @param {number} col
   * @param {number} row
   * @returns {{ xMm: number, yMm: number }}
   */
  cellToMm(col, row) {
    return {
      xMm: col * this.cellWidthMm + Math.floor(this.cellWidthMm / 2),
      yMm: row * this.cellDepthMm + Math.floor(this.cellDepthMm / 2),
    };
  }

  /**
   * Stamps a rectangular region with a given CellType.
   * @param {number} xMm
   * @param {number} yMm
   * @param {number} widthMm
   * @param {number} depthMm
   * @param {number} cellType
   */
  stampRect(xMm, yMm, widthMm, depthMm, cellType) {
    if (widthMm <= 0 || depthMm <= 0) return;

    const minCol = Math.max(0, Math.floor(xMm / this.cellWidthMm));
    const maxCol = Math.min(this.cols - 1, Math.floor((xMm + widthMm - 1) / this.cellWidthMm));
    const minRow = Math.max(0, Math.floor(yMm / this.cellDepthMm));
    const maxRow = Math.min(this.rows - 1, Math.floor((yMm + depthMm - 1) / this.cellDepthMm));

    for (let r = minRow; r <= maxRow; r++) {
      const rowOffset = r * this.cols;
      for (let c = minCol; c <= maxCol; c++) {
        this.data[rowOffset + c] = cellType;
      }
    }
  }

  /**
   * Stamps an obstacle with a clearance buffer zone around its perimeter.
   * Clearance area is stamped with CellType.CLEARANCE first, then the entity body is stamped.
   * @param {number} xMm
   * @param {number} yMm
   * @param {number} widthMm
   * @param {number} depthMm
   * @param {number} clearanceMm
   * @param {number} [bodyType=CellType.BLOCKED]
   */
  stampClearanceRing(xMm, yMm, widthMm, depthMm, clearanceMm, bodyType = CellType.BLOCKED) {
    if (clearanceMm > 0) {
      this.stampRect(
        xMm - clearanceMm,
        yMm - clearanceMm,
        widthMm + 2 * clearanceMm,
        depthMm + 2 * clearanceMm,
        CellType.CLEARANCE
      );
    }
    this.stampRect(xMm, yMm, widthMm, depthMm, bodyType);
  }

  /**
   * Checks if a cell is passable based on cell type and optional agent profile.
   * @param {number} col
   * @param {number} row
   * @param {Object} [agentProfile]
   * @returns {boolean}
   */
  isPassable(col, row, agentProfile = null) {
    const type = this.get(col, row);
    if (type === CellType.BLOCKED || type === CellType.RACK) {
      return false;
    }
    if (type === CellType.CLEARANCE && agentProfile?.cannotEnterClearance) {
      return false;
    }
    return true;
  }

  /**
   * Gets orthogonal 4-connected passable neighbor cells (North, South, East, West).
   * @param {number} col
   * @param {number} row
   * @param {Object} [agentProfile]
   * @returns {Array<{ col: number, row: number }>}
   */
  getNeighbors4(col, row, agentProfile = null) {
    const candidates = [
      { col: col, row: row - 1 }, // Up / North
      { col: col + 1, row: row }, // Right / East
      { col: col, row: row + 1 }, // Down / South
      { col: col - 1, row: row }, // Left / West
    ];
    return candidates.filter((n) => this.isPassable(n.col, n.row, agentProfile));
  }

  /**
   * Gets 8-connected passable neighbor cells including diagonals.
   * Diagonal moves are pruned if adjacent orthogonal cells are blocked to prevent cutting corners.
   * @param {number} col
   * @param {number} row
   * @param {Object} [agentProfile]
   * @returns {Array<{ col: number, row: number }>}
   */
  getNeighbors8(col, row, agentProfile = null) {
    const results = this.getNeighbors4(col, row, agentProfile);

    // Diagonals with corner cutting check
    const diagonals = [
      { col: col - 1, row: row - 1, adj1: [col - 1, row], adj2: [col, row - 1] },
      { col: col + 1, row: row - 1, adj1: [col + 1, row], adj2: [col, row - 1] },
      { col: col - 1, row: row + 1, adj1: [col - 1, row], adj2: [col, row + 1] },
      { col: col + 1, row: row + 1, adj1: [col + 1, row], adj2: [col, row + 1] },
    ];

    for (const d of diagonals) {
      if (
        this.isPassable(d.col, d.row, agentProfile) &&
        this.isPassable(d.adj1[0], d.adj1[1], agentProfile) &&
        this.isPassable(d.adj2[0], d.adj2[1], agentProfile)
      ) {
        results.push({ col: d.col, row: d.row });
      }
    }

    return results;
  }
}

export { CellType, OccupancyGrid };
export default { CellType, OccupancyGrid };
