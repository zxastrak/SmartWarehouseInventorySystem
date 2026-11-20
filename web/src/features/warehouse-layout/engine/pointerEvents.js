/**
 * Pointer Events & Interaction Controller
 * Handles hit-testing, selection, drag-and-drop, pan, and zoom without triggering React state updates.
 */

import { screenToWorld, zoomAt, pan } from './viewport.js';
import { footprint, overlaps } from '../../../../../shared/layout-core/src/geometry.js';
import { rowToLetter } from './renderer.js';

export class PointerController {
  /**
   * @param {HTMLCanvasElement} canvasElement - Top interactive overlay canvas
   * @param {Object} options
   */
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.canvas.style.touchAction = 'none';

    this.options = options;
    this.viewport = options.viewport || { scale: 0.02, tx: 50, ty: 50 };
    this.snapshot = options.snapshot || null;
    this.spatialHash = options.spatialHash || null;

    // Active Tool ('select' / Move | 'hand' / Hand tool)
    this.activeTool = options.activeTool || 'select';
    this.isSpacePressed = false;

    // Slot Fill & Snapping Configuration
    this.slotConfig = options.slotConfig || { lengthMm: 700, depthMm: 500, heightMm: 400 };
    this.slotRotated = options.slotRotated || false;
    this.isFillSlotMode = options.isFillSlotMode ?? false;
    this.activeColorHex = options.activeColorHex || '#5c732b';
    this.slotFillGhost = null;
    this.slotFillStart = null;

    // Dock Fill Configuration
    this.isFillDockMode = options.isFillDockMode ?? false;
    this.dockFillGhost = null;
    this.dockFillStart = null;
    this.dockConfig = options.dockConfig || null;

    // Aisle (Jalan/Lorong/Forklift) Fill Configuration
    this.isFillAisleMode = options.isFillAisleMode ?? false;
    this.aisleFillGhost = null;
    this.aisleFillStart = null;
    this.aisleConfig = options.aisleConfig || null;

    // Interactive Stamp Placement Mode
    this.placementGhost = null;
    this.placementData = null;
    this.lastWorldPos = null;

    // Interaction State (Native variables, NOT React state!)
    this.selectedIds = new Set();
    this.selectedEntities = new Map();
    this.mode = 'idle'; // 'idle' | 'panning' | 'dragging' | 'rubberBand' | 'slotFill' | 'placement'
    this.pointerStart = { x: 0, y: 0 };
    this.worldStart = { wx: 0, wy: 0 };
    this.activePointerId = null;

    this.dragTarget = null;
    this.dragGhost = null;
    this.resizeTarget = null;
    this.resizeHandle = null;
    this.isColliding = false;
    this.rubberBandRect = null;

    // Callbacks
    this.onViewportChange = options.onViewportChange || null;
    this.onSelectionChange = options.onSelectionChange || null;
    this.onDragCommit = options.onDragCommit || null;
    this.onSlotFillCommit = options.onSlotFillCommit || null;
    this.onDockFillCommit = options.onDockFillCommit || null;
    this.onAisleFillCommit = options.onAisleFillCommit || null;
    this.onPlacementCommit = options.onPlacementCommit || null;
    this.onPlacementCancel = options.onPlacementCancel || null;
    this.onPlacementCollision = options.onPlacementCollision || null;
    this.onRenderRequest = options.onRenderRequest || null;

    // Bind event listeners
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onWheel = this._onWheel.bind(this);

