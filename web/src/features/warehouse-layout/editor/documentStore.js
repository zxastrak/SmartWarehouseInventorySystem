/**
 * Document Store for Floor Plan Layout Editor
 * Manages in-memory layout state, applies mutations, handles selection,
 * and compiles atomic batch patches for backend synchronization.
 */

import geometry from '../../../../../shared/layout-core/src/geometry.js';
import SpatialHash from '../../../../../shared/layout-core/src/spatialHash.js';
const { rotate90, footprint, inside, overlaps } = geometry;

let clientCounter = 1;

export class DocumentStore {
  /**
   * @param {Object} initialSnapshot - The clean snapshot fetched from server
   * @param {Object} [historyManager] - Optional history instance for undo/redo
   */
  constructor(initialSnapshot, historyManager = null) {
    this.originalSnapshot = JSON.parse(JSON.stringify(initialSnapshot));
    this.snapshot = JSON.parse(JSON.stringify(initialSnapshot));
    this.history = historyManager;
    this.selectedKeys = new Set(); // e.g. "rack:12", "aisle:4"
    this.spatialHash = new SpatialHash(1000);
    this._rebuildSpatialHash();
  }

  _rebuildSpatialHash() {
    this.spatialHash.clear();

    // 1. Racks
    if (Array.isArray(this.snapshot.racks)) {
      for (const r of this.snapshot.racks) {
        if (!r.retired_at) {
          const box = footprint(r.length_mm, r.depth_mm, r.rotation || 0);
          this.spatialHash.insert(`rack:${r.id}`, {
            x: r.x_mm,
            y: r.y_mm,
            width: box.width,
            depth: box.depth,
          });
        }
      }
    }

    // 2. Layout Objects (Docks, Obstacles, Pillars)
    if (Array.isArray(this.snapshot.layout_objects)) {
      for (const o of this.snapshot.layout_objects) {
        if (o.object_type !== 'door_entry' && o.object_type !== 'door_exit') {
          this.spatialHash.insert(`layout_object:${o.id}`, {
            x: o.x_mm,
            y: o.y_mm,
            width: o.width_mm || 2000,
            depth: o.length_mm || 2000,
          });
        }
      }
    }

    // 3. Aisles (Walkways & Forklift lanes)
    if (Array.isArray(this.snapshot.aisles)) {
      for (const a of this.snapshot.aisles) {
        this.spatialHash.insert(`aisle:${a.id}`, {
          x: a.x_mm,
          y: a.y_mm,
          width: a.width_mm || 2000,
          depth: a.length_mm || 5000,
        });
      }
    }
  }

  /**
   * Incremental SpatialHash update for single entity (O(1) instead of O(N) full rebuild)
   */
  _updateEntitySpatialHash(type, entity) {
    if (!this.spatialHash || !entity) return;
    const key = `${type}:${entity.id}`;
    if (type === 'rack') {
      if (entity.retired_at) {
        this.spatialHash.remove(key);
      } else {
        const box = footprint(entity.length_mm, entity.depth_mm, entity.rotation || 0);
        this.spatialHash.insert(key, {
          x: entity.x_mm,
          y: entity.y_mm,
          width: box.width,
          depth: box.depth,
        });
      }
    } else if (type === 'layout_object') {
      if (entity.object_type === 'door_entry' || entity.object_type === 'door_exit') {
        this.spatialHash.remove(key);
      } else {
        this.spatialHash.insert(key, {
          x: entity.x_mm,
          y: entity.y_mm,
          width: entity.width_mm || 2000,
          depth: entity.length_mm || 2000,
        });
      }
    } else if (type === 'aisle') {
      this.spatialHash.insert(key, {
        x: entity.x_mm,
        y: entity.y_mm,
        width: entity.width_mm || 2000,
        depth: entity.length_mm || 5000,
      });
    }
  }

  /**
   * Incremental removal of single entity from SpatialHash
   */
  _removeEntitySpatialHash(type, id) {
    if (!this.spatialHash) return;
    const cleanId = String(id).includes(':') ? String(id).split(':')[1] : String(id);
    this.spatialHash.remove(`${type}:${cleanId}`);
    this.spatialHash.remove(String(id));
  }

  /**
   * Filter collisions with warehouse layout domain rules (forklift vs dock exemptions, etc.)
   */
  _filterEffectiveCollisions(type, entity, collisions) {
    if (!Array.isArray(collisions)) return collisions || [];
    if (type === 'layout_object' && String(entity?.object_type || '').includes('door')) {
      // Pintu menempel pada dinding perimeter gudang dan tidak boleh diblokir oleh collision
      return [];
    }
    if (type !== 'aisle') return collisions;
    const isForklift =
      entity.type === 'forklift' ||
      String(entity.name || '').toLowerCase().includes('forklift') ||
      entity.direction === 'forklift';

    const isDock = (cid) => {
      if (!String(cid).startsWith('layout_object:')) return false;
      const rawId = cid.replace('layout_object:', '');
      const obj = this.snapshot?.layout_objects?.find((o) => String(o.id) === String(rawId));
      return obj && String(obj.object_type || '').includes('dock');
    };

    return collisions.filter((cid) => {
      if (String(cid).startsWith('aisle:')) return false;
      if (isForklift && isDock(cid)) return false; // Forklift bisa menimpa dok!
      return true;
    });
  }

  get warehouse() {
    return this.snapshot.warehouse;
  }

  get racks() {
    return this.snapshot.racks || [];
  }

  get aisles() {
    return this.snapshot.aisles || [];
  }

  get zones() {
    return this.snapshot.zones || [];
  }

  get layout_objects() {
    return this.snapshot.layout_objects || [];
  }

  // --- SELECTION HELPERS ---
  select(entityType, id, multi = false) {
    const key = `${entityType}:${id}`;
    if (!multi) {
      this.selectedKeys.clear();
    }
    this.selectedKeys.add(key);
  }

  deselect(entityType, id) {
    const key = `${entityType}:${id}`;
    this.selectedKeys.delete(key);
  }

  clearSelection() {
    this.selectedKeys.clear();
  }

  isSelected(entityType, id) {
    return this.selectedKeys.has(`${entityType}:${id}`);
  }

  getSelectedItems() {
    const items = [];
    for (const key of this.selectedKeys) {
      const [type, rawId] = key.split(':');
      const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
      const item = this.findEntity(type, id);
      if (item) {
        items.push({ type, item, key });
      }
    }
    return items;
  }

  findEntity(type, id) {
    const cleanId = String(id).includes(':') ? String(id).split(':')[1] : String(id);
    const list = this._getEntityList(type);
    const found = list.find((item) => String(item.id) === cleanId || String(item.client_ref) === cleanId || String(item.id) === String(id));
    if (found) return found;

    // Fallback search across all lists
    const allTypes = ['rack', 'aisle', 'layout_object', 'zone'];
    for (const t of allTypes) {
      const candidateList = this._getEntityList(t);
      const item = candidateList.find((x) => String(x.id) === cleanId || String(x.client_ref) === cleanId || String(x.id) === String(id));
      if (item) return item;
    }
    return null;
  }

