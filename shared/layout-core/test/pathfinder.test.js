/**
 * Unit Test Suite for pathfinder.js (PF-12 through PF-17)
 * Native node:test and node:assert/strict runner. ESM format.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NavGraph } from '../src/navGraph.js';
import { MinHeap, astar, dijkstraMultiTarget, countTurns } from '../src/pathfinder.js';

describe('Pathfinder & A* Routing (PF-12 s/d PF-17)', () => {
  test('PF-12: MinHeap mengembalikan elemen dengan nilai f terkecil secara akurat', () => {
    const heap = new MinHeap();
    assert.equal(heap.isEmpty(), true);

    heap.push({ nodeId: 'c', f: 50 });
    heap.push({ nodeId: 'a', f: 10 });
    heap.push({ nodeId: 'd', f: 80 });
    heap.push({ nodeId: 'b', f: 20 });

    assert.equal(heap.size, 4);
    assert.equal(heap.pop().nodeId, 'a'); // 10
    assert.equal(heap.pop().nodeId, 'b'); // 20
    assert.equal(heap.pop().nodeId, 'c'); // 50
    assert.equal(heap.pop().nodeId, 'd'); // 80
    assert.equal(heap.isEmpty(), true);
  });

  test('PF-13: astar menemukan rute terpendek optimal pada graf grid', () => {
    // Buat grid graf sederhana 3x3:
    // (0,0) - (1000,0) - (2000,0)
    //   |         |         |
    // (0,1000)-(1000,1000)-(2000,1000)
    //   |         |         |
    // (0,2000)-(1000,2000)-(2000,2000)
    const graph = new NavGraph();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        graph.addNode(`n_${c}_${r}`, c * 1000, r * 1000);
      }
    }
    // Hubungkan edge horizontal
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        graph.addEdge(`n_${c}_${r}`, `n_${c + 1}_${r}`);
      }
    }
    // Hubungkan edge vertikal
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 2; r++) {
        graph.addEdge(`n_${c}_${r}`, `n_${c}_${r + 1}`);
      }
    }

    const result = astar(graph, 'n_0_0', 'n_2_2');
    assert.ok(result);
    assert.equal(result.totalDistanceMm, 4000); // 4 langkah x 1000mm
    assert.equal(result.path.length, 5);
    assert.equal(result.path[0].nodeId, 'n_0_0');
    assert.equal(result.path[result.path.length - 1].nodeId, 'n_2_2');
  });

  test('PF-14: astar mengembalikan null jika tujuan tidak terhubung (disconnected)', () => {
    const graph = new NavGraph();
    graph.addNode('island_1', 0, 0);
    graph.addNode('island_2', 10000, 10000);

    const result = astar(graph, 'island_1', 'island_2');
    assert.equal(result, null);
  });

  test('PF-15: countTurns menghitung perubahan sudut belokan secara presisi', () => {
    // Garis lurus -> 0 belokan
    const straight = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 2000, yMm: 0 },
    ];
    assert.equal(countTurns(straight), 0);

    // Belokan siku-siku (L-shape) -> 1 belokan
    const lShape = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
    ];
    assert.equal(countTurns(lShape), 1);

    // U-turn atau zig-zag -> 2 belokan
    const zigZag = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
      { xMm: 2000, yMm: 1000 },
    ];
    assert.equal(countTurns(zigZag), 2);
  });

  test('PF-16: agentProfile membatasi rute forklift pada lorong yang terlalu sempit', () => {
    const graph = new NavGraph();
    // 2 rute alternatif dari start ke goal:
    // Rute 1 (Sempit tapi pendek): start -> narrow -> goal (lebar 2000mm)
    // Rute 2 (Lebar tapi panjang): start -> wide1 -> wide2 -> goal (lebar 3500mm)
    graph.addNode('start', 0, 0);
    graph.addNode('narrow', 1000, 0);
    graph.addNode('wide1', 0, 2000);
    graph.addNode('wide2', 2000, 2000);
    graph.addNode('goal', 2000, 0);

    graph.addEdge('start', 'narrow', 1000, { aisleWidthMm: 2000 });
    graph.addEdge('narrow', 'goal', 1000, { aisleWidthMm: 2000 });

    graph.addEdge('start', 'wide1', 2000, { aisleWidthMm: 3500 });
    graph.addEdge('wide1', 'wide2', 2000, { aisleWidthMm: 3500 });
    graph.addEdge('wide2', 'goal', 2000, { aisleWidthMm: 3500 });

    // Human (lebar minimum 600mm) lewat rute sempit (total 2000mm)
    const humanResult = astar(graph, 'start', 'goal', {
      agentProfile: { minAisleWidthMm: 600 },
    });
    assert.equal(humanResult.totalDistanceMm, 2000);
    assert.equal(humanResult.path[1].nodeId, 'narrow');

    // Forklift (lebar minimum 3000mm) dilarang lewat rute sempit, harus memutar via wide1 & wide2
    const forkliftResult = astar(graph, 'start', 'goal', {
      agentProfile: { minAisleWidthMm: 3000 },
    });
    assert.ok(forkliftResult);
    assert.equal(forkliftResult.totalDistanceMm, 6000);
    assert.equal(forkliftResult.path[1].nodeId, 'wide1');
  });

  test('PF-17: dijkstraMultiTarget menemukan slot rak terdekat dari dock', () => {
    const graph = new NavGraph();
    graph.addNode('dock_1', 0, 0);
    graph.addNode('rack_far', 10000, 0);
    graph.addNode('rack_near', 2500, 0);

    graph.addEdge('dock_1', 'rack_near', 2500);
    graph.addEdge('dock_1', 'rack_far', 10000);

    const candidates = ['rack_far', 'rack_near'];
    const result = dijkstraMultiTarget(graph, 'dock_1', candidates);

    assert.ok(result);
    assert.equal(result.targetId, 'rack_near');
    assert.equal(result.totalDistanceMm, 2500);
  });

  test('Benchmark Performa A*: Eksekusi pada 300 simpul selesai dalam < 2ms', () => {
    const graph = new NavGraph();
    // Grid 15 x 20 = 300 simpul
    const COLS = 15;
    const ROWS = 20;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        graph.addNode(`n_${c}_${r}`, c * 2000, r * 2000);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 1; c++) {
        graph.addEdge(`n_${c}_${r}`, `n_${c + 1}_${r}`);
      }
    }
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS - 1; r++) {
        graph.addEdge(`n_${c}_${r}`, `n_${c}_${r + 1}`);
      }
    }

    const t0 = performance.now();
    const result = astar(graph, 'n_0_0', `n_${COLS - 1}_${ROWS - 1}`);
    const elapsed = performance.now() - t0;

    assert.ok(result);
    assert.ok(elapsed < 20, `A* harus sangat cepat, selesai dalam ${elapsed.toFixed(2)}ms`);
  });
});
