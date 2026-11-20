/**
 * Unit Test Suite for geometry.js
 * Uses Node.js native test runner (node:test and node:assert).
 * Enforces AC-22 and 100% branch coverage.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateInteger,
  footprint,
  rotate90,
  overlaps,
  inside,
  snap,
  mmToPx,
  pxToMm,
} from '../src/geometry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'test-vectors.json'), 'utf8')
);

describe('1. validateInteger', () => {
  test('Lulus untuk integer positif', () => {
    assert.equal(validateInteger(100, 'x', false), 100);
    assert.equal(validateInteger(0, 'x', true), 0);
  });

  test('Menolak NaN, Infinity, dan tipe non-number', () => {
    assert.throws(() => validateInteger(NaN, 'x'), TypeError);
    assert.throws(() => validateInteger(Infinity, 'x'), TypeError);
    assert.throws(() => validateInteger(-Infinity, 'x'), TypeError);
    assert.throws(() => validateInteger('100', 'x'), TypeError);
    assert.throws(() => validateInteger(null, 'x'), TypeError);
    assert.throws(() => validateInteger(undefined, 'x'), TypeError);
    assert.throws(() => validateInteger(true, 'x'), TypeError);
  });

  test('Menolak nilai float desimal (integer mm murni)', () => {
    assert.throws(() => validateInteger(100.5, 'x'), TypeError);
    assert.throws(() => validateInteger(0.1, 'x'), TypeError);
  });

  test('Menolak nilai <= 0 jika allowZero = false', () => {
    assert.throws(() => validateInteger(0, 'width', false), RangeError);
    assert.throws(() => validateInteger(-10, 'width', false), RangeError);
  });

  test('Menolak nilai negatif jika allowZero = true', () => {
    assert.throws(() => validateInteger(-1, 'x', true), RangeError);
  });
});

describe('2. footprint (Golden Vectors)', () => {
  for (const v of vectors.footprint) {
    test(`Rotasi ${v.rotation} menghasilkan dimensi X=${v.expected.width}, Y=${v.expected.depth}`, () => {
      const res = footprint(v.length, v.depth, v.rotation);
      assert.deepEqual(res, v.expected);
    });
  }

  test('Menolak rotasi selain 0, 90, 180, 270', () => {
    assert.throws(() => footprint(2000, 1000, 45), RangeError);
    assert.throws(() => footprint(2000, 1000, 360), RangeError);
  });
});

describe('3. rotate90 & AC-22 (Konsistensi Siklus 360 Derajat)', () => {
  for (let i = 0; i < vectors.rotate90.length; i++) {
    const v = vectors.rotate90[i];
    test(`Golden Vector rotate90 step ${i} (rot: ${v.input.rotation} -> ${v.expected.rotation})`, () => {
      const res = rotate90(
        v.input.x,
        v.input.y,
        v.input.length,
        v.input.depth,
        v.input.rotation
      );
      assert.deepEqual(res, v.expected);
    });
  }

  test('AC-22: 4 kali rotasi berturut-turut mengembalikan posisi dan rotasi awal secara tepat', () => {
    const initial = { x: 5000, y: 3000, length: 2400, depth: 1000, rotation: 0 };

    const rot1 = rotate90(initial.x, initial.y, initial.length, initial.depth, 0);
    assert.equal(rot1.rotation, 90);

    const rot2 = rotate90(rot1.x, rot1.y, initial.length, initial.depth, 90);
    assert.equal(rot2.rotation, 180);

    const rot3 = rotate90(rot2.x, rot2.y, initial.length, initial.depth, 180);
    assert.equal(rot3.rotation, 270);

    const rot4 = rotate90(rot3.x, rot3.y, initial.length, initial.depth, 270);
    assert.equal(rot4.rotation, 0);
    assert.equal(rot4.x, initial.x);
    assert.equal(rot4.y, initial.y);
  });

  test('rotate90 menolak rotasi input yang tidak valid', () => {
    assert.throws(() => rotate90(100, 100, 2000, 1000, 45), RangeError);
  });
});

describe('4. overlaps (Deteksi Tabrakan & Edge-Touch)', () => {
  for (const v of vectors.overlaps) {
    test(v.name, () => {
      const res = overlaps(v.rectA, v.rectB);
      assert.equal(res, v.expected);
    });
  }

  test('Mengembalikan false bila salah satu rect null/undefined', () => {
    assert.equal(overlaps(null, { x: 0, y: 0, width: 100, depth: 100 }), false);
    assert.equal(overlaps({ x: 0, y: 0, width: 100, depth: 100 }, null), false);
  });
});

describe('5. inside (Batas Gudang & Zona)', () => {
  for (const v of vectors.inside) {
    test(v.name, () => {
      const res = inside(v.inner, v.boundary);
      assert.equal(res, v.expected);
    });
  }

  test('Mengembalikan false bila rect null/undefined', () => {
    assert.equal(inside(null, { x: 0, y: 0, width: 100, depth: 100 }), false);
    assert.equal(inside({ x: 0, y: 0, width: 100, depth: 100 }, null), false);
  });
});

describe('6. snap to grid', () => {
  for (const v of vectors.snap) {
    test(`Value ${v.value} snapped with grid ${v.grid} tol ${v.tolerance} -> ${v.expected}`, () => {
      assert.equal(snap(v.value, v.grid, v.tolerance), v.expected);
    });
  }

  test('Mengembalikan nilai asli jika grid <= 0 atau tolerance <= 0', () => {
    assert.equal(snap(123, 0, 10), 123);
    assert.equal(snap(123, 100, 0), 123);
    assert.equal(snap(123, -50, 10), 123);
  });
});

describe('7. mmToPx & pxToMm (Preservasi Data Tanpa Distorsi Floating)', () => {
  test('Konversi presisi skala 0.1 px/mm', () => {
    const scale = 0.1;
    const mm = 2400;
    const px = mmToPx(mm, scale);
    assert.equal(px, 240);

    const backMm = pxToMm(px, scale);
    assert.equal(backMm, mm);
  });

  test('Menangani nilai scale 0 atau non-number dengan aman', () => {
    assert.equal(mmToPx(100, 'invalid'), 0);
    assert.equal(pxToMm(100, 0), 0);
    assert.equal(pxToMm('invalid', 0.1), 0);
  });
});
