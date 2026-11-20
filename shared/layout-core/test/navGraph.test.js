/**
 * Unit Test Suite for navGraph.js (PF-07 through PF-11)
 * Native node:test and node:assert/strict runner. ESM format.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NavGraph } from '../src/navGraph.js';

describe('NavGraph Topology & Structure (PF-07 s/d PF-11)', () => {
  test('PF-07: addNode dan getNode menyimpan simpul dengan metadata', () => {
    const graph = new NavGraph();
    const node = graph.addNode('dock_1', 1000, 2000, 'DOCK', { name: 'Dock Inbound 1' });

    assert.equal(node.id, 'dock_1');
    assert.equal(node.xMm, 1000);
    assert.equal(node.yMm, 2000);
    assert.equal(node.type, 'DOCK');
    assert.equal(node.metadata.name, 'Dock Inbound 1');

    const fetched = graph.getNode('dock_1');
    assert.deepEqual(fetched, node);
    assert.equal(graph.size, 1);
  });

  test('PF-08: addEdge menghitung cost Euclidean otomatis jika null', () => {
    const graph = new NavGraph();
    // (0, 0) ke (3000, 4000) -> segitiga 3-4-5 -> 5000mm
    graph.addNode('n1', 0, 0);
    graph.addNode('n2', 3000, 4000);
    graph.addEdge('n1', 'n2');

    const n1Neighbors = graph.getNeighbors('n1');
    assert.equal(n1Neighbors.length, 1);
    assert.equal(n1Neighbors[0].to, 'n2');
    assert.equal(n1Neighbors[0].cost, 5000);

    // Bidirectional secara default
    const n2Neighbors = graph.getNeighbors('n2');
    assert.equal(n2Neighbors.length, 1);
    assert.equal(n2Neighbors[0].to, 'n1');
    assert.equal(n2Neighbors[0].cost, 5000);
  });

  test('PF-09: addEdge directional vs bidirectional', () => {
    const graph = new NavGraph();
    graph.addNode('a', 0, 0);
    graph.addNode('b', 1000, 0);

    // One-way: a -> b saja
    graph.addEdge('a', 'b', 1000, { oneWay: true }, false);

    assert.equal(graph.getNeighbors('a').length, 1);
    assert.equal(graph.getNeighbors('b').length, 0);
  });

  test('PF-10: removeNode menghapus simpul dan semua edge yang mengarah padanya', () => {
    const graph = new NavGraph();
    graph.addNode('a', 0, 0);
    graph.addNode('b', 1000, 0);
    graph.addNode('c', 2000, 0);

    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');

    assert.equal(graph.size, 3);
    assert.equal(graph.edgeCount, 4); // 2 pasang bidirectional

    // Hapus b
    graph.removeNode('b');

    assert.equal(graph.size, 2);
    assert.equal(graph.getNode('b'), null);
    assert.equal(graph.getNeighbors('a').length, 0);
    assert.equal(graph.getNeighbors('c').length, 0);
    assert.equal(graph.edgeCount, 0);
  });

  test('PF-11: removeEdge dan clear membersihkan graf', () => {
    const graph = new NavGraph();
    graph.addNode('x', 0, 0);
    graph.addNode('y', 500, 0);
    graph.addEdge('x', 'y');

    assert.equal(graph.edgeCount, 2);
    graph.removeEdge('x', 'y', true);
    assert.equal(graph.edgeCount, 0);

    graph.clear();
    assert.equal(graph.size, 0);
  });
});