  _getEntityList(type) {
    const norm = String(type || '').toLowerCase();
    switch (norm) {
      case 'rack':
        return this.snapshot.racks || [];
      case 'aisle':
        return this.snapshot.aisles || [];
      case 'zone':
        return this.snapshot.zones || [];
      case 'layout_object':
      case 'door':
      case 'dock':
      case 'pillar':
      case 'wall':
        return this.snapshot.layout_objects || [];
      default:
        return [];
    }
  }

  // --- MUTATION ACTIONS ---

  /**
   * Moves an entity to a new (x, y) coordinate
   */
  moveEntity(type, id, toX, toY, validateCollision = true) {
    const entity = this.findEntity(type, id);
    if (!entity) return false;

    const fromX = entity.x_mm;
    const fromY = entity.y_mm;

    const box = type === 'rack'
      ? footprint(entity.length_mm, entity.depth_mm, entity.rotation || 0)
      : { width: entity.width_mm || 2000, depth: entity.length_mm || 2000 };

    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    const maxX = Math.max(0, wh.width_mm - box.width);
    const maxY = Math.max(0, wh.length_mm - box.depth);
    const clampedToX = Math.max(0, Math.min(maxX, toX));
    const clampedToY = Math.max(0, Math.min(maxY, toY));

    if (fromX === clampedToX && fromY === clampedToY) return true;

    if (validateCollision) {
      const collisions = this.spatialHash.query(
        { x: clampedToX, y: clampedToY, width: box.width, depth: box.depth },
        `${type}:${id}`
      );
      const effectiveCollisions = this._filterEffectiveCollisions(type, entity, collisions);
      if (effectiveCollisions.length > 0) {
        return false;
      }
    }

    // Apply mutation
    entity.x_mm = Math.floor(clampedToX);
    entity.y_mm = Math.floor(clampedToY);
    this._updateEntitySpatialHash(type, entity);

    // Record to history
    if (this.history) {
      this.history.push(
        { op: 'move', type, id, to: { x: clampedToX, y: clampedToY } },
        { op: 'move', type, id, to: { x: fromX, y: fromY } },
        `Geser ${type} #${id}`
      );
    }

    // Bila jalan bertabrakan dengan jalan lain saat digeser, otomatis gabungkan
    if (type === 'aisle') {
      const mergeRes = this.mergeAisle(id);
      if (mergeRes && mergeRes.isMerged) {
        return mergeRes;
      }
    }

    return true;
  }

  /**
   * Rotates an entity clockwise 90 degrees around its center
   */
  rotateEntity(type, id, validateCollision = true) {
    const entity = this.findEntity(type, id);
    if (!entity || typeof entity.rotation !== 'number') return false;

    const oldRot = entity.rotation || 0;
    const oldX = entity.x_mm;
    const oldY = entity.y_mm;

    const physLength = type === 'rack' ? entity.length_mm : entity.width_mm;
    const physDepth = type === 'rack' ? entity.depth_mm : entity.length_mm;

    const rotated = rotate90(oldX, oldY, physLength, physDepth, oldRot);
    const rotatedBox = footprint(physLength, physDepth, rotated.rotation);

    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    const maxX = Math.max(0, wh.width_mm - rotatedBox.width);
    const maxY = Math.max(0, wh.length_mm - rotatedBox.depth);
    const clampedX = Math.max(0, Math.min(maxX, rotated.x));
    const clampedY = Math.max(0, Math.min(maxY, rotated.y));

    if (validateCollision) {
      const newRect = {
        x: clampedX,
        y: clampedY,
        width: rotatedBox.width,
        depth: rotatedBox.depth,
      };
      const collisions = this.spatialHash.query(newRect, `${type}:${id}`);
      const effectiveCollisions = this._filterEffectiveCollisions(type, entity, collisions);
      if (effectiveCollisions.length > 0) {
        return false;
      }
    }

    entity.x_mm = clampedX;
    entity.y_mm = clampedY;
    entity.rotation = rotated.rotation;
    this._updateEntitySpatialHash(type, entity);

    if (this.history) {
      this.history.push(
        { op: 'rotate', type, id, to: { x: clampedX, y: clampedY, rotation: rotated.rotation } },
        { op: 'rotate', type, id, to: { x: oldX, y: oldY, rotation: oldRot } },
        `Putar ${type} #${id} 90°`
      );
    }
    return true;
  }

  _generateNextRackCode() {
    const existing = new Set((this.snapshot.racks || []).map((r) => String(r.rack_code).toUpperCase()));
    let num = (this.snapshot.racks || []).length + 1;
    while (existing.has(`R-${String(num).padStart(2, '0')}`)) {
      num++;
    }
    return `R-${String(num).padStart(2, '0')}`;
  }

  /**
   * Adds a new rack to the layout
   */
  addRack(customData = {}) {
    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    const length_mm = customData.length_mm !== undefined ? Number(customData.length_mm) : 2400;
    const depth_mm = customData.depth_mm !== undefined ? Number(customData.depth_mm) : 1000;
    const rotation = customData.rotation !== undefined ? Number(customData.rotation) : 0;
    const fp = footprint(length_mm, depth_mm, rotation);

    const maxX = Math.max(0, wh.width_mm - fp.width);
    const maxY = Math.max(0, wh.length_mm - fp.depth);
    const rawX = customData.x_mm !== undefined ? Number(customData.x_mm) : 5000;
    const rawY = customData.y_mm !== undefined ? Number(customData.y_mm) : 5000;
    let clampedX = Math.max(0, Math.min(maxX, rawX));
    let clampedY = Math.max(0, Math.min(maxY, rawY));

    const clientRef = `c-rack-${clientCounter++}`;
    const newRack = {
      id: clientRef,
      client_ref: clientRef,
      rack_code: customData.rack_code || this._generateNextRackCode(),
      zone_id: customData.zone_id || (this.snapshot.zones[0]?.id || null),
      x_mm: clampedX,
      y_mm: clampedY,
      length_mm,
      depth_mm,
      height_mm: customData.height_mm !== undefined ? Number(customData.height_mm) : 4000,
      rotation,
      color_hex: customData.color_hex || null,
      level_count: customData.level_count !== undefined ? Number(customData.level_count) : 3,
      bay_count: customData.bay_count !== undefined ? Number(customData.bay_count) : 1,
      slot_width_mm: customData.slot_width_mm !== undefined ? Number(customData.slot_width_mm) : undefined,
      slot_depth_mm: customData.slot_depth_mm !== undefined ? Number(customData.slot_depth_mm) : undefined,
      slot_rotated: customData.slot_rotated !== undefined ? Boolean(customData.slot_rotated) : undefined,
      version: 1,
      aisle_access: customData.aisle_access || [],
      is_new: true,
    };

    this.snapshot.racks.push(newRack);
    this._updateEntitySpatialHash('rack', newRack);
    this.select('rack', newRack.id);

    if (this.history) {
      this.history.push(
        { op: 'add', type: 'rack', item: { ...newRack } },
        { op: 'delete', type: 'rack', id: newRack.id, item: { ...newRack } },
        `Tambah Rak ${newRack.rack_code}`
      );
    }
    return newRack;
  }

