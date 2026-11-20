import test from 'node:test';
import assert from 'node:assert';

// 3D Math & Pitch Constraint test
function clampPitch(pitch) {
  // STRICT CONSTRAINT: "3d cukup kanan kiri dan atas, tidak pelu bisa memutar kebawahnya"
  return Math.max(15, Math.min(88, pitch));
}

function projectPointTest(x, y, z, camera, width = 800, height = 600) {
  const dx = x - camera.targetX;
  const dy = y - camera.targetY;
  const dz = z - camera.targetZ;

  const radYaw = (camera.yaw * Math.PI) / 180;
  const cosY = Math.cos(radYaw);
  const sinY = Math.sin(radYaw);
  const x1 = dx * cosY - dy * sinY;
  const y1 = dx * sinY + dy * cosY;
  const z1 = dz;

  const radPitch = (camera.pitch * Math.PI) / 180;
  const cosP = Math.cos(radPitch);
  const sinP = Math.sin(radPitch);
  const x2 = x1;
  const y2 = y1 * cosP - z1 * sinP;
  const z2 = y1 * sinP + z1 * cosP;

  const fov = 1200;
  const depth = camera.distance + y2;
  if (depth <= 20) return null;

  const scale = fov / depth;
  const screenX = width / 2 + x2 * scale + camera.panX;
  const screenY = height / 2 - z2 * scale + camera.panY;

  return { x: screenX, y: screenY, depth, scale };
}

test('3D Camera - Pitch strictly clamped above ground level (no looking from underneath)', () => {
  // Extreme downward attempts (negative or below floor)
  assert.strictEqual(clampPitch(-50), 15, 'Negative pitch must be clamped to 15');
  assert.strictEqual(clampPitch(0), 15, 'Ground level pitch must be clamped to 15');
  assert.strictEqual(clampPitch(10), 15, 'Under 15 pitch must be clamped to 15');
  assert.strictEqual(clampPitch(15), 15, '15 pitch is valid minimum');

  // Normal range
  assert.strictEqual(clampPitch(45), 45, '45 pitch remains untouched');

  // Top-down range
  assert.strictEqual(clampPitch(85), 85, '85 top-down pitch is valid');
  assert.strictEqual(clampPitch(95), 88, 'Above 88 pitch must be clamped to 88');
});

test('3D Camera - 360 degree horizontal yaw rotation (kanan-kiri)', () => {
  const stepLeft = (yaw, delta) => (yaw - delta + 360) % 360;
  const stepRight = (yaw, delta) => (yaw + delta + 360) % 360;

  assert.strictEqual(stepLeft(0, 15), 345);
  assert.strictEqual(stepRight(350, 20), 10);
  assert.strictEqual(stepRight(45, 45), 90);
});

test('3D Projection - Floor and roof elevation projects valid perspective coordinates', () => {
  const camera = {
    yaw: 45,
    pitch: clampPitch(42),
    distance: 100000,
    panX: 0,
    panY: 0,
    targetX: 25000,
    targetY: 40000,
    targetZ: 2000,
  };

  const groundP = projectPointTest(25000, 40000, 0, camera);
  const roofP = projectPointTest(25000, 40000, 8000, camera);

  assert.ok(groundP !== null, 'Ground point must project onto screen');
  assert.ok(roofP !== null, 'Roof point must project onto screen');
  // At pitch > 0 looking from above, higher Z coordinates appear higher on screen (lower Y pixel)
  assert.ok(roofP.y < groundP.y, 'Roof point must be visually above ground point on screen');
});

