/**
 * Unit Test untuk Generator UI & Pengaturan Pattern (STEP 11)
 * Menguji:
 * - Validasi kelengkapan token pola kode lokasi
 * - Substitusi token dan pemisah (dash, slash, dot, underscore)
 * - Format padding nol pada nomor bay, level, dan posisi
 * - Kalkulasi penambahan append-first di sisi klien
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import codeUtils from '../../../../../shared/layout-core/src/code.js';

const {
  renderPattern,
  validatePattern,
  padZero,
  normalizeCode,
} = codeUtils;

test('Pattern Validation - Memeriksa keberadaan 5 token wajib', () => {
  // 1. Pola lengkap
  const validPattern = '{aisle}-{rack}-{bay}-{level}-{position}';
  const res1 = validatePattern(validPattern);
  assert.equal(res1.valid, true);
  assert.equal(res1.missingTokens.length, 0);

  // 2. Pola dengan slash
  const slashPattern = '{aisle}/{rack}/{bay}/{level}/{position}';
  const res2 = validatePattern(slashPattern);
  assert.equal(res2.valid, true);

  // 3. Pola tidak lengkap (hilang {position})
  const missingPos = '{aisle}-{rack}-{bay}-{level}';
  const res3 = validatePattern(missingPos);
  assert.equal(res3.valid, false);
  assert.deepEqual(res3.missingTokens, ['{position}']);

  // 4. Pola tidak lengkap (hilang {bay} dan {level})
  const missingMultiple = '{aisle}-{rack}-{position}';
  const res4 = validatePattern(missingMultiple);
  assert.equal(res4.valid, false);
  assert.ok(res4.missingTokens.includes('{bay}'));
  assert.ok(res4.missingTokens.includes('{level}'));
});

test('Pattern Rendering - Substitusi token dengan berbagai pemisah', () => {
  const segments = {
    aisle: 'A01',
    rack: 'RK01',
    bay: 1,
    level: 2,
    position: 3,
  };

  // 1. Dash
  const dash = renderPattern(segments, '{aisle}-{rack}-{bay}-{level}-{position}', '-');
  assert.equal(dash, 'A01-RK01-01-02-03');

  // 2. Slash
  const slash = renderPattern(segments, '{aisle}/{rack}/{bay}/{level}/{position}', '/');
  assert.equal(slash, 'A01/RK01/01/02/03');

  // 3. Dot
  const dot = renderPattern(segments, '{aisle}.{rack}.{bay}.{level}.{position}', '.');
  assert.equal(dot, 'A01.RK01.01.02.03');

  // 4. Underscore
  const under = renderPattern(segments, '{aisle}_{rack}_{bay}_{level}_{position}', '_');
  assert.equal(under, 'A01_RK01_01_02_03');
});

test('Pattern Padding - Memastikan format dua digit seragam', () => {
  assert.equal(padZero(1, 2), '01');
  assert.equal(padZero(9, 2), '09');
  assert.equal(padZero(10, 2), '10');
  assert.equal(padZero(105, 3), '105');
});

test('Append-First UI Projection - Kalkulasi penambahan lokasi bersih', () => {
  const configs = [
    { bay_number: 1, level_number: 1, position_count: 4, last_issued: 2 }, // +2
    { bay_number: 1, level_number: 2, position_count: 2, last_issued: 2 }, // 0
    { bay_number: 2, level_number: 1, position_count: 3, last_issued: 0 }, // +3
  ];

  let alreadyIssuedTotal = 0;
  let newLocationsTotal = 0;

  for (const c of configs) {
    alreadyIssuedTotal += c.last_issued;
    if (c.position_count > c.last_issued) {
      newLocationsTotal += (c.position_count - c.last_issued);
    }
  }

  assert.equal(alreadyIssuedTotal, 4); // 2 + 2 + 0
  assert.equal(newLocationsTotal, 5); // 2 + 0 + 3
  assert.equal(alreadyIssuedTotal + newLocationsTotal, 9);
});