  /**
   * Adds a new aisle to the layout
   */
  addAisle(customData = {}) {
    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    let width_mm = Math.min(wh.width_mm, customData.width_mm || 2000);
    let length_mm = Math.min(wh.length_mm, customData.length_mm || 10000);

    const newIsForklift = customData.type === 'forklift' || String(customData.name || '').toLowerCase().includes('forklift') || customData.direction === 'forklift';
    let warnedLowForkliftWidth = false;

    // "kunci lebar forklift sesuai dengan yang diinput oleh user, jadi khusus forklift tidak bisa membesar atau mengecil"
    if (newIsForklift) {
      if (customData.width_mm !== undefined && Number(customData.width_mm) < 2500) {
        warnedLowForkliftWidth = true;
      }
      if (customData.length_mm !== undefined && Number(customData.length_mm) < 2500 && width_mm >= length_mm) {
        warnedLowForkliftWidth = true;
      }

      // Kunci lebar forklift sesuai dengan yang diinput oleh user (tidak boleh membesar atau mengecil otomatis)
      const userSpecifiedWidth = customData.user_width_mm || customData.userWidthMm || customData.configured_width_mm;
      if (userSpecifiedWidth) {
        const uWidth = Math.max(300, Number(userSpecifiedWidth));
        if (width_mm >= length_mm) {
          length_mm = uWidth; // Lebar penampang Y pada jalan horizontal
        } else {
          width_mm = uWidth; // Lebar penampang X pada jalan vertikal
        }
      }
    }

    const maxX = Math.max(0, wh.width_mm - width_mm);
    const maxY = Math.max(0, wh.length_mm - length_mm);
    const rawX = customData.x_mm !== undefined ? Number(customData.x_mm) : 2000;
    const rawY = customData.y_mm !== undefined ? Number(customData.y_mm) : 2000;
    let clampedX = Math.max(0, Math.min(maxX, rawX));
    let clampedY = Math.max(0, Math.min(maxY, rawY));

    const clientRef = `c-aisle-${clientCounter++}`;

    // PROTEKSI RAK: Jalan tidak boleh menghapus atau menimpa rak!
    if (this.spatialHash) {
      const rackHits = this.spatialHash.query({
        x: clampedX,
        y: clampedY,
        width: width_mm,
        depth: length_mm,
      }).filter((id) => String(id).startsWith('rack:'));

      if (rackHits.length > 0) {
        return {
          error: 'COLLIDES_WITH_RACK',
          message: 'Jalan tidak dapat menimpa atau menghapus rak! Silakan geser posisi rak terlebih dahulu.',
        };
      }
    }

    // PENGGABUNGAN JALAN & PENCEGAHAN TUMPANG TINDIH
    // "pejalan tidak bisa menimpa jalan lain, jalan forklift bisa, ketika jalan forklift menimpa jalan lain maka jalan tersebut menjai kuning bergaris hijau"
    const newIsHoriz = width_mm >= length_mm;

    if (Array.isArray(this.snapshot?.aisles) && this.snapshot.aisles.length > 0) {
      let candidate = null;
      let isOverlapping = false;
      let isCollinearMeeting = false;

      for (const a of this.snapshot.aisles) {
        const aIsHoriz = (a.width_mm || 2000) >= (a.length_mm || 5000);

        // A. Cek Overlap
        const overlaps = !(
          clampedX + width_mm <= a.x_mm ||
          a.x_mm + a.width_mm <= clampedX ||
          clampedY + length_mm <= a.y_mm ||
          a.y_mm + a.length_mm <= clampedY
        );

        // B. Cek Saling Bertemu di Ujung (Collinear End-to-End Touching)
        let touchesAtEnd = false;
        if (newIsHoriz && aIsHoriz) {
          // Keduanya Horizontal: rentang Y bertindihan/sejajar
          const yOverlap = Math.max(clampedY, a.y_mm) < Math.min(clampedY + length_mm, a.y_mm + a.length_mm) || Math.abs(clampedY - a.y_mm) <= 500;
          // Ujung X bertemu atau bersentuhan dalam jarak snap (<= 1000mm)
          const xTouches = Math.abs(clampedX - (a.x_mm + a.width_mm)) <= 1000 || Math.abs((clampedX + width_mm) - a.x_mm) <= 1000;
          touchesAtEnd = yOverlap && xTouches;
        } else if (!newIsHoriz && !aIsHoriz) {
          // Keduanya Vertikal: rentang X bertindihan/sejajar
          const xOverlap = Math.max(clampedX, a.x_mm) < Math.min(clampedX + width_mm, a.x_mm + a.width_mm) || Math.abs(clampedX - a.x_mm) <= 500;
          // Ujung Y bertemu atau bersentuhan dalam jarak snap (<= 1000mm)
          const yTouches = Math.abs(clampedY - (a.y_mm + a.length_mm)) <= 1000 || Math.abs((clampedY + length_mm) - a.y_mm) <= 1000;
          touchesAtEnd = xOverlap && yTouches;
        } else if (newIsHoriz && !aIsHoriz) {
          // Horizontal bertemu Vertikal di ujung/persimpangan
          const xIntersects = Math.max(clampedX, a.x_mm) <= Math.min(clampedX + width_mm, a.x_mm + a.width_mm) || Math.abs(clampedX - (a.x_mm + a.width_mm)) <= 1000 || Math.abs((clampedX + width_mm) - a.x_mm) <= 1000;
          const yTouches = Math.abs(clampedY - (a.y_mm + a.length_mm)) <= 1000 || Math.abs((clampedY + length_mm) - a.y_mm) <= 1000;
          touchesAtEnd = xIntersects && yTouches;
        } else if (!newIsHoriz && aIsHoriz) {
          // Vertikal bertemu Horizontal di ujung/persimpangan
          const yIntersects = Math.max(clampedY, a.y_mm) <= Math.min(clampedY + length_mm, a.y_mm + a.length_mm) || Math.abs(clampedY - (a.y_mm + a.length_mm)) <= 1000 || Math.abs((clampedY + length_mm) - a.y_mm) <= 1000;
          const xTouches = Math.abs(clampedX - (a.x_mm + a.width_mm)) <= 1000 || Math.abs((clampedX + width_mm) - a.x_mm) <= 1000;
          touchesAtEnd = yIntersects && xTouches;
        }

        if (overlaps || touchesAtEnd) {
          candidate = a;
          isOverlapping = overlaps;
          isCollinearMeeting = touchesAtEnd;
          break;
        }
      }

      if (candidate) {
        const aIsHoriz = (candidate.width_mm || 2000) >= (candidate.length_mm || 5000);
        const existIsForklift = candidate.type === 'forklift' || String(candidate.name || '').toLowerCase().includes('forklift') || candidate.direction === 'forklift';
        const existIsBoth = candidate.type === 'both' || candidate.direction === 'both' || candidate.is_both;
        const willBeBoth = existIsBoth || (newIsForklift && !existIsForklift) || (!newIsForklift && existIsForklift);

        // Kasus 1: Searah (keduanya Horizontal atau keduanya Vertikal) -> GABUNGKAN MENJADI SATU ENTITAS LORONG
        if (newIsHoriz === aIsHoriz) {
          const prevItem = { ...candidate };
          const minX = Math.min(candidate.x_mm, clampedX);
          const minY = Math.min(candidate.y_mm, clampedY);
          const maxXPos = Math.max(candidate.x_mm + candidate.width_mm, clampedX + width_mm);
          const maxYPos = Math.max(candidate.y_mm + candidate.length_mm, clampedY + length_mm);

          if (newIsForklift && existIsForklift && !willBeBoth) {
            // Khusus Forklift: KUNCI LEBAR jalur forklift sesuai input user (tidak boleh membesar atau mengecil)
            if (newIsHoriz) {
              candidate.x_mm = minX;
              candidate.width_mm = maxXPos - minX;
              // candidate.y_mm dan candidate.length_mm tetap terkunci sesuai input
            } else {
              candidate.y_mm = minY;
              candidate.length_mm = maxYPos - minY;
              // candidate.x_mm dan candidate.width_mm tetap terkunci sesuai input
            }
          } else {
            candidate.x_mm = minX;
            candidate.y_mm = minY;
            candidate.width_mm = maxXPos - minX;
            candidate.length_mm = maxYPos - minY;
          }
          candidate.client_ref = candidate.client_ref || clientRef;

          if (willBeBoth) {
            candidate.type = 'both';
            candidate.direction = 'both';
            candidate.name = 'Jalur Bersama (Forklift & Pejalan)';
            candidate.is_both = true;
            // Standar forklift minimal 2.5m (2500 mm)
            if (newIsHoriz && candidate.length_mm < 2500) candidate.length_mm = Math.min(wh.length_mm - minY, 2500);
            if (!newIsHoriz && candidate.width_mm < 2500) candidate.width_mm = Math.min(wh.width_mm - minX, 2500);
          } else if (newIsForklift) {
            candidate.type = 'forklift';
            candidate.direction = 'forklift';
          } else {
            // Jalur Manusia / Standar: Pastikan tidak tumpang tindih dan memenuhi batas minimal 0.8m
            candidate.type = candidate.type || 'standard';
            if (newIsHoriz && candidate.length_mm < 800) candidate.length_mm = Math.min(wh.length_mm - minY, 800);
            if (!newIsHoriz && candidate.width_mm < 800) candidate.width_mm = Math.min(wh.width_mm - minX, 800);
          }

          // Cek apakah lorong yang baru diperluas ini juga menyentuh lorong lain di sekitarnya
          const otherTouching = this.snapshot.aisles.filter((other) => {
            if (other.id === candidate.id) return false;
            const otherIsHoriz = (other.width_mm || 2000) >= (other.length_mm || 5000);
            if (otherIsHoriz !== newIsHoriz) return false;
            if (newIsHoriz) {
              const yOk = Math.max(candidate.y_mm, other.y_mm) < Math.min(candidate.y_mm + candidate.length_mm, other.y_mm + other.length_mm);
              const xOk = candidate.x_mm <= other.x_mm + other.width_mm + 500 && other.x_mm <= candidate.x_mm + candidate.width_mm + 500;
              return yOk && xOk;
            } else {
              const xOk = Math.max(candidate.x_mm, other.x_mm) < Math.min(candidate.x_mm + candidate.width_mm, other.x_mm + other.width_mm);
              const yOk = candidate.y_mm <= other.y_mm + other.length_mm + 500 && other.y_mm <= candidate.y_mm + candidate.length_mm + 500;
              return xOk && yOk;
            }
          });

          for (const extra of otherTouching) {
            const minX2 = Math.min(candidate.x_mm, extra.x_mm);
            const minY2 = Math.min(candidate.y_mm, extra.y_mm);
            const maxX2 = Math.max(candidate.x_mm + candidate.width_mm, extra.x_mm + extra.width_mm);
            const maxY2 = Math.max(candidate.y_mm + candidate.length_mm, extra.y_mm + extra.length_mm);
            candidate.x_mm = minX2;
            candidate.y_mm = minY2;
            candidate.width_mm = maxX2 - minX2;
            candidate.length_mm = maxY2 - minY2;
            this.snapshot.aisles = this.snapshot.aisles.filter((a) => a.id !== extra.id);
          }

          this.select('aisle', candidate.id);
          this._rebuildSpatialHash();

          if (this.history) {
            this.history.push(
              { op: 'update', type: 'aisle', id: candidate.id, item: { ...candidate }, prevItem },
              { op: 'update', type: 'aisle', id: candidate.id, item: prevItem, prevItem: { ...candidate } },
              `Gabung Jalan ${candidate.aisle_code}`
            );
          }
          return { ...candidate, isMerged: true, is_both: willBeBoth, warnMinimumForkliftWidth: warnedLowForkliftWidth };
        } else if (isOverlapping || isCollinearMeeting) {
          // Kasus 2: Tegak lurus (perpendicular T-junction/L-corner) yang bertindihan atau menyentuh ujung
          // Forklift & Pejalan kaki DIIZINKAN tumpang tindih (overlap) untuk membentuk persimpangan jalan / tikungan L yang terhubung mulus
          if (willBeBoth) {
            candidate.type = 'both';
            candidate.direction = 'both';
            candidate.name = 'Jalur Bersama (Forklift & Pejalan)';
            candidate.is_both = true;
          }

          // Sambung flush sudut pertemuan (L-turn / T-junction) agar tidak ada celah di sudut
          if (!newIsHoriz && aIsHoriz) {
            // Jalan baru vertikal bertemu lorong eksisting horizontal
            if (clampedY >= candidate.y_mm && clampedY <= candidate.y_mm + candidate.length_mm) {
              const prevBottom = clampedY + length_mm;
              clampedY = candidate.y_mm;
              length_mm = Math.max(length_mm, prevBottom - clampedY);
            } else if (clampedY + length_mm >= candidate.y_mm && clampedY + length_mm <= candidate.y_mm + candidate.length_mm) {
              length_mm = (candidate.y_mm + candidate.length_mm) - clampedY;
            }
          } else if (newIsHoriz && !aIsHoriz) {
            // Jalan baru horizontal bertemu lorong eksisting vertikal
            if (clampedX >= candidate.x_mm && clampedX <= candidate.x_mm + candidate.width_mm) {
              const prevRight = clampedX + width_mm;
              clampedX = candidate.x_mm;
              width_mm = Math.max(width_mm, prevRight - clampedX);
            } else if (clampedX + width_mm >= candidate.x_mm && clampedX + width_mm <= candidate.x_mm + candidate.width_mm) {
              width_mm = (candidate.x_mm + candidate.width_mm) - clampedX;
            }
          }
        }
      }
    }

    const newAisle = {
      id: clientRef,
      client_ref: clientRef,
      aisle_code: customData.aisle_code || `A-${String(this.snapshot.aisles.length + 1).padStart(2, '0')}`,
      name: customData.name || (newIsForklift ? `Jalur Forklift ${this.snapshot.aisles.length + 1}` : `Lorong ${this.snapshot.aisles.length + 1}`),
      x_mm: clampedX,
      y_mm: clampedY,
      width_mm,
      length_mm,
      type: customData.type || (newIsForklift ? 'forklift' : 'standard'),
      direction: customData.direction || (newIsForklift ? 'forklift' : 'two_way'),
      is_new: true,
      warnMinimumForkliftWidth: warnedLowForkliftWidth,
    };

    this.snapshot.aisles.push(newAisle);
    this.select('aisle', newAisle.id);
    this._rebuildSpatialHash();

    if (this.history) {
      this.history.push(
        { op: 'add', type: 'aisle', item: { ...newAisle } },
        { op: 'delete', type: 'aisle', id: newAisle.id, item: { ...newAisle } },
        `Tambah Lorong ${newAisle.aisle_code}`
      );
    }
    return newAisle;
  }

