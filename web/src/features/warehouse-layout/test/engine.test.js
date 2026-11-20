/**
 * Unit Test untuk Top View Canvas Engine
 * Menguji matematika viewport, transformasi koordinat, culling spatial, dan hit testing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createViewport,
  screenToWorld,
  worldToScreen,
  zoomAt,
  pan,
  fitBounds,
  getVisibleWorldBounds,
} from '../engine/viewport.js';
import SpatialHash from '../../../../../shared/layout-core/src/spatialHash.js';
import { footprint } from '../../../../../shared/layout-core/src/geometry.js';

test('Viewport Math - screenToWorld & worldToScreen roundtrip', () => {
  const vp = createViewport(0.05, 100, 200);

  const worldX = 12500;
  const worldY = 8400;

  const screen = worldToScreen(worldX, worldY, vp);
  assert.equal(screen.sx, 12500 * 0.05 + 100); // 725
  assert.equal(screen.sy, 8400 * 0.05 + 200); // 620

  const backToWorld = screenToWorld(screen.sx, screen.sy, vp);
  assert.equal(backToWorld.wx, worldX);
  assert.equal(backToWorld.wy, worldY);
});

test('Viewport Math - zoomAt stationary cursor invariant', () => {
  const vp = createViewport(0.02, 50, 50);
  const cursorX = 400;
  const cursorY = 300;

  // World point before zoom
  const worldBefore = screenToWorld(cursorX, cursorY, vp);

  // Zoom in by 1.25x
  const zoomedVp = zoomAt(cursorX, cursorY, 1.25, vp);
  assert.equal(zoomedVp.scale, 0.02 * 1.25);

  // World point after zoom at same screen cursor position MUST remain identical
  const worldAfter = screenToWorld(cursorX, cursorY, zoomedVp);
  assert.ok(Math.abs(worldAfter.wx - worldBefore.wx) <= 1, 'Cursor stationary point X must remain invariant');
  assert.ok(Math.abs(worldAfter.wy - worldBefore.wy) <= 1, 'Cursor stationary point Y must remain invariant');
});

test('Viewport Math - zoomAt boundary clamping', () => {
  const vp = createViewport(0.002, 0, 0);
  // Attempt to zoom out beyond minScale (0.002)
  const clampedOut = zoomAt(100, 100, 0.5, vp, 0.002, 0.5);
  assert.equal(clampedOut.scale, 0.002);

  // Attempt to zoom in beyond maxScale (0.5)
  const maxVp = createViewport(0.5, 0, 0);
  const clampedIn = zoomAt(100, 100, 2.0, maxVp, 0.002, 0.5);
  assert.equal(clampedIn.scale, 0.5);
});

test('Viewport Math - pan translation', () => {
  const vp = createViewport(0.02, 100, 150);
  const panned = pan(50, -30, vp);

  assert.equal(panned.tx, 150);
  assert.equal(panned.ty, 120);
  assert.equal(panned.scale, 0.02);
});

test('Viewport Math - fitBounds fits warehouse inside screen with margin', () => {
  const warehouse = { width_mm: 50000, length_mm: 30000 };
  const screenW = 1000;
  const screenH = 600;
  const padding = 50;

  const vp = fitBounds(warehouse, screenW, screenH, padding);

  // Available space: W = 900, H = 500
  // Scale W: 900 / 50000 = 0.018
  // Scale H: 500 / 30000 = 0.016666...
  // Expected scale is min(scaleW, scaleH) = 0.016666...
  assert.ok(vp.scale < 0.017 && vp.scale > 0.016);

  // Top-left screen coordinate should center the warehouse
  const screenTopLeft = worldToScreen(0, 0, vp);
  const screenBottomRight = worldToScreen(warehouse.width_mm, warehouse.length_mm, vp);

  const renderedW = screenBottomRight.sx - screenTopLeft.sx;
  const renderedH = screenBottomRight.sy - screenTopLeft.sy;

  assert.ok(renderedW <= screenW - padding * 2);
  assert.ok(renderedH <= screenH - padding * 2);
  assert.ok(screenTopLeft.sx >= padding);
  assert.ok(screenTopLeft.sy >= padding);
});

test('Viewport Math - getVisibleWorldBounds', () => {
  const vp = createViewport(0.01, 100, 50);
  const screenW = 800;
  const screenH = 600;

  const bounds = getVisibleWorldBounds(vp, screenW, screenH);
  // minX = -100 / 0.01 = -10000
  // minY = -50 / 0.01 = -5000
  // width = 800 / 0.01 = 80000
  // depth = 600 / 0.01 = 60000
  assert.equal(bounds.x, -10000);
  assert.equal(bounds.y, -5000);
  assert.equal(bounds.width, 80000);
  assert.equal(bounds.depth, 60000);
});

test('Spatial Hash - Culling 500 Racks efficiency', () => {
  const sh = new SpatialHash(2000);

  // Insert 500 racks spread over 50m x 50m (50000mm x 50000mm)
  for (let i = 0; i < 500; i++) {
    const col = i % 25;
    const row = Math.floor(i / 25);
    const x = col * 2000;
    const y = row * 2500;
    sh.insert(i + 1, { x, y, width: 1200, depth: 800 });
  }

  // Query a small camera viewport: x: 0..6000, y: 0..6000
  const visible = sh.query({ x: 0, y: 0, width: 6000, depth: 6000 });

  // Only racks within this 6m x 6m area should be returned
  assert.ok(visible.length < 500, `Expected culled count to be much less than 500, got ${visible.length}`);
  assert.ok(visible.length > 0, 'Visible set must not be empty');

  // Verify all returned racks actually touch or are near the query box
  for (const id of visible) {
    const col = (id - 1) % 25;
    const row = Math.floor((id - 1) / 25);
    const x = col * 2000;
    const y = row * 2500;
    assert.ok(x <= 8000 && y <= 8000, `Rack ${id} at (${x}, ${y}) should be near the query box`);
  }
});

test('Hit-Testing - Reverse Z-order precedence', () => {
  const snapshot = {
    zones: [
      { id: 1, name: 'Zone A', x_mm: 0, y_mm: 0, width_mm: 10000, length_mm: 10000 },
    ],
    aisles: [
      { id: 10, aisle_code: 'A1', x_mm: 1000, y_mm: 1000, width_mm: 3000, length_mm: 5000 },
    ],
    racks: [
      { id: 100, rack_code: 'R-01', x_mm: 1500, y_mm: 1500, length_mm: 2000, depth_mm: 1000, rotation: 0 },
    ],
  };

  function simpleHitTest(wx, wy) {
    // 1. Topmost: Racks
    for (let i = snapshot.racks.length - 1; i >= 0; i--) {
      const r = snapshot.racks[i];
      const box = footprint(r.length_mm, r.depth_mm, r.rotation || 0);
      if (wx >= r.x_mm && wx <= r.x_mm + box.width && wy >= r.y_mm && wy <= r.y_mm + box.depth) {
        return { type: 'rack', item: r };
      }
    }
    // 2. Aisles
    for (let i = snapshot.aisles.length - 1; i >= 0; i--) {
      const a = snapshot.aisles[i];
      if (wx >= a.x_mm && wx <= a.x_mm + a.width_mm && wy >= a.y_mm && wy <= a.y_mm + a.length_mm) {
        return { type: 'aisle', item: a };
      }
    }
    // 3. Zones
    for (let i = snapshot.zones.length - 1; i >= 0; i--) {
      const z = snapshot.zones[i];
      if (wx >= z.x_mm && wx <= z.x_mm + z.width_mm && wy >= z.y_mm && wy <= z.y_mm + z.length_mm) {
        return { type: 'zone', item: z };
      }
    }
    return null;
  }

  // Hit inside rack (1600, 1600) -> Must return rack, NOT zone or aisle
  const hitRack = simpleHitTest(1600, 1600);
  assert.equal(hitRack?.type, 'rack');
  assert.equal(hitRack?.item?.id, 100);

  // Hit inside aisle but outside rack (1200, 1200) -> Must return aisle
  const hitAisle = simpleHitTest(1200, 1200);
  assert.equal(hitAisle?.type, 'aisle');
  assert.equal(hitAisle?.item?.id, 10);

  // Hit inside zone but outside aisle and rack (500, 500) -> Must return zone
  const hitZone = simpleHitTest(500, 500);
  assert.equal(hitZone?.type, 'zone');
  assert.equal(hitZone?.item?.id, 1);

  // Hit outside everything (-100, -100) -> Null
  const hitEmpty = simpleHitTest(-100, -100);
  assert.equal(hitEmpty, null);
});
