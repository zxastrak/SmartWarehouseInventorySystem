/**
 * Pathfinder Module (A* & Dijkstra on NavGraph)
 * Provides optimal routing, turn penalties, multi-agent cost constraints,
 * and path smoothing. Zero external runtime dependencies. ESM format.
 */

/**
 * High-performance binary min-heap for priority queue in A*
 */
class MinHeap {
  constructor() {
    /** @type {Array<{ nodeId: string, f: number, g: number }>} */
    this.data = [];
  }

  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return null;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  isEmpty() {
    return this.data.length === 0;
  }

  get size() {
    return this.data.length;
  }

  _bubbleUp(index) {
    const item = this.data[index];
    while (index > 0) {
      const parentIdx = (index - 1) >> 1;
      const parent = this.data[parentIdx];
      if (item.f >= parent.f) break;
      this.data[index] = parent;
      index = parentIdx;
    }
    this.data[index] = item;
  }

  _sinkDown(index) {
    const length = this.data.length;
    const item = this.data[index];
    const halfLength = length >> 1;

    while (index < halfLength) {
      let leftIdx = (index << 1) + 1;
      let rightIdx = leftIdx + 1;
      let bestIdx = leftIdx;

      if (rightIdx < length && this.data[rightIdx].f < this.data[leftIdx].f) {
        bestIdx = rightIdx;
      }

      if (item.f <= this.data[bestIdx].f) break;

      this.data[index] = this.data[bestIdx];
      index = bestIdx;
    }
    this.data[index] = item;
  }
}

/**
 * Admissible and consistent Euclidean heuristic
 * @param {{ xMm: number, yMm: number }} a
 * @param {{ xMm: number, yMm: number }} b
 * @returns {number}
 */
function heuristic(a, b) {
  return Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
}

/**
 * Computes turns along a discrete path of coordinate points.
 * @param {Array<{ xMm: number, yMm: number }>} points
 * @returns {number}
 */
function countTurns(points) {
  if (!points || points.length < 3) return 0;
  let turns = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.xMm - prev.xMm;
    const dy1 = curr.yMm - prev.yMm;
    const dx2 = next.xMm - curr.xMm;
    const dy2 = next.yMm - curr.yMm;

    // Dot product dan cross product untuk cek perubahan arah
    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) > 1e-4) {
      turns++;
    }
  }
  return turns;
}

/**
 * Reconstructs path list from cameFrom map.
 * @param {import('./navGraph').NavGraph} graph
 * @param {Map<string, string>} cameFrom
 * @param {string} goalId
 * @param {number} totalCost
 * @returns {{ path: Array<Object>, totalDistanceMm: number, totalCost: number, turns: number }}
 */
function reconstructPath(graph, cameFrom, goalId, totalCost) {
  const path = [];
  let currId = goalId;

  while (currId) {
    const node = graph.getNode(currId);
    if (!node) break;
    path.unshift({
      nodeId: node.id,
      xMm: node.xMm,
      yMm: node.yMm,
      type: node.type,
      metadata: node.metadata,
    });
    currId = cameFrom.get(currId);
  }

  let totalDistMm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistMm += Math.hypot(path[i + 1].xMm - path[i].xMm, path[i + 1].yMm - path[i].yMm);
  }

  return {
    path,
    totalDistanceMm: Math.round(totalDistMm),
    totalCost: Math.round(totalCost),
    turns: countTurns(path),
  };
}

/**
 * Finds optimal route between startId and goalId using A* on NavGraph.
 *
 * @param {import('./navGraph').NavGraph} graph
 * @param {string} startId
 * @param {string} goalId
 * @param {Object} [options]
 * @param {Function} [options.costFn] - (fromNode, toNode, edge) => cost
 * @param {Object} [options.agentProfile] - agent constraints (e.g. minAisleWidthMm)
 * @returns {{ path: Array<Object>, totalDistanceMm: number, totalCost: number, turns: number, visitedCount: number } | null}
 */