  /**
   * Merges an existing aisle with any overlapping or collinear touching aisle
   */
  mergeAisle(id) {
    const cleanId = String(id).includes(':') ? String(id).split(':')[1] : String(id);
    const targetAisle = (this.snapshot?.aisles || []).find(
      (a) => String(a.id) === cleanId || String(a.client_ref) === cleanId || String(a.id) === String(id)
    );
    if (!targetAisle) return null;

    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    const targetIsHoriz = (targetAisle.width_mm || 2000) >= (targetAisle.length_mm || 5000);
    const targetIsForklift = targetAisle.type === 'forklift' || String(targetAisle.name || '').toLowerCase().includes('forklift') || targetAisle.direction === 'forklift';
    const targetIsBoth = targetAisle.type === 'both' || targetAisle.direction === 'both' || targetAisle.is_both;

    let candidate = null;
    let isOverlapping = false;
    let isCollinearMeeting = false;

    for (const a of (this.snapshot?.aisles || [])) {
      if (a.id === targetAisle.id) continue;
      const aIsHoriz = (a.width_mm || 2000) >= (a.length_mm || 5000);

      // Check Overlap
      const overlaps = !(
        targetAisle.x_mm + targetAisle.width_mm <= a.x_mm ||
        a.x_mm + a.width_mm <= targetAisle.x_mm ||
        targetAisle.y_mm + targetAisle.length_mm <= a.y_mm ||
        a.y_mm + a.length_mm <= targetAisle.y_mm
      );

      // Check Collinear Touching
      let touchesAtEnd = false;
      if (targetIsHoriz && aIsHoriz) {
        const yOverlap = Math.max(targetAisle.y_mm, a.y_mm) < Math.min(targetAisle.y_mm + targetAisle.length_mm, a.y_mm + a.length_mm) || Math.abs(targetAisle.y_mm - a.y_mm) <= 500;
        const xTouches = Math.abs(targetAisle.x_mm - (a.x_mm + a.width_mm)) <= 1000 || Math.abs((targetAisle.x_mm + targetAisle.width_mm) - a.x_mm) <= 1000;
        touchesAtEnd = yOverlap && xTouches;
      } else if (!targetIsHoriz && !aIsHoriz) {
        const xOverlap = Math.max(targetAisle.x_mm, a.x_mm) < Math.min(targetAisle.x_mm + targetAisle.width_mm, a.x_mm + a.width_mm) || Math.abs(targetAisle.x_mm - a.x_mm) <= 500;
        const yTouches = Math.abs(targetAisle.y_mm - (a.y_mm + a.length_mm)) <= 1000 || Math.abs((targetAisle.y_mm + targetAisle.length_mm) - a.y_mm) <= 1000;
        touchesAtEnd = xOverlap && yTouches;
      } else if (targetIsHoriz && !aIsHoriz) {
        const xIntersects = Math.max(targetAisle.x_mm, a.x_mm) <= Math.min(targetAisle.x_mm + targetAisle.width_mm, a.x_mm + a.width_mm) || Math.abs(targetAisle.x_mm - (a.x_mm + a.width_mm)) <= 1000 || Math.abs((targetAisle.x_mm + targetAisle.width_mm) - a.x_mm) <= 1000;
        const yTouches = Math.abs(targetAisle.y_mm - (a.y_mm + a.length_mm)) <= 1000 || Math.abs((targetAisle.y_mm + targetAisle.length_mm) - a.y_mm) <= 1000;
        touchesAtEnd = xIntersects && yTouches;
      } else if (!targetIsHoriz && aIsHoriz) {
        const yIntersects = Math.max(targetAisle.y_mm, a.y_mm) <= Math.min(targetAisle.y_mm + targetAisle.length_mm, a.y_mm + a.length_mm) || Math.abs(targetAisle.y_mm - (a.y_mm + a.length_mm)) <= 1000 || Math.abs((targetAisle.y_mm + targetAisle.length_mm) - a.y_mm) <= 1000;
        const xTouches = Math.abs(targetAisle.x_mm - (a.x_mm + a.width_mm)) <= 1000 || Math.abs((targetAisle.x_mm + targetAisle.width_mm) - a.x_mm) <= 1000;
        touchesAtEnd = yIntersects && xTouches;
      }

      if (overlaps || touchesAtEnd) {
        candidate = a;
        isOverlapping = overlaps;
        isCollinearMeeting = touchesAtEnd;
        break;
      }
    }

    if (!candidate) return null;

    const aIsHoriz = (candidate.width_mm || 2000) >= (candidate.length_mm || 5000);
    const existIsForklift = candidate.type === 'forklift' || String(candidate.name || '').toLowerCase().includes('forklift') || candidate.direction === 'forklift';
    const existIsBoth = candidate.type === 'both' || candidate.direction === 'both' || candidate.is_both;
    const willBeBoth = targetIsBoth || existIsBoth || (targetIsForklift && !existIsForklift) || (!targetIsForklift && existIsForklift);

    if (targetIsHoriz === aIsHoriz) {
      const prevCandidate = { ...candidate };
      const minX = Math.min(candidate.x_mm, targetAisle.x_mm);
      const minY = Math.min(candidate.y_mm, targetAisle.y_mm);
      const maxX = Math.max(candidate.x_mm + candidate.width_mm, targetAisle.x_mm + targetAisle.width_mm);
      const maxY = Math.max(candidate.y_mm + candidate.length_mm, targetAisle.y_mm + targetAisle.length_mm);

      if ((targetIsForklift || existIsForklift) && !willBeBoth) {
        // Khusus Forklift: KUNCI LEBAR jalur forklift sesuai input user (tidak boleh membesar atau mengecil)
        if (targetIsHoriz) {
          candidate.x_mm = minX;
          candidate.width_mm = maxX - minX;
          // candidate.y_mm & candidate.length_mm tetap terkunci
        } else {
          candidate.y_mm = minY;
          candidate.length_mm = maxY - minY;
          // candidate.x_mm & candidate.width_mm tetap terkunci
        }
      } else {
        candidate.x_mm = minX;
        candidate.y_mm = minY;
        candidate.width_mm = maxX - minX;
        candidate.length_mm = maxY - minY;
      }

      if (willBeBoth) {
        candidate.type = 'both';
        candidate.direction = 'both';
        candidate.name = 'Jalur Bersama (Forklift & Pejalan)';
        candidate.is_both = true;
        if (targetIsHoriz && candidate.length_mm < 2500) candidate.length_mm = Math.min(wh.length_mm - minY, 2500);
        if (!targetIsHoriz && candidate.width_mm < 2500) candidate.width_mm = Math.min(wh.width_mm - minX, 2500);
      } else if (targetIsForklift || existIsForklift) {
        candidate.type = 'forklift';
        candidate.direction = 'forklift';
      } else {
        candidate.type = candidate.type || 'standard';
        if (targetIsHoriz && candidate.length_mm < 800) candidate.length_mm = Math.min(wh.length_mm - minY, 800);
        if (!targetIsHoriz && candidate.width_mm < 800) candidate.width_mm = Math.min(wh.width_mm - minX, 800);
      }

      // Hapus targetAisle yang telah digabung ke candidate
      this.snapshot.aisles = this.snapshot.aisles.filter((a) => a.id !== targetAisle.id);
      this.deselect('aisle', targetAisle.id);
      this.select('aisle', candidate.id);
      this._rebuildSpatialHash();

      if (this.history) {
        this.history.push(
          { op: 'update', type: 'aisle', id: candidate.id, item: { ...candidate }, prevItem: prevCandidate },
          { op: 'update', type: 'aisle', id: candidate.id, item: prevCandidate, prevItem: { ...candidate } },
          `Gabung Jalan ${candidate.aisle_code}`
        );
      }

      return { moved: true, isMerged: true, aisle: candidate, is_both: willBeBoth };
    } else if (isOverlapping || isCollinearMeeting) {
      // Kasus 2: Tegak lurus (perpendicular L-corner / T-junction)
      // Hubungkan dan rapikan persimpangan agar flush dan seamless tanpa celah
      const prevTarget = { ...targetAisle };
      const prevCandidate = { ...candidate };

      if (willBeBoth) {
        targetAisle.type = 'both';
        targetAisle.direction = 'both';
        targetAisle.name = 'Jalur Bersama (Forklift & Pejalan)';
        targetAisle.is_both = true;
        candidate.type = 'both';
        candidate.direction = 'both';
        candidate.name = 'Jalur Bersama (Forklift & Pejalan)';
        candidate.is_both = true;
      }

      let modifiedTarget = false;
      if (targetIsHoriz && !aIsHoriz) {
        // targetAisle horizontal, candidate vertikal
        if (targetAisle.x_mm >= candidate.x_mm && targetAisle.x_mm <= candidate.x_mm + candidate.width_mm) {
          const shift = targetAisle.x_mm - candidate.x_mm;
          targetAisle.x_mm = candidate.x_mm;
          targetAisle.width_mm = Math.max(targetAisle.width_mm, targetAisle.width_mm + shift);
          modifiedTarget = true;
        } else if (targetAisle.x_mm + targetAisle.width_mm >= candidate.x_mm && targetAisle.x_mm + targetAisle.width_mm <= candidate.x_mm + candidate.width_mm) {
          targetAisle.width_mm = (candidate.x_mm + candidate.width_mm) - targetAisle.x_mm;
          modifiedTarget = true;
        }
      } else if (!targetIsHoriz && aIsHoriz) {
        // targetAisle vertikal, candidate horizontal
        if (targetAisle.y_mm >= candidate.y_mm && targetAisle.y_mm <= candidate.y_mm + candidate.length_mm) {
          const shift = targetAisle.y_mm - candidate.y_mm;
          targetAisle.y_mm = candidate.y_mm;
          targetAisle.length_mm = Math.max(targetAisle.length_mm, targetAisle.length_mm + shift);
          modifiedTarget = true;
        } else if (targetAisle.y_mm + targetAisle.length_mm >= candidate.y_mm && targetAisle.y_mm + targetAisle.length_mm <= candidate.y_mm + candidate.length_mm) {
          targetAisle.length_mm = (candidate.y_mm + candidate.length_mm) - targetAisle.y_mm;
          modifiedTarget = true;
        }
      }

      this._updateEntitySpatialHash('aisle', targetAisle);
      this._updateEntitySpatialHash('aisle', candidate);

      if (this.history && (modifiedTarget || willBeBoth)) {
        this.history.push(
          { op: 'update', type: 'aisle', id: targetAisle.id, item: { ...targetAisle }, prevItem: prevTarget },
          { op: 'update', type: 'aisle', id: targetAisle.id, item: prevTarget, prevItem: { ...targetAisle } },
          `Hubungkan Persimpangan Jalan ${targetAisle.aisle_code}`
        );
      }

      return { moved: true, isMerged: true, isConnected: true, aisle: targetAisle, connectedTo: candidate, is_both: willBeBoth };
    }

    return null;
  }

