/**
 * Unit Test Suite for structureValidation.js
 * Uses Node.js native test runner (node:test and node:assert).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBayWidths,
  validateLevels,
  validatePositionConfigs,
} from '../src/structureValidation.js';

describe('Rack Structural Rules Validation', () => {
  describe('validateBayWidths', () => {
    test('Lulus jika total lebar bay sama dengan panjang rak', () => {
      const res = validateBayWidths([1000, 1000, 400], 2400, 5);
      assert.equal(res.valid, true);
      assert.equal(res.difference, 0);
    });

    test('Lulus jika selisih masih dalam batas toleransi (<= 5 mm)', () => {
      const res = validateBayWidths([1000, 1002], 2000, 5);
      assert.equal(res.valid, true);
      assert.equal(res.difference, 2);
    });

    test('Gagal jika selisih melebihi toleransi', () => {
      const res = validateBayWidths([1000, 1010], 2000, 5);
      assert.equal(res.valid, false);
      assert.equal(res.difference, 10);
    });

    test('Gagal jika bay kosong atau lebar bay tidak valid', () => {
      assert.equal(validateBayWidths([], 2000).valid, false);
      assert.equal(validateBayWidths([1000, -100], 2000).valid, false);
    });
  });

  describe('validateLevels', () => {
    test('Lulus jika level naik ketat dan clearance terpenuhi', () => {
      const levels = [
        { level_number: 1, height_from_floor_mm: 200 },
        { level_number: 2, height_from_floor_mm: 800 },
        { level_number: 3, height_from_floor_mm: 1400 },
      ];
      const res = validateLevels(levels, 2000, 300);
      assert.equal(res.valid, true);
      assert.equal(res.errors.length, 0);
    });

    test('Gagal jika ketinggian level tidak naik ketat (sama atau lebih rendah)', () => {
      const levels = [
        { level_number: 1, height_from_floor_mm: 500 },
        { level_number: 2, height_from_floor_mm: 500 },
      ];
      const res = validateLevels(levels, 2000, 300);
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /harus lebih tinggi/);
    });

    test('Gagal jika jarak antar level kurang dari minimum clearance', () => {
      const levels = [
        { level_number: 1, height_from_floor_mm: 500 },
        { level_number: 2, height_from_floor_mm: 700 }, // selisih 200 mm < 300 mm
      ];
      const res = validateLevels(levels, 2000, 300);
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /kurang dari batas minimum clearance/);
    });

    test('Gagal jika level teratas + clearance melebihi tinggi rak total', () => {
      const levels = [
        { level_number: 1, height_from_floor_mm: 1000 },
        { level_number: 2, height_from_floor_mm: 1800 }, // 1800 + 300 = 2100 > 2000
      ];
      const res = validateLevels(levels, 2000, 300);
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /melebihi tinggi total rak/);
    });
  });

  describe('validatePositionConfigs', () => {
    test('Lulus jika semua position_count > 0', () => {
      const configs = [
        { bay_id: 1, level_id: 1, position_count: 2 },
        { bay_id: 1, level_id: 2, position_count: 4 },
      ];
      assert.equal(validatePositionConfigs(configs).valid, true);
    });

    test('Gagal jika ada position_count <= 0 atau non-integer', () => {
      const configs = [
        { bay_id: 1, level_id: 1, position_count: 0 },
      ];
      const res = validatePositionConfigs(configs);
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /position_count/);
    });
  });
});
