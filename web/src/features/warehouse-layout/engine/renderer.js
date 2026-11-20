/**
 * Native Canvas 2D Top View Renderer
 * Enforces:
 * - Render only on requestAnimationFrame when dirty
 * - Viewport culling via SpatialHash
 * - Level of Detail (LOD)
 * - Adaptive grid
 * - DPR capped at 2
 * - Susuno Design System visual palette
 */

import { footprint } from '../../../../../shared/layout-core/src/geometry.js';
import { getVisibleWorldBounds } from './viewport.js';

// Color Palette (Susuno Modern Industrial Forest)
const PALETTE = {
  canvasBg: '#f8f9f5',
  warehouseWall: '#191d17',
  gridMajor: '#b5c4a5',  // Soft, clean 5m major lines
  gridMinor: '#e2e7dc',  // Elegant, subtle 1m minor lines
  gridSlot: '#a78bfa',   // Clear modular slot grid (violet)
  headerYellow: '#f59e0b', // Yellow track for slot column numbers (1, 2, 3...)
  headerYellowBg: '#fef3c7',
  headerPurple: '#7c3aed', // Purple track for slot row letters (A, B, C...)
  headerPurpleBg: '#ede9fe',
  rackBorder: '#3e5510',
  rackFill: '#eef3e2',
  rackText: '#191d17',
  aisleFill: '#fef9c3',
  aisleBorder: '#fde047',
  aisleText: '#854d0e',
  selectionBorder: '#0284c7',
  selectionFill: 'rgba(2, 132, 199, 0.15)',
  collisionBorder: '#dc2626',
  collisionFill: 'rgba(220, 38, 38, 0.25)',
  handleFill: '#ffffff',
  handleBorder: '#0284c7',
};

// Heatmap colors for Occupancy Grid Matrix
const GRID_CELL_COLORS = {
  1: 'rgba(239, 68, 68, 0.22)',  // BLOCKED (rose/red)
  2: 'rgba(239, 68, 68, 0.32)',  // RACK (red-orange)
  3: 'rgba(92, 115, 43, 0.12)',  // AISLE (soft olive)
  4: 'rgba(139, 92, 246, 0.25)', // DOCK (purple)
  5: 'rgba(59, 130, 246, 0.25)',  // DOOR (blue)
  6: 'rgba(245, 158, 11, 0.18)', // CLEARANCE (amber buffer)
  7: 'rgba(16, 185, 129, 0.28)', // PICK_FACE (emerald)
};

export class LayoutRenderer {
  /**
   * @param {HTMLCanvasElement} baseCanvas
   * @param {HTMLCanvasElement} overlayCanvas
   */
  constructor(baseCanvas, overlayCanvas) {
    this.baseCanvas = baseCanvas;
    this.overlayCanvas = overlayCanvas;
    this.baseCtx = baseCanvas.getContext('2d');
    this.overlayCtx = overlayCanvas.getContext('2d');

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 800;
    this.height = 600;

    this.isDirty = true;
    this.isOverlayDirty = true;
    this.rafId = null;

    // Pathfinding & Grid Matrix Overlay States
    this.showGridMatrix = false;
    this.gridMatrixInstance = null;
    this.activeRoute = null;

    // Grid Visibility Controls
    this.showMeterGrid = true; // 1m x 1m standard adaptive grid
    this.showGridHorizontal = true; // Horizontal grid lines
    this.showGridVertical = true;   // Vertical grid lines
    this.showSlotGrid = false; // Modular slot custom dimension grid
    this.showSlotHorizontal = false;
    this.showSlotVertical = false;
    this.slotRotated = false;  // Slot grid orientation rotated 90° (swaps length & depth)

    // Modular Slot Dimensions Configuration (Length x Depth x Height in mm)
    this.slotConfig = {
      lengthMm: 700, // default 70 cm
      depthMm: 500,  // default 50 cm
      heightMm: 400, // default 40 cm
    };

    // Layer Visibility Controls (CAD / Figma style)
    this.hiddenLayers = new Set();
    this.hiddenEntityIds = new Set();

    // Callbacks
    this.onFrameRendered = null;

    // Bind loop
    this._renderLoop = this._renderLoop.bind(this);
  }

  /**
   * Updates canvas dimensions according to container element
   */
  resize(width, height) {
    this.width = width;
    this.height = height;

    this.baseCanvas.width = width * this.dpr;
    this.baseCanvas.height = height * this.dpr;
    this.baseCanvas.style.width = `${width}px`;
    this.baseCanvas.style.height = `${height}px`;

    this.overlayCanvas.width = width * this.dpr;
    this.overlayCanvas.height = height * this.dpr;
    this.overlayCanvas.style.width = `${width}px`;
    this.overlayCanvas.style.height = `${height}px`;

    this.baseCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.overlayCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.markDirty();
  }

  /**
   * Sets new layout snapshot and triggers base re-render
   */
  setSnapshot(snapshot) {
    this.snapshot = snapshot;
    this.markDirty(false);
  }

  /**
   * Alias for markDirty(false) to trigger frame render
   */
  requestRender() {
    this.markDirty(false);
  }

  /**
   * Updates hidden layers & entity IDs for visibility filtering
   */
  setHiddenLayers(hiddenTypes, hiddenIds) {
    this.hiddenLayers = new Set(hiddenTypes || []);
    this.hiddenEntityIds = new Set(hiddenIds || []);
    this.markDirty(false);
  }