  /**
   * Adds a new zone to the layout
   */
  addZone(customData = {}) {
    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    const width_mm = Math.min(wh.width_mm, customData.width_mm || 15000);
    const length_mm = Math.min(wh.length_mm, customData.length_mm || 10000);
    const maxX = Math.max(0, wh.width_mm - width_mm);
    const maxY = Math.max(0, wh.length_mm - length_mm);
    const rawX = customData.x_mm !== undefined ? Number(customData.x_mm) : 0;
    const rawY = customData.y_mm !== undefined ? Number(customData.y_mm) : 0;
    let clampedX = Math.max(0, Math.min(maxX, rawX));
    let clampedY = Math.max(0, Math.min(maxY, rawY));

    const clientRef = `c-zone-${clientCounter++}`;
    const newZone = {
      id: clientRef,
      client_ref: clientRef,
      zone_code: customData.zone_code || `Z-${String((this.snapshot.zones || []).length + 1).padStart(2, '0')}`,
      name: customData.name || `Zona ${(this.snapshot.zones || []).length + 1}`,
      color_hex: customData.color_hex || '#5c732b',
      x_mm: clampedX,
      y_mm: clampedY,
      width_mm,
      length_mm,
      is_new: true,
    };

    if (!Array.isArray(this.snapshot.zones)) {
      this.snapshot.zones = [];
    }
    this.snapshot.zones.push(newZone);
    this.select('zone', newZone.id);

    if (this.history) {
      this.history.push(
        { op: 'add', type: 'zone', item: { ...newZone } },
        { op: 'delete', type: 'zone', id: newZone.id, item: { ...newZone } },
        `Tambah Zona ${newZone.name}`
      );
    }
    return newZone;
  }

