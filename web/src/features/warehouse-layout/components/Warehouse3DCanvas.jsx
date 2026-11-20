/**
 * Warehouse 3D Canvas Viewport Component
 * Focused strictly on RACKS and CARDBOARD BOXES (Kardus & Palet).
 * Zero vehicles (no excavator/forklift), no mezzanine/clutter.
 *
 * Guaranteed 100% Solid Cardboard Boxes:
 * - Uses 2D screen cross-product back-face culling on all 6 cuboid faces.
 * - Always renders the facing front, side, and top faces so boxes are NEVER hollow or see-through.
 *
 * Clean Rack Proportions:
 * - Shelf levels start directly near the floor (80mm base, no hovering bottom stilts or empty legs).
 * - Exact level count matching user settings (default 3 levels).
 * - Camera Orbit: 360° horizontal rotation (kanan-kiri), vertical pitch clamped 15° to 88° (strictly above floor).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Design Palette matching reference photos
const PALETTE_3D = {
  sky: '#f6f8f3',
  floor: '#e5e9df',
  floorGrid: '#cbd5be',
  floorBorder: '#64748b',

  // Racking System
  rackUprightBlue: '#1d4ed8',     // Deep industrial blue
  rackUprightDark: '#1e3a8a',     // Shaded side of upright
  rackUprightLight: '#3b82f6',    // Top/highlight of upright
  rackBeamOrange: '#ea580c',      // Vibrant safety orange beam
  rackBeamDark: '#c2410c',        // Shaded beam face
  rackBeamTop: '#f97316',         // Top beam face
  rackBrace: '#60a5fa',           // Diagonal cross bracing

  // Pallet & Cardboard Boxes (Kardus)
  palletBlue: '#0284c7',          // Pallet blue base
  palletWood: '#92400e',          // Pallet wood runner
  boxTop: '#f4dec3',              // Light warm kraft top face
  boxFront: '#e5c497',            // Medium warm kraft front face
  boxSide: '#cca16d',             // Shaded kraft side face
  boxOutline: '#7c4f1d',          // Cardboard border outline
  boxTape: '#fde68a',             // Center sealing tape line

  // Warehouse Doors (Pintu Masuk, Keluar, Akses & Kusen Baja)
  doorFrameTop: '#475569',
  doorFrameFront: '#334155',
  doorFrameSide: '#1e293b',
  doorFrameStroke: '#0f172a',

  doorEntryTop: '#86efac',
  doorEntryFront: '#22c55e',
  doorEntrySide: '#16a34a',
  doorEntryStroke: '#14532d',

  doorExitTop: '#fca5a5',
  doorExitFront: '#ef4444',
  doorExitSide: '#dc2626',
  doorExitStroke: '#7f1d1d',

  doorBothTop: '#93c5fd',
  doorBothFront: '#3b82f6',
  doorBothSide: '#1d4ed8',
  doorBothStroke: '#1e3a8a',

  doorGlassTop: '#e0f2fe',
  doorGlassFront: '#7dd3fc',
  doorGlassSide: '#38bdf8',
  doorGlassStroke: '#0284c7',

  selectedGlow: '#0284c7',
};

// 3D Perspective Projection
function projectPoint(x, y, z, camera, width, height) {
  const dx = x - camera.targetX;
  const dy = y - camera.targetY;
  const dz = z - camera.targetZ;

  // Yaw rotation around Z axis (left / right orbit 360°)
  const radYaw = (camera.yaw * Math.PI) / 180;
  const cosY = Math.cos(radYaw);
  const sinY = Math.sin(radYaw);
  const x1 = dx * cosY - dy * sinY;
  const y1 = dx * sinY + dy * cosY;
  const z1 = dz;

  // Pitch rotation around horizontal axis (strictly clamped 15° to 88°)
  const radPitch = (camera.pitch * Math.PI) / 180;
  const cosP = Math.cos(radPitch);
  const sinP = Math.sin(radPitch);
  const x2 = x1;
  const y2 = y1 * cosP - z1 * sinP;
  const z2 = y1 * sinP + z1 * cosP;

  const fov = 1300;
  const depth = camera.distance + y2;
  if (depth <= 40) return null; // Clipped behind camera

  const scale = fov / depth;
  const screenX = width / 2 + x2 * scale + camera.panX;
  const screenY = height / 2 - z2 * scale + camera.panY;

  return { x: screenX, y: screenY, depth, scale };
}

// 2D Screen Cross Product for Back-Face Culling
function cross2D(p0, p1, p2) {
  return (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
}

// Draw shaded polygon
function drawPoly(ctx, pts, fillColor, strokeColor = null, lineWidth = 1) {
  if (!pts || pts.some((p) => !p)) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Draws a 100% Solid 3D Cuboid with Dynamic Back-Face Culling.
 * Evaluates all 6 faces in screen coordinates so that whichever faces are pointing
 * towards the viewer are ALWAYS rendered, guaranteeing the box is NEVER hollow or see-through!
 */
function draw3DSolidCuboid(ctx, x, y, z, w, l, h, camera, width, height, colors) {
  const c000 = projectPoint(x, y, z, camera, width, height);
  const c100 = projectPoint(x + w, y, z, camera, width, height);
  const c110 = projectPoint(x + w, y + l, z, camera, width, height);
  const c010 = projectPoint(x, y + l, z, camera, width, height);

  const c001 = projectPoint(x, y, z + h, camera, width, height);
  const c101 = projectPoint(x + w, y, z + h, camera, width, height);
  const c111 = projectPoint(x + w, y + l, z + h, camera, width, height);
  const c011 = projectPoint(x, y + l, z + h, camera, width, height);

  if (!c000 || !c100 || !c110 || !c010 || !c001 || !c101 || !c111 || !c011) return;

  // 6 Faces defined with counter-clockwise winding when looking from outside
  const faces = [
    { type: 'top', pts: [c001, c101, c111, c011], color: colors.top },
    { type: 'bottom', pts: [c010, c110, c100, c000], color: colors.side || colors.front },
    { type: 'front', pts: [c000, c100, c101, c001], color: colors.front },
    { type: 'back', pts: [c110, c010, c011, c111], color: colors.front },
    { type: 'right', pts: [c100, c110, c111, c101], color: colors.side },
    { type: 'left', pts: [c010, c000, c001, c011], color: colors.side },
  ];

  // Draw every face that is oriented towards the viewer (cross2D < 0 in canvas screen coords)
  for (const face of faces) {
    if (cross2D(face.pts[0], face.pts[1], face.pts[2]) < 0) {
      drawPoly(ctx, face.pts, face.color, colors.stroke || '#7c4f1d', colors.lineWidth || 1);
    }
  }

  // Draw top sealing tape line if requested and top face is visible
  if (colors.drawTape && cross2D(c001, c101, c111) < 0) {
    const tapeP1 = projectPoint(x + w / 2, y, z + h, camera, width, height);
    const tapeP2 = projectPoint(x + w / 2, y + l, z + h, camera, width, height);
    if (tapeP1 && tapeP2) {
      ctx.strokeStyle = PALETTE_3D.boxTape;
      ctx.lineWidth = Math.max(2 * (c001.scale * 90), 1.5);
      ctx.beginPath();
      ctx.moveTo(tapeP1.x, tapeP1.y);
      ctx.lineTo(tapeP2.x, tapeP2.y);
      ctx.stroke();
    }
  }
}

/**
 * Draws 3D Floor Markings for Aisles and Docks (Z=0 on floor plane).
 * Supports base fills, true 3D perspective hazard diagonal stripes, borders, and labels.
 */
