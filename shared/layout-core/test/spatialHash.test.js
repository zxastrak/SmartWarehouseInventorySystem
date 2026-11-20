/**
 * Unit Test Suite for spatialHash.js
 * Uses Node.js native test runner (node:test and node:assert).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import SpatialHash from '../src/spatialHash.js';

describe('SpatialHash 2D Grid', () => {
  test('Inisialisasi grid dengan cellSize default dan custom', () => {
    const shDefault = new SpatialHash();
    assert.equal(shDefault.cellSize, 1000);

    const shCustom = new SpatialHash(500);
    assert.equal(shCustom.cellSize, 500);

    assert.throws(() => new SpatialHash(0), RangeError);
    assert.throws(() => new SpatialHash(-100), RangeError);
  });

  test('Insert, query collision, dan exclude self saat drag', () => {
    const sh = new SpatialHash(1000);

    // Rak A di (0, 0) ukuran (2000, 1000)
    sh.insert('rack-A', { x: 0, y: 0, width: 2000, depth: 1000 });
    // Rak B di (3000, 0) ukuran (2000, 1000) -> tidak tabrakan
    sh.insert('rack-B', { x: 3000, y: 0, width: 2000, depth: 1000 });

    assert.equal(sh.size, 2);

    // Query di (1500, 500) ukuran (1000, 1000) -> overlaps dengan rack-A
    const colliding = sh.query({ x: 1500, y: 500, width: 1000, depth: 1000 });
    assert.deepEqual(colliding, ['rack-A']);

    // Query yang sama tetapi exclude 'rack-A' (simulasi drag rack-A)
    const collidingExcluded = sh.query(
      { x: 1500, y: 500, width: 1000, depth: 1000 },
      'rack-A'
    );
    assert.deepEqual(collidingExcluded, []);
  });

  test('Update posisi entitas memperbarui index dengan benar', () => {
    const sh = new SpatialHash(1000);
    sh.insert('rack-1', { x: 0, y: 0, width: 1000, depth: 1000 });

    // Pindah ke (5000, 5000)
    sh.update('rack-1', { x: 5000, y: 5000, width: 1000, depth: 1000 });

    // Tempat lama kosong
    const oldQuery = sh.query({ x: 0, y: 0, width: 1000, depth: 1000 });
    assert.deepEqual(oldQuery, []);

    // Tempat baru ditemukan
    const newQuery = sh.query({ x: 5000, y: 5000, width: 1000, depth: 1000 });
    assert.deepEqual(newQuery, ['rack-1']);
  });

  test('Remove dan Clear', () => {
    const sh = new SpatialHash(1000);
    sh.insert('item-1', { x: 0, y: 0, width: 500, depth: 500 });
    sh.insert('item-2', { x: 1000, y: 1000, width: 500, depth: 500 });
    assert.equal(sh.size, 2);

    sh.remove('item-1');
    assert.equal(sh.size, 1);
    assert.deepEqual(sh.query({ x: 0, y: 0, width: 500, depth: 500 }), []);

    sh.clear();
    assert.equal(sh.size, 0);
  });

  test('queryViewport untuk culling hanya mengembalikan objek yang berada di layar', () => {
    const sh = new SpatialHash(1000);
    sh.insert('rack-visible-1', { x: 100, y: 100, width: 1000, depth: 500 });
    sh.insert('rack-visible-2', { x: 1500, y: 100, width: 1000, depth: 500 });
    sh.insert('rack-far-away', { x: 50000, y: 50000, width: 1000, depth: 500 });

    const viewport = { x: 0, y: 0, width: 3000, depth: 2000 };
    const visible = sh.queryViewport(viewport);

    assert.equal(visible.includes('rack-visible-1'), true);
    assert.equal(visible.includes('rack-visible-2'), true);
    assert.equal(visible.includes('rack-far-away'), false);
  });
});