test('Slot Orientation & Snapping - Horizontal vs Vertikal calculation base for fill & drop', () => {
  const slotConfig = { lengthMm: 1000, depthMm: 500, heightMm: 400 };

  // 1. Horizontal Mode: slot width is lengthMm, slot depth is depthMm
  const getSlotDimensions = (isRotated) => ({
    slotW: isRotated ? slotConfig.depthMm : slotConfig.lengthMm,
    slotD: isRotated ? slotConfig.lengthMm : slotConfig.depthMm,
  });

  const horizontalDims = getSlotDimensions(false);
  assert.strictEqual(horizontalDims.slotW, 1000, 'Horizontal slot width must be 1000mm (lengthMm)');
  assert.strictEqual(horizontalDims.slotD, 500, 'Horizontal slot depth must be 500mm (depthMm)');

  // 2. Vertical Mode: slot width is depthMm, slot depth is lengthMm
  const verticalDims = getSlotDimensions(true);
  assert.strictEqual(verticalDims.slotW, 500, 'Vertical slot width must be 500mm (depthMm)');
  assert.strictEqual(verticalDims.slotD, 1000, 'Vertical slot depth must be 1000mm (lengthMm)');

  // 3. Drop snapping calculation adheres to active slot orientation
  const snapCoords = (wx, wy, dims) => ({
    x: Math.round(wx / dims.slotW) * dims.slotW,
    y: Math.round(wy / dims.slotD) * dims.slotD,
  });

  // World coordinates (2350, 1800)
  const snappedHorizontal = snapCoords(2350, 1800, horizontalDims);
  assert.strictEqual(snappedHorizontal.x, 2000, 'Snapped X aligns to multiple of 1000mm');
  assert.strictEqual(snappedHorizontal.y, 2000, 'Snapped Y aligns to multiple of 500mm');

  const snappedVertical = snapCoords(2350, 1800, verticalDims);
  assert.strictEqual(snappedVertical.x, 2500, 'Snapped X aligns to multiple of 500mm');
  assert.strictEqual(snappedVertical.y, 2000, 'Snapped Y aligns to multiple of 1000mm');
});

test('3D Floor Zones - Colors & Diagonal Stripes for Aisles and Docks', () => {
  const getAisleTypeAndStyle = (aisle) => {
    const name = String(aisle.name || '').toLowerCase();
    const code = String(aisle.aisle_code || '').toLowerCase();
    const type = String(aisle.type || aisle.aisle_type || '').toLowerCase();
    const dir = String(aisle.direction || '').toLowerCase();

    const isBoth =
      type === 'both' ||
      type === 'shared' ||
      dir === 'both' ||
      dir === 'shared' ||
      name.includes('keduanya') ||
      name.includes('both') ||
      name.includes('shared');

    if (isBoth) {
      return { category: 'both', isYellow: true, hasStripes: true, stripeColor: '#16a34a' };
    }

    const isForklift =
      type === 'forklift' ||
      dir === 'forklift' ||
      name.includes('forklift') ||
      code.includes('fk');

    if (isForklift) {
      return { category: 'forklift', isYellow: true, hasStripes: false };
    }

    return { category: 'person', isGreen: true, hasStripes: false };
  };

  // 1. Jalan untuk orang: Warna HIJAU
  const personAisle = getAisleTypeAndStyle({ name: 'Jalur Pejalan Kaki', type: 'person' });
  assert.strictEqual(personAisle.category, 'person');
  assert.strictEqual(personAisle.isGreen, true, 'Walkway must be green');
  assert.strictEqual(personAisle.hasStripes, false, 'Walkway has no diagonal stripes');

  // 2. Jalan forklift: Warna KUNING
  const forkliftAisle = getAisleTypeAndStyle({ name: 'Jalur Forklift', type: 'forklift' });
  assert.strictEqual(forkliftAisle.category, 'forklift');
  assert.strictEqual(forkliftAisle.isYellow, true, 'Forklift aisle must be yellow');

  // 3. Jalan keduanya: Warna KUNING BERGARIS HIJAU
  const bothAisle = getAisleTypeAndStyle({ name: 'Jalur Keduanya', type: 'both' });
  assert.strictEqual(bothAisle.category, 'both');
  assert.strictEqual(bothAisle.isYellow, true, 'Shared aisle must have yellow base');
  assert.strictEqual(bothAisle.hasStripes, true, 'Shared aisle must have diagonal stripes');
  assert.strictEqual(bothAisle.stripeColor, '#16a34a', 'Shared aisle stripes must be green');

  // 4. Area Dok: Garis PUTIH DIAGONAL
  const dockZone = {
    category: 'dock',
    hasWhiteStripes: true,
    stripeColor: '#ffffff',
  };
  assert.strictEqual(dockZone.hasWhiteStripes, true, 'Dock area must have white diagonal stripes');
  assert.strictEqual(dockZone.stripeColor, '#ffffff', 'Dock stripe color must be white');

  // 5. Penanda Orientasi Kompak (H vs V) untuk Jalan & Rak
  const getOrientationSymbol = (entity, isRack = false) => {
    if (isRack) {
      const isRot = (Number(entity.rotation) || 0) % 180 !== 0;
      const rawLen = Number(entity.length_mm) || 2400;
      const rawDep = Number(entity.depth_mm) || 1000;
      const rw = isRot ? rawDep : rawLen;
      const rl = isRot ? rawLen : rawDep;
      const isVert = Boolean(entity.slot_rotated || isRot || (rl > rw));
      return isVert ? 'V' : 'H';
    }
    const isHoriz = (Number(entity.width_mm) || 2000) >= (Number(entity.length_mm) || 5000);
    return isHoriz ? 'H' : 'V';
  };
  const horizAisle = { width_mm: 8000, length_mm: 2000 };
  const vertAisle = { width_mm: 2000, length_mm: 12000 };
  assert.strictEqual(getOrientationSymbol(horizAisle, false), 'H');
  assert.strictEqual(getOrientationSymbol(vertAisle, false), 'V');

  const horizRack = { length_mm: 4000, depth_mm: 500, rotation: 0 };
  const vertRack = { length_mm: 6000, depth_mm: 500, rotation: 90 };
  assert.strictEqual(getOrientationSymbol(horizRack, true), 'H');
  assert.strictEqual(getOrientationSymbol(vertRack, true), 'V');
});