function draw3DFloorZone(ctx, x, y, w, l, camera, width, height, style) {
  const p1 = projectPoint(x, y, 0, camera, width, height);
  const p2 = projectPoint(x + w, y, 0, camera, width, height);
  const p3 = projectPoint(x + w, y + l, 0, camera, width, height);
  const p4 = projectPoint(x, y + l, 0, camera, width, height);

  if (!p1 || !p2 || !p3 || !p4) return;

  ctx.save();

  // 1. Base Footprint Polygon
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();

  if (style.baseColor) {
    ctx.fillStyle = style.baseColor;
    ctx.fill();
  }

  // 2. 3D Perspective Diagonal Hazard Stripes
  if (style.hasStripes && style.stripeColor) {
    ctx.clip(); // Keep stripes strictly within zone bounds

    ctx.strokeStyle = style.stripeColor;
    ctx.lineWidth = style.stripeWidth || 3;

    const spacing = style.stripeSpacing || 800; // mm
    const totalSpan = w + l;
    for (let s = -totalSpan; s <= totalSpan * 2; s += spacing) {
      const pA = projectPoint(x + s, y - 200, 0, camera, width, height);
      const pB = projectPoint(x + s + l, y + l + 200, 0, camera, width, height);
      if (pA && pB) {
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  // 3. Perimeter Border
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.strokeStyle = style.borderColor || '#334155';
  ctx.lineWidth = style.borderWidth || 2;
  ctx.stroke();

  // 4. Readable Zone Label
  if (style.label) {
    const centerProj = projectPoint(x + w / 2, y + l / 2, 0, camera, width, height);
    if (centerProj) {
      ctx.font = 'bold 10px sans-serif';
      const textW = ctx.measureText(style.label).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(centerProj.x - textW / 2 - 5, centerProj.y - 7, textW + 10, 14, 3);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.label, centerProj.x, centerProj.y);
    }
  }
  ctx.restore();
}

export default function Warehouse3DCanvas({
  snapshot,
  onSwitchTo2D,
  activeRoute = null,
  selectedKeys = new Set(),
  hiddenLayers = new Set(),
  showGrid = true,
  showMeterGrid = true,
  showGridHorizontal = true,
  showGridVertical = true,
  showSlotGrid = true,
  showSlotHorizontal = true,
  showSlotVertical = false,
  slotConfig = null,
  slotRotated = false,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [isGridActive, setIsGridActive] = useState(showGrid !== false);
  const [isSlotGridActive, setIsSlotGridActive] = useState(Boolean(showSlotGrid));

  // Sync internal state when props from toolbar change
  useEffect(() => {
    if (showGrid !== undefined) setIsGridActive(showGrid !== false);
  }, [showGrid]);

  useEffect(() => {
    if (showSlotGrid !== undefined) setIsSlotGridActive(Boolean(showSlotGrid));
  }, [showSlotGrid]);

  const warehouse = snapshot?.warehouse || {
    name: 'Main Warehouse',
    width_mm: 50000,
    length_mm: 80000,
    height_mm: 8000,
  };

  const whW = warehouse.width_mm || 50000;
  const whL = warehouse.length_mm || 80000;
  const whH = warehouse.height_mm || 8000;

  // Initial camera setup angled cleanly on the racks
  const initialDist = Math.max(whW, whL) * 1.35;
  const cameraRef = useRef({
    yaw: 42, // 42° perspective angle
    pitch: 36, // 36° elevation looking down from above (clamped 15° to 88°)
    distance: initialDist,
    panX: 0,
    panY: 30,
    targetX: whW / 2,
    targetY: whL / 2,
    targetZ: whH * 0.25,
  });

  const [cameraState, setCameraState] = useState({
    yaw: 42,
    pitch: 36,
  });

  // Pointer dragging tracking
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef('orbit'); // 'orbit' | 'pan'
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // Render 3D Scene
  const renderScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    const camera = cameraRef.current;

    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 1. Subtle, Clean Radial Gradient Background
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2 - 40,
      120,
      width / 2,
      height / 2,
      Math.max(width, height)
    );
    bgGrad.addColorStop(0, '#fafbf8');
    bgGrad.addColorStop(1, '#e3e7dc');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // List of 3D draw items for depth sorting
    const drawItems = [];

    // Helper to push individual cuboids for accurate depth sorting across all scene elements
    const pushCuboid = (cx, cy, cz, cw, cl, ch, colors) => {
      const cProj = projectPoint(cx + cw / 2, cy + cl / 2, cz + ch / 2, camera, width, height);
      if (!cProj) return;
      drawItems.push({
        depth: cProj.depth,
        render: () => draw3DSolidCuboid(ctx, cx, cy, cz, cw, cl, ch, camera, width, height, colors),
      });
    };

    // --- A. Warehouse Floor Plane & Grid Lines ---
    const p00 = projectPoint(0, 0, 0, camera, width, height);
    const pW0 = projectPoint(whW, 0, 0, camera, width, height);
    const pWL = projectPoint(whW, whL, 0, camera, width, height);
    const p0L = projectPoint(0, whL, 0, camera, width, height);

    if (p00 && pW0 && pWL && p0L) {
      // 1. Base Floor Polygon Fill
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(pW0.x, pW0.y);
      ctx.lineTo(pWL.x, pWL.y);
      ctx.lineTo(p0L.x, p0L.y);
      ctx.closePath();
      ctx.fillStyle = PALETTE_3D.floor;
      ctx.fill();

      // 2. Visible Grid Lines (Strictly adhering to user toolbar selection!)
      const shouldDrawMeter = showMeterGrid !== false && (showGridHorizontal || showGridVertical);
      const shouldDrawSlot = Boolean(showSlotGrid);

      if (isGridActive && (shouldDrawMeter || shouldDrawSlot)) {
        ctx.save();

        // A. 1-Meter & 5-Meter Grid Lines
        if (shouldDrawMeter) {
          const step1m = 1000;
          ctx.strokeStyle = '#aab6a2';
          ctx.lineWidth = 0.9;

          // Vertical meter grid lines (along X axis)
          if (showGridVertical !== false) {
            for (let x = step1m; x < whW; x += step1m) {
              if (x % 5000 === 0) continue; // Skip 5m multiples (drawn below)
              const p1 = projectPoint(x, 0, 0, camera, width, height);
              const p2 = projectPoint(x, whL, 0, camera, width, height);
              if (p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }
          }

          // Horizontal meter grid lines (along Y axis)
          if (showGridHorizontal !== false) {
            for (let y = step1m; y < whL; y += step1m) {
              if (y % 5000 === 0) continue;
              const p1 = projectPoint(0, y, 0, camera, width, height);
              const p2 = projectPoint(whW, y, 0, camera, width, height);
              if (p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }
          }

          // 5-Meter Major Grid Lines
          const step5m = 5000;
          ctx.strokeStyle = '#526049';
          ctx.lineWidth = 1.7;

          if (showGridVertical !== false) {
            for (let x = 0; x <= whW; x += step5m) {
              const p1 = projectPoint(x, 0, 0, camera, width, height);
              const p2 = projectPoint(x, whL, 0, camera, width, height);
              if (p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }
          }

          if (showGridHorizontal !== false) {
            for (let y = 0; y <= whL; y += step5m) {
              const p1 = projectPoint(0, y, 0, camera, width, height);
              const p2 = projectPoint(whW, y, 0, camera, width, height);
              if (p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }
          }

          // Coordinate Labels (0m, 5m, 10m...)
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#4b5563';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (let x = 0; x <= whW; x += step5m) {
            const p = projectPoint(x, -250, 0, camera, width, height);
            if (p) ctx.fillText(`${x / 1000}m`, p.x, p.y);
          }
          for (let y = 0; y <= whL; y += step5m) {
            const p = projectPoint(-250, y, 0, camera, width, height);
            if (p) ctx.fillText(`${y / 1000}m`, p.x, p.y);
          }
        }

        // B. Slot Grid Lines (Adhering strictly to active slot orientation: Horizontal or Vertikal!)
        if (shouldDrawSlot) {
          const isSlotVerticalActive = Boolean(showSlotVertical || slotRotated);
          const sW = isSlotVerticalActive ? (slotConfig?.depthMm || 500) : (slotConfig?.lengthMm || 1000);
          const sD = isSlotVerticalActive ? (slotConfig?.lengthMm || 1000) : (slotConfig?.depthMm || 500);

          ctx.strokeStyle = '#65a30d'; // Olive lime green slot grid
          ctx.lineWidth = 1.1;
          ctx.setLineDash([4, 3]);

          for (let x = sW; x < whW; x += sW) {
            const p1 = projectPoint(x, 0, 0, camera, width, height);
            const p2 = projectPoint(x, whL, 0, camera, width, height);
            if (p1 && p2) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
          for (let y = sD; y < whL; y += sD) {
            const p1 = projectPoint(0, y, 0, camera, width, height);
            const p2 = projectPoint(whW, y, 0, camera, width, height);
            if (p1 && p2) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
          ctx.setLineDash([]);
        }

        ctx.restore();
      }

      // 3. Thick Floor Perimeter Border Line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(pW0.x, pW0.y);
      ctx.lineTo(pWL.x, pWL.y);
      ctx.lineTo(p0L.x, p0L.y);
      ctx.closePath();
      ctx.stroke();

      // 4. Warehouse Wall Boundary 3D Outlines (Garis Batas Dinding Gudang)
      const wallH = Math.min(whH, 4500);
      const p00_top = projectPoint(0, 0, wallH, camera, width, height);
      const pW0_top = projectPoint(whW, 0, wallH, camera, width, height);
      const pWL_top = projectPoint(whW, whL, wallH, camera, width, height);
      const p0L_top = projectPoint(0, whL, wallH, camera, width, height);

      if (p00_top && pW0_top && pWL_top && p0L_top) {
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);

        const wallPillars = [
          [p00, p00_top],
          [pW0, pW0_top],
          [pWL, pWL_top],
          [p0L, p0L_top],
        ];
        wallPillars.forEach(([bot, top]) => {
          if (bot && top) {
            ctx.beginPath();
            ctx.moveTo(bot.x, bot.y);
            ctx.lineTo(top.x, top.y);
            ctx.stroke();
          }
        });

        // Top Wall Rim
        ctx.beginPath();
        ctx.moveTo(p00_top.x, p00_top.y);
        ctx.lineTo(pW0_top.x, pW0_top.y);
        ctx.lineTo(pWL_top.x, pWL_top.y);
        ctx.lineTo(p0L_top.x, p0L_top.y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // --- B. Aisles & Dock Zones (Jalan & Area Dok 3D Floor Markings) ---
    // User Rules:
    // 1. Jalan untuk orang: Warna HIJAU
    // 2. Jalan forklift: Warna KUNING dan DIAGONAL KUNING
    // 3. Jalan keduanya: Warna HIJAU BERGARIS KUNING
    // 4. Area Dok: Garis PUTIH DIAGONAL
    const getAisleTypeAndStyle = (aisle) => {
      const name = String(aisle.name || '').toLowerCase();
      const code = String(aisle.aisle_code || '').toLowerCase();
      const type = String(aisle.type || aisle.aisle_type || '').toLowerCase();
      const dir = String(aisle.direction || '').toLowerCase();

      // Check "keduanya" (shared / both)
      const isBoth =
        type === 'both' ||
        type === 'shared' ||
        dir === 'both' ||
        dir === 'shared' ||
        name.includes('keduanya') ||
        name.includes('both') ||
        name.includes('shared') ||
        name.includes('campur') ||
        name.includes('gabungan');

      const isHoriz = (Number(aisle.width_mm) || 1500) >= (Number(aisle.length_mm) || 5000);
      const orientBadge = isHoriz ? 'H' : 'V';

      if (isBoth) {
        return {
          category: 'both',
          baseColor: 'rgba(250, 204, 21, 0.85)',       // Kuning
          hasStripes: true,
          stripeColor: '#16a34a',                     // Garis hijau (Kuning bergaris hijau)
          stripeWidth: 3.5,
          borderColor: '#15803d',
          label: aisle.aisle_code ? `${aisle.aisle_code} • Bersama [${orientBadge}]` : `🚶🚜 Bersama [${orientBadge}]`,
        };
      }

      // Check "forklift"
      const isForklift =
        type === 'forklift' ||
        dir === 'forklift' ||
        name.includes('forklift') ||
        code.includes('fk') ||
        code.includes('forklift');

      if (isForklift) {
        return {
          category: 'forklift',
          baseColor: 'rgba(250, 204, 21, 0.85)',      // Kuning
          hasStripes: false,                          // Forklift jalan kuning
          borderColor: '#ca8a04',
          label: aisle.aisle_code ? `${aisle.aisle_code} • Forklift [${orientBadge}]` : `🚜 Forklift [${orientBadge}]`,
        };
      }

      // Default: Jalan untuk orang (Pejalan full hijau)
      return {
        category: 'person',
        baseColor: 'rgba(34, 197, 94, 0.85)',         // Full Hijau
        hasStripes: false,
        borderColor: '#15803d',
        label: aisle.aisle_code ? `${aisle.aisle_code} • Pejalan [${orientBadge}]` : `🚶 Pejalan [${orientBadge}]`,
      };
    };

    // Area Dok Style: Garis PUTIH DIAGONAL
    const getDockStyle = (dock) => {
      return {
        baseColor: 'rgba(37, 99, 235, 0.75)',         // Biru area dok
        hasStripes: true,
        stripeColor: '#ffffff',                       // Garis putih diagonal
        stripeWidth: 3.5,
        borderColor: '#1d4ed8',
        label: `🚚 ${dock.name || dock.code || 'AREA DOK'}`,
      };
    };

    const rawAisles = Array.isArray(snapshot?.aisles) ? snapshot.aisles : [];
    const rawDocks = (Array.isArray(snapshot?.layout_objects)
      ? snapshot.layout_objects.filter((o) => String(o.object_type || '').toLowerCase().includes('dock'))
      : []
    ).concat(Array.isArray(snapshot?.docks) ? snapshot.docks : []);

    const rawDoors = (Array.isArray(snapshot?.layout_objects)
      ? snapshot.layout_objects.filter((o) => {
          const t = String(o.object_type || '').toLowerCase();
          return (
            t.includes('door') ||
            t.includes('entry') ||
            t.includes('exit') ||
            t.includes('pintu')
          ) && !t.includes('dock');
        })
      : []
    ).concat(Array.isArray(snapshot?.doors) ? snapshot.doors : []);

    const isDemoZones =
      rawAisles.length === 0 &&
      rawDocks.length === 0 &&
      rawDoors.length === 0 &&
      (!snapshot?.racks || snapshot.racks.length === 0);

    const aislesToRender = (rawAisles.length > 0
      ? rawAisles
      : isDemoZones
      ? [
          { id: 'demo-aisle-person', aisle_code: 'A-P01', name: 'Jalur Orang (Hijau)', type: 'person', x_mm: whW * 0.04, y_mm: whL * 0.12, width_mm: 1500, length_mm: whL * 0.68 },
          { id: 'demo-aisle-forklift', aisle_code: 'FK-01', name: 'Jalur Forklift (Kuning)', type: 'forklift', x_mm: whW * 0.86, y_mm: whL * 0.12, width_mm: 3000, length_mm: whL * 0.68 },
          { id: 'demo-aisle-both', aisle_code: 'A-B01', name: 'Jalur Keduanya (Hijau-Kuning)', type: 'both', x_mm: whW * 0.44, y_mm: whL * 0.12, width_mm: 2200, length_mm: whL * 0.68 },
        ]
      : []
    ).filter((a) => !hiddenLayers.has('aisle') && !hiddenLayers.has(a.id));

    const docksToRender = (rawDocks.length > 0
      ? rawDocks
      : isDemoZones
      ? [
          { id: 'demo-dock-01', object_type: 'dock_loading', name: 'Area Dok (Putih Diagonal)', x_mm: whW * 0.12, y_mm: whL * 0.84, width_mm: whW * 0.76, length_mm: 3600 },
        ]
      : []
    ).filter((d) => !hiddenLayers.has('dock') && !hiddenLayers.has(d.id));

    const doorsToRender = (rawDoors.length > 0
      ? rawDoors
      : isDemoZones
      ? [
          {
            id: 'demo-door-entry',
            object_type: 'door_entry',
            name: 'Pintu Masuk Utama',
            x_mm: Math.max(0, Math.round(whW * 0.18)),
            y_mm: 0,
            width_mm: 3200,
            length_mm: 600,
            height_mm: 3000,
          },
          {
            id: 'demo-door-exit',
            object_type: 'door_exit',
            name: 'Pintu Keluar Dok',
            x_mm: Math.max(0, Math.round(whW * 0.72)),
            y_mm: 0,
            width_mm: 3200,
            length_mm: 600,
            height_mm: 3000,
          },
        ]
      : []
    ).filter((d) => !hiddenLayers.has('door') && !hiddenLayers.has(d.id));

    // Render Aisles on Floor Plane (Z = 0)
    aislesToRender.forEach((aisle) => {
      const ax = aisle.x_mm || 0;
      const ay = aisle.y_mm || 0;
      const aw = aisle.width_mm || 1500;
      const al = aisle.length_mm || 5000;
      const style = getAisleTypeAndStyle(aisle);
      draw3DFloorZone(ctx, ax, ay, aw, al, camera, width, height, style);
    });

    // Render Docks on Floor Plane (Z = 0)
    docksToRender.forEach((dock) => {
      const dx = dock.x_mm || 0;
      const dy = dock.y_mm || 0;
      const dw = dock.width_mm || 4000;
      const dl = dock.length_mm || 6000;
      const style = getDockStyle(dock);
      draw3DFloorZone(ctx, dx, dy, dw, dl, camera, width, height, style);
    });

    // --- C. Racks and Cardboard Boxes (Kardus & Palet) ---
    // Render exact racks configured by user; if empty, render default 3-level demonstration racks
    const racksToRender = ((snapshot?.racks && snapshot.racks.length > 0)
      ? snapshot.racks
      : [
          { id: 'demo-1', rack_code: 'A-01', x_mm: whW * 0.16, y_mm: whL * 0.22, width_mm: 2400, length_mm: 16000, level_count: 3, color_hex: '#1d4ed8' },
          { id: 'demo-2', rack_code: 'A-02', x_mm: whW * 0.34, y_mm: whL * 0.22, width_mm: 2400, length_mm: 16000, level_count: 3, color_hex: '#1d4ed8' },
          { id: 'demo-3', rack_code: 'B-01', x_mm: whW * 0.52, y_mm: whL * 0.22, width_mm: 2400, length_mm: 16000, level_count: 3, color_hex: '#1d4ed8' },
          { id: 'demo-4', rack_code: 'B-02', x_mm: whW * 0.70, y_mm: whL * 0.22, width_mm: 2400, length_mm: 16000, level_count: 3, color_hex: '#1d4ed8' },
        ]
    ).filter((r) => !hiddenLayers.has('rack') && !hiddenLayers.has(r.id));

    racksToRender.forEach((rack) => {
      const rx = rack.x_mm || 0;
      const ry = rack.y_mm || 0;
      const rot = Number(rack.rotation) || 0;
      const isRot = rot === 90 || rot === 270;

      // Extract accurate physical length and depth dimensions
      const rawLen = Number(rack.length_mm) || (rack.width_mm && !rack.depth_mm ? Number(rack.width_mm) : 2400);
      const rawDep = Number(rack.depth_mm) || (rack.width_mm && rack.depth_mm ? Number(rack.depth_mm) : 1000);

      // Floor footprint dimensions along X (rw) and along Y (rl)
      const rw = isRot ? rawDep : rawLen; // Bounding width along X
      const rl = isRot ? rawLen : rawDep; // Bounding length along Y

      // Determine orientation:
      // Vertical: extends along Y (rl > rw, or explicitly rotated 90/270, or rack.slot_rotated)
      // Horizontal: extends along X (rw >= rl)
      const isVertical = Boolean(rack.slot_rotated || isRot || (rl > rw));

      // Modular slot size when rack was created (or fallback to active slotConfig)
      const cfgLen = Number(slotConfig?.lengthMm) || 1000;
      const cfgDep = Number(slotConfig?.depthMm) || 500;
      const slotBaySpan = Number(rack.slot_width_mm) || cfgLen;
      const slotDepthSpan = Number(rack.slot_depth_mm) || cfgDep;

      // Level count strictly follows setting (default 3 levels)
      const levelCount = Math.max(Number(rack.level_count) || 3, 1);
      const rackH = rack.height_mm || levelCount * 1300 + 100;
      const isSelected = selectedKeys.has(`rack:${rack.id}`);
      const uprightBaseColor = rack.color_hex || PALETTE_3D.rackUprightBlue;

      // Shelf levels start directly near floor (40mm base plate) - NO floating stilts!
      const bottomOffset = 40;
      const usableH = Math.max(rackH - bottomOffset - 80, levelCount * 700);
      const lvlStep = usableH / levelCount;
      const beamThick = Math.max(70, Math.min(110, rackH / (levelCount * 8)));

      // 0. Garis-garis tipis pembagi slot/kompartemen bentuk rak di lantai (tetap tampil apapun gridnya)
      const longDim = isVertical ? rl : rw;
      const explicitBays = Number(rack.bay_count);
      const calcBayCount = explicitBays > 0 ? explicitBays : Math.max(1, Math.round(longDim / slotBaySpan));
      const stepSlotX = isVertical ? (rw > slotDepthSpan * 1.5 ? slotDepthSpan : rw) : (rw / calcBayCount);
      const stepSlotY = isVertical ? (rl / calcBayCount) : (rl > slotDepthSpan * 1.5 ? slotDepthSpan : rl);

      const floorBaseProj = projectPoint(rx + rw / 2, ry + rl / 2, 0, camera, width, height);
      if (floorBaseProj) {
        drawItems.push({
          depth: floorBaseProj.depth + 10,
          render: () => {
            ctx.save();
            ctx.strokeStyle = '#a78bfa'; // Garis ungu muda pembagi slot
            ctx.lineWidth = 1.1;

            // Garis horizontal pembatas slot
            if (stepSlotY > 80 && stepSlotY < rl - 30) {
              for (let y = ry + stepSlotY; y <= ry + rl - 30; y += stepSlotY) {
                const pL = projectPoint(rx, y, 1, camera, width, height);
                const pR = projectPoint(rx + rw, y, 1, camera, width, height);
                if (pL && pR) {
                  ctx.beginPath();
                  ctx.moveTo(pL.x, pL.y);
                  ctx.lineTo(pR.x, pR.y);
                  ctx.stroke();
                }
              }
            }

            // Garis vertikal pembatas slot
            if (stepSlotX > 80 && stepSlotX < rw - 30) {
              for (let x = rx + stepSlotX; x <= rx + rw - 30; x += stepSlotX) {
                const pF = projectPoint(x, ry, 1, camera, width, height);
                const pB = projectPoint(x, ry + rl, 1, camera, width, height);
                if (pF && pB) {
                  ctx.beginPath();
                  ctx.moveTo(pF.x, pF.y);
                  ctx.lineTo(pB.x, pB.y);
                  ctx.stroke();
                }
              }
            }
            ctx.restore();
          },
        });
      }

      if (!isVertical) {
        // =========================================================================
        // A. HORIZONTAL RACK (Bays span along X axis)
        // Dibuat simetris penuh: Depan, Belakang, Kiri & Kanan memiliki balok oranye & tiang biru identik
        // =========================================================================
        const bayCount = calcBayCount;
        const stepX = rw / Math.max(bayCount, 1);
        const postThick = Math.max(50, Math.min(80, stepX * 0.05, rl * 0.08));
        const boxesPerBay = stepX >= 1800 ? 2 : 1;

        // 1. Blue Upright Steel Posts (Tiang Biru Vertikal)
        for (let b = 0; b <= bayCount; b++) {
          const bx = rx + b * stepX;

          // Plat Kaki Bawah (Base Foot Accent)
          pushCuboid(
            bx - (postThick + 14) / 2,
            ry - 3,
            0,
            postThick + 14,
            postThick + 6,
            24,
            { front: '#2563eb', side: '#1d4ed8', top: '#60a5fa', stroke: '#1e3a8a', lineWidth: 0.8 }
          );
          pushCuboid(
            bx - (postThick + 14) / 2,
            ry + rl - postThick - 3,
            0,
            postThick + 14,
            postThick + 6,
            24,
            { front: '#2563eb', side: '#1d4ed8', top: '#60a5fa', stroke: '#1e3a8a', lineWidth: 0.8 }
          );

          // Tiang Depan (Front Upright Post dengan tonjolan kuping di atas)
          pushCuboid(
            bx - postThick / 2,
            ry,
            0,
            postThick,
            postThick,
            rackH + 70,
            {
              front: uprightBaseColor,
              side: PALETTE_3D.rackUprightDark,
              top: PALETTE_3D.rackUprightLight,
              stroke: '#1e3a8a',
              lineWidth: 1,
            }
          );

          // Tiang Belakang (Back Upright Post dengan tonjolan kuping di atas)
          pushCuboid(
            bx - postThick / 2,
            ry + rl - postThick,
            0,
            postThick,
            postThick,
            rackH + 70,
            {
              front: uprightBaseColor,
              side: PALETTE_3D.rackUprightDark,
              top: PALETTE_3D.rackUprightLight,
              stroke: '#1e3a8a',
              lineWidth: 1,
            }
          );
        }

        // 2. Horizontal Safety Orange Beams pada Semua 4 Sisi (Depan, Belakang, Kiri, Kanan)
        const bayW = rw / bayCount;
        const boxMarginX = Math.max(12, bayW * 0.03);
        const singleBoxW = (bayW - boxMarginX * (boxesPerBay + 1)) / boxesPerBay;
        const singleBoxL = rl - postThick * 2 - 20;
        const singleBoxH = Math.max(lvlStep - beamThick - 35, 500);

        for (let lvl = 0; lvl < levelCount; lvl++) {
          const zBeam = bottomOffset + lvl * lvlStep;

          // Balok Depan (Front Orange Beam)
          pushCuboid(
            rx,
            ry,
            zBeam,
            rw,
            postThick,
            beamThick,
            {
              front: PALETTE_3D.rackBeamOrange,
              side: PALETTE_3D.rackBeamDark,
              top: PALETTE_3D.rackBeamTop,
              stroke: '#9a3412',
              lineWidth: 1,
            }
          );

          // Balok Belakang (Back Orange Beam)
          pushCuboid(
            rx,
            ry + rl - postThick,
            zBeam,
            rw,
            postThick,
            beamThick,
            {
              front: PALETTE_3D.rackBeamOrange,
              side: PALETTE_3D.rackBeamDark,
              top: PALETTE_3D.rackBeamTop,
              stroke: '#9a3412',
              lineWidth: 1,
            }
          );

          // Balok Sisi Kiri (Left Orange Beam - menutup sisi kiri sehingga tampak sama seperti depan)
          pushCuboid(
            rx,
            ry + postThick,
            zBeam,
            postThick,
            rl - postThick * 2,
            beamThick,
            {
              front: PALETTE_3D.rackBeamOrange,
              side: PALETTE_3D.rackBeamDark,
              top: PALETTE_3D.rackBeamTop,
              stroke: '#9a3412',
              lineWidth: 1,
            }
          );

          // Balok Sisi Kanan (Right Orange Beam - menutup sisi kanan sehingga tampak sama seperti depan)
          pushCuboid(
            rx + rw - postThick,
            ry + postThick,
            zBeam,
            postThick,
            rl - postThick * 2,
            beamThick,
            {
              front: PALETTE_3D.rackBeamOrange,
              side: PALETTE_3D.rackBeamDark,
              top: PALETTE_3D.rackBeamTop,
              stroke: '#9a3412',
              lineWidth: 1,
            }
          );

          // Balok Sekat Penghubung Tiang Antar-Bay (Intermediate Cross Beams)
          for (let b = 1; b < bayCount; b++) {
            const bx = rx + b * stepX;
            pushCuboid(
              bx - postThick / 2,
              ry + postThick,
              zBeam,
              postThick,
              rl - postThick * 2,
              beamThick,
              {
                front: PALETTE_3D.rackBeamOrange,
                side: PALETTE_3D.rackBeamDark,
                top: PALETTE_3D.rackBeamTop,
                stroke: '#9a3412',
                lineWidth: 1,
              }
            );
          }

          // 3. Kardus Padat (Solid Cardboard Boxes) di Setiap Level
          for (let b = 0; b < bayCount; b++) {
            for (let k = 0; k < boxesPerBay; k++) {
              const boxX = rx + b * bayW + boxMarginX + k * (singleBoxW + boxMarginX);
              const boxY = ry + postThick + 10;
              const boxZ = zBeam + beamThick;

              // Pallet Runner Base
              pushCuboid(
                boxX,
                boxY,
                boxZ,
                singleBoxW,
                singleBoxL,
                30,
                {
                  front: PALETTE_3D.palletBlue,
                  side: '#0369a1',
                  top: '#38bdf8',
                  stroke: '#075985',
                  lineWidth: 0.8,
                }
              );

              // 100% Solid Cardboard Box (Sesuai visual foto: cokelat kraft dengan tutup atas terang)
              pushCuboid(
                boxX,
                boxY,
                boxZ + 30,
                singleBoxW,
                singleBoxL,
                singleBoxH,
                {
                  front: '#d4a373',
                  side: '#c89666',
                  top: '#fde68a',
                  stroke: '#8c5828',
                  lineWidth: 1,
                  drawTape: true,
                }
              );
            }
          }
        }
      } else {
        // =========================================================================
        // B. VERTICAL RACK (Bays, orange beams, & boxes span along Y axis)
        // =========================================================================
        const bayCount = calcBayCount;
        const stepY = rl / Math.max(bayCount, 1);
        const postThick = Math.max(50, Math.min(80, stepY * 0.05, rw * 0.08));
        const boxesPerBay = stepY >= 1800 ? 2 : 1;

        // 1. Blue Upright Steel Posts (Tiang Biru Vertikal di sisi kiri & kanan pada tiap bay)
        for (let b = 0; b <= bayCount; b++) {
          const by = ry + b * stepY;

          // Plat Kaki Bawah (Base Foot Accent)
          pushCuboid(
            rx - 3,
            by - (postThick + 14) / 2,
            0,
            postThick + 6,
            postThick + 14,
            24,
            { front: '#2563eb', side: '#1d4ed8', top: '#60a5fa', stroke: '#1e3a8a', lineWidth: 0.8 }
          );
          pushCuboid(
            rx + rw - postThick - 3,
            by - (postThick + 14) / 2,
            0,
            postThick + 6,
            postThick + 14,
            24,
            { front: '#2563eb', side: '#1d4ed8', top: '#60a5fa', stroke: '#1e3a8a', lineWidth: 0.8 }
          );

          // Left Upright Post (Tiang Kiri dengan tonjolan kuping di atas)
          pushCuboid(
            rx,
            by - postThick / 2,
            0,
            postThick,
            postThick,
            rackH + 70,
            {
              front: uprightBaseColor,
              side: PALETTE_3D.rackUprightDark,
              top: PALETTE_3D.rackUprightLight,
              stroke: '#1e3a8a',
              lineWidth: 1,
            }
          );

          // Right Upright Post (Tiang Kanan dengan tonjolan kuping di atas)
          pushCuboid(
            rx + rw - postThick,
            by - postThick / 2,
            0,
            postThick,
            postThick,
            rackH + 70,
            {
              front: uprightBaseColor,
              side: PALETTE_3D.rackUprightDark,
              top: PALETTE_3D.rackUprightLight,
              stroke: '#1e3a8a',
              lineWidth: 1,
            }
          );

          // Perforation tick lines on upright front
          const postProj = projectPoint(rx, by, rackH / 2, camera, width, height);
          if (postProj) {
            drawItems.push({
              depth: postProj.depth - 2,
              render: () => {
                ctx.save();
                ctx.strokeStyle = '#93c5fd';
                ctx.lineWidth = 1.2;
                const tickStep = 250;
                for (let z = 100; z < rackH - 30; z += tickStep) {
                  const ptL = projectPoint(rx - 1, by - postThick * 0.35, z, camera, width, height);
                  const ptR = projectPoint(rx - 1, by + postThick * 0.35, z, camera, width, height);
                  if (ptL && ptR) {
                    ctx.beginPath();
                    ctx.moveTo(ptL.x, ptL.y);
                    ctx.lineTo(ptR.x, ptR.y);
                    ctx.stroke();
                  }
                }
                ctx.restore();
              },
            });
          }

        }

        // 2. Horizontal Safety Orange Beams pada Semua 4 Sisi (Depan, Belakang, Kiri, Kanan)
        const bayL = rl / bayCount;
        const boxMarginY = Math.max(12, bayL * 0.03);
        const singleBoxL = (bayL - boxMarginY * (boxesPerBay + 1)) / boxesPerBay;
        const singleBoxW = rw - postThick * 2 - 20;
        const singleBoxH = Math.max(lvlStep - beamThick - 35, 500);

        for (let lvl = 0; lvl < levelCount; lvl++) {
          const zBeam = bottomOffset + lvl * lvlStep;

          // Balok Kiri (Left Orange Beam - sepanjang Y)
          pushCuboid(
            rx,
            ry,
            zBeam,
            postThick,
            rl,
            beamThick,
            {
              front: PALETTE_3D.rackBeamOrange,
              side: PALETTE_3D.rackBeamDark,
              top: PALETTE_3D.rackBeamTop,
              stroke: '#9a3412',
              lineWidth: 1,
            }
          );

          // Balok Kanan (Right Orange Beam - sepanjang Y)
          pushCuboid(
            rx + rw - postThick,
            ry,
            zBeam,
            postThick,
            rl,
            beamThick,
            {
              front: PALETTE_3D.rackBeamOrange,
              side: PALETTE_3D.rackBeamDark,
              top: PALETTE_3D.rackBeamTop,
              stroke: '#9a3412',
              lineWidth: 1,
            }
          );

          // Balok Depan (Front Orange Beam - menutup sisi depan sepanjang X)
          pushCuboid(
            rx + postThick,
            ry,
            zBeam,
            rw - postThick * 2,
            postThick,
            beamThick,
            {
              front: PALETTE_3D.rackBeamOrange,
              side: PALETTE_3D.rackBeamDark,
              top: PALETTE_3D.rackBeamTop,
              stroke: '#9a3412',
              lineWidth: 1,
            }
          );

          // Balok Belakang (Back Orange Beam - menutup sisi belakang sepanjang X)
          pushCuboid(
            rx + postThick,
            ry + rl - postThick,
            zBeam,
            rw - postThick * 2,
            postThick,
            beamThick,
            {
              front: PALETTE_3D.rackBeamOrange,
              side: PALETTE_3D.rackBeamDark,
              top: PALETTE_3D.rackBeamTop,
              stroke: '#9a3412',
              lineWidth: 1,
            }
          );

          // Balok Sekat Penghubung Tiang Antar-Bay (Intermediate Cross Beams along X)
          for (let b = 1; b < bayCount; b++) {
            const by = ry + b * stepY;
            pushCuboid(
              rx + postThick,
              by - postThick / 2,
              zBeam,
              rw - postThick * 2,
              postThick,
              beamThick,
              {
                front: PALETTE_3D.rackBeamOrange,
                side: PALETTE_3D.rackBeamDark,
                top: PALETTE_3D.rackBeamTop,
                stroke: '#9a3412',
                lineWidth: 1,
              }
            );
          }

          // 3. Kardus Padat (Solid Cardboard Boxes) di Setiap Level
          for (let b = 0; b < bayCount; b++) {
            for (let k = 0; k < boxesPerBay; k++) {
              const boxX = rx + postThick + 10;
              const boxY = ry + b * bayL + boxMarginY + k * (singleBoxL + boxMarginY);
              const boxZ = zBeam + beamThick;

              // Pallet Runner Base
              pushCuboid(
                boxX,
                boxY,
                boxZ,
                singleBoxW,
                singleBoxL,
                30,
                {
                  front: PALETTE_3D.palletBlue,
                  side: '#0369a1',
                  top: '#38bdf8',
                  stroke: '#075985',
                  lineWidth: 0.8,
                }
              );

              // 100% Solid Cardboard Box (Sesuai visual foto: cokelat kraft dengan tutup atas terang)
              pushCuboid(
                boxX,
                boxY,
                boxZ + 30,
                singleBoxW,
                singleBoxL,
                singleBoxH,
                {
                  front: '#d4a373',
                  side: '#c89666',
                  top: '#fde68a',
                  stroke: '#8c5828',
                  lineWidth: 1,
                  drawTape: true,
                }
              );
            }
          }
        }
      }

      // Rack Identification Badge (Floating above top)
      const labelTop = projectPoint(rx + rw / 2, ry + rl / 2, rackH + 350, camera, width, height);
      if (labelTop) {
        drawItems.push({
          depth: labelTop.depth - 50, // Slightly in front
          render: () => {
            const rackOrientSym = isVertical ? 'V' : 'H';
            const labelText = `${rack.rack_code || 'A-01'} [${rackOrientSym}]`;
            ctx.font = 'bold 11px sans-serif';
            const textWidth = ctx.measureText(labelText).width;

            ctx.fillStyle = isSelected ? '#0284c7' : '#1e293b';
            ctx.beginPath();
            ctx.roundRect(labelTop.x - textWidth / 2 - 6, labelTop.y - 8, textWidth + 12, 16, 4);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, labelTop.x, labelTop.y);

            // Glowing Selection Outline if Selected
            if (isSelected) {
              const cT1 = projectPoint(rx, ry, rackH, camera, width, height);
              const cT2 = projectPoint(rx + rw, ry, rackH, camera, width, height);
              const cT3 = projectPoint(rx + rw, ry + rl, rackH, camera, width, height);
              const cT4 = projectPoint(rx, ry + rl, rackH, camera, width, height);
              if (cT1 && cT2 && cT3 && cT4) {
                ctx.strokeStyle = PALETTE_3D.selectedGlow;
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 3]);
                drawPoly(ctx, [cT1, cT2, cT3, cT4], null, PALETTE_3D.selectedGlow, 3);
                ctx.setLineDash([]);
              }
            }
          },
        });
      }
    });

    // --- D. Warehouse Doors (Pintu Gudang 3D: Kusen Baja, Shutter Sectional, Beacon & Plang) ---
    doorsToRender.forEach((door) => {
      const dx = Number(door.x_mm) || 0;
      const dy = Number(door.y_mm) || 0;
      const dw = Number(door.width_mm) || 3000;
      const dl = Number(door.length_mm) || 600;
      const dh = Math.max(1800, Math.min(whH, Number(door.height_mm) || 2800));

      const type = String(door.object_type || '').toLowerCase();
      const isBoth = type.includes('both') || type === 'door' || (type.includes('masuk') && type.includes('keluar'));
      const isEntry = !isBoth && (type.includes('entry') || type.includes('masuk'));
      const isExit = !isBoth && (type.includes('exit') || type.includes('keluar'));

      const isSelected =
        selectedKeys.has(`door:${door.id}`) ||
        selectedKeys.has(`layout_object:${door.id}`) ||
        selectedKeys.has(door.id);

      // Orientasi Pintu:
      // dw >= dl -> Horizontal (menempel di dinding utara/selatan, lebar X, tebal Y)
      // dl > dw  -> Vertikal (menempel di dinding barat/timur, panjang Y, tebal X)
      const isHoriz = dw >= dl;

      const frameColors = {
        top: PALETTE_3D.doorFrameTop,
        front: PALETTE_3D.doorFrameFront,
        side: PALETTE_3D.doorFrameSide,
        stroke: PALETTE_3D.doorFrameStroke,
        lineWidth: 1.2,
      };

      let panelColors, badgeColor, beaconColor, badgeLabel;
      if (isEntry) {
        panelColors = {
          top: PALETTE_3D.doorEntryTop,
          front: PALETTE_3D.doorEntryFront,
          side: PALETTE_3D.doorEntrySide,
          stroke: PALETTE_3D.doorEntryStroke,
          lineWidth: 1,
        };
        badgeColor = '#15803d';
        beaconColor = '#22c55e';
        badgeLabel = 'PINTU MASUK ⬇';
      } else if (isExit) {
        panelColors = {
          top: PALETTE_3D.doorExitTop,
          front: PALETTE_3D.doorExitFront,
          side: PALETTE_3D.doorExitSide,
          stroke: PALETTE_3D.doorExitStroke,
          lineWidth: 1,
        };
        badgeColor = '#b91c1c';
        beaconColor = '#ef4444';
        badgeLabel = 'PINTU KELUAR ⬆';
      } else {
        panelColors = {
          top: PALETTE_3D.doorBothTop,
          front: PALETTE_3D.doorBothFront,
          side: PALETTE_3D.doorBothSide,
          stroke: PALETTE_3D.doorBothStroke,
          lineWidth: 1,
        };
        badgeColor = '#1d4ed8';
        beaconColor = '#3b82f6';
        badgeLabel = 'PINTU AKSES ⇅';
      }

      const glassColors = {
        top: PALETTE_3D.doorGlassTop,
        front: PALETTE_3D.doorGlassFront,
        side: PALETTE_3D.doorGlassSide,
        stroke: PALETTE_3D.doorGlassStroke,
        lineWidth: 1,
      };

      // Proporsi Kusen Baja & Bukaan Pintu
      const postThick = Math.min(220, Math.max(120, (isHoriz ? dw : dl) * 0.08));
      const lintelH = Math.min(320, Math.max(180, dh * 0.1));
      const openH = dh - lintelH;

      if (isHoriz) {
        // 1. Kusen Kiri (Tiang Barat)
        pushCuboid(dx, dy, 0, postThick, dl, dh, frameColors);

        // 2. Kusen Kanan (Tiang Timur)
        pushCuboid(dx + dw - postThick, dy, 0, postThick, dl, dh, frameColors);

        // 3. Balok Atas (Lintel Header)
        pushCuboid(dx, dy, dh - lintelH, dw, dl, lintelH, frameColors);

        // 4. Daun Pintu Shutter Sectional Roll-Up
        const panelThick = Math.max(80, Math.min(dl, 160));
        const panelY = dy + (dl - panelThick) / 2;
        const panelW = dw - 2 * postThick;
        const panelX = dx + postThick;
        pushCuboid(panelX, panelY, 0, panelW, panelThick, openH, panelColors);

        // 5. Jendela Intip Akrilik (Vision Glass Slit)
        if (panelW >= 600 && openH >= 1200) {
          const winW = Math.min(panelW * 0.55, 1400);
          const winX = panelX + (panelW - winW) / 2;
          const winH = 260;
          const winZ = Math.min(openH - 300, 1350);
          pushCuboid(winX, panelY - 4, winZ, winW, panelThick + 8, winH, glassColors);
        }

        // 6. Garis-garis Slat Shutter (Ribbed Sections)
        const slatProj = projectPoint(panelX + panelW / 2, panelY + panelThick / 2, openH / 2, camera, width, height);
        if (slatProj) {
          drawItems.push({
            depth: slatProj.depth - 5,
            render: () => {
              ctx.save();
              ctx.strokeStyle = panelColors.top;
              ctx.lineWidth = 1.2;
              for (let sz = 300; sz < openH - 100; sz += 350) {
                const pL = projectPoint(panelX + 10, panelY + panelThick / 2, sz, camera, width, height);
                const pR = projectPoint(panelX + panelW - 10, panelY + panelThick / 2, sz, camera, width, height);
                if (pL && pR) {
                  ctx.beginPath();
                  ctx.moveTo(pL.x, pL.y);
                  ctx.lineTo(pR.x, pR.y);
                  ctx.stroke();
                }
              }
              ctx.restore();
            },
          });
        }
      } else {
        // 1. Kusen Atas (Tiang Utara)
        pushCuboid(dx, dy, 0, dw, postThick, dh, frameColors);

        // 2. Kusen Bawah (Tiang Selatan)
        pushCuboid(dx, dy + dl - postThick, 0, dw, postThick, dh, frameColors);

        // 3. Balok Atas (Lintel Header)
        pushCuboid(dx, dy, dh - lintelH, dw, dl, lintelH, frameColors);

        // 4. Daun Pintu Shutter Sectional
        const panelThick = Math.max(80, Math.min(dw, 160));
        const panelX = dx + (dw - panelThick) / 2;
        const panelL = dl - 2 * postThick;
        const panelY = dy + postThick;
        pushCuboid(panelX, panelY, 0, panelThick, panelL, openH, panelColors);

        // 5. Jendela Intip Akrilik (Vision Glass Slit)
        if (panelL >= 600 && openH >= 1200) {
          const winL = Math.min(panelL * 0.55, 1400);
          const winY = panelY + (panelL - winL) / 2;
          const winH = 260;
          const winZ = Math.min(openH - 300, 1350);
          pushCuboid(panelX - 4, winY, winZ, panelThick + 8, winL, winH, glassColors);
        }

        // 6. Garis-garis Slat Shutter (Ribbed Sections)
        const slatProj = projectPoint(panelX + panelThick / 2, panelY + panelL / 2, openH / 2, camera, width, height);
        if (slatProj) {
          drawItems.push({
            depth: slatProj.depth - 5,
            render: () => {
              ctx.save();
              ctx.strokeStyle = panelColors.top;
              ctx.lineWidth = 1.2;
              for (let sz = 300; sz < openH - 100; sz += 350) {
                const pT = projectPoint(panelX + panelThick / 2, panelY + 10, sz, camera, width, height);
                const pB = projectPoint(panelX + panelThick / 2, panelY + panelL - 10, sz, camera, width, height);
                if (pT && pB) {
                  ctx.beginPath();
                  ctx.moveTo(pT.x, pT.y);
                  ctx.lineTo(pB.x, pB.y);
                  ctx.stroke();
                }
              }
              ctx.restore();
            },
          });
        }
      }

      // 7. Lampu Beacon Sensor Industri di Atas Lintel
      const beaconSize = 140;
      const beaconH = 110;
      const beaconX = dx + dw / 2 - beaconSize / 2;
      const beaconY = dy + dl / 2 - beaconSize / 2;
      pushCuboid(beaconX, beaconY, dh, beaconSize, beaconSize, beaconH, {
        top: beaconColor,
        front: beaconColor,
        side: beaconColor,
        stroke: '#0f172a',
        lineWidth: 1,
      });

      // 8. Ambang Pintu & Penanda Lantai Z=1
      const floorProj = projectPoint(dx + dw / 2, dy + dl / 2, 1, camera, width, height);
      if (floorProj) {
        drawItems.push({
          depth: floorProj.depth + 8,
          render: () => {
            const p1 = projectPoint(dx, dy, 1, camera, width, height);
            const p2 = projectPoint(dx + dw, dy, 1, camera, width, height);
            const p3 = projectPoint(dx + dw, dy + dl, 1, camera, width, height);
            const p4 = projectPoint(dx, dy + dl, 1, camera, width, height);
            if (p1 && p2 && p3 && p4) {
              const apronColor = isEntry
                ? 'rgba(34, 197, 94, 0.32)'
                : isExit
                ? 'rgba(239, 68, 68, 0.32)'
                : 'rgba(59, 130, 246, 0.32)';
              drawPoly(ctx, [p1, p2, p3, p4], apronColor, beaconColor, 1.5);
            }
          },
        });
      }

      // 9. Plang Indikator 3D Melayang di Atas Pintu
      const labelProj = projectPoint(dx + dw / 2, dy + dl / 2, dh + 340, camera, width, height);
      if (labelProj) {
        drawItems.push({
          depth: labelProj.depth - 40,
          render: () => {
            const labelText = `🚪 ${badgeLabel}${door.name ? ' • ' + door.name : ''}`;
            ctx.font = 'bold 11px sans-serif';
            const textWidth = ctx.measureText(labelText).width;

            // Background badge
            ctx.fillStyle = isSelected ? PALETTE_3D.selectedGlow : badgeColor;
            ctx.beginPath();
            ctx.roundRect(labelProj.x - textWidth / 2 - 8, labelProj.y - 9, textWidth + 16, 18, 5);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, labelProj.x, labelProj.y);

            // Glowing Outline jika Terpilih
            if (isSelected) {
              const cT1 = projectPoint(dx, dy, dh, camera, width, height);
              const cT2 = projectPoint(dx + dw, dy, dh, camera, width, height);
              const cT3 = projectPoint(dx + dw, dy + dl, dh, camera, width, height);
              const cT4 = projectPoint(dx, dy + dl, dh, camera, width, height);
              if (cT1 && cT2 && cT3 && cT4) {
                ctx.strokeStyle = PALETTE_3D.selectedGlow;
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 3]);
                drawPoly(ctx, [cT1, cT2, cT3, cT4], null, PALETTE_3D.selectedGlow, 3);
                ctx.setLineDash([]);
              }
            }
          },
        });
      }
    });

    // Sort by depth descending (Painter's algorithm: farthest rendered first)
    drawItems.sort((a, b) => b.depth - a.depth);

    // Execute sorted render calls
    drawItems.forEach((item) => item.render());
  }, [
    snapshot,
    activeRoute,
    selectedKeys,
    hiddenLayers,
    whW,
    whL,
    whH,
    isGridActive,
    isSlotGridActive,
    showGrid,
    showMeterGrid,
    showGridHorizontal,
    showGridVertical,
    showSlotGrid,
    showSlotHorizontal,
    showSlotVertical,
    slotConfig,
    slotRotated,
  ]);

  // Handle Resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    renderScene();
  }, [renderScene]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    renderScene();
  }, [renderScene]);

  // Pointer Interaction Handlers (Orbit clamped: left/right + top only, never below floor)
  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    dragModeRef.current = e.button === 2 || e.shiftKey ? 'pan' : 'orbit';
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };

    const camera = cameraRef.current;

    if (dragModeRef.current === 'pan') {
      camera.panX += dx;
      camera.panY += dy;
    } else {
      // Horizontal drag rotates Yaw (Kanan / Kiri 360°)
      camera.yaw = (camera.yaw + dx * 0.4 + 360) % 360;

      // Vertical drag rotates Pitch (Atas / Bawah)
      // Clamped strictly between 15° (above floor) and 88° (looking down from above, NEVER below floor)
      camera.pitch = Math.max(15, Math.min(88, camera.pitch + dy * 0.35));

      setCameraState({
        yaw: Math.round(camera.yaw),
        pitch: Math.round(camera.pitch),
      });
    }

    renderScene();
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const camera = cameraRef.current;
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    const minDistance = Math.max(whW, whL) * 0.25;
    const maxDistance = Math.max(whW, whL) * 3.5;
    camera.distance = Math.max(minDistance, Math.min(maxDistance, camera.distance * zoomFactor));
    renderScene();
  };

  // Quick Preset Handlers
  const handleSetPreset = (yaw, pitch) => {
    cameraRef.current.yaw = yaw;
    cameraRef.current.pitch = Math.max(15, Math.min(88, pitch));
    setCameraState({ yaw: Math.round(yaw), pitch: Math.round(cameraRef.current.pitch) });
    renderScene();
  };

  const handleResetView = () => {
    cameraRef.current.yaw = 42;
    cameraRef.current.pitch = 36;
    cameraRef.current.panX = 0;
    cameraRef.current.panY = 30;
    cameraRef.current.distance = initialDist;
    setCameraState({ yaw: 42, pitch: 36 });
    renderScene();
  };

  const handleZoom = (inOut) => {
    const factor = inOut === 'in' ? 0.85 : 1.15;
    cameraRef.current.distance = Math.max(
      Math.max(whW, whL) * 0.25,
      Math.min(Math.max(whW, whL) * 3.5, cameraRef.current.distance * factor)
    );
    renderScene();
  };

  const handleOrbitStep = (axis, delta) => {
    const camera = cameraRef.current;
    if (axis === 'yaw') {
      camera.yaw = (camera.yaw + delta + 360) % 360;
    } else if (axis === 'pitch') {
      camera.pitch = Math.max(15, Math.min(88, camera.pitch + delta));
    }
    setCameraState({ yaw: Math.round(camera.yaw), pitch: Math.round(camera.pitch) });
    renderScene();
  };

  return (
    <div
      className="warehouse-3d-wrapper"
      ref={containerRef}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: isDraggingRef.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Floating 3D HUD & Controls */}
      <div className="hud-3d-top-bar">
        {/* Switch back to 2D button */}
        <div className="view-mode-pill-toggle">
          <button
            type="button"
            className="btn-view-pill"
            onClick={onSwitchTo2D}
            title="Kembali ke Denah 2D"
          >
            <span>🗺️</span> Denah 2D
          </button>
          <button
            type="button"
            className="btn-view-pill active"
            title="Tampilan Model 3D Rak & Kardus Aktif"
          >
            <span>🧊</span> Model 3D
          </button>
        </div>

        {/* Quick Grid Toggles */}
        <div className="view-mode-pill-toggle" style={{ marginLeft: 8 }}>
          <button
            type="button"
            className={`btn-view-pill ${isGridActive ? 'active' : ''}`}
            onClick={() => setIsGridActive((prev) => !prev)}
            title="Tampilkan / Sembunyikan Garis-Garis Grid Lantai 1 Meter"
          >
            <span>📐</span> Garis Grid 1m: <strong>{isGridActive ? 'ON' : 'OFF'}</strong>
          </button>
          <button
            type="button"
            className={`btn-view-pill ${isSlotGridActive ? 'active' : ''}`}
            onClick={() => setIsSlotGridActive((prev) => !prev)}
            title="Tampilkan / Sembunyikan Garis Grid Ukuran Slot"
          >
            <span>🗂️</span> Garis Slot ({slotRotated || showSlotVertical ? 'Vertikal' : 'Horizontal'}): <strong>{isSlotGridActive ? 'ON' : 'OFF'}</strong>
          </button>
        </div>

        {/* Camera Info Badge */}
        <div className="hud-3d-badge">
          <span>📐 Rotasi Kiri-Kanan: <strong>{cameraState.yaw}°</strong></span>
          <span style={{ margin: '0 6px', opacity: 0.4 }}>|</span>
          <span>Kemiringan Atas: <strong>{cameraState.pitch}°</strong></span>
        </div>
      </div>

      {/* Floating 3D Orbit & Angle Controls (Bottom Right) */}
      <div className="hud-3d-controls-dock">
        <div className="hud-3d-btn-group">
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleOrbitStep('yaw', -15)}
            title="Putar Kiri (Yaw -15°)"
          >
            ⟲ Kiri
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleOrbitStep('yaw', 15)}
            title="Putar Kanan (Yaw +15°)"
          >
            ⟳ Kanan
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleOrbitStep('pitch', 8)}
            title="Sudut Lebih Tegak / Atas (Pitch +8°)"
          >
            ▲ Atas
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleOrbitStep('pitch', -8)}
            title="Sudut Lebih Datar (Pitch -8°, batas min 15°)"
          >
            ▼ Datar
          </button>
        </div>

        <div className="hud-3d-divider" />

        {/* Preset Angle Views */}
        <div className="hud-3d-btn-group">
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleSetPreset(42, 36)}
            title="Tampilan Isometrik"
          >
            Isometrik
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleSetPreset(0, 25)}
            title="Tampak Depan"
          >
            Depan
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleSetPreset(270, 25)}
            title="Tampak Kiri"
          >
            Kiri
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleSetPreset(90, 25)}
            title="Tampak Kanan"
          >
            Kanan
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleSetPreset(180, 25)}
            title="Tampak Belakang"
          >
            Belakang
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleSetPreset(cameraState.yaw, 85)}
            title="Tampak Dari Atas (Top-Down 3D)"
          >
            Top 3D
          </button>
        </div>

        <div className="hud-3d-divider" />

        {/* Zoom & Reset */}
        <div className="hud-3d-btn-group">
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleZoom('in')}
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            className="btn-3d-tool"
            onClick={() => handleZoom('out')}
            title="Zoom Out"
          >
            -
          </button>
          <button
            type="button"
            className="btn-3d-tool btn-3d-primary"
            onClick={handleResetView}
            title="Reset Sudut & Posisi Kamera"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Floating Bottom Help Note */}
      <div className="hud-3d-help-note">
        <span>💡 <strong>Navigasi 3D:</strong> Klik & seret mouse untuk rotasi kanan-kiri dan kemiringan atas (terkunci di atas lantai) | Roda mouse untuk zoom | Klik kanan / Shift untuk geser posisi</span>
      </div>
    </div>
  );
}
