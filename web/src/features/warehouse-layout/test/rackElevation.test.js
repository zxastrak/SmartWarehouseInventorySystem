/**
 * Unit Test untuk Rack Elevation View & Dimensi SVG (STEP 9)
 * Menguji:
 * - Kalkulasi geometri tampak depan rak (viewBox, pilar, balok)
 * - Pemetaan koordinat vertikal (inversi lantai SVG)
 * - Pembagian kompartemen slot posisi
 * - Aturan validasi lebar bay dan ketinggian level di klien
 */

import test from 'node:test';
import assert from 'node:assert/strict';

function computeElevationGeometry(rack, bays = [], levels = [], configs = []) {
  const rackLength = rack.length_mm || 2400;
  const rackHeight = rack.height_mm || 4000;

  const marginLeft = 180;
  const marginRight = 60;
  const marginTop = 80;
  const marginBottom = 120;

  const vbMinX = -marginLeft;
  const vbMinY = -marginTop;
  const vbWidth = rackLength + marginLeft + marginRight;
  const vbHeight = rackHeight + marginTop + marginBottom;

  const bayOffsets = [];
  let currentX = 0;
  for (const b of bays) {
    bayOffsets.push({
      bay_number: b.bay_number,
      startX: currentX,
      width: b.width_mm,
    });
    currentX += b.width_mm;
  }

  const uprightWidth = 60;
  const beamHeight = 40;

  const sortedLevels = [...levels].sort((a, b) => a.level_number - b.level_number);

  const levelBeams = sortedLevels.map((lvl) => ({
    level_number: lvl.level_number,
    beamY: rackHeight - lvl.height_from_floor_mm - beamHeight,
    floorHeight: lvl.height_from_floor_mm,
  }));

  const slots = [];
  for (const bay of bayOffsets) {
    for (let lIdx = 0; lIdx < sortedLevels.length; lIdx++) {
      const lvl = sortedLevels[lIdx];
      const cfg = configs.find(
        (c) => c.bay_number === bay.bay_number && c.level_number === lvl.level_number
      );
      const posCount = cfg?.position_count || 1;

      const levelFloorY = rackHeight - lvl.height_from_floor_mm;
      const nextLvl = sortedLevels[lIdx + 1];
      const compTopY = nextLvl ? rackHeight - nextLvl.height_from_floor_mm : 0;
      const compHeight = levelFloorY - compTopY - beamHeight;

      const slotWidth = (bay.width - uprightWidth) / posCount;

      slots.push({
        bay_number: bay.bay_number,
        level_number: lvl.level_number,
        posCount,
        slotWidth,
        compHeight,
      });
    }
  }

  return {
    viewBox: { vbMinX, vbMinY, vbWidth, vbHeight },
    totalBayWidth: currentX,
    bayOffsets,
    levelBeams,
    slots,
  };
}

test('Rack Elevation - Kalkulasi ViewBox proporsional dengan margin anotasi', () => {
  const rack = { length_mm: 2400, height_mm: 4000 };
  const geo = computeElevationGeometry(rack);

  assert.equal(geo.viewBox.vbMinX, -180);
  assert.equal(geo.viewBox.vbMinY, -80);
  assert.equal(geo.viewBox.vbWidth, 2400 + 180 + 60); // 2640
  assert.equal(geo.viewBox.vbHeight, 4000 + 80 + 120); // 4200
});

test('Rack Elevation - Pemetaan Offset Horizontal Kolom Bay', () => {
  const rack = { length_mm: 3600, height_mm: 4000 };
  const bays = [
    { bay_number: 1, width_mm: 1200 },
    { bay_number: 2, width_mm: 1200 },
    { bay_number: 3, width_mm: 1200 },
  ];

  const geo = computeElevationGeometry(rack, bays);

  assert.equal(geo.bayOffsets.length, 3);
  assert.equal(geo.bayOffsets[0].startX, 0);
  assert.equal(geo.bayOffsets[1].startX, 1200);
  assert.equal(geo.bayOffsets[2].startX, 2400);
  assert.equal(geo.totalBayWidth, 3600);
});

test('Rack Elevation - Inversi Koordinat Vertikal Level (Lantai Y=0 di Dasar SVG)', () => {
  const rack = { length_mm: 2400, height_mm: 4000 };
  const levels = [
    { level_number: 1, height_from_floor_mm: 0 },
    { level_number: 2, height_from_floor_mm: 1500 },
    { level_number: 3, height_from_floor_mm: 3000 },
  ];

  const geo = computeElevationGeometry(rack, [], levels);

  // Level 1 di lantai (height_from_floor_mm = 0) -> beamY = 4000 - 0 - 40 = 3960
  assert.equal(geo.levelBeams[0].beamY, 3960);

  // Level 2 di 1500 mm -> beamY = 4000 - 1500 - 40 = 2460
  assert.equal(geo.levelBeams[1].beamY, 2460);

  // Level 3 di 3000 mm -> beamY = 4000 - 3000 - 40 = 960
  assert.equal(geo.levelBeams[2].beamY, 960);

  // Level yang lebih tinggi di fisik harus memiliki koordinat SVG Y lebih kecil
  assert.ok(geo.levelBeams[2].beamY < geo.levelBeams[1].beamY);
  assert.ok(geo.levelBeams[1].beamY < geo.levelBeams[0].beamY);
});

test('Rack Elevation - Pembagian Slot Posisi Kompartemen (Position Count)', () => {
  const rack = { length_mm: 2400, height_mm: 4000 };
  const bays = [{ bay_number: 1, width_mm: 2400 }];
  const levels = [
    { level_number: 1, height_from_floor_mm: 0 },
    { level_number: 2, height_from_floor_mm: 1500 },
  ];
  const configs = [
    { bay_number: 1, level_number: 1, position_count: 2 },
    { bay_number: 1, level_number: 2, position_count: 3 },
  ];

  const geo = computeElevationGeometry(rack, bays, levels, configs);

  // Kompartemen Level 1 memiliki 2 posisi -> slotWidth = (2400 - 60) / 2 = 1170 mm
  assert.equal(geo.slots[0].posCount, 2);
  assert.equal(geo.slots[0].slotWidth, 1170);

  // Kompartemen Level 2 memiliki 3 posisi -> slotWidth = (2400 - 60) / 3 = 780 mm
  assert.equal(geo.slots[1].posCount, 3);
  assert.equal(geo.slots[1].slotWidth, 780);
});

test('Rack Elevation - Validasi Toleransi Lebar Bay (Client-Side Check)', () => {
  const rackLength = 2400;

  function isBayWidthValid(widths) {
    const sum = widths.reduce((a, b) => a + b, 0);
    return Math.abs(sum - rackLength) <= 5;
  }

  assert.equal(isBayWidthValid([1200, 1200]), true); // Presisi tepat
  assert.equal(isBayWidthValid([1202, 1200]), true); // Selisih 2 mm <= 5 mm
  assert.equal(isBayWidthValid([1205, 1200]), true); // Selisih 5 mm <= 5 mm
  assert.equal(isBayWidthValid([1206, 1200]), false); // Selisih 6 mm > 5 mm
  assert.equal(isBayWidthValid([1000, 1000]), false); // Selisih 400 mm
});