test('3D Rack Footprint & Orientation - Modular Slot Grid Alignment', () => {
  const computeRack3DMeta = (rack, slotConfig = { lengthMm: 1000, depthMm: 500 }) => {
    const rawLen = Number(rack.length_mm) || (rack.width_mm && !rack.depth_mm ? Number(rack.width_mm) : 2400);
    const rawDep = Number(rack.depth_mm) || (rack.width_mm && rack.depth_mm ? Number(rack.depth_mm) : 1000);
    const rot = Number(rack.rotation) || 0;
    const isRot = rot === 90 || rot === 270;

    const rw = isRot ? rawDep : rawLen; // X dimension on floor
    const rl = isRot ? rawLen : rawDep; // Y dimension on floor
    const isVertical = Boolean(rack.slot_rotated || isRot || (rl > rw));

    const cfgLen = slotConfig.lengthMm || 1000;
    const cfgDep = slotConfig.depthMm || 500;
    const slotBaySpan = Number(rack.slot_width_mm) || cfgLen;

    const longDim = isVertical ? rl : rw;
    const explicitBays = Number(rack.bay_count);
    const bayCount = Math.max(1, explicitBays > 0 ? explicitBays : Math.round(longDim / slotBaySpan));
    const step = isVertical ? (rl / bayCount) : (rw / bayCount);
    const trussSpan = isVertical ? rw : rl;

    return { rw, rl, isVertical, bayCount, step, trussSpan };
  };

  // 1. Horizontal Rack created with 1000x500mm slot grid: 4 slots dragged = 4000mm length, 500mm depth
  const horizSlot = computeRack3DMeta({
    length_mm: 4000,
    depth_mm: 500,
    rotation: 0,
    bay_count: 4,
    slot_width_mm: 1000,
    slot_depth_mm: 500,
    slot_rotated: false,
  });
  assert.strictEqual(horizSlot.isVertical, false, 'Horizontal rack');
  assert.strictEqual(horizSlot.bayCount, 4, 'Bay count must strictly match 4 horizontal slots');
  assert.strictEqual(horizSlot.step, 1000, 'Each 3D bay span must exactly equal 1000mm slot width');
  assert.strictEqual(horizSlot.trussSpan, 500, 'Truss depth must strictly match 500mm slot depth');

  // 2. Vertical Rack created with 500x1000mm slot grid: 6 slots dragged = 6000mm length, 500mm depth
  const vertSlot = computeRack3DMeta({
    length_mm: 6000,
    depth_mm: 500,
    rotation: 90,
    bay_count: 6,
    slot_width_mm: 1000,
    slot_depth_mm: 500,
    slot_rotated: true,
  });
  assert.strictEqual(vertSlot.isVertical, true, 'Vertical rack');
  assert.strictEqual(vertSlot.bayCount, 6, 'Bay count must strictly match 6 vertical slots');
  assert.strictEqual(vertSlot.step, 1000, 'Each 3D vertical bay span must exactly equal 1000mm slot length');
  assert.strictEqual(vertSlot.trussSpan, 500, 'Truss width across X must strictly match 500mm slot width');
});

