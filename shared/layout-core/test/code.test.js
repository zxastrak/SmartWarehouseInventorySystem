/**
 * Unit Test Suite for code.js
 * Uses Node.js native test runner (node:test and node:assert).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCode,
  isValidCode,
  padZero,
  renderPattern,
  validatePattern,
} from '../src/code.js';

describe('Code Normalizer & Pattern Generator', () => {
  test('normalizeCode membersihkan spasi dan mengkapitalkan huruf', () => {
    assert.equal(normalizeCode('  rack-01  '), 'RACK-01');
    assert.equal(normalizeCode('loc_a_02'), 'LOC_A_02');
    assert.equal(normalizeCode(null), '');
    assert.equal(normalizeCode(undefined), '');
  });

  test('isValidCode validasi karakter alfanumerik, dash, dan underscore', () => {
    assert.equal(isValidCode('RACK-01'), true);
    assert.equal(isValidCode('A_01_02_03'), true);
    assert.equal(isValidCode('RACK 01'), false); // spasi tidak valid
    assert.equal(isValidCode('RACK@01'), false); // karakter khusus tidak valid
    assert.equal(isValidCode(''), false);
    assert.equal(isValidCode('A'.repeat(61)), false); // melebihi batas 60 karakter
  });

  test('padZero menambahkan padding nol', () => {
    assert.equal(padZero(5, 2), '05');
    assert.equal(padZero('12', 2), '12');
    assert.equal(padZero(1, 3), '001');
  });

  test('renderPattern menghasilkan kode lokasi lengkap dengan token', () => {
    const segments = {
      aisle: 'A',
      rack: '01',
      bay: 3,
      level: 2,
      position: 1,
    };
    const code = renderPattern(segments);
    assert.equal(code, 'A-01-03-02-01');

    // Custom separator
    const codeUnderscore = renderPattern(segments, undefined, '_');
    assert.equal(codeUnderscore, 'A_01_03_02_01');
  });

  test('validatePattern memvalidasi keberadaan token yang dibutuhkan', () => {
    const valid = validatePattern('{aisle}-{rack}-{bay}-{level}-{position}');
    assert.equal(valid.valid, true);
    assert.deepEqual(valid.missingTokens, []);

    const missing = validatePattern('{aisle}-{rack}-{bay}');
    assert.equal(missing.valid, false);
    assert.deepEqual(missing.missingTokens, ['{level}', '{position}']);
  });
});