  /**
   * Adds a new layout object (dock, door, pillar/obstacle)
   */
  addLayoutObject(customData = {}) {
    const wh = this.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
    const width_mm = Math.min(wh.width_mm, customData.width_mm || 3000);
    const length_mm = Math.min(wh.length_mm, customData.length_mm || 3000);
    const maxX = Math.max(0, wh.width_mm - width_mm);
    const maxY = Math.max(0, wh.length_mm - length_mm);
    const rawX = customData.x_mm !== undefined ? Number(customData.x_mm) : 0;
    const rawY = customData.y_mm !== undefined ? Number(customData.y_mm) : 0;
    let clampedX = Math.max(0, Math.min(maxX, rawX));
    let clampedY = Math.max(0, Math.min(maxY, rawY));

    const clientRef = `c-obj-${clientCounter++}`;
    const newObj = {
      id: clientRef,
      client_ref: clientRef,
      object_type: customData.object_type || 'dock',
      name:
        customData.name ||
        (customData.object_type === 'dock'
          ? 'Dok Penerimaan'
          : customData.object_type === 'door'
          ? 'Pintu Akses'
          : 'Pilar Gudang'),
      x_mm: clampedX,
      y_mm: clampedY,
      width_mm,
      length_mm,
      height_mm: customData.height_mm || 2500,
      rotation: customData.rotation || 0,
      clearance_mm: customData.clearance_mm || 500,
      is_new: true,
    };

    if (!Array.isArray(this.snapshot.layout_objects)) {
      this.snapshot.layout_objects = [];
    }
    this.snapshot.layout_objects.push(newObj);
    this.select('layout_object', newObj.id);
    this._rebuildSpatialHash();

    if (this.history) {
      this.history.push(
        { op: 'add', type: 'layout_object', item: { ...newObj } },
        { op: 'delete', type: 'layout_object', id: newObj.id, item: { ...newObj } },
        `Tambah ${newObj.name}`
      );
    }
    return newObj;
  }

