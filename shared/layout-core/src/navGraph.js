/**
 * Navigation Graph Module (Sparse Weighted Graph for Warehouse Routing)
 * Stores discrete navigational nodes (intersections, pick-faces, docks, doors)
 * and weighted traversable edges. Zero external runtime dependencies. ESM format.
 */

import { validateInteger } from './geometry.js';

class NavGraph {
  constructor() {
    /** @type {Map<string, { id: string, xMm: number, yMm: number, type: string, metadata: Object }>} */
    this.nodes = new Map();
    /** @type {Map<string, Array<{ to: string, cost: number, metadata: Object }>>} */
    this.edges = new Map();
  }

  /**
   * Adds or updates a navigational node.
   * @param {string} id
   * @param {number} xMm
   * @param {number} yMm
   * @param {string} [type='WAYPOINT'] - INTERSECTION, ENDPOINT, PICK_FACE, DOCK, DOOR, WAYPOINT
   * @param {Object} [metadata={}]
   * @returns {{ id: string, xMm: number, yMm: number, type: string, metadata: Object }}
   */
  addNode(id, xMm, yMm, type = 'WAYPOINT', metadata = {}) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new TypeError(`nodeId harus berupa non-empty string, diterima: ${id}`);
    }
    validateInteger(xMm, 'xMm', true);
    validateInteger(yMm, 'yMm', true);

    const node = {
      id: id.trim(),
      xMm,
      yMm,
      type,
      metadata: { ...metadata },
    };

    this.nodes.set(node.id, node);
    if (!this.edges.has(node.id)) {
      this.edges.set(node.id, []);
    }
    return node;
  }

  /**
   * Retrieves a node by ID.
   * @param {string} id
   * @returns {{ id: string, xMm: number, yMm: number, type: string, metadata: Object } | null}
   */
  getNode(id) {
    return this.nodes.get(id) || null;
  }

  /**
   * Adds a directional or bidirectional edge between two nodes.
   * If cost is not provided, Euclidean distance in mm is calculated.
   * @param {string} fromId
   * @param {string} toId
   * @param {number} [cost=null]
   * @param {Object} [metadata={}]
   * @param {boolean} [bidirectional=true]
   */
  addEdge(fromId, toId, cost = null, metadata = {}, bidirectional = true) {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (!fromNode || !toNode) {
      throw new Error(`Koneksi edge gagal: node '${!fromNode ? fromId : toId}' tidak ditemukan di graf.`);
    }

    const calculatedCost =
      typeof cost === 'number' && cost >= 0
        ? cost
        : Math.hypot(toNode.xMm - fromNode.xMm, toNode.yMm - fromNode.yMm);

    this._addDirectedEdge(fromId, toId, calculatedCost, metadata);
    if (bidirectional) {
      this._addDirectedEdge(toId, fromId, calculatedCost, metadata);
    }
  }

  _addDirectedEdge(fromId, toId, cost, metadata) {
    const edgeList = this.edges.get(fromId) || [];
    const existingIndex = edgeList.findIndex((e) => e.to === toId);
    const edgeObj = { to: toId, cost, metadata: { ...metadata } };

    if (existingIndex >= 0) {
      edgeList[existingIndex] = edgeObj;
    } else {
      edgeList.push(edgeObj);
    }
    this.edges.set(fromId, edgeList);
  }

  /**
   * Returns outgoing edges / adjacent neighbors for a node.
   * @param {string} id
   * @returns {Array<{ to: string, cost: number, metadata: Object }>}
   */
  getNeighbors(id) {
    return this.edges.get(id) || [];
  }

  /**
   * Removes a node and all referencing edges.
   * @param {string} id
   */
  removeNode(id) {
    if (!this.nodes.has(id)) return;
    this.nodes.delete(id);
    this.edges.delete(id);

    // Hapus edge masuk dari node lain
    for (const [fromId, edgeList] of this.edges.entries()) {
      const filtered = edgeList.filter((e) => e.to !== id);
      if (filtered.length !== edgeList.length) {
        this.edges.set(fromId, filtered);
      }
    }
  }

  /**
   * Removes an edge between two nodes.
   * @param {string} fromId
   * @param {string} toId
   * @param {boolean} [bidirectional=true]
   */
  removeEdge(fromId, toId, bidirectional = true) {
    const listA = this.edges.get(fromId);
    if (listA) {
      this.edges.set(fromId, listA.filter((e) => e.to !== toId));
    }
    if (bidirectional) {
      const listB = this.edges.get(toId);
      if (listB) {
        this.edges.set(toId, listB.filter((e) => e.to !== fromId));
      }
    }
  }

  /**
   * Clears all nodes and edges.
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
  }

  get size() {
    return this.nodes.size;
  }

  get edgeCount() {
    let count = 0;
    for (const edgeList of this.edges.values()) {
      count += edgeList.length;
    }
    return count;
  }
}

export { NavGraph };
export default NavGraph;
