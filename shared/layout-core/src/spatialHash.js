/**
 * Uniform Spatial Hash 2D Grid
 * Enables fast spatial querying (O(1) average cell lookup)
 * for collision checks and viewport culling on large numbers of layout entities (500+ racks).
 */

import { overlaps } from './geometry.js';

class SpatialHash {
  /**
   * @param {number} [cellSize=1000] - Cell size in millimeters (default: 1000 mm / 1 m)
   */
  constructor(cellSize = 1000) {
    if (typeof cellSize !== 'number' || cellSize <= 0) {
      throw new RangeError('cellSize harus berupa angka positif dalam milimeter');
    }
    this.cellSize = cellSize;
    /** @type {Map<string, Set<any>>} */
    this.grid = new Map();
    /** @type {Map<any, { rect: { x: number, y: number, width: number, depth: number }, cellKeys: Set<string> }>} */
    this.items = new Map();
  }

  /**
   * Computes grid cell key for a given point.
   * @param {number} x
   * @param {number} y
   * @returns {string}
   */
  _cellKey(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx}:${cy}`;
  }

  /**
   * Computes all cell keys overlapped by a rectangle.
   * @param {{ x: number, y: number, width: number, depth: number }} rect
   * @returns {string[]}
   */
  _getKeysForRect(rect) {
    const minX = Math.floor(rect.x / this.cellSize);
    const maxX = Math.floor((rect.x + rect.width) / this.cellSize);
    const minY = Math.floor(rect.y / this.cellSize);
    const maxY = Math.floor((rect.y + rect.depth) / this.cellSize);

    const keys = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        keys.push(`${x}:${y}`);
      }
    }
    return keys;
  }

  /**
   * Inserts an item into the spatial hash.
   * @param {any} id
   * @param {{ x: number, y: number, width: number, depth: number }} rect
   */
  insert(id, rect) {
    if (this.items.has(id)) {
      this.remove(id);
    }

    const cellKeys = new Set(this._getKeysForRect(rect));
    for (const key of cellKeys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      this.grid.get(key).add(id);
    }

    this.items.set(id, {
      rect: { ...rect },
      cellKeys,
    });
  }

  /**
   * Removes an item from the spatial hash.
   * @param {any} id
   */
  remove(id) {
    const entry = this.items.get(id);
    if (!entry) return;

    for (const key of entry.cellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        cell.delete(id);
        if (cell.size === 0) {
          this.grid.delete(key);
        }
      }
    }

    this.items.delete(id);
  }

  /**
   * Updates an item's rectangle in the spatial hash.
   * @param {any} id
   * @param {{ x: number, y: number, width: number, depth: number }} newRect
   */
  update(id, newRect) {
    this.insert(id, newRect);
  }

  /**
   * Queries all candidate items that intersect or overlap with the target rectangle.
   * Performs broad-phase cell lookup followed by narrow-phase AABB positive area overlap check.
   *
   * @param {{ x: number, y: number, width: number, depth: number }} rect
   * @param {any} [excludeId=null] - Optional ID to ignore (e.g. self during drag)
   * @returns {any[]} List of IDs colliding with target rect
   */
  query(rect, excludeId = null) {
    const keys = this._getKeysForRect(rect);
    const candidates = new Set();

    const isExcluded = (id) => {
      if (excludeId === null || excludeId === undefined) return false;
      if (id === excludeId) return true;
      const sId = String(id);
      const sExclude = String(excludeId);
      if (sId === sExclude) return true;
      if (sId.endsWith(`:${sExclude}`) || sExclude.endsWith(`:${sId}`)) return true;
      return false;
    };

    for (const key of keys) {
      const cell = this.grid.get(key);
      if (cell) {
        for (const id of cell) {
          if (!isExcluded(id)) {
            candidates.add(id);
          }
        }
      }
    }

    // Narrow phase: periksa tabrakan area positif secara tepat
    const collidingIds = [];
    for (const id of candidates) {
      const entry = this.items.get(id);
      if (entry && overlaps(rect, entry.rect)) {
        collidingIds.push(id);
      }
    }

    return collidingIds;
  }

  /**
   * Queries all items contained within a bounding box (e.g. for viewport culling).
   * @param {{ x: number, y: number, width: number, depth: number }} viewportRect
   * @returns {any[]}
   */
  queryViewport(viewportRect) {
    const keys = this._getKeysForRect(viewportRect);
    const candidates = new Set();

    for (const key of keys) {
      const cell = this.grid.get(key);
      if (cell) {
        for (const id of cell) {
          candidates.add(id);
        }
      }
    }

    const visibleIds = [];
    for (const id of candidates) {
      const entry = this.items.get(id);
      if (entry && overlaps(viewportRect, entry.rect)) {
        visibleIds.push(id);
      }
    }

    return visibleIds;
  }

  /**
   * Clears the entire spatial hash.
   */
  clear() {
    this.grid.clear();
    this.items.clear();
  }

  /**
   * Returns current count of indexed items.
   * @returns {number}
   */
  get size() {
    return this.items.size;
  }
}

export { SpatialHash };
export default SpatialHash;