  /**
   * Updates an entity by ID
   */
  updateEntity(type, id, updates = {}) {
    const cleanId = String(id).includes(':') ? String(id).split(':')[1] : String(id);
    let entity = this.findEntity(type, cleanId) || this.findEntity(type, id);
    let actualType = type;

    if (!entity) {
      const allTypes = ['rack', 'aisle', 'layout_object', 'zone'];
      for (const t of allTypes) {
        const candidateList = this._getEntityList(t);
        const found = candidateList.find(
          (item) => String(item.id) === cleanId || String(item.client_ref) === cleanId || String(item.id) === String(id)
        );
        if (found) {
          entity = found;
          actualType = t;
          break;
        }
      }
    }

    if (!entity) return null;

    const oldState = { ...entity };
    Object.assign(entity, updates);
    this._updateEntitySpatialHash(actualType, entity);

    if (this.history) {
      this.history.push(
        { op: 'update', type: actualType, id: entity.id, to: { ...updates }, item: { ...entity } },
        { op: 'update', type: actualType, id: entity.id, to: oldState, item: oldState },
        `Ubah properti ${actualType} #${entity.id}`
      );
    }
    return entity;
  }

  /**
   * Deletes an entity by ID
   */
  deleteEntity(type, id) {
    const cleanId = String(id).includes(':') ? String(id).split(':')[1] : String(id);
    let list = this._getEntityList(type);
    let index = list.findIndex(
      (item) => String(item.id) === cleanId || String(item.client_ref) === cleanId || String(item.id) === String(id)
    );
    let actualType = type;

    // Fallback search across all entities if not found in target list
    if (index === -1) {
      const allTypes = ['rack', 'aisle', 'layout_object', 'zone'];
      for (const t of allTypes) {
        const candidateList = this._getEntityList(t);
        const foundIdx = candidateList.findIndex(
          (item) => String(item.id) === cleanId || String(item.client_ref) === cleanId || String(item.id) === String(id)
        );
        if (foundIdx !== -1) {
          list = candidateList;
          index = foundIdx;
          actualType = t;
          break;
        }
      }
    }

    if (index === -1) return false;

    const removedItem = list.splice(index, 1)[0];
    const removedId = removedItem.id || cleanId;

    this.deselect(actualType, removedId);
    this.deselect(type, id);
    this.selectedKeys.delete(`${actualType}:${removedId}`);
    this.selectedKeys.delete(`${type}:${id}`);
    this.selectedKeys.delete(String(id));
    this.selectedKeys.delete(String(removedId));
    this._removeEntitySpatialHash(actualType, removedId);

    if (this.history) {
      this.history.push(
        { op: 'delete', type: actualType, id: removedId, item: { ...removedItem } },
        { op: 'add', type: actualType, item: { ...removedItem }, index },
        `Hapus ${actualType} #${removedId}`
      );
    }
    return true;
  }

  // --- REVERSIBLE PATCH APPLICATION (FOR UNDO / REDO) ---
  applyPatch(patch) {
    const { op, type, id, to, item, index } = patch;

    if (op === 'move') {
      const entity = this.findEntity(type, id);
      if (entity && to) {
        entity.x_mm = to.x;
        entity.y_mm = to.y;
      }
    } else if (op === 'rotate') {
      const entity = this.findEntity(type, id);
      if (entity && to) {
        entity.x_mm = to.x;
        entity.y_mm = to.y;
        entity.rotation = to.rotation;
      }
    } else if (op === 'add') {
      const list = this._getEntityList(type);
      if (typeof index === 'number' && index >= 0) {
        list.splice(index, 0, { ...item });
      } else {
        list.push({ ...item });
      }
    } else if (op === 'delete') {
      const list = this._getEntityList(type);
      const idx = list.findIndex((x) => String(x.id) === String(id));
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      this.deselect(type, id);
    } else if (op === 'update') {
      const entity = this.findEntity(type, id);
      if (entity && to) {
        Object.assign(entity, to);
      }
    }

    this._rebuildSpatialHash();
  }