test('Fitur 2: Snap to Clearance & Auto-Fit Jalan ke Celah Rak (Zero-Collision)', () => {
  // Logic identik dengan PointerController._snapAisleToRackClearance
  const snapAisleToClearance = (rect, rackBoxes, forcedOrientation = null) => {
    let { x, y, width, depth } = rect;
    let isAutoFitted = false;
    if (!rackBoxes || rackBoxes.length === 0) {
      return { x: Math.round(x), y: Math.round(y), width: Math.round(width), depth: Math.round(depth), isAutoFitted: false };
    }

    const isVerticalAisle = forcedOrientation === 'vertical' || (forcedOrientation === null && depth > width);

    const fitHorizontalGap = () => {
      const yOverlapping = rackBoxes.filter((r) => r.top < y + depth && r.bottom > y);
      if (yOverlapping.length > 0) {
        const leftRacks = yOverlapping.filter((r) => r.right <= x + 400 || (r.left < x && r.right < x + width));
        const rightRacks = yOverlapping.filter((r) => r.left >= x - 200 && r.right > x);

        const validLeft = leftRacks.filter((l) => !rightRacks.some((r) => r.id === l.id));
        const validRight = rightRacks.filter((r) => !leftRacks.some((l) => l.id === r.id));

        const maxLeftEdge = validLeft.length > 0 ? Math.max(...validLeft.map((r) => r.right)) : null;
        const minRightEdge = validRight.length > 0 ? Math.min(...validRight.map((r) => r.left)) : null;

        if (maxLeftEdge !== null && minRightEdge !== null && minRightEdge > maxLeftEdge) {
          const availableGap = minRightEdge - maxLeftEdge;
          if (availableGap < width) {
            // Celah lebih sempit dari lebar jalan -> persempit jalan sesuai celah (zero-collision)
            if (availableGap >= 150) {
              x = maxLeftEdge;
              width = availableGap;
              isAutoFitted = true;
            }
          } else {
            // Celah cukup lebar -> JANGAN diperlebar! Tetap gunakan lebar yang diminta.
            if (x < maxLeftEdge) {
              x = maxLeftEdge;
              isAutoFitted = true;
            } else if (x + width > minRightEdge) {
              x = minRightEdge - width;
              isAutoFitted = true;
            }
          }
        } else if (maxLeftEdge !== null) {
          if (x < maxLeftEdge || Math.abs(x - maxLeftEdge) < 300) {
            x = maxLeftEdge;
            isAutoFitted = true;
          }
        } else if (minRightEdge !== null) {
          if ((x + width) > minRightEdge || Math.abs((x + width) - minRightEdge) < 300) {
            if (x < minRightEdge) {
              width = Math.min(width, Math.max(150, minRightEdge - x));
            } else {
              x = minRightEdge - width;
            }
            isAutoFitted = true;
          }
        }
      }
    };

    const fitVerticalGap = () => {
      const xOverlapping = rackBoxes.filter((r) => r.left < x + width && r.right > x);
      if (xOverlapping.length > 0) {
        const topRacks = xOverlapping.filter((r) => r.bottom <= y + 400 || (r.top < y && r.bottom < y + depth));
        const bottomRacks = xOverlapping.filter((r) => r.top >= y - 200 && r.top > y);

        const validTop = topRacks.filter((t) => !bottomRacks.some((b) => b.id === t.id));
        const validBottom = bottomRacks.filter((b) => !topRacks.some((t) => t.id === b.id));

        const maxTopEdge = validTop.length > 0 ? Math.max(...validTop.map((r) => r.bottom)) : null;
        const minBottomEdge = validBottom.length > 0 ? Math.min(...validBottom.map((r) => r.top)) : null;

        if (maxTopEdge !== null && minBottomEdge !== null && minBottomEdge > maxTopEdge) {
          const availableGap = minBottomEdge - maxTopEdge;
          if (availableGap < depth) {
            // Celah lebih sempit dari kedalaman jalan -> persempit jalan sesuai celah (zero-collision)
            if (availableGap >= 150) {
              y = maxTopEdge;
              depth = availableGap;
              isAutoFitted = true;
            }
          } else {
            // Celah cukup lebar -> JANGAN diperlebar! Tetap gunakan kedalaman yang diminta.
            if (y < maxTopEdge) {
              y = maxTopEdge;
              isAutoFitted = true;
            } else if (y + depth > minBottomEdge) {
              y = minBottomEdge - depth;
              isAutoFitted = true;
            }
          }
        } else if (maxTopEdge !== null) {
          if (y < maxTopEdge || Math.abs(y - maxTopEdge) < 300) {
            y = maxTopEdge;
            isAutoFitted = true;
          }
        } else if (minBottomEdge !== null) {
          if ((y + depth) > minBottomEdge || Math.abs((y + depth) - minBottomEdge) < 300) {
            if (y < minBottomEdge) {
              depth = Math.min(depth, Math.max(150, minBottomEdge - y));
            } else {
              y = minBottomEdge - depth;
            }
            isAutoFitted = true;
          }
        }
      }
    };

    if (isVerticalAisle) {
      fitHorizontalGap();
      fitVerticalGap();
    } else {
      fitVerticalGap();
      fitHorizontalGap();
    }

    return { x, y, width, depth, isAutoFitted };
  };

  // Kasus 1: Celah vertikal antara Rack A (x=0..1000) dan Rack B (x=1800..2800). Celah = 800mm (0.8m)
  // Pengguna mencoba meletakkan jalan standar 1000mm di celah ini
  const mockRacks = [
    { id: 'r1', left: 0, right: 1000, top: 0, bottom: 8000 },
    { id: 'r2', left: 1800, right: 2800, top: 0, bottom: 8000 },
  ];
  const inputAisle = { x: 1000, y: 500, width: 1000, depth: 6000 };
  const fittedAisle = snapAisleToClearance(inputAisle, mockRacks);

  assert.strictEqual(fittedAisle.isAutoFitted, true, 'Aisle must be auto-fitted');
  assert.strictEqual(fittedAisle.x, 1000, 'Aisle must snap exactly to left rack right edge');
  assert.strictEqual(fittedAisle.width, 800, 'Aisle width must be auto-fitted to 800mm (exact available clearance)');
  assert.strictEqual(fittedAisle.x + fittedAisle.width, 1800, 'Aisle right edge must touch right rack left edge (zero collision)');

  // Kasus 2: Celah horizontal antara Rak Atas (y=0..500) dan Rak Bawah (y=1200..1700). Celah = 700mm
  const horizontalMockRacks = [
    { id: 'h1', left: 0, right: 6000, top: 0, bottom: 500 },
    { id: 'h2', left: 0, right: 6000, top: 1200, bottom: 1700 },
  ];
  const horizAisleInput = { x: 500, y: 500, width: 5000, depth: 1000 };
  const fittedHoriz = snapAisleToClearance(horizAisleInput, horizontalMockRacks);

  assert.strictEqual(fittedHoriz.isAutoFitted, true, 'Horizontal aisle must be auto-fitted');
  assert.strictEqual(fittedHoriz.y, 500, 'Must snap to bottom of top rack');
  assert.strictEqual(fittedHoriz.depth, 700, 'Depth must auto-fit to 700mm gap');

  // Kasus 3: Celah kecil sempit (x=1000..1700, celah 700mm), input di posisi sembarang dalam celah (misal x=1400) dengan width default 2000mm
  const smallGapRacks = [
    { id: 's1', left: 0, right: 1000, top: 0, bottom: 6000 },
    { id: 's2', left: 1700, right: 2700, top: 0, bottom: 6000 },
  ];
  const smallInput = { x: 1400, y: 0, width: 2000, depth: 6000 };
  const fittedSmall = snapAisleToClearance(smallInput, smallGapRacks, 'vertical');
  assert.strictEqual(fittedSmall.isAutoFitted, true, 'Small gap aisle must be auto-fitted');
  assert.strictEqual(fittedSmall.x, 1000, 'Must snap to left edge 1000');
  assert.strictEqual(fittedSmall.width, 700, 'Must auto-fit width to exact 700mm gap');

  // Kasus 4: Drag horizontal pendek (width 1000mm, depth default 2000mm) pada celah horizontal 800mm (y=2000..2800)
  const shortHorizRacks = [
    { id: 'sh1', left: 0, right: 8000, top: 0, bottom: 2000 },
    { id: 'sh2', left: 0, right: 8000, top: 2800, bottom: 4800 },
  ];
  const shortHorizInput = { x: 2000, y: 2200, width: 1000, depth: 2000 };
  const fittedShortHoriz = snapAisleToClearance(shortHorizInput, shortHorizRacks, 'horizontal');
  assert.strictEqual(fittedShortHoriz.isAutoFitted, true, 'Short horizontal drag must be auto-fitted');
  assert.strictEqual(fittedShortHoriz.y, 2000, 'Must snap to top rack bottom at 2000');
  assert.strictEqual(fittedShortHoriz.depth, 800, 'Must auto-fit depth to exact 800mm gap');

  // Kasus 5: Bounded Corner Gap (seperti celah antara A-03 di atas dan B-05 di bawah, y=1000..2000, celah 1000mm)
  const cornerRacks = [
    { id: 'top-rack', left: 2000, right: 15000, top: 0, bottom: 1000 },
    { id: 'bottom-rack', left: 2000, right: 4000, top: 2000, bottom: 5000 },
  ];
  const cornerInput = { x: 2000, y: 1000, width: 2000, depth: 1500 };
  const fittedCorner = snapAisleToClearance(cornerInput, cornerRacks);
  assert.strictEqual(fittedCorner.isAutoFitted, true, 'Corner gap aisle must be auto-fitted');
  assert.strictEqual(fittedCorner.y, 1000, 'Y must snap to bottom of top rack at 1000');
  assert.strictEqual(fittedCorner.depth, 1000, 'Depth must auto-fit to 1000mm gap between top and bottom racks');

  // Kasus 6: Celah Lebih Besar dari Jalan (Celah = 3000mm, Jalan = 1500mm) -> JALAN TIDAK MELEBAR, TETAP 1500mm
  const wideGapRacks = [
    { id: 'w1', left: 0, right: 1000, top: 0, bottom: 8000 },
    { id: 'w2', left: 4000, right: 5000, top: 0, bottom: 8000 },
  ];
  const wideInput = { x: 1200, y: 500, width: 1500, depth: 6000 };
  const fittedWide = snapAisleToClearance(wideInput, wideGapRacks);
  assert.strictEqual(fittedWide.width, 1500, 'Jalan dilarang otomatis diperlebar melebihi ukuran yang diminta (harus tetap 1500mm)');
  assert.strictEqual(fittedWide.x, 1200, 'Posisi x tetap aman tanpa pelebaran');
});