    this._attach();
  }

  _attach() {
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('pointercancel', this._onPointerUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this._onContextMenu = (e) => {
      if (this.mode === 'placement') {
        e.preventDefault();
        this.cancelPlacement();
      }
    };
    this.canvas.addEventListener('contextmenu', this._onContextMenu);

    // Space key handlers for temporary Hand tool / panning
    this._onKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        this._updateCursor();
      }
    };
    this._onKeyUp = (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this._updateCursor();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    if (this._onContextMenu) {
      this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    }
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    if (this._onKeyUp) {
      window.removeEventListener('keyup', this._onKeyUp);
    }
  }

  setActiveTool(tool) {
    this.activeTool = tool || 'select';
    if (this.activeTool === 'select') {
      this.isFillDockMode = false;
      this.isFillAisleMode = false;
      this.isFillSlotMode = false;
      if (this.mode === 'placement') {
        this.cancelPlacement();
      }
    }
    this._updateCursor();
  }

  _updateCursor() {
    if (!this.canvas) return;
    if (this.activeTool === 'hand' || this.isSpacePressed) {
      this.canvas.style.cursor = this.mode === 'panning' ? 'grabbing' : 'grab';
    } else if (this.isFillDockMode || this.isFillAisleMode || this.isFillSlotMode || this.mode === 'placement') {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  updateData(snapshot, spatialHash, viewport) {
    this.snapshot = snapshot;
    this.spatialHash = spatialHash;
    if (viewport) this.viewport = viewport;
  }

  updateSlotConfig(config, rotated, fillMode, colorHex) {
    if (config) this.slotConfig = config;
    if (typeof rotated === 'boolean') this.slotRotated = rotated;
    if (typeof fillMode === 'boolean') {
      this.isFillSlotMode = fillMode;
      if (fillMode) {
        this.isFillDockMode = false;
        this.isFillAisleMode = false;
      }
    }
    if (colorHex) this.activeColorHex = colorHex;
  }

  updateDockFillMode(fillMode, config) {
    if (typeof fillMode === 'boolean') {
      this.isFillDockMode = fillMode;
      if (fillMode) {
        this.isFillSlotMode = false;
        this.isFillAisleMode = false;
        if (this.canvas) this.canvas.style.cursor = 'crosshair';
      } else if (!this.isFillSlotMode && !this.isFillAisleMode && this.mode !== 'placement') {
        if (this.canvas) this.canvas.style.cursor = 'default';
      }
    }
    if (config) {
      this.dockConfig = config;
    }
  }

  updateAisleFillMode(fillMode, config) {
    if (typeof fillMode === 'boolean') {
      this.isFillAisleMode = fillMode;
      if (fillMode) {
        this.isFillSlotMode = false;
        this.isFillDockMode = false;
        if (this.canvas) this.canvas.style.cursor = 'crosshair';
      } else if (!this.isFillSlotMode && !this.isFillDockMode && this.mode !== 'placement') {
        if (this.canvas) this.canvas.style.cursor = 'default';
      }
    }
    if (config) {
      this.aisleConfig = config;
    }
  }

  getSlotDimensions() {
    const cfg = this.slotConfig || { lengthMm: 700, depthMm: 500 };
    const baseW = cfg.lengthMm || 700;
    const baseD = cfg.depthMm || 500;
    return {
      slotW: this.slotRotated ? baseD : baseW,
      slotD: this.slotRotated ? baseW : baseD,
    };
  }

  /**
   * Mengumpulkan bounding box seluruh rak yang ada pada denah
   * @param {string|number|null} [excludeId]
   * @returns {Array<Object>}
   */
  _getRackBoxes(excludeId = null) {
    if (!this.snapshot) return [];
    const boxes = [];
    if (Array.isArray(this.snapshot.racks)) {
      for (const r of this.snapshot.racks) {
        if (r.retired_at) continue;
        if (excludeId && (String(r.id) === String(excludeId) || String(r.client_ref) === String(excludeId))) continue;
        const fp = footprint(r.length_mm, r.depth_mm, r.rotation || 0);
        boxes.push({
          id: r.id,
          type: 'rack',
          rack_code: r.rack_code,
          x: r.x_mm,
          y: r.y_mm,
          width: fp.width,
          depth: fp.depth,
          left: r.x_mm,
          right: r.x_mm + fp.width,
          top: r.y_mm,
          bottom: r.y_mm + fp.depth,
        });
      }
    }
    if (Array.isArray(this.snapshot.layout_objects)) {
      for (const o of this.snapshot.layout_objects) {
        if (excludeId && (String(o.id) === String(excludeId) || String(o.client_ref) === String(excludeId))) continue;
        if (o.object_type !== 'door_entry' && o.object_type !== 'door_exit') {
          const w = o.width_mm || 2000;
          const d = o.length_mm || 2000;
          boxes.push({
            id: o.id,
            type: 'layout_object',
            name: o.name,
            x: o.x_mm,
            y: o.y_mm,
            width: w,
            depth: d,
            left: o.x_mm,
            right: o.x_mm + w,
            top: o.y_mm,
            bottom: o.y_mm + d,
          });
        }
      }
    }
    return boxes;
  }

  /**
   * Fitur 2: Snap to Clearance & Auto-Fit Jalan ke Celah Rak
   * Menjamin jalan dan rak TIDAK TABRAKAN:
   * - Mendeteksi tepi rak terdekat di kiri/kanan atau atas/bawah
   * - Jika lebar/kedalaman jalan melebihi celah aktual antar rak, otomatis auto-fit selebar celah
   * - Menempelkan sisi luar jalan ke sisi luar rak secara presisi (zero collision)
   */
  _snapAisleToRackClearance(rect, excludeAisleId = null, forcedOrientation = null, isForklift = false) {
    let { x, y, width, depth } = rect;
    let isAutoFitted = false;
    const rackBoxes = this._getRackBoxes(excludeAisleId);
    if (rackBoxes.length === 0) {
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
      const clampedW = Math.min(Math.max(150, width), wh.width_mm);
      const clampedD = Math.min(Math.max(150, depth), wh.length_mm);
      const clampedX = Math.max(0, Math.min(wh.width_mm - clampedW, x));
      const clampedY = Math.max(0, Math.min(wh.length_mm - clampedD, y));
      return { x: Math.round(clampedX), y: Math.round(clampedY), width: Math.round(clampedW), depth: Math.round(clampedD), isAutoFitted: false };
    }

    const isVerticalAisle = forcedOrientation === 'vertical' || (forcedOrientation === null && depth > width);

    const fitHorizontalGap = () => {
      const yOverlapping = rackBoxes.filter((r) => r.top < y + depth && r.bottom > y);
      if (yOverlapping.length > 0) {
        const leftRacks = yOverlapping.filter((r) => r.right <= x + 400 || (r.left < x && r.right < x + width));
        const rightRacks = yOverlapping.filter((r) => r.left >= x - 200 && r.left > x);

        const validLeft = leftRacks.filter((l) => !rightRacks.some((r) => r.id === l.id));
        const validRight = rightRacks.filter((r) => !leftRacks.some((l) => l.id === r.id));

        const maxLeftEdge = validLeft.length > 0 ? Math.max(...validLeft.map((r) => r.right)) : null;
        const minRightEdge = validRight.length > 0 ? Math.min(...validRight.map((r) => r.left)) : null;

        if (maxLeftEdge !== null && minRightEdge !== null && minRightEdge > maxLeftEdge) {
          const availableGap = minRightEdge - maxLeftEdge;
          if (availableGap < width) {
            // Celah lebih sempit dari lebar jalan -> jika bukan forklift, auto-fit. Jika forklift, lebar dikunci!
            if (!isForklift && availableGap >= 150) {
              x = maxLeftEdge;
              width = availableGap;
              isAutoFitted = true;
            }
          } else {
            // Celah cukup lebar / lebih besar dari jalan -> JANGAN diperlebar! Tetap gunakan lebar yang diminta.
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
              if (!isForklift) {
                width = Math.min(width, Math.max(150, minRightEdge - x));
              } else {
                x = minRightEdge - width;
              }
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
            // Celah lebih sempit dari kedalaman jalan -> jika bukan forklift, auto-fit. Jika forklift, lebar dikunci!
            if (!isForklift && availableGap >= 150) {
              y = maxTopEdge;
              depth = availableGap;
              isAutoFitted = true;
            }
          } else {
            // Celah cukup lebar / lebih besar dari jalan -> JANGAN diperlebar! Tetap gunakan kedalaman yang diminta.
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
              if (!isForklift) {
                depth = Math.min(depth, Math.max(150, minBottomEdge - y));
              } else {
                y = minBottomEdge - depth;
              }
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

    // 3. Fallback pemangkasan presisi jika masih ada tumpang-tindih fisik dengan rak manapun
    if (!isForklift) {
      for (const r of rackBoxes) {
        if (overlaps({ x, y, width, depth }, r)) {
          const overlapL = (x + width) - r.left;
          const overlapR = r.right - x;
          const overlapT = (y + depth) - r.top;
          const overlapB = r.bottom - y;
          const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);

          if (minOverlap === overlapT && r.top > y) {
            depth = Math.max(150, r.top - y);
            isAutoFitted = true;
          } else if (minOverlap === overlapB && r.bottom < y + depth) {
            const shift = r.bottom - y;
            y = r.bottom;
            depth = Math.max(150, depth - shift);
            isAutoFitted = true;
          } else if (minOverlap === overlapL && r.left > x) {
            width = Math.max(150, r.left - x);
            isAutoFitted = true;
          } else if (minOverlap === overlapR && r.right < x + width) {
            const shift = r.right - x;
            x = r.right;
            width = Math.max(150, width - shift);
            isAutoFitted = true;
          }
        }
      }
    }

    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    const clampedW = Math.min(Math.max(150, width), wh.width_mm);
    const clampedD = Math.min(Math.max(150, depth), wh.length_mm);
    const clampedX = Math.max(0, Math.min(wh.width_mm - clampedW, x));
    const clampedY = Math.max(0, Math.min(wh.length_mm - clampedD, y));

    return {
      x: Math.round(clampedX),
      y: Math.round(clampedY),
      width: Math.round(clampedW),
      depth: Math.round(clampedD),
      isAutoFitted,
    };
  }

  /**
   * Reverse Z-order hit testing: Racks -> Aisles -> Objects -> Zones
   */
  hitTest(wx, wy) {
    if (!this.snapshot) return null;

    // 1. Racks (topmost)
    if (Array.isArray(this.snapshot.racks)) {
      for (let i = this.snapshot.racks.length - 1; i >= 0; i--) {
        const r = this.snapshot.racks[i];
        const box = footprint(r.length_mm, r.depth_mm, r.rotation || 0);
        if (wx >= r.x_mm && wx <= r.x_mm + box.width && wy >= r.y_mm && wy <= r.y_mm + box.depth) {
          return { type: 'rack', item: r, box };
        }
      }
    }

    // 2. Aisles
    if (Array.isArray(this.snapshot.aisles)) {
      for (let i = this.snapshot.aisles.length - 1; i >= 0; i--) {
        const a = this.snapshot.aisles[i];
        if (wx >= a.x_mm && wx <= a.x_mm + a.width_mm && wy >= a.y_mm && wy <= a.y_mm + a.length_mm) {
          return { type: 'aisle', item: a };
        }
      }
    }

    // 3. Layout Objects
    if (Array.isArray(this.snapshot.layout_objects)) {
      for (let i = this.snapshot.layout_objects.length - 1; i >= 0; i--) {
        const o = this.snapshot.layout_objects[i];
        const w = o.width_mm || o.length_mm || 2000;
        const l = o.length_mm || o.depth_mm || 1000;
        if (wx >= o.x_mm && wx <= o.x_mm + w && wy >= o.y_mm && wy <= o.y_mm + l) {
          return { type: 'layout_object', item: o };
        }
      }
    }

    return null;
  }

  /**
   * Hit-testing resize handles on currently selected objects (dok, lorong, dsb.)
   */
  _getHandleUnderPointer(wx, wy) {
    if (!this.selectedIds || this.selectedIds.size === 0 || !this.snapshot) return null;
    const scale = this.viewport?.scale || 0.015;
    const hitRadius = Math.max(12 / scale, 250);

    for (const rawId of this.selectedIds) {
      let type = 'layout_object';
      let entity = (this.snapshot.layout_objects || []).find((o) => String(o.id) === String(rawId));
      if (!entity) {
        type = 'aisle';
        entity = (this.snapshot.aisles || []).find((a) => String(a.id) === String(rawId));
      }
      if (!entity) continue; // Untuk rak atau zona tidak menggunakan free-handle resize

      const x = entity.x_mm;
      const y = entity.y_mm;
      const width = entity.width_mm || 2000;
      const depth = entity.length_mm || 2000;

      const isForklift = type === 'aisle' && (
        entity.type === 'forklift' ||
        String(entity.name || '').toLowerCase().includes('forklift') ||
        entity.direction === 'forklift'
      );
      const isHoriz = width >= depth;

      let handles;
      if (isForklift) {
        // "kunci lebar forklift sesuai dengan yang diinput oleh user, jadi khusus forklift tidak bisa membesar atau mengecil"
        // Hanya sediakan handle di sepanjang koridor jalan untuk memperpanjang/memperpendek; lebar penampang terkunci
        if (isHoriz) {
          handles = [
            { id: 'w', x: x, y: y + depth / 2, cursor: 'ew-resize' },
            { id: 'e', x: x + width, y: y + depth / 2, cursor: 'ew-resize' },
          ];
        } else {
          handles = [
            { id: 'n', x: x + width / 2, y: y, cursor: 'ns-resize' },
            { id: 's', x: x + width / 2, y: y + depth, cursor: 'ns-resize' },
          ];
        }
      } else {
        handles = [
          // 4 titik tengah sisi
          { id: 'n', x: x + width / 2, y: y, cursor: 'ns-resize' },
          { id: 's', x: x + width / 2, y: y + depth, cursor: 'ns-resize' },
          { id: 'w', x: x, y: y + depth / 2, cursor: 'ew-resize' },
          { id: 'e', x: x + width, y: y + depth / 2, cursor: 'ew-resize' },
          // 4 sudut
          { id: 'nw', x: x, y: y, cursor: 'nwse-resize' },
          { id: 'se', x: x + width, y: y + depth, cursor: 'nwse-resize' },
          { id: 'ne', x: x + width, y: y, cursor: 'nesw-resize' },
          { id: 'sw', x: x, y: y + depth, cursor: 'nesw-resize' },
        ];
      }

      for (const h of handles) {
        if (Math.abs(wx - h.x) <= hitRadius && Math.abs(wy - h.y) <= hitRadius) {
          return {
            handle: h.id,
            cursor: h.cursor,
            entity,
            type,
            x,
            y,
            width,
            depth,
          };
        }
      }
    }
    return null;
  }

  _onPointerDown(e) {
    if (this.mode === 'placement') {
      if (e.button === 0) {
        // Klik kiri: Commit penempatan rak jika tidak tumpang tindih
        if (this.placementGhost) {
          if (this.placementGhost.isColliding) {
            if (this.onPlacementCollision) {
              this.onPlacementCollision(this.placementGhost);
            }
            return;
          }
          if (this.onPlacementCommit) {
            const commitData = {
              ...this.placementData,
              x_mm: this.placementGhost.x_mm,
              y_mm: this.placementGhost.y_mm,
              rotation: this.placementGhost.rotation || 0,
              bay_count: this.placementGhost.bay_count,
              slotW: this.placementGhost.slotW,
              slotD: this.placementGhost.slotD,
              slot_rotated: (this.placementGhost.rotation || 0) % 180 !== 0,
            };
            this.cancelPlacement();
            this.onPlacementCommit(commitData);
          } else {
            this.cancelPlacement();
          }
        } else {
          this.cancelPlacement();
        }
      } else if (e.button === 2) {
        // Klik kanan: Batal penempatan
        e.preventDefault();
        this.cancelPlacement();
      }
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { wx, wy } = screenToWorld(sx, sy, this.viewport);

    this.pointerStart = { x: sx, y: sy };
    this.worldStart = { wx, wy };
    this.activePointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);

    // Pan dengan Hand tool, Space held, middle click (button = 1), right click (button = 2), Space + Click, atau Alt + Click
    if (this.activeTool === 'hand' || this.isSpacePressed || e.button === 1 || e.button === 2 || e.spaceKey || e.altKey) {
      this.mode = 'panning';
      if (this.canvas) this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Cek apakah kursor mengklik salah satu handle pada objek yang sedang diseleksi (melebarkan salah satu sisi)
    const handleHit = this._getHandleUnderPointer(wx, wy);
    if (handleHit && e.button === 0) {
      this.mode = 'resizing';
      this.resizeHandle = handleHit.handle;
      this.resizeTarget = {
        type: handleHit.type,
        id: handleHit.entity.id,
        item: handleHit.entity,
        origX: handleHit.x,
        origY: handleHit.y,
        origW: handleHit.width,
        origD: handleHit.depth,
      };
      this.dragGhost = {
        x_mm: handleHit.x,
        y_mm: handleHit.y,
        width: handleHit.width,
        depth: handleHit.depth,
      };
      this.isColliding = false;
      this._requestRender(true);
      return;
    }

    // Hit-testing objek di bawah kursor (prioritaskan seleksi & pergeseran setiap objek)
    const hit = this.hitTest(wx, wy);

    // Jika alat aktif adalah Move ('select') atau kursor persis mengklik objek yang sudah ada:
    // Masuk langsung ke mode seleksi & pergeseran (dragging)
    if (hit) {
      const entity = hit.item;
      const isShift = e.shiftKey;

      if (isShift) {
        if (this.selectedIds.has(entity.id)) {
          this.selectedIds.delete(entity.id);
          this.selectedEntities.delete(entity.id);
        } else {
          this.selectedIds.add(entity.id);
          this.selectedEntities.set(entity.id, { type: hit.type, id: entity.id });
        }
      } else if (!this.selectedIds.has(entity.id)) {
        this.selectedIds.clear();
        this.selectedEntities.clear();
        this.selectedIds.add(entity.id);
        this.selectedEntities.set(entity.id, { type: hit.type, id: entity.id });
      }

      this.mode = 'dragging';
      this.dragTarget = { type: hit.type, id: entity.id, item: entity };
      const box = hit.type === 'rack'
        ? footprint(entity.length_mm, entity.depth_mm, entity.rotation || 0)
        : { width: entity.width_mm || entity.length_mm || 2000, depth: entity.length_mm || entity.depth_mm || 2000 };
      this.dragGhost = {
        x_mm: entity.x_mm,
        y_mm: entity.y_mm,
        width: box.width,
        depth: box.depth,
      };
      this.isColliding = false;

      if (this.onSelectionChange) {
        this.onSelectionChange(Array.from(this.selectedEntities.values()));
      }
      this._requestRender();
      return;
    }

    // 1. Mode Drag & Fill Dok (Bila aktif pada area kosong)
    if (this.isFillDockMode && e.button === 0) {
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
      const { slotW, slotD } = this.getSlotDimensions();
      const GRID_X = slotW;
      const GRID_Y = slotD;
      const maxSafeCols = Math.max(1, Math.floor(wh.width_mm / GRID_X));
      const maxSafeRows = Math.max(1, Math.floor(wh.length_mm / GRID_Y));
      const c0 = Math.max(0, Math.min(maxSafeCols - 1, Math.floor(wx / GRID_X)));
      const r0 = Math.max(0, Math.min(maxSafeRows - 1, Math.floor(wy / GRID_Y)));

      const defaultW = Math.min(wh.width_mm, Math.max(1000, Math.round((Number(this.dockConfig?.widthM) || 4) * 1000)));
      const defaultL = Math.min(wh.length_mm, Math.max(1000, Math.round((Number(this.dockConfig?.lengthM) || 6) * 1000)));
      const dockName = this.dockConfig?.name || 'Dok Standar';

      const x_mm = Math.max(0, Math.min(wh.width_mm - defaultW, c0 * GRID_X));
      const y_mm = Math.max(0, Math.min(wh.length_mm - defaultL, r0 * GRID_Y));

      this.mode = 'dockFill';
      this.dockFillStart = { c: c0, r: r0, wx: x_mm, wy: y_mm };
      this.dockFillGhost = {
        x_mm,
        y_mm,
        width_mm: defaultW,
        length_mm: defaultL,
        name: dockName,
        isClickPlacement: true,
      };
      this._requestRender(true);
      return;
    }

    // 1b. Mode Drag & Fill Jalan / Lorong / Forklift
    if (this.isFillAisleMode && e.button === 0) {
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
      const { slotW, slotD } = this.getSlotDimensions();
      const GRID_X = slotW;
      const GRID_Y = slotD;
      const maxSafeCols = Math.max(1, Math.floor(wh.width_mm / GRID_X));
      const maxSafeRows = Math.max(1, Math.floor(wh.length_mm / GRID_Y));
      const c0 = Math.max(0, Math.min(maxSafeCols - 1, Math.floor(wx / GRID_X)));
      const r0 = Math.max(0, Math.min(maxSafeRows - 1, Math.floor(wy / GRID_Y)));

      const isForklift = this.aisleConfig?.type === 'forklift' || String(this.aisleConfig?.name || '').toLowerCase().includes('forklift');
      const isPedestrian = this.aisleConfig?.type === 'pedestrian';
      const defaultW = Math.min(wh.width_mm, Math.max(300, Math.round((Number(this.aisleConfig?.widthM) || (isForklift ? 3 : isPedestrian ? 1 : 1.5)) * 1000)));
      const defaultL = isPedestrian ? GRID_Y : Math.min(wh.length_mm, 3000);
      const aisleName = this.aisleConfig?.name || (isForklift ? 'Jalur Forklift' : isPedestrian ? 'Jalur Penghubung' : 'Jalan Lorong');
      const aisleCode = this.aisleConfig?.code || (isForklift ? 'FK' : isPedestrian ? 'P' : 'A');

      const rawGhost = {
        x: Math.max(0, Math.min(wh.width_mm - defaultW, c0 * GRID_X)),
        y: Math.max(0, Math.min(wh.length_mm - defaultL, r0 * GRID_Y)),
        width: defaultW,
        depth: defaultL,
      };
      const fitted = this._snapAisleToRackClearance(rawGhost, null, null, isForklift);
      const clampedW = Math.min(wh.width_mm, fitted.width);
      const clampedL = Math.min(wh.length_mm, fitted.depth);
      const clampedX = Math.max(0, Math.min(wh.width_mm - clampedW, fitted.x));
      const clampedY = Math.max(0, Math.min(wh.length_mm - clampedL, fitted.y));

      this.mode = 'aisleFill';
      this.dockFillStart = null;
      this.aisleFillStart = { c: c0, r: r0, wx: clampedX, wy: clampedY };

      const isDock = (cid) => {
        if (!String(cid).startsWith('layout_object:')) return false;
        const rawId = cid.replace('layout_object:', '');
        const obj = this.snapshot?.layout_objects?.find((o) => String(o.id) === String(rawId));
        return obj && String(obj.object_type || '').includes('dock');
      };

      const queryHits = this.spatialHash
        ? this.spatialHash.query({
            x: clampedX,
            y: clampedY,
            width: clampedW,
            depth: clampedL,
          })
        : [];

      const rackOrObjCollisions = queryHits.filter((cid) => {
        if (String(cid).startsWith('aisle:')) return false;
        if (isForklift && isDock(cid)) return false; // Forklift bisa menimpa dok!
        return true;
      });

      const isColliding = rackOrObjCollisions.length > 0;
      const collisionReason = rackOrObjCollisions.length > 0 ? 'rack' : null;

      this.aisleFillGhost = {
        x_mm: clampedX,
        y_mm: clampedY,
        width_mm: clampedW,
        length_mm: clampedL,
        isAutoFitted: fitted.isAutoFitted,
        isColliding,
        collisionReason,
        type: this.aisleConfig?.type || 'standard',
        name: aisleName,
        aisle_code: aisleCode,
        direction: this.aisleConfig?.direction || 'two_way',
        isClickPlacement: true,
      };
      this._requestRender(true);
      return;
    }

    // 2. Mode Drag & Fill Slot Rak (Prioritas utama bila aktif)
    if (this.isFillSlotMode && e.button === 0) {
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
      const { slotW, slotD } = this.getSlotDimensions();
      const maxSafeCols = Math.max(1, Math.floor(wh.width_mm / slotW));
      const maxSafeRows = Math.max(1, Math.floor(wh.length_mm / slotD));
      const c0 = Math.max(0, Math.min(maxSafeCols - 1, Math.floor(wx / slotW)));
      const r0 = Math.max(0, Math.min(maxSafeRows - 1, Math.floor(wy / slotD)));

      this.mode = 'slotFill';
      this.slotFillStart = { c: c0, r: r0 };
      this.slotFillGhost = {
        x_mm: c0 * slotW,
        y_mm: r0 * slotD,
        width_mm: slotW,
        depth_mm: slotD,
        bayCount: 1,
        depthCount: 1,
        minC: c0,
        maxC: c0,
        minR: r0,
        maxR: r0,
        startCol: c0 + 1,
        endCol: c0 + 1,
        rowLetter: rowToLetter(r0),
        color_hex: this.activeColorHex,
        slotW,
        slotD,
      };
      this._requestRender(true);
      return;
    }

    // Klik pada canvas kosong
    if (!e.shiftKey) {
      this.selectedIds.clear();
      this.selectedEntities.clear();
      if (this.onSelectionChange) {
        this.onSelectionChange([]);
      }
    }

    if (e.button === 0) {
      // Klik kiri tahan di ruang kosong -> Mode Rubber-Band Marquee Selection Box
      this.mode = 'rubberBand';
      this.rubberBandRect = null;
      this._requestRender();
    } else {
      // Klik selain tombol kiri (misal tengah/kanan) -> Pan kanvas
      this.mode = 'panning';
      this._requestRender();
    }
  }

  _onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { wx, wy } = screenToWorld(sx, sy, this.viewport);
    this.lastWorldPos = { wx, wy };

    if (this.mode === 'placement') {
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
      const { slotW, slotD } = this.getSlotDimensions();
      const ghostW = this.placementGhost?.width_mm || slotW;
      const ghostD = this.placementGhost?.depth_mm || slotD;

      const maxX = Math.max(0, wh.width_mm - ghostW);
      const maxY = Math.max(0, wh.length_mm - ghostD);

      const c = Math.max(0, Math.floor(wx / slotW));
      const r = Math.max(0, Math.floor(wy / slotD));

      const snappedX = Math.max(0, Math.min(maxX, c * slotW));
      const snappedY = Math.max(0, Math.min(maxY, r * slotD));

      if (this.placementGhost) {
        this.placementGhost.x_mm = snappedX;
        this.placementGhost.y_mm = snappedY;
        this.placementGhost.col = Math.floor(snappedX / slotW) + 1;
        this.placementGhost.rowLetter = rowToLetter(Math.floor(snappedY / slotD));

        if (this.spatialHash) {
          const collisions = this.spatialHash.query({
            x: snappedX,
            y: snappedY,
            width: this.placementGhost.width_mm,
            depth: this.placementGhost.depth_mm,
          });
          this.placementGhost.isColliding = collisions.length > 0;
        }

        this._requestRender(true);
      }
      return;
    }

    if (this.activePointerId !== e.pointerId) {
      if (this.activeTool === 'hand' || this.isSpacePressed) {
        if (this.canvas && this.canvas.style.cursor !== 'grab') {
          this.canvas.style.cursor = 'grab';
        }
      } else if (this.activeTool === 'select' && !this.isFillDockMode && !this.isFillAisleMode && !this.isFillSlotMode && this.mode !== 'placement') {
        const handleHit = this._getHandleUnderPointer(wx, wy);
        if (handleHit) {
          if (this.canvas && this.canvas.style.cursor !== handleHit.cursor) {
            this.canvas.style.cursor = handleHit.cursor;
          }
          return;
        }

        const hit = this.hitTest(wx, wy);
        if (hit) {
          if (this.canvas && this.canvas.style.cursor !== 'move') {
            this.canvas.style.cursor = 'move';
          }
        } else {
          if (this.canvas && this.canvas.style.cursor !== 'default') {
            this.canvas.style.cursor = 'default';
          }
        }
      }
      return;
    }

    if (this.mode === 'resizing' && this.resizeTarget && this.dragGhost) {
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
      const { origX, origY, origW, origD } = this.resizeTarget;
      const handle = this.resizeHandle;

      // Snap ke grid 500mm
      const SNAP = 500;
      const snappedWx = Math.round(wx / SNAP) * SNAP;
      const snappedWy = Math.round(wy / SNAP) * SNAP;

      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newD = origD;

      const MIN_SIZE = 500;

      if (handle === 'w' || handle === 'nw' || handle === 'sw') {
        const rightEdge = origX + origW;
        newX = Math.max(0, Math.min(rightEdge - MIN_SIZE, snappedWx));
        newW = rightEdge - newX;
      }
      if (handle === 'e' || handle === 'ne' || handle === 'se') {
        newW = Math.max(MIN_SIZE, Math.min(wh.width_mm - origX, snappedWx - origX));
      }
      if (handle === 'n' || handle === 'nw' || handle === 'ne') {
        const bottomEdge = origY + origD;
        newY = Math.max(0, Math.min(bottomEdge - MIN_SIZE, snappedWy));
        newD = bottomEdge - newY;
      }
      if (handle === 's' || handle === 'sw' || handle === 'se') {
        newD = Math.max(MIN_SIZE, Math.min(wh.length_mm - origY, snappedWy - origY));
      }

      // Khusus Forklift: KUNCI LEBAR penampang sesuai input user (tidak boleh membesar atau mengecil)
      const isForklift = this.resizeTarget?.type === 'aisle' && (
        this.resizeTarget?.item?.type === 'forklift' ||
        String(this.resizeTarget?.item?.name || '').toLowerCase().includes('forklift') ||
        this.resizeTarget?.item?.direction === 'forklift'
      );
      if (isForklift) {
        const isHoriz = origW >= origD;
        if (isHoriz) {
          newD = origD;
          newY = origY;
        } else {
          newW = origW;
          newX = origX;
        }
      }

      this.dragGhost.x_mm = newX;
      this.dragGhost.y_mm = newY;
      this.dragGhost.width = newW;
      this.dragGhost.depth = newD;

      this._requestRender(true);
      return;
    }

    if (this.mode === 'panning') {
      const dx = sx - this.pointerStart.x;
      const dy = sy - this.pointerStart.y;
      const nextVp = pan(dx, dy, this.viewport);
      // Excel model clamping with margin (24px ruler + 60px margin = 84px)
      const maxOffset = 84;
      if (nextVp.tx > maxOffset) nextVp.tx = maxOffset;
      if (nextVp.ty > maxOffset) nextVp.ty = maxOffset;
      this.viewport = nextVp;
      this.pointerStart = { x: sx, y: sy };

      if (this.onViewportChange) {
        this.onViewportChange(this.viewport);
      }
      this._requestRender();
    } else if (this.mode === 'dragging' && this.dragTarget && this.dragGhost) {
      const { wx, wy } = screenToWorld(sx, sy, this.viewport);
      const dwx = wx - this.worldStart.wx;
      const dwy = wy - this.worldStart.wy;

      const isDoor = this.dragTarget.type === 'layout_object' && String(this.dragTarget.item?.object_type || '').includes('door');

      if (isDoor) {
        const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
        const whW = wh.width_mm;
        const whL = wh.length_mm;

        const rawDoorSpan = Math.max(1000, Math.max(this.dragTarget.item?.width_mm || 3000, this.dragTarget.item?.length_mm || 3000));
        const doorSpan = Math.min(Math.min(whW, whL), rawDoorSpan);
        const dLeft = Math.abs(wx);
        const dRight = Math.abs(whW - wx);
        const dTop = Math.abs(wy);
        const dBottom = Math.abs(whL - wy);
        const minDist = Math.min(dLeft, dRight, dTop, dBottom);

        let snapX = 0;
        let snapY = 0;
        let snapW = doorSpan;
        let snapL = 600;

        if (minDist === dLeft) {
          snapX = 0;
          snapY = Math.max(0, Math.min(whL - doorSpan, Math.round(wy / 500) * 500));
          snapW = 600;
          snapL = doorSpan;
        } else if (minDist === dRight) {
          snapX = Math.max(0, whW - 600);
          snapY = Math.max(0, Math.min(whL - doorSpan, Math.round(wy / 500) * 500));
          snapW = 600;
          snapL = doorSpan;
        } else if (minDist === dTop) {
          snapX = Math.max(0, Math.min(whW - doorSpan, Math.round(wx / 500) * 500));
          snapY = 0;
          snapW = doorSpan;
          snapL = 600;
        } else {
          snapX = Math.max(0, Math.min(whW - doorSpan, Math.round(wx / 500) * 500));
          snapY = Math.max(0, whL - 600);
          snapW = doorSpan;
          snapL = 600;
        }

        this.dragGhost.x_mm = snapX;
        this.dragGhost.y_mm = snapY;
        this.dragGhost.width = snapW;
        this.dragGhost.depth = snapL;
      } else if (this.dragTarget.type === 'aisle') {
        const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
        const whW = wh.width_mm;
        const whL = wh.length_mm;
        const origX = this.dragTarget.item?.x_mm ?? 0;
        const origY = this.dragTarget.item?.y_mm ?? 0;
        const targetW = Math.min(whW, this.dragTarget.item?.width_mm || 2000);
        const targetL = Math.min(whL, this.dragTarget.item?.length_mm || 5000);
        const rawX = Math.max(0, Math.min(whW - targetW, origX + dwx));
        const rawY = Math.max(0, Math.min(whL - targetL, origY + dwy));

        const isForklift = this.dragTarget.item?.type === 'forklift' ||
          String(this.dragTarget.item?.name || '').toLowerCase().includes('forklift') ||
          this.dragTarget.item?.direction === 'forklift';

        // Fitur 2: Snap to Clearance & Auto-Fit ke Celah Rak
        const fitted = this._snapAisleToRackClearance({
          x: rawX,
          y: rawY,
          width: targetW,
          depth: targetL,
        }, this.dragTarget.id, null, isForklift);

        const clampedW = Math.min(whW, fitted.width);
        const clampedL = Math.min(whL, fitted.depth);
        const clampedX = Math.max(0, Math.min(whW - clampedW, fitted.x));
        const clampedY = Math.max(0, Math.min(whL - clampedL, fitted.y));

        this.dragGhost.x_mm = clampedX;
        this.dragGhost.y_mm = clampedY;
        this.dragGhost.width = clampedW;
        this.dragGhost.depth = clampedL;
        this.dragGhost.isAutoFitted = fitted.isAutoFitted;
      } else {
        const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
        const whW = wh.width_mm;
        const whL = wh.length_mm;
        const origX = this.dragTarget.item?.x_mm ?? this.dragTarget.x_mm ?? 0;
        const origY = this.dragTarget.item?.y_mm ?? this.dragTarget.y_mm ?? 0;
        const targetW = this.dragGhost.width || 1000;
        const targetD = this.dragGhost.depth || 1000;
        const newX = origX + dwx;
        const newY = origY + dwy;

        this.dragGhost.x_mm = Math.max(0, Math.min(whW - targetW, newX));
        this.dragGhost.y_mm = Math.max(0, Math.min(whL - targetD, newY));
      }

      // Real-time broad-phase collision check via SpatialHash
      if (this.spatialHash && !isDoor) {
        const collisions = this.spatialHash.query(
          { x: this.dragGhost.x_mm, y: this.dragGhost.y_mm, width: this.dragGhost.width, depth: this.dragGhost.depth },
          `${this.dragTarget.type}:${this.dragTarget.id}`
        );
        const effectiveCollisions = this.dragTarget.type === 'aisle'
          ? collisions.filter((cid) => !String(cid).startsWith('aisle:'))
          : collisions;
        this.isColliding = effectiveCollisions.length > 0;
      }

      this._requestRender(true);
    } else if (this.mode === 'rubberBand') {
      const { wx, wy } = screenToWorld(sx, sy, this.viewport);
      const minX = Math.min(this.worldStart.wx, wx);
      const minY = Math.min(this.worldStart.wy, wy);
      const w = Math.abs(wx - this.worldStart.wx);
      const d = Math.abs(wy - this.worldStart.wy);

      // Tampilkan kotak seleksi hanya bila jarak drag > 4px di layar
      const screenDist = Math.hypot(sx - this.pointerStart.x, sy - this.pointerStart.y);
      if (screenDist > 4) {
        this.rubberBandRect = { x: minX, y: minY, width: w, depth: d };
        this._requestRender(true);
      }
    } else if (this.mode === 'slotFill' && this.slotFillStart) {
      const { wx, wy } = screenToWorld(sx, sy, this.viewport);
      const { slotW, slotD } = this.getSlotDimensions();
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };

      const maxSafeCols = Math.max(1, Math.floor(wh.width_mm / slotW));
      const maxSafeRows = Math.max(1, Math.floor(wh.length_mm / slotD));

      const c1 = Math.max(0, Math.min(maxSafeCols - 1, Math.floor(wx / slotW)));
      const r1 = Math.max(0, Math.min(maxSafeRows - 1, Math.floor(wy / slotD)));

      const minC = Math.min(this.slotFillStart.c, c1);
      const maxC = Math.max(this.slotFillStart.c, c1);
      const minR = Math.min(this.slotFillStart.r, r1);
      const maxR = Math.max(this.slotFillStart.r, r1);

      const width_mm = (maxC - minC + 1) * slotW;
      const depth_mm = (maxR - minR + 1) * slotD;
      const x_mm = minC * slotW;
      const y_mm = minR * slotD;
      const bayCount = maxC - minC + 1;
      const depthCount = maxR - minR + 1;

      const isColliding = this.spatialHash
        ? this.spatialHash.query({ x: x_mm, y: y_mm, width: width_mm, depth: depth_mm }).length > 0
        : false;

      this.slotFillGhost = {
        x_mm,
        y_mm,
        width_mm,
        depth_mm,
        bayCount,
        depthCount,
        minC,
        maxC,
        minR,
        maxR,
        startCol: minC + 1,
        endCol: maxC + 1,
        rowLetter: rowToLetter(minR),
        color_hex: this.activeColorHex,
        slotW,
        slotD,
        isColliding,
      };

      this._requestRender(true);
    } else if (this.mode === 'dockFill' && this.dockFillStart) {
      const { wx, wy } = screenToWorld(sx, sy, this.viewport);
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
      const { slotW, slotD } = this.getSlotDimensions();
      const GRID_X = slotW;
      const GRID_Y = slotD;

      const maxSafeCols = Math.max(1, Math.floor(wh.width_mm / GRID_X));
      const maxSafeRows = Math.max(1, Math.floor(wh.length_mm / GRID_Y));
      const c1 = Math.max(0, Math.min(maxSafeCols - 1, Math.floor(wx / GRID_X)));
      const r1 = Math.max(0, Math.min(maxSafeRows - 1, Math.floor(wy / GRID_Y)));

      const minC = Math.min(this.dockFillStart.c, c1);
      const maxC = Math.max(this.dockFillStart.c, c1);
      const minR = Math.min(this.dockFillStart.r, r1);
      const maxR = Math.max(this.dockFillStart.r, r1);

      const colsDragged = maxC - minC + 1;
      const rowsDragged = maxR - minR + 1;

      const screenDist = Math.hypot(sx - this.pointerStart.x, sy - this.pointerStart.y);
      if (screenDist > 5 || colsDragged > 1 || rowsDragged > 1) {
        const x_mm = minC * GRID_X;
        const y_mm = minR * GRID_Y;
        const width_mm = Math.min(wh.width_mm - x_mm, colsDragged * GRID_X);
        const length_mm = Math.min(wh.length_mm - y_mm, rowsDragged * GRID_Y);

        const isColliding = this.spatialHash
          ? this.spatialHash.query({ x: x_mm, y: y_mm, width: width_mm, depth: length_mm }).length > 0
          : false;

        this.dockFillGhost = {
          x_mm,
          y_mm,
          width_mm,
          length_mm,
          name: this.dockConfig?.name || 'Area Dok Muat',
          isClickPlacement: false,
          isColliding,
        };
      }
      this._requestRender(true);
    } else if (this.mode === 'aisleFill' && this.aisleFillStart) {
      const { wx, wy } = screenToWorld(sx, sy, this.viewport);
      const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
      const { slotW, slotD } = this.getSlotDimensions();
      const GRID_X = slotW;
      const GRID_Y = slotD;

      const maxSafeCols = Math.max(1, Math.floor(wh.width_mm / GRID_X));
      const maxSafeRows = Math.max(1, Math.floor(wh.length_mm / GRID_Y));
      const c1 = Math.max(0, Math.min(maxSafeCols - 1, Math.floor(wx / GRID_X)));
      const r1 = Math.max(0, Math.min(maxSafeRows - 1, Math.floor(wy / GRID_Y)));

      const minC = Math.min(this.aisleFillStart.c, c1);
      const maxC = Math.max(this.aisleFillStart.c, c1);
      const minR = Math.min(this.aisleFillStart.r, r1);
      const maxR = Math.max(this.aisleFillStart.r, r1);

      const colsDragged = maxC - minC + 1;
      const rowsDragged = maxR - minR + 1;

      const screenDist = Math.hypot(sx - this.pointerStart.x, sy - this.pointerStart.y);
      if (screenDist > 5 || colsDragged > 1 || rowsDragged > 1) {
        const x_mm = minC * GRID_X;
        const y_mm = minR * GRID_Y;
        let width_mm = colsDragged * GRID_X;
        let length_mm = rowsDragged * GRID_Y;

        const isForklift = this.aisleConfig?.type === 'forklift' || String(this.aisleConfig?.name || '').toLowerCase().includes('forklift');
        const isPedestrian = this.aisleConfig?.type === 'pedestrian';
        const configuredW = Math.max(
          300,
          Math.round((Number(this.aisleConfig?.widthM) || (isForklift ? 3 : isPedestrian ? 1 : 1.5)) * 1000)
        );

        if (isForklift) {
          // Khusus forklift: kunci lebar penampang persis sesuai input user
          if (colsDragged >= rowsDragged) {
            length_mm = configuredW;
          } else {
            width_mm = configuredW;
          }
        } else {
          if (colsDragged === 1 && rowsDragged > 1) {
            width_mm = configuredW;
          } else if (rowsDragged === 1 && colsDragged > 1) {
            length_mm = configuredW;
          }
        }

        const dragOrientation = colsDragged > rowsDragged ? 'horizontal' : rowsDragged > colsDragged ? 'vertical' : null;

        // Fitur 2: Snap to Clearance & Auto-Fit to Rack Gap (Zero Collision)
        const fitted = this._snapAisleToRackClearance({
          x: x_mm,
          y: y_mm,
          width: width_mm,
          depth: length_mm,
        }, null, dragOrientation, isForklift);

        if (isForklift) {
          if (dragOrientation === 'horizontal' || (!dragOrientation && colsDragged >= rowsDragged)) {
            fitted.depth = configuredW;
          } else {
            fitted.width = configuredW;
          }
        }

        const clampedW = Math.min(wh.width_mm, fitted.width);
        const clampedL = Math.min(wh.length_mm, fitted.depth);
        const clampedX = Math.max(0, Math.min(wh.width_mm - clampedW, fitted.x));
        const clampedY = Math.max(0, Math.min(wh.length_mm - clampedL, fitted.y));

        const isDock = (cid) => {
          if (!String(cid).startsWith('layout_object:')) return false;
          const rawId = cid.replace('layout_object:', '');
          const obj = this.snapshot?.layout_objects?.find((o) => String(o.id) === String(rawId));
          return obj && String(obj.object_type || '').includes('dock');
        };

        const queryHits = this.spatialHash
          ? this.spatialHash.query({
              x: clampedX,
              y: clampedY,
              width: clampedW,
              depth: clampedL,
            })
          : [];

        const rackOrObjCollisions = queryHits.filter((cid) => {
          if (String(cid).startsWith('aisle:')) return false;
          if (isForklift && isDock(cid)) return false; // Forklift bisa menimpa dok!
          return true;
        });

        const isColliding = rackOrObjCollisions.length > 0;
        const collisionReason = rackOrObjCollisions.length > 0 ? 'rack' : null;

        this.aisleFillGhost = {
          x_mm: clampedX,
          y_mm: clampedY,
          width_mm: clampedW,
          length_mm: clampedL,
          isAutoFitted: fitted.isAutoFitted,
          isColliding,
          collisionReason,
          type: this.aisleConfig?.type || 'standard',
          name: this.aisleConfig?.name || (isForklift ? 'Jalur Forklift' : 'Jalan Lorong'),
          aisle_code: this.aisleConfig?.code || (isForklift ? 'FK' : 'A'),
          direction: this.aisleConfig?.direction || 'two_way',
          isClickPlacement: false,
        };
      }
      this._requestRender(true);
    }
  }

  _onPointerUp(e) {
    if (this.activePointerId === e.pointerId) {
      this.canvas.releasePointerCapture(e.pointerId);
      this.activePointerId = null;
    }

    if (this.mode === 'resizing' && this.resizeTarget && this.dragGhost) {
      const finalPosition = {
        type: this.resizeTarget.type || 'layout_object',
        id: this.resizeTarget.id,
        x_mm: this.dragGhost.x_mm,
        y_mm: this.dragGhost.y_mm,
        width: this.dragGhost.width,
        width_mm: this.dragGhost.width,
        depth: this.dragGhost.depth,
        length_mm: this.dragGhost.depth,
        isColliding: false,
        isResize: true,
      };

      if (this.onDragCommit) {
        this.onDragCommit(finalPosition);
      }

      this.dragGhost = null;
      this.resizeTarget = null;
      this.resizeHandle = null;
      this.mode = 'idle';
      this._requestRender();
      return;
    }

    if (this.mode === 'dragging' && this.dragTarget && this.dragGhost) {
      const finalPosition = {
        type: this.dragTarget.type || 'rack',
        id: this.dragTarget.id,
        x_mm: this.dragGhost.x_mm,
        y_mm: this.dragGhost.y_mm,
        width_mm: this.dragGhost.width,
        length_mm: this.dragGhost.depth,
        isColliding: this.isColliding,
      };

      if (this.onDragCommit) {
        this.onDragCommit(finalPosition);
      }

      this.dragGhost = null;
      this.dragTarget = null;
      this.isColliding = false;
      this._requestRender();
    } else if (this.mode === 'rubberBand') {
      if (this.rubberBandRect && this.snapshot) {
        if (!e.shiftKey) {
          this.selectedIds.clear();
          this.selectedEntities.clear();
        }

        // 1. Seleksi Racks
        if (Array.isArray(this.snapshot.racks)) {
          for (const r of this.snapshot.racks) {
            const box = footprint(r.length_mm, r.depth_mm, r.rotation || 0);
            const rRect = { x: r.x_mm, y: r.y_mm, width: box.width, depth: box.depth };
            if (overlaps(this.rubberBandRect, rRect)) {
              this.selectedIds.add(r.id);
              this.selectedEntities.set(r.id, { type: 'rack', id: r.id });
            }
          }
        }

        // 2. Seleksi Aisles (Jalan/Lorong & Jalur Forklift)
        if (Array.isArray(this.snapshot.aisles)) {
          for (const a of this.snapshot.aisles) {
            const aRect = { x: a.x_mm, y: a.y_mm, width: a.width_mm || 2000, depth: a.length_mm || 5000 };
            if (overlaps(this.rubberBandRect, aRect)) {
              this.selectedIds.add(a.id);
              this.selectedEntities.set(a.id, { type: 'aisle', id: a.id });
            }
          }
        }

        // 3. Seleksi Layout Objects (Pintu Masuk, Pintu Keluar, Dok, Rintangan)
        if (Array.isArray(this.snapshot.layout_objects)) {
          for (const o of this.snapshot.layout_objects) {
            const oWidth = o.width_mm || 2000;
            const oLength = o.length_mm || 1000;
            const oRect = { x: o.x_mm, y: o.y_mm, width: oWidth, depth: oLength };
            if (overlaps(this.rubberBandRect, oRect)) {
              this.selectedIds.add(o.id);
              this.selectedEntities.set(o.id, { type: 'layout_object', id: o.id });
            }
          }
        }

        if (this.onSelectionChange) {
          this.onSelectionChange(Array.from(this.selectedEntities.values()));
        }
      } else {
        // Klik di ruang kosong tanpa drag -> bersihkan seleksi
        if (!e.shiftKey) {
          this.selectedIds.clear();
          this.selectedEntities.clear();
          if (this.onSelectionChange) {
            this.onSelectionChange([]);
          }
        }
      }
      this.rubberBandRect = null;
      this._requestRender();
    } else if (this.mode === 'dockFill' && this.dockFillGhost) {
      const ghost = { ...this.dockFillGhost };
      this.dockFillGhost = null;
      this.dockFillStart = null;
      this.mode = 'idle';
      this._requestRender(true);

      if (this.onDockFillCommit) {
        this.onDockFillCommit(ghost);
      }
      return;
    } else if (this.mode === 'aisleFill' && this.aisleFillGhost) {
      const ghost = { ...this.aisleFillGhost };
      this.aisleFillGhost = null;
      this.aisleFillStart = null;
      this.mode = 'idle';
      this._requestRender(true);

      if (this.onAisleFillCommit) {
        this.onAisleFillCommit(ghost);
      }
      return;
    } else if (this.mode === 'slotFill' && this.slotFillGhost) {
      const ghost = { ...this.slotFillGhost };
      const hasCommitted = ghost.bayCount >= 1 && ghost.depthCount >= 1;
      this.slotFillGhost = null;
      this.slotFillStart = null;
      this.mode = 'idle';
      this._requestRender(true);

      if (hasCommitted && this.onSlotFillCommit) {
        this.onSlotFillCommit(ghost);
      }
      return;
    }

    this.mode = 'idle';
    this._updateCursor();
  }

  _onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.83;
    const nextVp = zoomAt(sx, sy, zoomFactor, this.viewport);
    // Excel model clamping with margin (24px ruler + 60px margin = 84px)
    const maxOffset = 84;
    if (nextVp.tx > maxOffset) nextVp.tx = maxOffset;
    if (nextVp.ty > maxOffset) nextVp.ty = maxOffset;
    this.viewport = nextVp;

    if (this.onViewportChange) {
      this.onViewportChange(this.viewport);
    }
    this._requestRender();
  }

  _requestRender(overlayOnly = false) {
    if (this.onRenderRequest) {
      this.onRenderRequest(overlayOnly);
    }
  }

  /**
   * Starts interactive stamp placement mode for a configured rack
   * @param {Object} rackData
   */
  startPlacement(rackData) {
    this.mode = 'placement';
    this.placementData = { ...rackData };
    const rot = rackData.rotation || 0;
    const fp = footprint(rackData.length_mm, rackData.depth_mm, rot);
    const { slotW, slotD } = this.getSlotDimensions();
    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };

    const initWx = this.lastWorldPos ? this.lastWorldPos.wx : ((-this.viewport.tx + 400) / this.viewport.scale);
    const initWy = this.lastWorldPos ? this.lastWorldPos.wy : ((-this.viewport.ty + 300) / this.viewport.scale);

    const maxX = Math.max(0, wh.width_mm - fp.width);
    const maxY = Math.max(0, wh.length_mm - fp.depth);
    const c = Math.max(0, Math.floor(initWx / slotW));
    const r = Math.max(0, Math.floor(initWy / slotD));
    const clampedX = Math.max(0, Math.min(maxX, c * slotW));
    const clampedY = Math.max(0, Math.min(maxY, r * slotD));

    const isColliding = this.spatialHash
      ? this.spatialHash.query({ x: clampedX, y: clampedY, width: fp.width, depth: fp.depth }).length > 0
      : false;

    this.placementGhost = {
      x_mm: clampedX,
      y_mm: clampedY,
      width_mm: fp.width,
      depth_mm: fp.depth,
      length_mm: rackData.length_mm,
      rackDepth_mm: rackData.depth_mm,
      rotation: rot,
      bay_count: rackData.bay_count || Math.max(1, Math.round(rackData.length_mm / (this.slotRotated ? slotD : slotW))),
      level_count: rackData.level_count || 3,
      rack_code: rackData.rack_code || 'R-01',
      color_hex: rackData.color_hex || '#5c732b',
      col: Math.floor(clampedX / slotW) + 1,
      rowLetter: rowToLetter(Math.floor(clampedY / slotD)),
      slotW,
      slotD,
      isColliding,
    };

    this.canvas.style.cursor = 'crosshair';
    this._requestRender(true);
  }

  /**
   * Cancels placement mode and clears ghost
   */
  cancelPlacement() {
    if (this.mode === 'placement') {
      this.mode = 'idle';
      this.placementGhost = null;
      this.placementData = null;
      this.canvas.style.cursor = 'default';
      if (this.onPlacementCancel) {
        this.onPlacementCancel();
      }
      this._requestRender(true);
    }
  }

  /**
   * Rotates pending placement ghost by 90 degrees
   */
  rotatePlacement() {
    if (this.mode !== 'placement' || !this.placementGhost) return;
    const currentRot = this.placementGhost.rotation || 0;
    const nextRot = (currentRot + 90) % 360;
    this.placementGhost.rotation = nextRot;
    if (this.placementData) {
      this.placementData.rotation = nextRot;
    }
    const fp = footprint(this.placementGhost.length_mm, this.placementGhost.rackDepth_mm, nextRot);
    this.placementGhost.width_mm = fp.width;
    this.placementGhost.depth_mm = fp.depth;

    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    const maxX = Math.max(0, wh.width_mm - fp.width);
    const maxY = Math.max(0, wh.length_mm - fp.depth);
    this.placementGhost.x_mm = Math.max(0, Math.min(maxX, this.placementGhost.x_mm));
    this.placementGhost.y_mm = Math.max(0, Math.min(maxY, this.placementGhost.y_mm));

    if (this.spatialHash) {
      const collisions = this.spatialHash.query({
        x: this.placementGhost.x_mm,
        y: this.placementGhost.y_mm,
        width: fp.width,
        depth: fp.depth,
      });
      this.placementGhost.isColliding = collisions.length > 0;
    }

    this._requestRender(true);
  }

  clearSelection() {
    this.selectedIds.clear();
    this.selectedEntities.clear();
    this.rubberBandRect = null;
    this._requestRender();
  }

  getOverlayState() {
    return {
      selectedIds: this.selectedIds,
      dragGhost: this.dragGhost,
      isColliding: this.isColliding,
      rubberBand: this.rubberBandRect,
      slotFillGhost: this.slotFillGhost,
      dockFillGhost: this.dockFillGhost,
      aisleFillGhost: this.aisleFillGhost,
      placementGhost: this.placementGhost,
    };
  }
}