function astar(graph, startId, goalId, options = {}) {
  const startNode = graph.getNode(startId);
  const goalNode = graph.getNode(goalId);

  if (!startNode || !goalNode) {
    return null;
  }

  if (startId === goalId) {
    return {
      path: [
        {
          nodeId: startNode.id,
          xMm: startNode.xMm,
          yMm: startNode.yMm,
          type: startNode.type,
          metadata: startNode.metadata,
        },
      ],
      totalDistanceMm: 0,
      totalCost: 0,
      turns: 0,
      visitedCount: 1,
    };
  }

  const { costFn, agentProfile } = options;
  const open = new MinHeap();
  const gScore = new Map();
  const cameFrom = new Map();
  const closed = new Set();

  gScore.set(startId, 0);
  open.push({
    nodeId: startId,
    f: heuristic(startNode, goalNode),
    g: 0,
  });

  let visitedCount = 0;

  while (!open.isEmpty()) {
    const current = open.pop();
    const currId = current.nodeId;

    if (currId === goalId) {
      const result = reconstructPath(graph, cameFrom, goalId, current.g);
      return { ...result, visitedCount };
    }

    if (closed.has(currId)) continue;
    closed.add(currId);
    visitedCount++;

    const currNode = graph.getNode(currId);
    const neighbors = graph.getNeighbors(currId);

    for (const edge of neighbors) {
      const neighborId = edge.to;
      if (closed.has(neighborId)) continue;

      const neighborNode = graph.getNode(neighborId);
      if (!neighborNode) continue;

      // Agent profile constraints (e.g. narrow aisle check)
      if (agentProfile?.minAisleWidthMm && edge.metadata?.aisleWidthMm) {
        if (edge.metadata.aisleWidthMm < agentProfile.minAisleWidthMm) {
          continue; // cannot traverse too narrow aisle
        }
      }

      // Cost calculation
      let stepCost = edge.cost;
      if (typeof costFn === 'function') {
        stepCost = costFn(currNode, neighborNode, edge);
        if (stepCost === Infinity || stepCost < 0) continue;
      }

      const tentativeG = current.g + stepCost;
      const currentBestG = gScore.get(neighborId);

      if (currentBestG === undefined || tentativeG < currentBestG) {
        cameFrom.set(neighborId, currId);
        gScore.set(neighborId, tentativeG);
        const f = tentativeG + heuristic(neighborNode, goalNode);
        open.push({ nodeId: neighborId, f, g: tentativeG });
      }
    }
  }

  return null; // Destination unreachable
}

/**
 * Finds shortest route to any target in targetIds set using Dijkstra.
 * Useful for "nearest accessible rack slot from dock".
 *
 * @param {import('./navGraph').NavGraph} graph
 * @param {string} startId
 * @param {Set<string>|Array<string>} targetIds
 * @param {Object} [options]
 * @returns {{ targetId: string, path: Array<Object>, totalDistanceMm: number, totalCost: number, turns: number } | null}
 */
function dijkstraMultiTarget(graph, startId, targetIds, options = {}) {
  const targetSet = new Set(targetIds);
  if (targetSet.size === 0) return null;

  const startNode = graph.getNode(startId);
  if (!startNode) return null;

  if (targetSet.has(startId)) {
    return {
      targetId: startId,
      path: [
        {
          nodeId: startNode.id,
          xMm: startNode.xMm,
          yMm: startNode.yMm,
          type: startNode.type,
          metadata: startNode.metadata,
        },
      ],
      totalDistanceMm: 0,
      totalCost: 0,
      turns: 0,
    };
  }

  const { costFn, agentProfile } = options;
  const open = new MinHeap();
  const gScore = new Map();
  const cameFrom = new Map();
  const closed = new Set();

  gScore.set(startId, 0);
  open.push({ nodeId: startId, f: 0, g: 0 });

  while (!open.isEmpty()) {
    const current = open.pop();
    const currId = current.nodeId;

    if (targetSet.has(currId)) {
      const result = reconstructPath(graph, cameFrom, currId, current.g);
      return { targetId: currId, ...result };
    }

    if (closed.has(currId)) continue;
    closed.add(currId);

    const currNode = graph.getNode(currId);
    const neighbors = graph.getNeighbors(currId);

    for (const edge of neighbors) {
      const neighborId = edge.to;
      if (closed.has(neighborId)) continue;

      const neighborNode = graph.getNode(neighborId);
      if (!neighborNode) continue;

      if (agentProfile?.minAisleWidthMm && edge.metadata?.aisleWidthMm) {
        if (edge.metadata.aisleWidthMm < agentProfile.minAisleWidthMm) continue;
      }

      let stepCost = edge.cost;
      if (typeof costFn === 'function') {
        stepCost = costFn(currNode, neighborNode, edge);
        if (stepCost === Infinity || stepCost < 0) continue;
      }

      const tentativeG = current.g + stepCost;
      const currentBestG = gScore.get(neighborId);

      if (currentBestG === undefined || tentativeG < currentBestG) {
        cameFrom.set(neighborId, currId);
        gScore.set(neighborId, tentativeG);
        open.push({ nodeId: neighborId, f: tentativeG, g: tentativeG });
      }
    }
  }

  return null;
}

export { MinHeap, heuristic, countTurns, astar, dijkstraMultiTarget };
export default { MinHeap, heuristic, countTurns, astar, dijkstraMultiTarget };