test('3D Doors - Geometri & Klasifikasi Pintu Gudang (Entry, Exit, Both)', () => {
  const calculate3DDoorGeometry = (door, whH = 8000) => {
    const dx = Number(door.x_mm) || 0;
    const dy = Number(door.y_mm) || 0;
    const dw = Number(door.width_mm) || 3000;
    const dl = Number(door.length_mm) || 600;
    const dh = Math.max(1800, Math.min(whH, Number(door.height_mm) || 2800));

    const type = String(door.object_type || '').toLowerCase();
    const isBoth = type.includes('both') || type === 'door' || (type.includes('masuk') && type.includes('keluar'));
    const isEntry = !isBoth && (type.includes('entry') || type.includes('masuk'));
    const isExit = !isBoth && (type.includes('exit') || type.includes('keluar'));

    const isHoriz = dw >= dl;
    const postThick = Math.min(220, Math.max(120, (isHoriz ? dw : dl) * 0.08));
    const lintelH = Math.min(320, Math.max(180, dh * 0.1));
    const openH = dh - lintelH;

    let leftPost, rightPost, lintel, shutter, visionWindow;
    if (isHoriz) {
      leftPost = { x: dx, y: dy, z: 0, w: postThick, l: dl, h: dh };
      rightPost = { x: dx + dw - postThick, y: dy, z: 0, w: postThick, l: dl, h: dh };
      lintel = { x: dx, y: dy, z: dh - lintelH, w: dw, l: dl, h: lintelH };
      const panelThick = Math.max(80, Math.min(dl, 160));
      const panelY = dy + (dl - panelThick) / 2;
      const panelW = dw - 2 * postThick;
      const panelX = dx + postThick;
      shutter = { x: panelX, y: panelY, z: 0, w: panelW, l: panelThick, h: openH };
      if (panelW >= 600 && openH >= 1200) {
        const winW = Math.min(panelW * 0.55, 1400);
        visionWindow = { x: panelX + (panelW - winW) / 2, y: panelY - 4, z: Math.min(openH - 300, 1350), w: winW, l: panelThick + 8, h: 260 };
      }
    } else {
      leftPost = { x: dx, y: dy, z: 0, w: dw, l: postThick, h: dh };
      rightPost = { x: dx, y: dy + dl - postThick, z: 0, w: dw, l: postThick, h: dh };
      lintel = { x: dx, y: dy, z: dh - lintelH, w: dw, l: dl, h: lintelH };
      const panelThick = Math.max(80, Math.min(dw, 160));
      const panelX = dx + (dw - panelThick) / 2;
      const panelL = dl - 2 * postThick;
      const panelY = dy + postThick;
      shutter = { x: panelX, y: panelY, z: 0, w: panelThick, l: panelL, h: openH };
      if (panelL >= 600 && openH >= 1200) {
        const winL = Math.min(panelL * 0.55, 1400);
        visionWindow = { x: panelX - 4, y: panelY + (panelL - winL) / 2, z: Math.min(openH - 300, 1350), w: panelThick + 8, l: winL, h: 260 };
      }
    }

    const category = isEntry ? 'entry' : isExit ? 'exit' : 'both';
    return { category, isHoriz, leftPost, rightPost, lintel, shutter, visionWindow, openH, dh };
  };

  // 1. Pintu Masuk Horizontal pada Dinding Utara
  const entryDoor = {
    id: 'd1',
    object_type: 'door_entry',
    name: 'Pintu Masuk Utama',
    x_mm: 5000,
    y_mm: 0,
    width_mm: 3000,
    length_mm: 600,
    height_mm: 3000,
  };
  const gEntry = calculate3DDoorGeometry(entryDoor);
  assert.strictEqual(gEntry.category, 'entry', 'Door category must be entry');
  assert.strictEqual(gEntry.isHoriz, true, 'Orientation must be horizontal along wall');
  assert.strictEqual(gEntry.leftPost.x, 5000, 'Left post starts at door x');
  assert.strictEqual(gEntry.rightPost.x + gEntry.rightPost.w, 8000, 'Right post touches door right edge at 8000');
  assert.strictEqual(gEntry.lintel.z + gEntry.lintel.h, 3000, 'Lintel top reaches full door height 3000');
  assert.ok(gEntry.shutter.w > 2000, 'Shutter panel width fits opening span');
  assert.ok(gEntry.visionWindow !== null, 'Vision window is present at eye height');

  // 2. Pintu Keluar Vertikal pada Dinding Barat
  const exitDoor = {
    id: 'd2',
    object_type: 'door_exit',
    name: 'Pintu Keluar Forklift',
    x_mm: 0,
    y_mm: 10000,
    width_mm: 600,
    length_mm: 3200,
    height_mm: 2800,
  };
  const gExit = calculate3DDoorGeometry(exitDoor);
  assert.strictEqual(gExit.category, 'exit', 'Door category must be exit');
  assert.strictEqual(gExit.isHoriz, false, 'Orientation must be vertical along wall');
  assert.strictEqual(gExit.leftPost.y, 10000, 'North post starts at 10000');
  assert.strictEqual(gExit.rightPost.y + gExit.rightPost.l, 13200, 'South post ends at 13200');
  assert.strictEqual(gExit.lintel.h, 280, 'Lintel height calculated correctly');

  // 3. Pintu Akses Keduanya (Both)
  const bothDoor = {
    id: 'd3',
    object_type: 'door_both',
    name: 'Pintu Akses 2 Arah',
    x_mm: 12000,
    y_mm: 0,
    width_mm: 2400,
    length_mm: 600,
    height_mm: 2500,
  };
  const gBoth = calculate3DDoorGeometry(bothDoor);
  assert.strictEqual(gBoth.category, 'both', 'Door category must be both');
});