  /**
   * Marks scene dirty and schedules a render in the next rAF
   */
  markDirty(overlayOnly = false) {
    if (!overlayOnly) this.isDirty = true;
    this.isOverlayDirty = true;

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this._renderLoop);
    }
  }

  start() {
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this._renderLoop);
    }
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _renderLoop() {
    this.rafId = null;

    if (this.isDirty) {
      this._renderBaseScene();
      this.isDirty = false;
    }

    if (this.isOverlayDirty) {
      this._renderOverlayScene();
      this.isOverlayDirty = false;
    }

    if (this.onFrameRendered) {
      this.onFrameRendered();
    }
  }

  /**
   * Renders static/domain entities (Warehouse, Zones, Aisles, Racks, Grid)
   */
  _renderBaseScene() {
    const ctx = this.baseCtx;
    const viewport = this.viewport || { scale: 0.02, tx: 50, ty: 50 };
    const snapshot = this.snapshot;

    // CRITICAL FIX: Lock DPR scaling at every frame to eliminate canvas blurriness
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    // Clear canvas
    ctx.fillStyle = PALETTE.canvasBg;
    ctx.fillRect(0, 0, this.width, this.height);

    if (!snapshot || !snapshot.warehouse) return;

    ctx.save();
    ctx.translate(viewport.tx, viewport.ty);
    ctx.scale(viewport.scale, viewport.scale);

    const visibleBounds = getVisibleWorldBounds(viewport, this.width, this.height);

    // 1. Adaptive 1m / 5m Meter Grid (jika diaktifkan)
    if (this.showMeterGrid) {
      this._drawAdaptiveGrid(ctx, visibleBounds, viewport.scale);
    }

    // 1b. Modular Slot Grid (custom slot dimensions X × Y)
    if (this.showSlotGrid) {
      this._drawSlotGrid(ctx, visibleBounds, viewport.scale, snapshot.warehouse);
    }

    // 1c. Occupancy Grid Matrix Heatmap (jika diaktifkan)
    if (this.showGridMatrix && this.gridMatrixInstance) {
      this._renderGridMatrix(ctx, visibleBounds);
    }

    // 2. Warehouse Boundary
    const wh = snapshot.warehouse;
    ctx.strokeStyle = PALETTE.warehouseWall;
    ctx.lineWidth = Math.max(2 / viewport.scale, 80);
    ctx.strokeRect(0, 0, wh.width_mm, wh.length_mm);

    // 3. Zones
    if (Array.isArray(snapshot.zones)) {
      for (const z of snapshot.zones) {
        if (this.hiddenLayers.has('zone') || this.hiddenEntityIds.has(z.id)) continue;

        ctx.fillStyle = `${z.color_hex || '#5c732b'}18`;
        ctx.strokeStyle = z.color_hex || '#5c732b';
        ctx.lineWidth = Math.max(1 / viewport.scale, 30);
        ctx.fillRect(z.x_mm, z.y_mm, z.width_mm, z.length_mm);
        ctx.strokeRect(z.x_mm, z.y_mm, z.width_mm, z.length_mm);

        // Label Zona jika cukup besar
        if (z.width_mm * viewport.scale > 60) {
          ctx.fillStyle = z.color_hex || '#5c732b';
          ctx.font = `bold ${Math.max(14 / viewport.scale, 400)}px sans-serif`;
          ctx.fillText(z.name || z.zone_code, z.x_mm + 400, z.y_mm + 1200);

          const isHorizZone = (z.width_mm || 0) >= (z.length_mm || 0);
          this._drawOrientationBadge(ctx, z.x_mm, z.y_mm, z.width_mm, z.length_mm, isHorizZone, viewport.scale, false);
        }
      }
    }

    // 4. Aisles & Forklift Lanes
    if (Array.isArray(snapshot.aisles)) {
      for (const a of snapshot.aisles) {
        if (this.hiddenLayers.has('aisle') || this.hiddenEntityIds.has(a.id)) continue;

        const isBoth = a.type === 'both' || a.direction === 'both' || Boolean(a.is_both) || String(a.name || '').toLowerCase().includes('bersama');
        const isForklift = !isBoth && (
          String(a.name || '').toLowerCase().includes('forklift') ||
          String(a.aisle_code || '').toLowerCase().includes('forklift') ||
          a.direction === 'forklift'
        );
        const isPedestrian = !isBoth && (
          String(a.type || '').toLowerCase().includes('pedestrian') ||
          String(a.name || '').toLowerCase().includes('penghubung') ||
          String(a.name || '').toLowerCase().includes('orang') ||
          String(a.aisle_code || '').startsWith('P-')
        );

        ctx.save();
        if (isBoth) {
          // Kuning bergaris hijau (Jalur Bersama: Forklift menimpa jalan pejalan)
          // 1. Base fill kuning
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(a.x_mm, a.y_mm, a.width_mm, a.length_mm);

          // 2. Garis-garis diagonal hijau
          ctx.save();
          ctx.beginPath();
          ctx.rect(a.x_mm, a.y_mm, a.width_mm, a.length_mm);
          ctx.clip();

          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = Math.max(3.2 / viewport.scale, 40);
          const spacing = Math.max(16 / viewport.scale, 800);
          const totalSpan = a.width_mm + a.length_mm;
          for (let s = -totalSpan; s <= totalSpan * 2; s += spacing) {
            ctx.beginPath();
            ctx.moveTo(a.x_mm + s, a.y_mm - 100);
            ctx.lineTo(a.x_mm + s + a.length_mm + 200, a.y_mm + a.length_mm + 100);
            ctx.stroke();
          }
          ctx.restore();

          // 3. Stroke border kuning-hijau kuat
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = Math.max(2.5 / viewport.scale, 35);
          ctx.strokeRect(a.x_mm, a.y_mm, a.width_mm, a.length_mm);
        } else if (isForklift) {
          // Forklift jalan kuning
          ctx.fillStyle = '#fef08a';
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = Math.max(2 / viewport.scale, 30);
          ctx.fillRect(a.x_mm, a.y_mm, a.width_mm, a.length_mm);
          ctx.strokeRect(a.x_mm, a.y_mm, a.width_mm, a.length_mm);
        } else {
          // Pejalan full hijau
          ctx.fillStyle = '#86efac';
          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = Math.max(2 / viewport.scale, 30);
          ctx.fillRect(a.x_mm, a.y_mm, a.width_mm, a.length_mm);
          ctx.strokeRect(a.x_mm, a.y_mm, a.width_mm, a.length_mm);
        }

        const isHoriz = (a.width_mm || 2000) >= (a.length_mm || 5000);

        if (a.width_mm * viewport.scale > 18 || a.length_mm * viewport.scale > 18) {
          ctx.fillStyle = isBoth ? '#14532d' : (isForklift ? '#854d0e' : '#14532d');
          ctx.font = `bold ${Math.max(11 / viewport.scale, 280)}px sans-serif`;
          const prefix = isBoth ? '🚜🚶 ' : (isForklift ? '🚜 ' : '🚶 ');
          const baseName = a.name || (isBoth ? 'Jalur Bersama' : (isForklift ? 'Jalur Forklift' : 'Lorong'));
          const aisleLabel = `${prefix}${a.aisle_code} • ${baseName}`;
          ctx.fillText(aisleLabel, a.x_mm + 200, a.y_mm + Math.min(1000, a.length_mm / 2));

          // Garis pemandu arah arus jalan (centerline directional dash)
          ctx.save();
          ctx.strokeStyle = isBoth ? 'rgba(22, 163, 74, 0.55)' : (isForklift ? 'rgba(217, 119, 6, 0.45)' : 'rgba(100, 116, 139, 0.4)');
          ctx.lineWidth = Math.max(1.5 / viewport.scale, 25);
          ctx.setLineDash([Math.max(6 / viewport.scale, 100), Math.max(4 / viewport.scale, 80)]);
          ctx.beginPath();
          if (isHoriz) {
            const midY = a.y_mm + a.length_mm / 2;
            ctx.moveTo(a.x_mm + 120, midY);
            ctx.lineTo(a.x_mm + a.width_mm - 120, midY);
          } else {
            const midX = a.x_mm + a.width_mm / 2;
            ctx.moveTo(midX, a.y_mm + 120);
            ctx.lineTo(midX, a.y_mm + a.length_mm - 120);
          }
          ctx.stroke();
          ctx.restore();

          // Penanda orientasi H / V pada ujung area jalan
          this._drawOrientationBadge(ctx, a.x_mm, a.y_mm, a.width_mm, a.length_mm, isHoriz, viewport.scale, true);

          // 2 Indikator Khusus untuk Jalur Bersama (Forklift & Pejalan)
          if (isBoth) {
            this._drawDualAisleIndicators(ctx, a.x_mm, a.y_mm, a.width_mm, a.length_mm, isHoriz, viewport.scale);
          }
        }
        ctx.restore();
      }
    }

    // 5. Racks with Viewport Culling & LOD
    if (Array.isArray(snapshot.racks)) {
      for (const r of snapshot.racks) {
        if (this.hiddenLayers.has('rack') || this.hiddenEntityIds.has(r.id)) continue;

        const box = footprint(r.length_mm, r.depth_mm, r.rotation || 0);

        // Viewport culling check
        if (
          r.x_mm + box.width < visibleBounds.x ||
          r.x_mm > visibleBounds.x + visibleBounds.width ||
          r.y_mm + box.depth < visibleBounds.y ||
          r.y_mm > visibleBounds.y + visibleBounds.depth
        ) {
          continue; // Di luar layar, lewati render
        }

        this._drawRack(ctx, r, box, viewport.scale);
      }
    }

    // 6. Layout Obstacles (Doors, Docks, Pillars, Walls)
    if (Array.isArray(snapshot.layout_objects)) {
      for (const o of snapshot.layout_objects) {
        if (this.hiddenEntityIds.has(o.id)) continue;

        const type = String(o.object_type || '').toLowerCase();
        const isBothDoor = type.includes('both') || type === 'door' || (type.includes('masuk') && type.includes('keluar'));
        const isEntryDoor = !isBothDoor && (type.includes('entry') || type.includes('masuk'));
        const isExitDoor = !isBothDoor && (type.includes('exit') || type.includes('keluar'));
        const isDock = type.includes('dock');

        if ((isBothDoor || isEntryDoor || isExitDoor) && this.hiddenLayers.has('door')) continue;
        if (isDock && this.hiddenLayers.has('dock')) continue;

        ctx.save();

        if (isBothDoor) {
          ctx.fillStyle = '#eff6ff';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = Math.max(2.5 / viewport.scale, 45);
        } else if (isEntryDoor) {
          ctx.fillStyle = '#dcfce7';
          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = Math.max(2 / viewport.scale, 40);
        } else if (isExitDoor) {
          ctx.fillStyle = '#fee2e2';
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = Math.max(2 / viewport.scale, 40);
        } else if (isDock) {
          ctx.fillStyle = '#eff6ff';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = Math.max(2.5 / viewport.scale, 50);
        } else {
          ctx.fillStyle = '#f1f5f9';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = Math.max(1 / viewport.scale, 20);
        }

        ctx.fillRect(o.x_mm, o.y_mm, o.width_mm, o.length_mm);
        ctx.strokeRect(o.x_mm, o.y_mm, o.width_mm, o.length_mm);

        // Label teks pintu / aset
        const maxSpan = Math.max(o.width_mm, o.length_mm);
        if (maxSpan * viewport.scale > 20) {
          ctx.fillStyle = isBothDoor
            ? '#1d4ed8'
            : isEntryDoor
            ? '#15803d'
            : isExitDoor
            ? '#b91c1c'
            : isDock
            ? '#1d4ed8'
            : '#1e293b';
          const fontSize = Math.max(10 / viewport.scale, 260);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = o.name || (isBothDoor
            ? 'PINTU AKSES ⇅'
            : isEntryDoor
            ? 'PINTU MASUK ⬇'
            : isExitDoor
            ? 'PINTU KELUAR ⬆'
            : isDock
            ? 'AREA DOCKING 🚛'
            : 'ASET');

          const cx = o.x_mm + o.width_mm / 2;
          const cy = o.y_mm + o.length_mm / 2;

          if (o.length_mm > o.width_mm) {
            // Pintu vertikal pada dinding kiri atau kanan
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(label, 0, 0);
            ctx.restore();
          } else {
            ctx.fillText(label, cx, cy);
          }
        }
        ctx.restore();
      }
    }

    ctx.restore();

    // 7. Fixed Viewport CAD Rulers (Excel model: top & left bar starting from 0m)
    this._drawScreenRulers(ctx, viewport, wh);

    // 8. Excel-like Slot Headers (Top Yellow 1, 2, 3... & Left Purple A, B, C...)
    if (this.showSlotGrid) {
      this._drawSlotHeaders(ctx, viewport, wh);
    }
  }

  /**
   * Draws Excel-style CAD rulers along the top and left edges of the viewport.
   * Fixed at top-left origin (0m), expanding right (X) and down (Y).
   * Smallest tick interval is 1 meter (1000 mm).
   */
  _drawScreenRulers(ctx, viewport, wh) {
    const rulerThickness = 24;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // 1. Top Horizontal Ruler Background
    ctx.fillStyle = '#f8f9f5';
    ctx.fillRect(rulerThickness, 0, w - rulerThickness, rulerThickness);
    ctx.strokeStyle = '#d4dacb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerThickness, rulerThickness);
    ctx.lineTo(w, rulerThickness);
    ctx.stroke();

    // 2. Left Vertical Ruler Background
    ctx.fillStyle = '#f8f9f5';
    ctx.fillRect(0, rulerThickness, rulerThickness, h - rulerThickness);
    ctx.beginPath();
    ctx.moveTo(rulerThickness, rulerThickness);
    ctx.lineTo(rulerThickness, h);
    ctx.stroke();

    // Highlight active warehouse bounds on rulers (from 0 to width / length)
    if (wh) {
      const whStartSx = Math.max(rulerThickness, viewport.tx);
      const whEndSx = Math.min(w, viewport.tx + wh.width_mm * viewport.scale);
      if (whEndSx > whStartSx) {
        ctx.fillStyle = 'rgba(92, 115, 43, 0.12)';
        ctx.fillRect(whStartSx, 0, whEndSx - whStartSx, rulerThickness);
      }

      const whStartSy = Math.max(rulerThickness, viewport.ty);
      const whEndSy = Math.min(h, viewport.ty + wh.length_mm * viewport.scale);
      if (whEndSy > whStartSy) {
        ctx.fillStyle = 'rgba(92, 115, 43, 0.12)';
        ctx.fillRect(0, whStartSy, rulerThickness, whEndSy - whStartSy);
      }
    }

    // Step configuration: smallest distance is always 1m (1000 mm)
    const pxPerMeter = viewport.scale * 1000;
    let minorStepMm = 1000; // 1 meter smallest tick
    let majorStepMm = 5000; // 5 meters

    if (pxPerMeter >= 40) {
      minorStepMm = 1000;
      majorStepMm = 2000;
    } else if (pxPerMeter >= 14) {
      minorStepMm = 1000;
      majorStepMm = 5000;
    } else if (pxPerMeter >= 6) {
      minorStepMm = 5000;
      majorStepMm = 10000;
    } else {
      minorStepMm = 10000;
      majorStepMm = 20000;
    }

    // Clip and draw Top Ruler Ticks & Labels (Only positive X >= 0)
    ctx.save();
    ctx.beginPath();
    ctx.rect(rulerThickness, 0, w - rulerThickness, rulerThickness);
    ctx.clip();

    ctx.fillStyle = '#3e5510';
    ctx.strokeStyle = '#737b6c';
    ctx.font = '600 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxWorldX = Math.ceil((w - viewport.tx) / viewport.scale);

    ctx.beginPath();
    for (let wx = 0; wx <= maxWorldX; wx += minorStepMm) {
      const sx = viewport.tx + wx * viewport.scale;
      if (sx < rulerThickness - 1) continue;

      const isMajor = wx % majorStepMm === 0;
      const tHeight = isMajor ? 12 : 6;
      ctx.moveTo(sx, rulerThickness);
      ctx.lineTo(sx, rulerThickness - tHeight);

      if (isMajor) {
        ctx.fillText(`${wx / 1000}m`, sx, 2);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Clip and draw Left Ruler Ticks & Labels (Only positive Y >= 0)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, rulerThickness, rulerThickness, h - rulerThickness);
    ctx.clip();

    ctx.fillStyle = '#3e5510';
    ctx.strokeStyle = '#737b6c';
    ctx.font = '600 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const maxWorldY = Math.ceil((h - viewport.ty) / viewport.scale);

    ctx.beginPath();
    for (let wy = 0; wy <= maxWorldY; wy += minorStepMm) {
      const sy = viewport.ty + wy * viewport.scale;
      if (sy < rulerThickness - 1) continue;

      const isMajor = wy % majorStepMm === 0;
      const tWidth = isMajor ? 12 : 6;
      ctx.moveTo(rulerThickness, sy);
      ctx.lineTo(rulerThickness - tWidth, sy);

      if (isMajor) {
        ctx.fillText(`${wy / 1000}m`, rulerThickness - 13, sy);
      }
    }
    ctx.stroke();
    ctx.restore();

    // 3. Top-Left Corner Box (Fixed origin indicator)
    ctx.fillStyle = '#eef3e2';
    ctx.fillRect(0, 0, rulerThickness, rulerThickness);
    ctx.strokeStyle = '#c4cca9';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, rulerThickness, rulerThickness);

    ctx.fillStyle = '#3e5510';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('m', rulerThickness / 2, rulerThickness / 2);

    ctx.restore();
  }

  /**
   * Draws Excel-like Slot Headers:
   * - Top Yellow Track: Fixed Excel Header for Column Numbers (1, 2, 3...)
   * - Left Purple Track: Fixed Excel Header for Row Letters (A, B, C...)
   * Stays permanently visible and perfectly aligned with grid slots under any zoom or pan.
   */
  _drawSlotHeaders(ctx, viewport, wh) {
    if (!wh) return;

    const baseW = this.slotConfig.lengthMm || 700;
    const baseD = this.slotConfig.depthMm || 500;
    const slotW = this.slotRotated ? baseD : baseW;
    const slotD = this.slotRotated ? baseW : baseD;

    const slotW_px = slotW * viewport.scale;
    const slotD_px = slotD * viewport.scale;

    const maxCols = Math.ceil(wh.width_mm / slotW);
    const maxRows = Math.ceil(wh.length_mm / slotD);

    const rulerT = 24;      // CAD meter ruler thickness
    const slotHeaderH = 20; // Top yellow track height (24..44)
    const slotHeaderW = 28; // Left purple track width (24..52)
    const leftBound = rulerT + slotHeaderW;
    const topBound = rulerT + slotHeaderH;

    ctx.save();

    // 1. TOP YELLOW TRACK: Column Numbers (1, 2, 3...)
    ctx.save();
    ctx.beginPath();
    ctx.rect(leftBound, rulerT, this.width - leftBound, slotHeaderH);
    ctx.clip();

    // Track Background
    ctx.fillStyle = PALETTE.headerYellowBg || '#fef3c7';
    ctx.fillRect(leftBound, rulerT, this.width - leftBound, slotHeaderH);

    // Track Bottom Border
    ctx.strokeStyle = PALETTE.headerYellow || '#f59e0b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftBound, topBound);
    ctx.lineTo(this.width, topBound);
    ctx.stroke();

    let stepCol = 1;
    if (slotW_px < 18) stepCol = 10;
    else if (slotW_px < 28) stepCol = 5;
    else if (slotW_px < 42) stepCol = 2;

    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let c = 0; c < maxCols; c++) {
      const sx = viewport.tx + c * slotW_px;
      if (sx + slotW_px < leftBound || sx > this.width) continue;

      // Divider line aligned 1:1 with slot grid line
      ctx.strokeStyle = '#fcd34d';
      ctx.beginPath();
      ctx.moveTo(sx, rulerT);
      ctx.lineTo(sx, topBound);
      ctx.stroke();

      const isLabeled = (c + 1) % stepCol === 0 || c === 0;
      if (isLabeled && slotW_px >= 10) {
        ctx.fillStyle = '#78350f';
        const centerX = sx + slotW_px / 2;
        ctx.fillText(`${c + 1}`, centerX, rulerT + slotHeaderH / 2);
      }
    }
    // Warehouse right edge boundary indicator line on header
    const whEndSx = viewport.tx + wh.width_mm * viewport.scale;
    if (whEndSx >= leftBound && whEndSx <= this.width) {
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(whEndSx, rulerT);
      ctx.lineTo(whEndSx, topBound);
      ctx.stroke();
    }
    ctx.restore();

    // 2. LEFT PURPLE TRACK: Row Letters (A, B, C...)
    ctx.save();
    ctx.beginPath();
    ctx.rect(rulerT, topBound, slotHeaderW, this.height - topBound);
    ctx.clip();

    // Track Background
    ctx.fillStyle = PALETTE.headerPurpleBg || '#ede9fe';
    ctx.fillRect(rulerT, topBound, slotHeaderW, this.height - topBound);

    // Track Right Border
    ctx.strokeStyle = PALETTE.headerPurple || '#7c3aed';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftBound, topBound);
    ctx.lineTo(leftBound, this.height);
    ctx.stroke();

    let stepRow = 1;
    if (slotD_px < 16) stepRow = 10;
    else if (slotD_px < 24) stepRow = 5;
    else if (slotD_px < 36) stepRow = 2;

    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < maxRows; r++) {
      const sy = viewport.ty + r * slotD_px;
      if (sy + slotD_px < topBound || sy > this.height) continue;

      // Divider line aligned 1:1 with slot grid line
      ctx.strokeStyle = '#ddd6fe';
      ctx.beginPath();
      ctx.moveTo(rulerT, sy);
      ctx.lineTo(leftBound, sy);
      ctx.stroke();

      const isLabeled = (r + 1) % stepRow === 0 || r === 0;
      if (isLabeled && slotD_px >= 10) {
        const rowLetter = rowToLetter(r);
        ctx.fillStyle = '#5b21b6';
        const centerY = sy + slotD_px / 2;
        ctx.fillText(rowLetter, rulerT + slotHeaderW / 2, centerY);
      }
    }
    // Warehouse bottom edge boundary indicator line on header
    const whEndSy = viewport.ty + wh.length_mm * viewport.scale;
    if (whEndSy >= topBound && whEndSy <= this.height) {
      ctx.strokeStyle = '#6d28d9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rulerT, whEndSy);
      ctx.lineTo(leftBound, whEndSy);
      ctx.stroke();
    }
    ctx.restore();

    // 3. CORNER JUNCTION BOX (x: 24..52, y: 24..44)
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(rulerT, rulerT, slotHeaderW, slotHeaderH);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1;
    ctx.strokeRect(rulerT, rulerT, slotHeaderW, slotHeaderH);

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1-A', rulerT + slotHeaderW / 2, rulerT + slotHeaderH / 2);

    ctx.restore();
  }

  /**
   * Draws a single rack applying Level of Detail (LOD) rules
   */
  _drawRack(ctx, rack, box, scale) {
    const screenW = box.width * scale;
    const screenH = box.depth * scale;

    // LOD Level 1: di bawah 3px (titik flat polos)
    if (screenW < 3 || screenH < 3) {
      ctx.fillStyle = PALETTE.rackBorder;
      ctx.fillRect(rack.x_mm, rack.y_mm, box.width, box.depth);
      return;
    }

    const strokeColor = rack.color_hex || PALETTE.rackBorder;
    const fillColor = rack.color_hex ? `${rack.color_hex}22` : PALETTE.rackFill;

    // LOD Level 2: di bawah 24px (kotak polos tanpa teks / panah)
    if (screenW < 24 || screenH < 12) {
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(1 / scale, 20);
      ctx.fillRect(rack.x_mm, rack.y_mm, box.width, box.depth);
      ctx.strokeRect(rack.x_mm, rack.y_mm, box.width, box.depth);
      return;
    }

    // LOD Level 3: >= 24px (tampilan detail penuh)
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1.5 / scale, 30);
    ctx.fillRect(rack.x_mm, rack.y_mm, box.width, box.depth);

    // Garis-garis tipis pembagi slot / bentuk kompartemen rak (tetap tampil apapun gridnya)
    ctx.save();
    ctx.strokeStyle = PALETTE.gridSlot || '#a78bfa';
    ctx.lineWidth = Math.max(0.85 / scale, 12);
    ctx.beginPath();

    const isRotated = Number(rack.rotation) === 90 || Number(rack.rotation) === 270;
    const baseW = Number(rack.slot_width_mm || (this.slotConfig?.lengthMm) || 1000);
    const baseD = Number(rack.slot_depth_mm || (this.slotConfig?.depthMm) || 500);
    const bayCount = Number(rack.bay_count) || 0;
    const stepX = isRotated ? baseD : (bayCount > 1 ? box.width / bayCount : baseW);
    const stepY = isRotated ? (bayCount > 1 ? box.depth / bayCount : baseW) : baseD;

    // Pembagian garis vertikal di dalam rak jika rak lebih lebar dari 1 slot
    if (stepX > 100 && stepX < box.width - 30) {
      for (let x = rack.x_mm + stepX; x <= rack.x_mm + box.width - 30; x += stepX) {
        ctx.moveTo(x, rack.y_mm);
        ctx.lineTo(x, rack.y_mm + box.depth);
      }
    }

    // Pembagian garis horizontal di dalam rak jika rak lebih panjang dari 1 slot (seperti di screenshot user)
    if (stepY > 100 && stepY < box.depth - 30) {
      for (let y = rack.y_mm + stepY; y <= rack.y_mm + box.depth - 30; y += stepY) {
        ctx.moveTo(rack.x_mm, y);
        ctx.lineTo(rack.x_mm + box.width, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeRect(rack.x_mm, rack.y_mm, box.width, box.depth);

    // Teks Label Kode Rak
    const isRackVert = isRotated || box.depth > box.width;
    ctx.fillStyle = PALETTE.rackText;
    ctx.font = `600 ${Math.max(11 / scale, 280)}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(rack.rack_code, rack.x_mm + box.width / 2, rack.y_mm + box.depth / 2);

    // Penanda Orientasi [H] atau [V] pada ujung rak
    this._drawOrientationBadge(ctx, rack.x_mm, rack.y_mm, box.width, box.depth, !isRackVert, scale, false);

    // Arah Aisle Access Arrow jika terkonfigurasi
    if (rack.aisle_access && rack.aisle_access.length > 0) {
      const primary = rack.aisle_access.find((a) => a.is_primary) || rack.aisle_access[0];
      this._drawAccessIndicator(ctx, rack, box, primary.access_side, scale);
    }
  }

  _drawAccessIndicator(ctx, rack, box, side, scale) {
    ctx.fillStyle = '#5c732b';
    const dotSize = Math.max(3 / scale, 60);
    const midX = rack.x_mm + box.width / 2;
    const midY = rack.y_mm + box.depth / 2;

    if (side === 'left') {
      ctx.fillRect(rack.x_mm + 40, midY - dotSize / 2, dotSize, dotSize);
    } else if (side === 'right') {
      ctx.fillRect(rack.x_mm + box.width - 40 - dotSize, midY - dotSize / 2, dotSize, dotSize);
    } else {
      ctx.fillRect(midX - dotSize / 2, rack.y_mm + 40, dotSize, dotSize);
    }
  }

  /**
   * Menggambar penanda/badge orientasi [H] atau [V] pada ujung area (lorong/jalan, rak, zona)
   * Menandakan objek dibuat mengikuti panduan grid Horizontal atau Vertikal.
   */
  _drawOrientationBadge(ctx, x, y, width, height, isHoriz, scale, bothEnds = false) {
    const orient = isHoriz ? 'H' : 'V';

    // Dimensi badge dalam mm dunia nyata (terbaca pada layar)
    const targetW = Math.max(14 / scale, 340);
    const targetH = Math.max(11 / scale, 260);

    // Pastikan badge proporsional dan tidak melebihi ukuran entitas
    const badgeW = Math.min(targetW, width * 0.42);
    const badgeH = Math.min(targetH, height * 0.42);

    if (badgeW * scale < 7 || badgeH * scale < 5) return; // Terlalu kecil saat zoom jauh

    const pad = Math.min(60, Math.min(width, height) * 0.06);
    const radius = Math.min(badgeH / 2, Math.max(2.5 / scale, 40));

    const drawSingleBadge = (bx, by) => {
      ctx.save();
      // Palet: Horizontal = Amber/Kuning (Kolom 1,2,3), Vertikal = Ungu/Purple (Baris A,B,C)
      if (isHoriz) {
        ctx.fillStyle = '#fef3c7'; // Amber 100
        ctx.strokeStyle = '#f59e0b'; // Amber 500
      } else {
        ctx.fillStyle = '#ede9fe'; // Purple 100
        ctx.strokeStyle = '#7c3aed'; // Purple 600
      }
      ctx.lineWidth = Math.max(1 / scale, 16);

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, badgeW, badgeH, radius);
      } else {
        ctx.rect(bx, by, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isHoriz ? '#78350f' : '#5b21b6';
      const fontSize = Math.min(badgeH * 0.72, Math.max(8.5 / scale, 190));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(orient, bx + badgeW / 2, by + badgeH / 2);
      ctx.restore();
    };

    // Ujung 1 (Top-Right / Akhir Primer)
    const bx1 = x + width - badgeW - pad;
    const by1 = y + pad;
    drawSingleBadge(bx1, by1);

    // Jika entitas panjang (lorong/jalan), ujung kedua juga diberi badge
    if (bothEnds) {
      if (isHoriz && width > 5000) {
        // Ujung Kiri
        const bx2 = x + pad;
        const by2 = y + pad;
        drawSingleBadge(bx2, by2);
      } else if (!isHoriz && height > 5000) {
        // Ujung Bawah
        const bx2 = x + width - badgeW - pad;
        const by2 = y + height - badgeH - pad;
        drawSingleBadge(bx2, by2);
      }
    }
  }

  /**
   * Menggambar 2 indikator [🚜 Forklift] dan [🚶 Pejalan] pada Jalur Bersama
   */
  _drawDualAisleIndicators(ctx, x, y, width, height, isHoriz, scale) {
    const badgeW = Math.min(width * 0.45, Math.max(34 / scale, 750));
    const badgeH = Math.min(height * 0.35, Math.max(12 / scale, 240));
    if (badgeW * scale < 20 || badgeH * scale < 6) return;

    const pad = Math.min(80, Math.min(width, height) * 0.05);
    const radius = Math.min(badgeH / 2, Math.max(2 / scale, 35));

    // Posisi di dekat awal atau tengah area
    const bx = x + pad;
    const by = isHoriz ? y + height - badgeH - pad : y + pad + badgeH + 60;

    // Badge 1: 🚜 Forklift
    ctx.save();
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(1 / scale, 16);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bx, by, badgeW / 2 - 10, badgeH, radius);
    } else {
      ctx.rect(bx, by, badgeW / 2 - 10, badgeH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    const fontSize = Math.min(badgeH * 0.68, Math.max(8 / scale, 180));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚜 Forklift', bx + (badgeW / 2 - 10) / 2, by + badgeH / 2);

    // Badge 2: 🚶 Pejalan
    const bx2 = bx + badgeW / 2 + 10;
    ctx.fillStyle = '#dcfce7';
    ctx.strokeStyle = '#16a34a';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bx2, by, badgeW / 2 - 10, badgeH, radius);
    } else {
      ctx.rect(bx2, by, badgeW / 2 - 10, badgeH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#166534';
    ctx.fillText('🚶 Pejalan', bx2 + (badgeW / 2 - 10) / 2, by + badgeH / 2);
    ctx.restore();
  }

  /**
   * Draws 1x1 meter default grid across the warehouse floor.
   * Includes major grid lines every 5 meters for clear visual orientation.
   */
  _drawAdaptiveGrid(ctx, bounds, scale) {
    const meterMm = 1000;   // 1x1 meter default grid (1000 mm)
    const majorStep = 5000; // 5 meter major lines

    // Multiplier for extremely zoomed-out views to avoid visual line clutter
    let step = meterMm;
    if (scale < 0.008) step = 10000;
    else if (scale < 0.015) step = 5000;

    const startX = Math.floor(bounds.x / step) * step;
    const endX = Math.ceil((bounds.x + bounds.width) / step) * step;
    const startY = Math.floor(bounds.y / step) * step;
    const endY = Math.ceil((bounds.y + bounds.depth) / step) * step;

    ctx.save();

    // 1. Draw 1m minor grid lines if step === 1000 mm
    if (step === meterMm) {
      ctx.strokeStyle = PALETTE.gridMinor;
      ctx.lineWidth = 0.65 / scale;
      ctx.beginPath();
      if (this.showGridVertical !== false) {
        for (let x = startX; x <= endX; x += meterMm) {
          if (x % majorStep !== 0) {
            ctx.moveTo(x, bounds.y);
            ctx.lineTo(x, bounds.y + bounds.depth);
          }
        }
      }
      if (this.showGridHorizontal !== false) {
        for (let y = startY; y <= endY; y += meterMm) {
          if (y % majorStep !== 0) {
            ctx.moveTo(bounds.x, y);
            ctx.lineTo(bounds.x + bounds.width, y);
          }
        }
      }
      ctx.stroke();
    }

    // 2. Draw Major lines (every 5 meters)
    const majorInterval = step === meterMm ? majorStep : step;
    const majorStartX = Math.floor(bounds.x / majorInterval) * majorInterval;
    const majorEndX = Math.ceil((bounds.x + bounds.width) / majorInterval) * majorInterval;
    const majorStartY = Math.floor(bounds.y / majorInterval) * majorInterval;
    const majorEndY = Math.ceil((bounds.y + bounds.depth) / majorInterval) * majorInterval;

    ctx.strokeStyle = PALETTE.gridMajor;
    ctx.lineWidth = 1.0 / scale;
    ctx.beginPath();
    if (this.showGridVertical !== false) {
      for (let x = majorStartX; x <= majorEndX; x += majorInterval) {
        ctx.moveTo(x, bounds.y);
        ctx.lineTo(x, bounds.y + bounds.depth);
      }
    }
    if (this.showGridHorizontal !== false) {
      for (let y = majorStartY; y <= majorEndY; y += majorInterval) {
        ctx.moveTo(bounds.x, y);
        ctx.lineTo(bounds.x + bounds.width, y);
      }
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draws modular slot grid lines according to slotConfig (lengthMm × depthMm)
   * Rendered within the warehouse floor boundary.
   */
  _drawSlotGrid(ctx, bounds, scale, warehouse) {
    const baseW = this.slotConfig.lengthMm || 700;
    const baseD = this.slotConfig.depthMm || 500;
    const slotW = this.slotRotated ? baseD : baseW;
    const slotD = this.slotRotated ? baseW : baseD;
    const maxW = warehouse?.width_mm || 50000;
    const maxH = warehouse?.length_mm || 80000;

    const minX = Math.max(0, Math.floor(bounds.x / slotW) * slotW);
    const maxX = Math.min(maxW, Math.ceil((bounds.x + bounds.width) / slotW) * slotW);
    const minY = Math.max(0, Math.floor(bounds.y / slotD) * slotD);
    const maxY = Math.min(maxH, Math.ceil((bounds.y + bounds.depth) / slotD) * slotD);

    if (minX > maxX || minY > maxY) return;

    ctx.save();
    ctx.strokeStyle = PALETTE.gridSlot || '#a78bfa';
    ctx.lineWidth = Math.max(0.75 / scale, 1);
    ctx.beginPath();

    // Garis pembatas slot vertikal
    for (let x = minX; x <= maxX; x += slotW) {
      ctx.moveTo(x, Math.max(0, bounds.y));
      ctx.lineTo(x, Math.min(maxH, bounds.y + bounds.depth));
    }

    // Garis pembatas slot horizontal
    for (let y = minY; y <= maxY; y += slotD) {
      ctx.moveTo(Math.max(0, bounds.x), y);
      ctx.lineTo(Math.min(maxW, bounds.x + bounds.width), y);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders Overlay (Selection highlights, ghost drag, collision warnings)
   */
  _renderOverlayScene() {
    const ctx = this.overlayCtx;
    const viewport = this.viewport || { scale: 0.02, tx: 50, ty: 50 };
    const overlayState = this.overlayState;

    // CRITICAL FIX: Lock DPR scaling at every overlay frame
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (!overlayState) return;

    ctx.save();
    ctx.translate(viewport.tx, viewport.ty);
    ctx.scale(viewport.scale, viewport.scale);

    // 1. Ghost Dragged Object
    if (overlayState.dragGhost) {
      const g = overlayState.dragGhost;
      const isColliding = overlayState.isColliding;

      ctx.fillStyle = isColliding ? PALETTE.collisionFill : 'rgba(92, 115, 43, 0.25)';
      ctx.strokeStyle = isColliding ? PALETTE.collisionBorder : PALETTE.selectionBorder;
      ctx.lineWidth = Math.max(2 / viewport.scale, 40);

      ctx.fillRect(g.x_mm, g.y_mm, g.width, g.depth);
      ctx.strokeRect(g.x_mm, g.y_mm, g.width, g.depth);
    }

    // 2. Selected Entity Highlight
    if (overlayState.selectedIds && overlayState.selectedIds.size > 0 && this.snapshot) {
      for (const id of overlayState.selectedIds) {
        const item =
          this.snapshot.racks?.find((r) => r.id === id) ||
          this.snapshot.aisles?.find((a) => a.id === id) ||
          this.snapshot.layout_objects?.find((o) => o.id === id) ||
          this.snapshot.zones?.find((z) => z.id === id);
        if (item) {
          const w = item.width_mm || (item.length_mm && item.depth_mm ? footprint(item.length_mm, item.depth_mm, item.rotation || 0).width : 2000);
          const d = item.length_mm && item.depth_mm ? footprint(item.length_mm, item.depth_mm, item.rotation || 0).depth : (item.length_mm || 2000);
          ctx.strokeStyle = PALETTE.selectionBorder;
          ctx.lineWidth = Math.max(2 / viewport.scale, 40);
          ctx.strokeRect(item.x_mm, item.y_mm, w, d);

          // Selection Handles
          this._drawSelectionHandles(ctx, item.x_mm, item.y_mm, w, d, viewport.scale);
        }
      }
    }

    // 3. Rubber-band Selection Marquee
    if (overlayState.rubberBand) {
      const rb = overlayState.rubberBand;
      ctx.fillStyle = PALETTE.selectionFill;
      ctx.strokeStyle = PALETTE.selectionBorder;
      ctx.lineWidth = Math.max(1 / viewport.scale, 20);
      ctx.setLineDash([Math.max(4 / viewport.scale, 80), Math.max(4 / viewport.scale, 80)]);
      ctx.fillRect(rb.x, rb.y, rb.width, rb.depth);
      ctx.strokeRect(rb.x, rb.y, rb.width, rb.depth);
      ctx.setLineDash([]);
    }

    // 3b. Slot Fill Drag Highlight (Live Excel-like Cell Fill)
    if (overlayState.slotFillGhost) {
      this._drawSlotFillGhost(ctx, overlayState.slotFillGhost, viewport.scale);
    }

    // 3c. Dock Fill Drag Highlight
    if (overlayState.dockFillGhost) {
      this._drawDockFillGhost(ctx, overlayState.dockFillGhost, viewport.scale);
    }

    // 3c-2. Aisle Fill Drag Highlight
    if (overlayState.aisleFillGhost) {
      this._drawAisleFillGhost(ctx, overlayState.aisleFillGhost, viewport.scale);
    }

    // 3d. Interactive Placement Ghost (Stamp Mode)
    if (overlayState.placementGhost) {
      this._drawPlacementGhost(ctx, overlayState.placementGhost, viewport.scale);
    }

    // 4. Pathfinding Active Route Polyline
    if (this.activeRoute && Array.isArray(this.activeRoute.path) && this.activeRoute.path.length > 0) {
      this._drawPathRoute(ctx, this.activeRoute, viewport.scale);
    }

    ctx.restore();
  }

  /**
   * Draws interactive live cell fill ghost when user drags across slots
   */
  _drawSlotFillGhost(ctx, g, scale) {
    if (!g) return;

    const isColliding = Boolean(g.isColliding);
    const mainColor = isColliding ? '#ef4444' : (g.color_hex || '#5c732b');

    // 1. Fill highlight (Translucent red on collision or custom RGB / Hex color)
    ctx.fillStyle = isColliding ? 'rgba(239, 68, 68, 0.32)' : `${mainColor}38`;
    ctx.fillRect(g.x_mm, g.y_mm, g.width_mm, g.depth_mm);

    // 2. Dashed / Crisp Outer Border
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(isColliding ? 3.5 / scale : 2.5 / scale, 40);
    ctx.strokeRect(g.x_mm, g.y_mm, g.width_mm, g.depth_mm);

    // 3. Inner slot divider lines & row labels
    if (g.bayCount > 1 || g.depthCount > 1) {
      ctx.save();
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = Math.max(1.2 / scale, 20);
      ctx.setLineDash([Math.max(4 / scale, 60), Math.max(4 / scale, 60)]);
      ctx.beginPath();
      for (let c = 1; c < g.bayCount; c++) {
        const x = g.x_mm + c * g.slotW;
        ctx.moveTo(x, g.y_mm);
        ctx.lineTo(x, g.y_mm + g.depth_mm);
      }
      for (let r = 1; r < g.depthCount; r++) {
        const y = g.y_mm + r * g.slotD;
        ctx.moveTo(g.x_mm, y);
        ctx.lineTo(g.x_mm + g.width_mm, y);
      }
      ctx.stroke();
      ctx.restore();

      // Label Baris pada sisi kiri ghost fill jika cukup besar
      if (g.depthCount > 1 && g.slotD * scale >= 14) {
        ctx.save();
        ctx.fillStyle = mainColor;
        ctx.font = `bold ${Math.max(10 / scale, 200)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let r = 0; r < g.depthCount; r++) {
          const rowL = rowToLetter(g.minR + r);
          const y = g.y_mm + r * g.slotD + g.slotD / 2;
          ctx.fillText(`Baris ${rowL}`, g.x_mm + Math.max(6 / scale, 60), y);
        }
        ctx.restore();
      }
    }

    // 4. Floating Info Badge (Menampilkan Jumlah Baris, Kolom & Total Slot)
    ctx.save();
    const totalSlots = (g.bayCount || 1) * (g.depthCount || 1);
    const endRowLetter = g.depthCount > 1 ? ` s/d ${rowToLetter(g.maxR)}` : '';
    const endColText = g.bayCount > 1 ? ` s/d ${g.endCol}` : '';
    const badgeText = isColliding
      ? `⚠️ TUMPANG TINDIH! Area bertabrakan dengan objek lain (${(g.width_mm / 1000).toFixed(1)}m × ${(g.depth_mm / 1000).toFixed(1)}m)`
      : `📦 ${g.depthCount} Baris × ${g.bayCount} Kolom (${totalSlots} Slot) | Baris ${g.rowLetter}${endRowLetter} | ${(g.width_mm / 1000).toFixed(1)}m × ${(g.depth_mm / 1000).toFixed(1)}m`;
    const fontSize = Math.max(12 / scale, 240);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textW = ctx.measureText(badgeText).width;
    const badgePad = Math.max(8 / scale, 120);
    const badgeH = Math.max(22 / scale, 340);

    const bx = g.x_mm + g.width_mm / 2 - (textW + badgePad * 2) / 2;
    const by = g.y_mm - Math.max(28 / scale, 400);

    ctx.fillStyle = isColliding ? '#7f1d1d' : '#191d17';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, textW + badgePad * 2, badgeH, Math.max(4 / scale, 60));
    } else {
      ctx.rect(bx, by, textW + badgePad * 2, badgeH);
    }
    ctx.fill();

    ctx.fillStyle = isColliding ? '#fecaca' : '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, bx + (textW + badgePad * 2) / 2, by + badgeH / 2);
    ctx.restore();
  }

  /**
   * Draws interactive live dock area fill ghost when user drags on canvas
   */
  _drawDockFillGhost(ctx, g, scale) {
    if (!g) return;
    ctx.save();

    const isColliding = Boolean(g.isColliding);
    const mainColor = isColliding ? '#ef4444' : '#2563eb';

    // 1. Fill highlight (Translucent Royal Blue or Warning Red)
    ctx.fillStyle = isColliding ? 'rgba(239, 68, 68, 0.28)' : 'rgba(37, 99, 235, 0.22)';
    ctx.fillRect(g.x_mm, g.y_mm, g.width_mm, g.length_mm);

    // 2. Crisp dashed border
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(isColliding ? 4 / scale : 3 / scale, 60);
    ctx.setLineDash([Math.max(6 / scale, 120), Math.max(4 / scale, 80)]);
    ctx.strokeRect(g.x_mm, g.y_mm, g.width_mm, g.length_mm);
    ctx.setLineDash([]);

    // 3. Center Icon & Text
    const cx = g.x_mm + g.width_mm / 2;
    const cy = g.y_mm + g.length_mm / 2;
    const fontSize = Math.max(13 / scale, 340);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isColliding ? '#b91c1c' : '#1d4ed8';
    ctx.fillText(isColliding ? `⚠️ AREA DOK TUMPANG TINDIH!` : `🚛 AREA DOK BONGKAR MUAT`, cx, cy - Math.max(10 / scale, 160));

    const subFontSize = Math.max(11 / scale, 260);
    ctx.font = `600 ${subFontSize}px sans-serif`;
    ctx.fillStyle = isColliding ? '#ef4444' : '#2563eb';
    ctx.fillText(
      isColliding ? `Bertabrakan dengan rak / objek lain` : `${(g.width_mm / 1000).toFixed(1)}m × ${(g.length_mm / 1000).toFixed(1)}m (${Math.round((g.width_mm * g.length_mm) / 1000000)} m²)`,
      cx,
      cy + Math.max(12 / scale, 180)
    );

    // 4. Floating Info Badge on Top
    const badgeText = isColliding
      ? `⚠️ TUMPANG TINDIH DENGAN OBJEK LAIN! Dok tidak dapat dibuat di sini`
      : `🚛 Mode Drag & Fill Dok: ${(g.width_mm / 1000).toFixed(1)}m × ${(g.length_mm / 1000).toFixed(1)}m (Lepaskan untuk pasang)`;
    const bFontSize = Math.max(11 / scale, 230);
    ctx.font = `bold ${bFontSize}px sans-serif`;
    const textW = ctx.measureText(badgeText).width;
    const badgePad = Math.max(8 / scale, 120);
    const badgeH = Math.max(22 / scale, 320);

    const bx = cx - (textW + badgePad * 2) / 2;
    const by = g.y_mm - Math.max(28 / scale, 380);

    ctx.fillStyle = isColliding ? '#7f1d1d' : '#1e3a8a';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, textW + badgePad * 2, badgeH, Math.max(4 / scale, 60));
    } else {
      ctx.rect(bx, by, textW + badgePad * 2, badgeH);
    }
    ctx.fill();

    ctx.fillStyle = isColliding ? '#fecaca' : '#dbeafe';
    ctx.fillText(badgeText, bx + (textW + badgePad * 2) / 2, by + badgeH / 2);

    ctx.restore();
  }

  /**
   * Draws interactive live aisle / walkway fill ghost when user drags on canvas
   */
  _drawAisleFillGhost(ctx, g, scale) {
    if (!g) return;
    ctx.save();

    const isColliding = Boolean(g.isColliding);
    const isForklift = g.type === 'forklift';
    const isPedestrian = !isForklift;
    const mainColor = isColliding ? '#ef4444' : (isForklift ? '#ca8a04' : '#16a34a');
    const fillColor = isColliding
      ? 'rgba(239, 68, 68, 0.28)'
      : (isForklift ? 'rgba(250, 204, 21, 0.38)' : 'rgba(34, 197, 94, 0.30)');

    // 1. Fill highlight
    ctx.fillStyle = fillColor;
    ctx.fillRect(g.x_mm, g.y_mm, g.width_mm, g.length_mm);

    // 2. Crisp dashed border (warna emerald jika Snap to Clearance aktif, merah jika bertabrakan)
    ctx.strokeStyle = isColliding ? '#ef4444' : (g.isAutoFitted ? '#10b981' : mainColor);
    ctx.lineWidth = Math.max(isColliding ? 3.5 / scale : 2.5 / scale, 50);
    ctx.setLineDash([Math.max(6 / scale, 120), Math.max(4 / scale, 80)]);
    ctx.strokeRect(g.x_mm, g.y_mm, g.width_mm, g.length_mm);
    ctx.setLineDash([]);

    // 3. Center Icon & Text
    const cx = g.x_mm + g.width_mm / 2;
    const cy = g.y_mm + g.length_mm / 2;
    const icon = isColliding ? '⚠️' : (isForklift ? '🚜' : '🚶');
    const isHoriz = g.width_mm >= g.length_mm;
    const orientLabel = isHoriz ? 'H' : 'V';
    const label = isColliding
      ? (g.collisionReason === 'pedestrian_overlap'
          ? `⚠️ PEJALAN TIDAK BISA MENIMPA JALAN LAIN!`
          : `⚠️ JALAN MENIMPA RAK! (Geser Rak)`)
      : (isForklift ? `JALUR FORKLIFT [${orientLabel}]` : `JALAN PEJALAN [${orientLabel}]`);
    const fontSize = Math.max(13 / scale, 340);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isColliding ? '#b91c1c' : (g.isAutoFitted ? '#047857' : mainColor);
    ctx.fillText(`${icon} ${label}`, cx, cy - Math.max(10 / scale, 160));

    // Badge penanda orientasi pada ujung ghost jalan
    this._drawOrientationBadge(ctx, g.x_mm, g.y_mm, g.width_mm, g.length_mm, isHoriz, scale, false);

    const subFontSize = Math.max(11 / scale, 260);
    ctx.font = `600 ${subFontSize}px sans-serif`;
    ctx.fillStyle = isColliding ? '#ef4444' : mainColor;
    ctx.fillText(
      isColliding
        ? (g.collisionReason === 'pedestrian_overlap' ? 'Pilih posisi kosong / tidak tumpang tindih' : 'Tidak boleh menimpa rak!')
        : `${(g.width_mm / 1000).toFixed(1)}m × ${(g.length_mm / 1000).toFixed(1)}m (${Math.round((g.width_mm * g.length_mm) / 1000000)} m²)`,
      cx,
      cy + Math.max(12 / scale, 180)
    );

    // 4. Floating Info Badge on Top
    const badgeText = isColliding
      ? `⚠️ JALAN MENIMPA RAK! Jalan tidak bisa menimpa rak, silakan geser posisi rak terlebih dahulu`
      : (g.isAutoFitted
        ? `✨ Snap to Clearance: Pas di celah rak ${(g.width_mm / 1000).toFixed(2)}m × ${(g.length_mm / 1000).toFixed(2)}m (Zero Collision)`
        : `${icon} Drag & Fill Jalan (${orientLabel}): ${(g.width_mm / 1000).toFixed(1)}m × ${(g.length_mm / 1000).toFixed(1)}m (Lepaskan untuk pasang)`);
    const bFontSize = Math.max(11 / scale, 230);
    ctx.font = `bold ${bFontSize}px sans-serif`;
    const textW = ctx.measureText(badgeText).width;
    const badgePad = Math.max(8 / scale, 120);
    const badgeH = Math.max(22 / scale, 320);

    const bx = cx - (textW + badgePad * 2) / 2;
    const by = g.y_mm - Math.max(28 / scale, 380);

    ctx.fillStyle = isColliding ? '#7f1d1d' : (g.isAutoFitted ? '#064e3b' : (isForklift ? '#78350f' : '#451a03'));
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, textW + badgePad * 2, badgeH, Math.max(4 / scale, 60));
    } else {
      ctx.rect(bx, by, textW + badgePad * 2, badgeH);
    }
    ctx.fill();

    ctx.fillStyle = isColliding ? '#fecaca' : (g.isAutoFitted ? '#a7f3d0' : '#fef3c7');
    ctx.fillText(badgeText, bx + (textW + badgePad * 2) / 2, by + badgeH / 2);

    ctx.restore();
  }

  /**
   * Draws interactive placement ghost following cursor snapped to slot grid
   */
  _drawPlacementGhost(ctx, g, scale) {
    if (!g) return;

    const isColliding = Boolean(g.isColliding);
    const mainColor = isColliding ? '#ef4444' : (g.color_hex || '#5c732b');
    const isRotated = (g.rotation || 0) % 180 !== 0;

    ctx.save();

    // 1. Semi-transparent fill highlight
    ctx.fillStyle = isColliding ? 'rgba(239, 68, 68, 0.32)' : `${mainColor}3d`;
    ctx.fillRect(g.x_mm, g.y_mm, g.width_mm, g.depth_mm);

    // 2. Dashed vibrant border
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = Math.max(isColliding ? 3.5 / scale : 2.5 / scale, 40);
    ctx.setLineDash([Math.max(6 / scale, 120), Math.max(4 / scale, 80)]);
    ctx.strokeRect(g.x_mm, g.y_mm, g.width_mm, g.depth_mm);
    ctx.setLineDash([]);

    // 3. Grid / Bay dividing lines if bay_count > 1
    if (g.bay_count > 1) {
      ctx.strokeStyle = isColliding ? '#ef4444aa' : `${mainColor}aa`;
      ctx.lineWidth = Math.max(1.2 / scale, 24);
      const step = isRotated ? (g.depth_mm / g.bay_count) : (g.width_mm / g.bay_count);
      ctx.beginPath();
      for (let i = 1; i < g.bay_count; i++) {
        if (isRotated) {
          const y = g.y_mm + i * step;
          ctx.moveTo(g.x_mm, y);
          ctx.lineTo(g.x_mm + g.width_mm, y);
        } else {
          const x = g.x_mm + i * step;
          ctx.moveTo(x, g.y_mm);
          ctx.lineTo(x, g.y_mm + g.depth_mm);
        }
      }
      ctx.stroke();
    }

    // 4. Center label: Rack Code + Orientation + Dimensions
    ctx.fillStyle = isColliding ? '#b91c1c' : '#191d17';
    const centerFontSize = Math.max(12 / scale, 240);
    ctx.font = `bold ${centerFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ghostOrientSym = isRotated ? 'V' : 'H';
    ctx.fillText(
      isColliding
        ? `⚠️ TUMPANG TINDIH: ${g.rack_code}`
        : `${g.rack_code} [${ghostOrientSym}] (${(g.width_mm / 1000).toFixed(1)}m × ${(g.depth_mm / 1000).toFixed(1)}m)`,
      g.x_mm + g.width_mm / 2,
      g.y_mm + g.depth_mm / 2
    );

    // Badge penanda orientasi pada ujung ghost rak
    this._drawOrientationBadge(ctx, g.x_mm, g.y_mm, g.width_mm, g.depth_mm, !isRotated, scale, false);

    // 5. Floating Placement Badge above ghost
    const badgeText = isColliding
      ? `⚠️ TUMPANG TINDIH - Tidak dapat diletakkan! (Area sudah terisi)`
      : `📍 ${g.rack_code} [${g.bay_count} Bay × ${g.level_count || 3} Lt] | Baris ${g.rowLetter}, Kol ${g.col} • Klik untuk meletakkan`;
    const fontSize = Math.max(12 / scale, 240);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textW = ctx.measureText(badgeText).width;
    const badgePad = Math.max(10 / scale, 160);
    const badgeH = Math.max(24 / scale, 360);

    const bx = g.x_mm + g.width_mm / 2 - (textW + badgePad * 2) / 2;
    const by = g.y_mm - Math.max(30 / scale, 420);

    ctx.fillStyle = isColliding ? '#7f1d1d' : '#1e293b';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, textW + badgePad * 2, badgeH, Math.max(5 / scale, 80));
    } else {
      ctx.rect(bx, by, textW + badgePad * 2, badgeH);
    }
    ctx.fill();

    ctx.fillStyle = isColliding ? '#fecaca' : '#f8fafc';
    ctx.fillText(badgeText, bx + (textW + badgePad * 2) / 2, by + badgeH / 2);

    ctx.restore();
  }

  /**
   * Renders viewport-culled OccupancyGrid heatmap and 50cm x 50cm pathfinding matrix mesh
   */
  _renderGridMatrix(ctx, bounds) {
    if (!this.gridMatrixInstance) return;
    const grid = this.gridMatrixInstance;
    const cellW = grid.cellWidthMm || grid.cellSize || 500;
    const cellD = grid.cellDepthMm || grid.cellSize || 500;

    const minCol = Math.max(0, Math.floor(bounds.x / cellW));
    const maxCol = Math.min(grid.cols - 1, Math.floor((bounds.x + bounds.width) / cellW));
    const minRow = Math.max(0, Math.floor(bounds.y / cellD));
    const maxRow = Math.min(grid.rows - 1, Math.floor((bounds.y + bounds.depth) / cellD));

    // 1. Draw Cell fills (Occupancy Heatmap: blocked, rack, aisle, dock, door)
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const type = grid.get(c, r);
        const color = GRID_CELL_COLORS[type];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c * cellW, r * cellD, cellW, cellD);
        }
      }
    }

    // 2. Draw 50cm x 50cm matrix mesh grid so pathfinding cell blocks are clearly visible
    const viewportScale = this.viewport?.scale || 0.02;
    ctx.save();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)'; // Subtle slate matrix mesh
    ctx.lineWidth = Math.max(0.6 / viewportScale, 18);
    ctx.beginPath();
    for (let c = minCol; c <= maxCol + 1; c++) {
      const x = c * cellW;
      ctx.moveTo(x, minRow * cellD);
      ctx.lineTo(x, (maxRow + 1) * cellD);
    }
    for (let r = minRow; r <= maxRow + 1; r++) {
      const y = r * cellD;
      ctx.moveTo(minCol * cellW, y);
      ctx.lineTo((maxCol + 1) * cellW, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders active A* navigation route polyline on overlay canvas
   */
  _drawPathRoute(ctx, route, scale) {
    if (!route || !Array.isArray(route.path) || route.path.length < 2) return;
    const pts = route.path;

    ctx.save();
    // 1. Dark outer backing line
    ctx.strokeStyle = '#191d17';
    ctx.lineWidth = Math.max(6 / scale, 120);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].xMm, pts[0].yMm);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].xMm, pts[i].yMm);
    }
    ctx.stroke();

    // 2. Primary Deep Forest line
    ctx.strokeStyle = '#5c732b';
    ctx.lineWidth = Math.max(4 / scale, 80);
    ctx.stroke();

    // 3. Dashed mint core line
    ctx.strokeStyle = '#bef264';
    ctx.lineWidth = Math.max(1.8 / scale, 35);
    ctx.setLineDash([Math.max(6 / scale, 120), Math.max(4 / scale, 80)]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Waypoint intermediate dots
    const markerRadius = Math.max(4 / scale, 80);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3e5510';
      ctx.lineWidth = Math.max(1.5 / scale, 30);
      ctx.beginPath();
      ctx.arc(pts[i].xMm, pts[i].yMm, markerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 5. Start and Goal pins
    this._drawRoutePin(ctx, pts[0].xMm, pts[0].yMm, '#16a34a', 'START', scale);
    this._drawRoutePin(ctx, pts[pts.length - 1].xMm, pts[pts.length - 1].yMm, '#dc2626', 'GOAL', scale);

    ctx.restore();
  }

  _drawRoutePin(ctx, x, y, color, label, scale) {
    const radius = Math.max(8 / scale, 160);
    ctx.save();
    // Halo
    ctx.fillStyle = `${color}40`;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Pin Body
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2 / scale, 40);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Text Label
    if (scale > 0.012) {
      ctx.fillStyle = '#191d17';
      ctx.font = `bold ${Math.max(10 / scale, 200)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, x, y - radius * 1.6);
    }
    ctx.restore();
  }

  /**
   * Sets slot dimensions configuration and triggers re-render
   */
  setSlotConfig(config) {
    if (config && config.lengthMm > 0 && config.depthMm > 0) {
      this.slotConfig = { ...this.slotConfig, ...config };
      this.markDirty(false);
    }
  }

  /**
   * Sets grid visibility for meter grid, horizontal/vertical lines, and modular slot grid
   */
  setGridVisibility({ meter, slot, slotRotated, horizontal, vertical, slotHorizontal, slotVertical }) {
    if (typeof meter === 'boolean') {
      this.showMeterGrid = meter;
    }
    if (typeof slot === 'boolean') {
      this.showSlotGrid = slot;
    }
    if (typeof slotRotated === 'boolean') {
      this.slotRotated = slotRotated;
    }
    if (typeof horizontal === 'boolean') {
      this.showGridHorizontal = horizontal;
    }
    if (typeof vertical === 'boolean') {
      this.showGridVertical = vertical;
    }
    if (typeof slotHorizontal === 'boolean') {
      this.showSlotHorizontal = slotHorizontal;
    }
    if (typeof slotVertical === 'boolean') {
      this.showSlotVertical = slotVertical;
    }
    this.markDirty(false);
  }

  /**
   * Sets occupancy grid heatmap instance and visibility
   */
  setGridMatrix(grid, show = true) {
    this.gridMatrixInstance = grid;
    this.showGridMatrix = show;
    this.markDirty(false);
  }

  /**
   * Sets active navigation route for overlay display
   */
  setActiveRoute(route) {
    this.activeRoute = route;
    this.markDirty(true);
  }

  _drawSelectionHandles(ctx, x, y, width, depth, scale) {
    const handleSize = Math.max(8 / scale, 160);
    ctx.fillStyle = PALETTE.handleFill;
    ctx.strokeStyle = PALETTE.handleBorder;
    ctx.lineWidth = Math.max(1.5 / scale, 30);

    const corners = [
      [x, y],
      [x + width, y],
      [x, y + depth],
      [x + width, y + depth],
    ];

    for (const [hx, hy] of corners) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    }
  }
}

/**
 * Converts 0-based row index to spreadsheet-style letters:
 * 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, 27 -> AB
 */
export function rowToLetter(rowIdx) {
  let res = '';
  let n = rowIdx;
  while (n >= 0) {
    res = String.fromCharCode(65 + (n % 26)) + res;
    n = Math.floor(n / 26) - 1;
  }
  return res;
}