  // --- BATCH PATCH COMPILER ---
  /**
   * Compares working state against original server snapshot and generates
   * atomic batch patch payload for PATCH /api/warehouse-layout/warehouses/:id/layout
   */
  generateBatchPatch() {
    const operations = [];
    const baseVersion = this.originalSnapshot.warehouse.layout_version || 1;

    // 1. Process Racks
    const origRackMap = new Map((this.originalSnapshot.racks || []).map((r) => [String(r.id), r]));
    const currRackMap = new Map((this.snapshot.racks || []).map((r) => [String(r.id), r]));

    // Check updates & creates
    for (const curr of this.snapshot.racks) {
      if (curr.is_new || String(curr.id).startsWith('c-')) {
        operations.push({
          op: 'create',
          entity: 'rack',
          client_ref: curr.client_ref || String(curr.id),
          data: {
            rack_code: curr.rack_code,
            zone_id: curr.zone_id,
            x_mm: curr.x_mm,
            y_mm: curr.y_mm,
            length_mm: curr.length_mm,
            depth_mm: curr.depth_mm,
            height_mm: curr.height_mm,
            rotation: curr.rotation || 0,
            color_hex: curr.color_hex || '#5c732b',
          },
        });
      } else {
        const orig = origRackMap.get(String(curr.id));
        if (orig) {
          const changed = {};
          if (orig.x_mm !== curr.x_mm) changed.x_mm = curr.x_mm;
          if (orig.y_mm !== curr.y_mm) changed.y_mm = curr.y_mm;
          if (orig.rotation !== curr.rotation) changed.rotation = curr.rotation;
          if (orig.zone_id !== curr.zone_id) changed.zone_id = curr.zone_id;
          if (orig.rack_code !== curr.rack_code) changed.rack_code = curr.rack_code;
          if (orig.color_hex !== curr.color_hex) changed.color_hex = curr.color_hex;
          if (orig.height_mm !== curr.height_mm) changed.height_mm = curr.height_mm;
          if (orig.length_mm !== curr.length_mm) changed.length_mm = curr.length_mm;
          if (orig.depth_mm !== curr.depth_mm) changed.depth_mm = curr.depth_mm;

          if (Object.keys(changed).length > 0) {
            operations.push({
              op: 'update',
              entity: 'rack',
              id: curr.id,
              data: changed,
            });
          }
        }
      }
    }

    // Check deletes
    for (const [id, orig] of origRackMap) {
      if (!currRackMap.has(id)) {
        operations.push({
          op: 'delete',
          entity: 'rack',
          id: orig.id,
        });
      }
    }

    // 2. Process Aisles
    const origAisleMap = new Map((this.originalSnapshot.aisles || []).map((a) => [String(a.id), a]));
    const currAisleMap = new Map((this.snapshot.aisles || []).map((a) => [String(a.id), a]));

    for (const curr of this.snapshot.aisles) {
      if (curr.is_new || String(curr.id).startsWith('c-')) {
        operations.push({
          op: 'create',
          entity: 'aisle',
          client_ref: curr.client_ref || String(curr.id),
          data: {
            aisle_code: curr.aisle_code,
            name: curr.name,
            x_mm: curr.x_mm,
            y_mm: curr.y_mm,
            width_mm: curr.width_mm,
            length_mm: curr.length_mm,
            direction: curr.direction || 'two_way',
          },
        });
      } else {
        const orig = origAisleMap.get(String(curr.id));
        if (orig) {
          const changed = {};
          if (orig.x_mm !== curr.x_mm) changed.x_mm = curr.x_mm;
          if (orig.y_mm !== curr.y_mm) changed.y_mm = curr.y_mm;
          if (orig.width_mm !== curr.width_mm) changed.width_mm = curr.width_mm;
          if (orig.length_mm !== curr.length_mm) changed.length_mm = curr.length_mm;
          if (orig.name !== curr.name) changed.name = curr.name;
          if (orig.aisle_code !== curr.aisle_code) changed.aisle_code = curr.aisle_code;
          if (orig.direction !== curr.direction) changed.direction = curr.direction;

          if (Object.keys(changed).length > 0) {
            operations.push({
              op: 'update',
              entity: 'aisle',
              id: curr.id,
              data: changed,
            });
          }
        }
      }
    }

    for (const [id, orig] of origAisleMap) {
      if (!currAisleMap.has(id)) {
        operations.push({
          op: 'delete',
          entity: 'aisle',
          id: orig.id,
        });
      }
    }

    // 3. Process Layout Objects (Doors, Obstacles, etc.)
    const origObjMap = new Map((this.originalSnapshot.layout_objects || []).map((o) => [String(o.id), o]));
    const currObjMap = new Map((this.snapshot.layout_objects || []).map((o) => [String(o.id), o]));

    for (const curr of this.snapshot.layout_objects || []) {
      if (curr.is_new || String(curr.id).startsWith('c-')) {
        operations.push({
          op: 'create',
          entity: 'layout_object',
          client_ref: curr.client_ref || String(curr.id),
          data: {
            object_type: curr.object_type || 'door_entry',
            name: curr.name,
            x_mm: curr.x_mm,
            y_mm: curr.y_mm,
            width_mm: curr.width_mm,
            length_mm: curr.length_mm,
            height_mm: curr.height_mm || 2500,
            rotation: curr.rotation || 0,
            clearance_mm: curr.clearance_mm || 0,
          },
        });
      } else {
        const orig = origObjMap.get(String(curr.id));
        if (orig) {
          const changed = {};
          if (orig.x_mm !== curr.x_mm) changed.x_mm = curr.x_mm;
          if (orig.y_mm !== curr.y_mm) changed.y_mm = curr.y_mm;
          if (orig.width_mm !== curr.width_mm) changed.width_mm = curr.width_mm;
          if (orig.length_mm !== curr.length_mm) changed.length_mm = curr.length_mm;
          if (orig.name !== curr.name) changed.name = curr.name;
          if (orig.object_type !== curr.object_type) changed.object_type = curr.object_type;
          if (orig.height_mm !== curr.height_mm) changed.height_mm = curr.height_mm;
          if (orig.rotation !== curr.rotation) changed.rotation = curr.rotation;

          if (Object.keys(changed).length > 0) {
            operations.push({
              op: 'update',
              entity: 'layout_object',
              id: curr.id,
              data: changed,
            });
          }
        }
      }
    }

    for (const [id, orig] of origObjMap) {
      if (!currObjMap.has(id)) {
        operations.push({
          op: 'delete',
          entity: 'layout_object',
          id: orig.id,
        });
      }
    }

    return {
      expectedLayoutVersion: baseVersion,
      base_version: baseVersion,
      operations,
    };
  }

  /**
   * Resets original baseline after a successful commit/save
   */
  markCommitted(newSnapshot) {
    this.originalSnapshot = JSON.parse(JSON.stringify(newSnapshot));
    this.snapshot = JSON.parse(JSON.stringify(newSnapshot));
    if (this.history) {
      this.history.markSaved();
    }
    this._rebuildSpatialHash();
  }
}