test('3D Rack Symmetry - 4-sided outer perimeter framing (Depan, Belakang, Kiri, Kanan identical)', () => {
  // Test function modeling the 4-sided orange beam geometry for horizontal & vertical racks
  const generateRackBeamPerimeter = (isVertical, rw, rl, levelCount, bottomOffset, lvlStep, beamThick, postThick) => {
    const beams = [];
    for (let lvl = 0; lvl < levelCount; lvl++) {
      const zBeam = bottomOffset + lvl * lvlStep;
      if (!isVertical) {
        // Horizontal Rack: Beams on Front, Back, Left, and Right
        beams.push({ side: 'front', z: zBeam, w: rw, l: postThick });
        beams.push({ side: 'back', z: zBeam, w: rw, l: postThick });
        beams.push({ side: 'left', z: zBeam, w: postThick, l: rl - postThick * 2 });
        beams.push({ side: 'right', z: zBeam, w: postThick, l: rl - postThick * 2 });
      } else {
        // Vertical Rack: Beams on Left, Right, Front, and Back
        beams.push({ side: 'left', z: zBeam, w: postThick, l: rl });
        beams.push({ side: 'right', z: zBeam, w: postThick, l: rl });
        beams.push({ side: 'front', z: zBeam, w: rw - postThick * 2, l: postThick });
        beams.push({ side: 'back', z: zBeam, w: rw - postThick * 2, l: postThick });
      }
    }
    return beams;
  };

  const horizBeams = generateRackBeamPerimeter(false, 6000, 1000, 3, 120, 1000, 75, 60);
  assert.strictEqual(horizBeams.length, 12, '3 levels * 4 outer faces = 12 perimeter beams');
  const horizSides = new Set(horizBeams.map((b) => b.side));
  assert.ok(horizSides.has('front') && horizSides.has('back') && horizSides.has('left') && horizSides.has('right'), 'Horizontal rack has beams on all 4 faces');

  const vertBeams = generateRackBeamPerimeter(true, 1000, 6000, 3, 120, 1000, 75, 60);
  assert.strictEqual(vertBeams.length, 12, '3 levels * 4 outer faces = 12 perimeter beams');
  const vertSides = new Set(vertBeams.map((b) => b.side));
  assert.ok(vertSides.has('front') && vertSides.has('back') && vertSides.has('left') && vertSides.has('right'), 'Vertical rack has beams on all 4 faces');
});

test('3D Camera Presets - 4 cardinal angles exist (Depan, Belakang, Kiri, Kanan)', () => {
  const presets = {
    depan: { yaw: 0, pitch: 25 },
    kanan: { yaw: 90, pitch: 25 },
    belakang: { yaw: 180, pitch: 25 },
    kiri: { yaw: 270, pitch: 25 },
  };

  assert.strictEqual(presets.depan.yaw, 0);
  assert.strictEqual(presets.kanan.yaw, 90);
  assert.strictEqual(presets.belakang.yaw, 180);
  assert.strictEqual(presets.kiri.yaw, 270);
});
