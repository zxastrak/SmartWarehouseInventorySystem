/**
 * Floor Plan Editor & Top View Canvas Page
 * Native Canvas 2D engine with 0 React re-renders during drag/pan/zoom.
 * Integrated with HistoryManager (100 steps undo/redo) and DocumentStore (atomic batch patch).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LayoutRenderer } from '../engine/renderer.js';
import { PointerController } from '../engine/pointerEvents.js';
import { createViewport, fitBounds, zoomAt } from '../engine/viewport.js';
import SpatialHash from '../../../../../shared/layout-core/src/spatialHash.js';
import geometry from '../../../../../shared/layout-core/src/geometry.js';
import { HistoryManager } from '../editor/history.js';
import { DocumentStore } from '../editor/documentStore.js';
import EditorToolbar from '../components/EditorToolbar.jsx';
import ConflictDialog from '../components/ConflictDialog.jsx';
import LocationGeneratorModal from '../components/LocationGeneratorModal.jsx';
import LocationDirectoryDrawer from '../components/LocationDirectoryDrawer.jsx';
import LocationInspectorModal from '../components/LocationInspectorModal.jsx';
import SlotConfigDrawer from '../components/SlotConfigDrawer.jsx';
import AddRackDrawer from '../components/AddRackDrawer.jsx';
import ManageAssetsDrawer from '../components/ManageAssetsDrawer.jsx';
import LayersDrawer from '../components/LayersDrawer.jsx';
import Warehouse3DCanvas from '../components/Warehouse3DCanvas.jsx';
import PathModePanel from '../components/PathModePanel.jsx';
import DashboardSidebar from '../../../components/DashboardSidebar.jsx';
import { buildLayoutRouting, astar } from '../../../../../shared/layout-core/src/index.js';
import '../styles/warehouseLayout.css';

const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api';

function getAuthToken() {
  return localStorage.getItem('susuno_token') || localStorage.getItem('susuno_auth_token') || 'demo_token';
}

const { footprint } = geometry;

const RULER_THICKNESS = 24;
const WAREHOUSE_MARGIN = 60; // 60px margin on top and left so it's not crammed
const ORIGIN_OFFSET = RULER_THICKNESS + WAREHOUSE_MARGIN; // 84px

const DEFAULT_FALLBACK_WIDTH_MM = 50000;
const DEFAULT_FALLBACK_LENGTH_MM = 80000;
const MIN_VIEWPORT_DIMENSION_PX = 300;
const BASE_VIEWPORT_SCALE = 0.015;
const MIN_VIEWPORT_SCALE = 0.012;
const MAX_VIEWPORT_SCALE = 0.08;

/**
 * Calculates an Excel-model viewport: (0, 0) is anchored at the top-left with empty margin
 * Expands rightwards (X) and downwards (Y) comfortably.
 */
function computeComfortableViewport(snapshot, clientW, clientH) {
  if (!snapshot || !snapshot.warehouse) {
    return createViewport(BASE_VIEWPORT_SCALE, ORIGIN_OFFSET, ORIGIN_OFFSET);
  }

  const wh = snapshot.warehouse;
  const availW = Math.max(clientW - ORIGIN_OFFSET - 60, MIN_VIEWPORT_DIMENSION_PX);
  const availH = Math.max(clientH - ORIGIN_OFFSET - 60, MIN_VIEWPORT_DIMENSION_PX);

  const scaleW = availW / (wh.width_mm || DEFAULT_FALLBACK_WIDTH_MM);
  const scaleH = availH / (wh.length_mm || DEFAULT_FALLBACK_LENGTH_MM);
  const scale = Math.min(Math.max(Math.min(scaleW, scaleH) * 0.95, MIN_VIEWPORT_SCALE), MAX_VIEWPORT_SCALE);

  return {
    scale,
    tx: ORIGIN_OFFSET,
    ty: ORIGIN_OFFSET,
  };
}

export default function WarehouseLayoutPage({
  warehouseId = 1,
  warehouse = null,
  manager = null,
  onNavigate = null,
  onBack = null,
}) {
  const containerRef = useRef(null);
  const baseCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  // Non-rendering Engine & Store Instances stored in Ref
  const rendererRef = useRef(null);
  const pointerControllerRef = useRef(null);
  const spatialHashRef = useRef(new SpatialHash(1000));
  const viewportRef = useRef(createViewport(0.015, ORIGIN_OFFSET, ORIGIN_OFFSET));
  const historyRef = useRef(new HistoryManager(100));
  const documentStoreRef = useRef(null);

  // React State only for loading, toolbar status, and modals
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [layoutSessionKey, setLayoutSessionKey] = useState(0);
  const [fps, setFps] = useState(60);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [selectedCount, setSelectedCount] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [viewMode, setViewMode] = useState('2d'); // '2d' | '3d'

  // Trigger 2D re-render when switching back from 3D
  useEffect(() => {
    if (viewMode === '2d' && rendererRef.current) {
      rendererRef.current.markDirty(false);
    }
  }, [viewMode]);

  // Toolbar & Editing States
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Unsaved changes navigation guard state
  const [unsavedNavModalOpen, setUnsavedNavModalOpen] = useState(false);
  const [pendingTargetRoute, setPendingTargetRoute] = useState(null);

  // Browser reload / tab close guard when isDirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Sidebar navigation handler with unsaved guard
  const handleSidebarNavigate = useCallback(
    (label) => {
      if (label === 'Warehouse Layout') return;
      const routes = {
        Dashboard: 'dashboard',
        'Warehouse Layout': 'warehouse-layout',
        Inventory: 'inventory',
        Inbound: 'inbound',
        Outbound: 'outbound',
        'AI Insight': 'ai-insight',
        'Purchase Orders': 'purchase-orders',
        Suppliers: 'suppliers',
        Reports: 'reports',
        'Audit Trail': 'audit-trail',
        'Staff Management': 'staff-management',
        Settings: 'settings',
      };
      const target = routes[label] || label;
      if (isDirty) {
        setPendingTargetRoute(target);
        setUnsavedNavModalOpen(true);
        return;
      }
      if (onNavigate) {
        onNavigate(target);
      } else if (onBack) {
        onBack();
      }
    },
    [isDirty, onNavigate, onBack]
  );

  // Conflict Modal State (AC-15)
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictDetails, setConflictDetails] = useState(null);

  // STEP 11: Bulk Location Generator Modal State
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [selectedRackForGenerator, setSelectedRackForGenerator] = useState(null);

  // STEP 12: Location Directory & Inspector State
  const [directoryDrawerOpen, setDirectoryDrawerOpen] = useState(false);
  const [inspectorModalOpen, setInspectorModalOpen] = useState(false);
  const [selectedLocationIdForInspection, setSelectedLocationIdForInspection] = useState(null);

  // Phase 4: Pathfinding & Routing State (Matriks dasar selalu aktif secara default)
  const [showGrid, setShowGrid] = useState(true);
  const [showMeterGrid, setShowMeterGrid] = useState(true);
  const [showGridHorizontal, setShowGridHorizontal] = useState(true);
  const [showGridVertical, setShowGridVertical] = useState(true);
  const [showSlotGrid, setShowSlotGrid] = useState(true);
  const [showSlotHorizontal, setShowSlotHorizontal] = useState(true);
  const [showSlotVertical, setShowSlotVertical] = useState(false);
  const [isPathMode, setIsPathMode] = useState(false);
  const [pathStartNode, setPathStartNode] = useState('');
  const [pathGoalNode, setPathGoalNode] = useState('');
  const [pathAgentProfile, setPathAgentProfile] = useState('human');
  const [activeRoute, setActiveRoute] = useState(null);
  const routingDataRef = useRef(null);

  const isPathModeRef = useRef(false);
  const pathStartNodeRef = useRef('');
  const pathGoalNodeRef = useRef('');
  useEffect(() => {
    isPathModeRef.current = isPathMode;
    pathStartNodeRef.current = pathStartNode;
    pathGoalNodeRef.current = pathGoalNode;
  }, [isPathMode, pathStartNode, pathGoalNode]);

  // Pointer Tool Selection ('select' / Move | 'hand' / Hand tool)
  const [activeTool, setActiveTool] = useState('select');
  useEffect(() => {
    if (pointerControllerRef.current) {
      pointerControllerRef.current.setActiveTool(activeTool);
    }
    if (activeTool === 'select') {
      setIsFillSlotMode(false);
      setIsFillDockMode(false);
      setIsFillAisleMode(false);
      setIsPlacementActive(false);
    }
  }, [activeTool]);

  // Modular Slot Dimensions State (70cm x 50cm x 40cm default)
  const [slotConfig, setSlotConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('susuno_slot_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { lengthMm: 700, depthMm: 500, heightMm: 400 };
  });
  const [slotRotated, setSlotRotated] = useState(false);
  const [isFillSlotMode, setIsFillSlotMode] = useState(false);
  const [isFillDockMode, setIsFillDockMode] = useState(false);
  const [dockFillConfig, setDockFillConfig] = useState({ name: 'Dok Standar', widthM: 4, lengthM: 6 });
  const [isFillAisleMode, setIsFillAisleMode] = useState(false);
  const [aisleFillConfig, setAisleFillConfig] = useState({
    type: 'standard',
    name: 'Jalan Lorong',
    code: 'A',
    widthM: 2,
    direction: 'two_way',
  });
  const [totalRacks, setTotalRacks] = useState(0);
  const [activeRackColor, setActiveRackColor] = useState('#5c732b');
  const [activeLevelCount, setActiveLevelCount] = useState(3);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [addRackDrawerOpen, setAddRackDrawerOpen] = useState(false);
  const [manageAssetsDrawerOpen, setManageAssetsDrawerOpen] = useState(false);
  const [layersDrawerOpen, setLayersDrawerOpen] = useState(false);
  const [hiddenLayers, setHiddenLayers] = useState(() => new Set());
  const [hiddenEntityIds, setHiddenEntityIds] = useState(() => new Set());

  // Interactive Stamp Placement Mode State
  const [isPlacementActive, setIsPlacementActive] = useState(false);
  const [placementRackCode, setPlacementRackCode] = useState('');

  // Walkway & Forklift Configuration (Clearance & Aisle Width)
  const [walkwayConfig, setWalkwayConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('susuno_walkway_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      aisleWidthM: 1.5,
      hasForklift: false,
      forkliftLengthM: 2.4,
      forkliftWidthM: 1.2,
    };
  });

  const handleWalkwayConfigChange = useCallback((newConfig) => {
    setWalkwayConfig(newConfig);
    setIsDirty(true);
    try {
      localStorage.setItem('susuno_walkway_config', JSON.stringify(newConfig));
    } catch {}
  }, []);

  // FPS Tracking Variables (non-react state)
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((text, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pointerControllerRef.current) {
      pointerControllerRef.current.updateSlotConfig(slotConfig, slotRotated, isFillSlotMode, activeRackColor);
    }
  }, [slotConfig, slotRotated, isFillSlotMode, activeRackColor]);

  useEffect(() => {
    if (pointerControllerRef.current) {
      pointerControllerRef.current.updateDockFillMode(isFillDockMode, dockFillConfig);
    }
  }, [isFillDockMode, dockFillConfig]);

  useEffect(() => {
    if (pointerControllerRef.current) {
      pointerControllerRef.current.updateAisleFillMode(isFillAisleMode, aisleFillConfig);
    }
  }, [isFillAisleMode, aisleFillConfig]);

  // Enforce: Input jalan hanya aktif ketika memencet kelola aset dan memilih jalan
  useEffect(() => {
    if (!manageAssetsDrawerOpen && isFillAisleMode) {
      setIsFillAisleMode(false);
    }
  }, [manageAssetsDrawerOpen, isFillAisleMode]);

  // Update Toolbar status from History and Store
  const syncStoreUI = useCallback(() => {
    if (!historyRef.current || !documentStoreRef.current) return;
    const history = historyRef.current;
    const store = documentStoreRef.current;

    setCanUndo(history.canUndo());
    setCanRedo(history.canRedo());
    setIsDirty(history.isDirty());
    setSelectedCount(store.selectedKeys.size);
    setTotalRacks(store.snapshot.racks?.length || 0);

    // Update React snapshot state so LayersDrawer, 3D Canvas, and modals update immediately
    setSnapshot({
      ...store.snapshot,
      racks: store.snapshot.racks ? [...store.snapshot.racks] : [],
      aisles: store.snapshot.aisles ? [...store.snapshot.aisles] : [],
      zones: store.snapshot.zones ? [...store.snapshot.zones] : [],
      layout_objects: store.snapshot.layout_objects ? [...store.snapshot.layout_objects] : [],
    });

    if (rendererRef.current) {
      rendererRef.current.snapshot = store.snapshot;
      rendererRef.current.spatialHash = store.spatialHash;
      rendererRef.current.markDirty(false);
    }
    if (pointerControllerRef.current) {
      pointerControllerRef.current.updateData(store.snapshot, store.spatialHash, viewportRef.current);
    }
  }, []);

  // 1. Fetch Layout Snapshot
  const loadLayoutSnapshot = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/warehouses/${id}/layout?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Gagal memuat layout (HTTP ${res.status})`);
      }

      const json = await res.json();
      const layoutData = json.data;

      // Inisialisasi DocumentStore & History
      const history = new HistoryManager(100);
      historyRef.current = history;
      const docStore = new DocumentStore(layoutData, history);
      documentStoreRef.current = docStore;
      spatialHashRef.current = docStore.spatialHash;

      setSnapshot(layoutData);
      setTotalRacks(layoutData.racks?.length || 0);
      setCanUndo(false);
      setCanRedo(false);
      setIsDirty(false);
      setSelectedCount(0);
      setConflictOpen(false);
      setLoading(false);
      setLayoutSessionKey((k) => k + 1);
    } catch (err) {
      console.error('[LAYOUT FETCH ERROR]', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLayoutSnapshot(warehouseId);
  }, [warehouseId, loadLayoutSnapshot]);

  // 2. Initialize Canvas Engine when layout snapshot is loaded
  useEffect(() => {
    if (!layoutSessionKey || !documentStoreRef.current || !baseCanvasRef.current || !overlayCanvasRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const baseCanvas = baseCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const store = documentStoreRef.current;

    const renderer = new LayoutRenderer(baseCanvas, overlayCanvas);
    rendererRef.current = renderer;

    const initVp = computeComfortableViewport(
      store.snapshot,
      container.clientWidth || 800,
      container.clientHeight || 600
    );
    viewportRef.current = initVp;
    setZoomPercent(Math.round((initVp.scale / 0.035) * 100));

    renderer.snapshot = store.snapshot;
    renderer.spatialHash = store.spatialHash;
    renderer.viewport = initVp;
    renderer.setSlotConfig(slotConfig);
    renderer.setGridVisibility({
      meter: showMeterGrid,
      horizontal: showGridHorizontal,
      vertical: showGridVertical,
      slot: showSlotGrid,
      slotRotated,
    });
    renderer.resize(container.clientWidth || 800, container.clientHeight || 600);

    // Initial 50cm matrix mesh grid jika showGrid aktif
    if (showGrid) {
      if (!routingDataRef.current && store.snapshot) {
        routingDataRef.current = buildLayoutRouting(store.snapshot, 500, 500);
      }
      if (routingDataRef.current?.grid) {
        renderer.setGridMatrix(routingDataRef.current.grid, true);
      }
    }

    // FPS loop counter
    renderer.onFrameRendered = () => {
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    };

    // Pointer Controller
    const pointer = new PointerController(overlayCanvas, {
      viewport: initVp,
      snapshot: store.snapshot,
      spatialHash: store.spatialHash,
      activeTool,
      slotConfig,
      slotRotated,
      isFillSlotMode,
      isFillDockMode,
      activeColorHex: activeRackColor,
      onSlotFillCommit: (ghost) => {
        if (!documentStoreRef.current) return;
        if (ghost.isColliding) {
          showToast('⚠️ Gagal membuat rak: area tumpang tindih dengan objek atau rak lain!', 'warning');
          return;
        }
        const store = documentStoreRef.current;
        const isVertical = Boolean(slotRotated || ghost.depthCount > ghost.bayCount);
        const wh = store.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };

        if (
          ghost.x_mm < 0 ||
          ghost.y_mm < 0 ||
          ghost.x_mm + ghost.width_mm > wh.width_mm ||
          ghost.y_mm + ghost.depth_mm > wh.length_mm
        ) {
          showToast('⚠️ Gagal membuat rak: posisi atau ukuran melebihi batas dinding gudang!', 'warning');
          return;
        }

        const collisions = store.spatialHash.query({
          x: ghost.x_mm,
          y: ghost.y_mm,
          width: ghost.width_mm,
          depth: ghost.depth_mm,
        });

        if (collisions.length > 0) {
          showToast('⚠️ Gagal membuat rak: area tumpang tindih dengan objek atau rak lain!', 'warning');
          return;
        }

        const rackCode = `${ghost.rowLetter}-${String(ghost.startCol).padStart(2, '0')}`;
        const bayCount = isVertical ? ghost.depthCount : ghost.bayCount;
        const slotW = ghost.slotW || (slotRotated ? (slotConfig?.depthMm || 500) : (slotConfig?.lengthMm || 1000));
        const slotD = ghost.slotD || (slotRotated ? (slotConfig?.lengthMm || 1000) : (slotConfig?.depthMm || 500));

        const newRack = store.addRack({
          rack_code: rackCode,
          x_mm: ghost.x_mm,
          y_mm: ghost.y_mm,
          length_mm: isVertical ? ghost.depth_mm : ghost.width_mm,
          depth_mm: isVertical ? ghost.width_mm : ghost.depth_mm,
          height_mm: (slotConfig?.heightMm ? slotConfig.heightMm * activeLevelCount : activeLevelCount * 500),
          rotation: isVertical ? 90 : 0,
          level_count: activeLevelCount,
          bay_count: bayCount,
          slot_width_mm: isVertical ? slotD : slotW,
          slot_depth_mm: isVertical ? slotW : slotD,
          slot_rotated: isVertical,
          color_hex: ghost.color_hex || activeRackColor,
        });
        store.select('rack', newRack.id);
        setActiveTool('select');
        setIsFillSlotMode(false);
        setIsDirty(true);
        syncStoreUI();
        rendererRef.current?.markDirty(false);
        showToast(`✓ Rak ${newRack.rack_code} (${activeLevelCount} Tingkat) berhasil dibuat (${isVertical ? 'Vertikal' : 'Horizontal'}, ${bayCount} Slot)`);
      },
      onDockFillCommit: (ghost) => {
        const store = documentStoreRef.current;
        const wh = store?.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
        if (ghost.x_mm < 0 || ghost.y_mm < 0 || ghost.x_mm + ghost.width_mm > wh.width_mm || ghost.y_mm + ghost.length_mm > wh.length_mm) {
          showToast('⚠️ Gagal membuat dok: area melebihi batas dinding gudang!', 'warning');
          return;
        }
        if (ghost.isColliding) {
          showToast('⚠️ Gagal membuat dok: area tumpang tindih dengan rak atau objek lain!', 'warning');
          return;
        }
        handleAddDock({
          name: ghost.name || 'Dok Muat',
          width_mm: ghost.width_mm,
          length_mm: ghost.length_mm,
          x_mm: ghost.x_mm,
          y_mm: ghost.y_mm,
          clearance_mm: 500,
        });
        setIsFillDockMode(false);
        setActiveTool('select');
      },
      isFillAisleMode,
      aisleConfig: aisleFillConfig,
      onAisleFillCommit: (ghost) => {
        let finalGhost = { ...ghost };
        const store = documentStoreRef.current;
        const wh = store?.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };
        // Jalankan auto-fit clearance sebagai proteksi penyesuaian jika ditempatkan pada celah sempit
        if (pointerControllerRef.current && store) {
          const fitted = pointerControllerRef.current._snapAisleToRackClearance({
            x: finalGhost.x_mm,
            y: finalGhost.y_mm,
            width: finalGhost.width_mm,
            depth: finalGhost.length_mm,
          });
          finalGhost.x_mm = fitted.x;
          finalGhost.y_mm = fitted.y;
          finalGhost.width_mm = fitted.width;
          finalGhost.length_mm = fitted.depth;
        }

        if (finalGhost.x_mm < 0 || finalGhost.y_mm < 0 || finalGhost.x_mm + finalGhost.width_mm > wh.width_mm || finalGhost.y_mm + finalGhost.length_mm > wh.length_mm) {
          showToast('⚠️ Gagal membuat jalan: area lorong melebihi batas dinding gudang!', 'warning');
          return;
        }

        if (store) {
          const isFk = finalGhost.type === 'forklift' || String(finalGhost.name || '').toLowerCase().includes('forklift');
          const isDock = (id) => {
            if (!String(id).startsWith('layout_object:')) return false;
            const rawId = id.replace('layout_object:', '');
            const obj = store.snapshot?.layout_objects?.find((o) => String(o.id) === String(rawId));
            return obj && String(obj.object_type || '').includes('dock');
          };

          let collisions = store.spatialHash.query({
            x: finalGhost.x_mm,
            y: finalGhost.y_mm,
            width: finalGhost.width_mm,
            depth: finalGhost.length_mm,
          }).filter((id) => {
            if (String(id).startsWith('aisle:')) return false;
            if (isFk && isDock(id)) return false; // Forklift bisa menimpa dok!
            return true;
          });
          if (collisions.length > 0) {
            // Coba trim sekali lagi dengan snap clearance
            if (pointerControllerRef.current) {
              const fitted2 = pointerControllerRef.current._snapAisleToRackClearance({
                x: finalGhost.x_mm,
                y: finalGhost.y_mm,
                width: finalGhost.width_mm,
                depth: finalGhost.length_mm,
              });
              const c2 = store.spatialHash.query({
                x: fitted2.x,
                y: fitted2.y,
                width: fitted2.width,
                depth: fitted2.depth,
              }).filter((id) => {
                if (String(id).startsWith('aisle:')) return false;
                if (isFk && isDock(id)) return false;
                return true;
              });
              if (c2.length === 0 && fitted2.width >= 300 && fitted2.depth >= 300) {
                finalGhost.x_mm = fitted2.x;
                finalGhost.y_mm = fitted2.y;
                finalGhost.width_mm = fitted2.width;
                finalGhost.length_mm = fitted2.depth;
                collisions = [];
              }
            }
            if (collisions.length > 0) {
              showToast('⚠️ Jalan tidak dapat menimpa atau menghapus rak! Silakan geser posisi rak terlebih dahulu.', 'warning');
              return;
            }
          }
        }

        const existingAisles = documentStoreRef.current?.snapshot?.aisles || [];
        const isFk = finalGhost.type === 'forklift';
        const isPed = finalGhost.type === 'pedestrian';
        const prefix = isFk ? 'FK' : isPed ? 'P' : 'A';
        const usedNums = existingAisles
          .map((a) => {
            const m = (a.aisle_code || '').match(new RegExp(`^${prefix}-(\\d+)$`));
            return m ? parseInt(m[1], 10) : 0;
          })
          .filter((n) => n > 0);
        const nextNum = (usedNums.length > 0 ? Math.max(...usedNums) : 0) + 1;
        const finalCode = finalGhost.aisle_code && finalGhost.aisle_code.includes('-')
          ? finalGhost.aisle_code
          : `${prefix}-${String(nextNum).padStart(2, '0')}`;

        handleAddAisleFromAsset({
          name: finalGhost.name || (finalGhost.type === 'forklift' ? 'Jalur Forklift' : 'Jalan Lorong'),
          aisle_code: finalCode,
          width_mm: finalGhost.width_mm,
          length_mm: finalGhost.length_mm,
          x_mm: finalGhost.x_mm,
          y_mm: finalGhost.y_mm,
          type: finalGhost.type || 'standard',
          direction: finalGhost.direction || 'two_way',
        });
        setIsFillAisleMode(false);
        setActiveTool('select');
      },
      onViewportChange: (newVp) => {
        viewportRef.current = newVp;
        setZoomPercent(Math.round((newVp.scale / 0.015) * 100));
        renderer.viewport = newVp;
      },
      onSelectionChange: (selectedItems) => {
        store.clearSelection();
        for (const item of selectedItems) {
          if (typeof item === 'object' && item.type && item.id) {
            store.select(item.type, item.id, true);
          } else {
            store.select('rack', item, true);
          }
        }
        syncStoreUI();

        // Path mode click-to-route handling
        if (isPathModeRef.current && selectedItems && selectedItems.length > 0) {
          const first = selectedItems[0];
          const clickedId = typeof first === 'object' ? first.id : first;
          const rackNodeId = `pick_rack_${clickedId}`;
          if (!pathStartNodeRef.current) {
            setPathStartNode(rackNodeId);
          } else if (!pathGoalNodeRef.current) {
            setPathGoalNode(rackNodeId);
          }
        }
      },
      onDragCommit: (dragged) => {
        if (!dragged) return;
        const type = dragged.type || 'rack';
        const isDoor = type === 'layout_object' && String(dragged.item?.object_type || store.findEntity('layout_object', dragged.id)?.object_type || '').includes('door');

        // Khusus aisle: sinkronisasi dimensi auto-fitted sebelum validasi move agar tidak bertabrakan dengan ukuran lama
        if (type === 'aisle' && (dragged.width || dragged.width_mm) && (dragged.depth || dragged.length_mm)) {
          const item = store.findEntity('aisle', dragged.id);
          if (item) {
            item.width_mm = dragged.width || dragged.width_mm;
            item.length_mm = dragged.depth || dragged.length_mm;
          }
        }
        if (dragged.isColliding && !isDoor) {
          showToast(type === 'aisle' ? '⚠️ Jalan tidak dapat menimpa rak! Silakan geser posisi rak terlebih dahulu.' : '⚠️ Posisi tumpang tindih! Gerakan dibatalkan untuk menjaga jarak aman.', 'warning');
          rendererRef.current?.markDirty(false);
          return;
        }
        if (dragged.isResize) {
          const item = store.findEntity(type, dragged.id);
          if (item) {
            let newW = dragged.width || dragged.width_mm || item.width_mm;
            let newL = dragged.depth || dragged.length_mm || item.length_mm;

            // Khusus Forklift: KUNCI LEBAR jalur forklift sesuai input user (tidak boleh membesar atau mengecil)
            const isForklift = type === 'aisle' && (
              item.type === 'forklift' ||
              String(item.name || '').toLowerCase().includes('forklift') ||
              item.direction === 'forklift'
            );
            if (isForklift) {
              const isHoriz = item.width_mm >= item.length_mm;
              if (isHoriz) {
                // Lebar penampang jalan (sumbu Y) terkunci sesuai input
                newL = item.length_mm;
              } else {
                // Lebar penampang jalan (sumbu X) terkunci sesuai input
                newW = item.width_mm;
              }
            }

            store.updateEntity(type, dragged.id, {
              x_mm: dragged.x_mm,
              y_mm: dragged.y_mm,
              width_mm: newW,
              length_mm: newL,
            });
            if (type === 'aisle') {
              const mergeRes = store.mergeAisle(dragged.id);
              if (mergeRes && mergeRes.isMerged) {
                if (mergeRes.is_both) {
                  showToast(`✓ Jalan forklift & pejalan kaki digabungkan menjadi Jalur Bersama '${mergeRes.aisle?.name || ''}' (Dual Indikator 🚜🚶)!`, 'success');
                } else if (mergeRes.isConnected) {
                  showToast(`✓ Persimpangan jalan forklift terhubung mulus di tikungan (L-Corner / T-Junction)!`, 'success');
                } else {
                  showToast(`✓ Jalan forklift berhasil digabungkan menjadi satu lorong!`, 'success');
                }
              } else {
                showToast(`✓ Ukuran '${item.name || 'Jalan'}' berhasil diubah: ${(newW / 1000).toFixed(1)}m × ${(newL / 1000).toFixed(1)}m`, 'success');
              }
            } else {
              showToast(`✓ Ukuran '${item.name || 'Dok'}' berhasil diubah: ${(newW / 1000).toFixed(1)}m × ${(newL / 1000).toFixed(1)}m`, 'success');
            }
            setIsDirty(true);
            syncStoreUI();
            rendererRef.current?.markDirty(false);
            return;
          }
        }
        const moved = store.moveEntity(type, dragged.id, dragged.x_mm, dragged.y_mm, !isDoor);
        if (!moved) {
          showToast(type === 'aisle' ? '⚠️ Jalan tidak dapat menimpa rak! Silakan geser posisi rak terlebih dahulu.' : '⚠️ Tidak dapat memindahkan ke posisi tersebut karena tumpang tindih.', 'warning');
          rendererRef.current?.markDirty(false);
          return;
        }
        if (type === 'aisle' && moved && moved.isMerged) {
          if (moved.is_both) {
            showToast(`✓ Jalan forklift & pejalan kaki digabungkan menjadi Jalur Bersama '${moved.aisle?.name || ''}' (Dual Indikator 🚜🚶)!`, 'success');
          } else if (moved.isConnected) {
            showToast(`✓ Persimpangan jalan forklift terhubung mulus di tikungan (L-Corner / T-Junction)!`, 'success');
          } else if (moved.aisle?.type === 'forklift') {
            showToast(`✓ Jalan forklift bertabrakan & berhasil digabungkan menjadi satu lorong!`, 'success');
          } else {
            showToast(`✓ Jalan pejalan kaki bertabrakan & berhasil digabungkan menjadi satu lorong!`, 'success');
          }
        }
        if (type === 'layout_object' && (dragged.width || dragged.width_mm) && (dragged.depth || dragged.length_mm)) {
          const item = store.findEntity('layout_object', dragged.id);
          if (item) {
            item.width_mm = dragged.width || dragged.width_mm;
            item.length_mm = dragged.depth || dragged.length_mm;
          }
        }
        setIsDirty(true);
        syncStoreUI();
        rendererRef.current?.markDirty(false);
      },
      onPlacementCollision: () => {
        showToast('⚠️ Posisi tumpang tindih! Tidak dapat meletakkan rak di atas objek lain.', 'warning');
      },
      onPlacementCommit: (placed) => {
        if (!documentStoreRef.current) return;
        const store = documentStoreRef.current;
        const isRot = (placed.rotation || 0) === 90 || (placed.rotation || 0) === 270;
        const fp = footprint(placed.length_mm, placed.depth_mm, placed.rotation || 0);
        const wh = store.snapshot?.warehouse || { width_mm: 50000, length_mm: 80000 };

        if (placed.x_mm < 0 || placed.y_mm < 0 || placed.x_mm + fp.width > wh.width_mm || placed.y_mm + fp.depth > wh.length_mm) {
          showToast('⚠️ Posisi rak di luar batas dinding gudang!', 'warning');
          return;
        }

        const collisions = store.spatialHash.query({
          x: placed.x_mm,
          y: placed.y_mm,
          width: fp.width,
          depth: fp.depth,
        });
        if (collisions.length > 0) {
          showToast('⚠️ Posisi tumpang tindih! Tidak dapat meletakkan rak di atas objek lain.', 'warning');
          return;
        }

        const newRack = store.addRack({
          rack_code: placed.rack_code,
          x_mm: placed.x_mm,
          y_mm: placed.y_mm,
          length_mm: placed.length_mm,
          depth_mm: placed.depth_mm,
          height_mm: placed.height_mm,
          rotation: placed.rotation || 0,
          bay_count: placed.bay_count || Math.max(1, Math.round(placed.length_mm / (slotConfig?.lengthMm || 1000))),
          level_count: placed.level_count || activeLevelCount,
          color_hex: placed.color_hex || activeRackColor,
          slot_width_mm: placed.slotW || (slotConfig?.lengthMm || 1000),
          slot_depth_mm: placed.slotD || (slotConfig?.depthMm || 500),
          slot_rotated: isRot,
        });
        store.select('rack', newRack.id);
        setActiveTool('select');
        setIsPlacementActive(false);
        setIsDirty(true);
        syncStoreUI();
        rendererRef.current?.markDirty(false);
        showToast(`✓ Rak ${newRack.rack_code} (${newRack.level_count || 3} Tingkat) berhasil diletakkan!`, 'success');
      },
      onPlacementCancel: () => {
        setIsPlacementActive(false);
      },
      onRenderRequest: (overlayOnly) => {
        renderer.overlayState = pointer.getOverlayState();
        renderer.markDirty(overlayOnly);
      },
    });
    pointerControllerRef.current = pointer;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          renderer.resize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    renderer.start();

    return () => {
      resizeObserver.disconnect();
      pointer.destroy();
      renderer.stop();
    };
  }, [layoutSessionKey, syncStoreUI]);

  // --- TOOLBAR & MANIPULATION HANDLERS ---
  const handleUndo = useCallback(() => {
    if (!historyRef.current || !documentStoreRef.current) return;
    historyRef.current.undo((patch) => {
      documentStoreRef.current.applyPatch(patch);
    });
    syncStoreUI();
  }, [syncStoreUI]);

  const handleRedo = useCallback(() => {
    if (!historyRef.current || !documentStoreRef.current) return;
    historyRef.current.redo((patch) => {
      documentStoreRef.current.applyPatch(patch);
    });
    syncStoreUI();
  }, [syncStoreUI]);

  const handleOpenAddRack = useCallback(() => {
    setSlotModalOpen(false);
    setAddRackDrawerOpen(true);
  }, []);

  const handleCancelPlacement = useCallback(() => {
    pointerControllerRef.current?.cancelPlacement();
    setIsPlacementActive(false);
    showToast('Penempatan rak dibatalkan', 'info');
  }, [showToast]);

  const handleConfirmAddRack = useCallback((rackData) => {
    setPlacementRackCode(rackData.rack_code || 'R-01');
    setIsPlacementActive(true);
    setAddRackDrawerOpen(false);

    pointerControllerRef.current?.startPlacement({
      rack_code: rackData.rack_code,
      length_mm: rackData.length_mm,
      depth_mm: rackData.depth_mm,
      height_mm: rackData.height_mm,
      rotation: rackData.rotation !== undefined ? rackData.rotation : (slotRotated ? 90 : 0),
      bay_count: rackData.bay_count || 3,
      level_count: rackData.level_count || activeLevelCount,
      color_hex: rackData.color_hex || activeRackColor,
    });

    showToast(`📍 Mode Penempatan Aktif: Klik pada kanvas untuk meletakkan rak ${rackData.rack_code} (Tekan [ESC] batal, [R] putar)`, 'info');
  }, [showToast, activeLevelCount, activeRackColor]);

  const ensureSlotGridForAisle = useCallback(() => {
    let triggered = false;
    setShowSlotHorizontal((prevH) => {
      setShowSlotVertical((prevV) => {
        if (!prevH && !prevV) {
          triggered = true;
          rendererRef.current?.setGridVisibility({
            slot: true,
            slotHorizontal: true,
            slotVertical: false,
            slotRotated: false,
          });
          showToast('Grid slot dinyalakan sebagai dasar perhitungan membuat jalan', 'info');
          return false;
        }
        return prevV;
      });
      return !showSlotVertical ? true : prevH;
    });
    setShowSlotGrid(true);
    return triggered;
  }, [showSlotVertical, showToast]);

  const handleAddAisle = useCallback(() => {
    ensureSlotGridForAisle();
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const wh = store.snapshot?.warehouse;
    const whW = wh?.width_mm || 50000;
    const whL = wh?.length_mm || 80000;

    const centerWorldX = Math.round((-viewportRef.current.tx + 400) / viewportRef.current.scale);
    const centerWorldY = Math.round((-viewportRef.current.ty + 300) / viewportRef.current.scale);

    const cellW = slotConfig.lengthMm || 700;
    const cellD = slotConfig.depthMm || 500;
    const snappedX = Math.round(Math.max(centerWorldX, 1000) / cellW) * cellW;
    const snappedY = Math.round(Math.max(centerWorldY, 1000) / cellD) * cellD;

    // Hitung lebar lorong dari konfigurasi jarak jalan & forklift
    const targetWidthMm = walkwayConfig.hasForklift
      ? Math.max(Math.round(walkwayConfig.aisleWidthM * 1000), Math.round((Number(walkwayConfig.forkliftWidthM) + 0.5) * 1000))
      : Math.round(walkwayConfig.aisleWidthM * 1000);

    const safeW = Math.min(whW, targetWidthMm);
    const safeL = Math.min(whL, 10000);
    const safeX = Math.max(0, Math.min(whW - safeW, snappedX));
    const safeY = Math.max(0, Math.min(whL - safeL, snappedY));

    const newAisle = store.addAisle({
      x_mm: safeX,
      y_mm: safeY,
      width_mm: safeW,
      length_mm: safeL,
    });

    if (newAisle && newAisle.error === 'COLLIDES_WITH_RACK') {
      showToast('⚠️ Jalan tidak dapat menimpa atau menghapus rak! Silakan geser posisi rak terlebih dahulu.', 'warning');
      return;
    }

    if (newAisle && newAisle.error === 'PEDESTRIAN_CANNOT_OVERLAP') {
      showToast('⚠️ Jalan pejalan kaki tidak bisa menimpa jalan lain! Silakan pilih posisi yang tidak bertindihan.', 'warning');
      return;
    }

    if (newAisle && newAisle.warnMinimumForkliftWidth) {
      showToast('⚠️ Lebar jalan forklift minimal 2.5 meter. Lebar otomatis disesuaikan ke 2.5m.', 'warning');
    }

    store.select('aisle', newAisle.id);
    setActiveTool('select');
    setIsFillAisleMode(false);
    syncStoreUI();
    if (newAisle && newAisle.isMerged) {
      if (newAisle.is_both) {
        showToast(`✓ Jalan forklift & jalan manusia digabungkan menjadi Jalur Bersama '${newAisle.name}' (Dual Indikator 🚜🚶)!`, 'success');
      } else if (newAisle.type === 'forklift') {
        showToast(`✓ Jalan forklift bertabrakan & berhasil digabungkan menjadi satu lorong forklift!`, 'success');
      } else {
        showToast(`✓ Jalan pejalan kaki bertabrakan & berhasil digabungkan menjadi satu lorong!`, 'success');
      }
    } else {
      showToast(`Lorong ${newAisle.aisle_code} berhasil ditambahkan (${(safeW / 1000).toFixed(1)}m${walkwayConfig.hasForklift ? ' - Akses Forklift' : ''})`);
    }
  }, [syncStoreUI, showToast, slotConfig, walkwayConfig]);

  const handleAddDoor = useCallback((doorData) => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const objType = doorData.object_type || 'door_both';
    const wh = store.snapshot?.warehouse;
    const whW = wh?.width_mm || 50000;
    const whL = wh?.length_mm || 80000;

    let { x_mm = 0, y_mm = 0, width_mm = 3000, length_mm = 600, height_mm = 2500 } = doorData;

    // Pastikan pintu otomatis menempel flush ke dinding terdekat
    const doorSpan = Math.max(1000, Math.min(Math.min(whW, whL), Math.max(width_mm, length_mm)));
    const dLeft = Math.abs(x_mm);
    const dRight = Math.abs(whW - x_mm - width_mm);
    const dTop = Math.abs(y_mm);
    const dBottom = Math.abs(whL - y_mm - length_mm);
    const onWall = dLeft <= 100 || dRight <= 100 || dTop <= 100 || dBottom <= 100;

    if (!onWall) {
      const minDist = Math.min(dLeft, dRight, dTop, dBottom);
      if (minDist === dLeft) {
        x_mm = 0;
        y_mm = Math.max(0, Math.min(whL - doorSpan, Math.round(y_mm / 500) * 500));
        width_mm = 600;
        length_mm = doorSpan;
      } else if (minDist === dRight) {
        x_mm = Math.max(0, whW - 600);
        y_mm = Math.max(0, Math.min(whL - doorSpan, Math.round(y_mm / 500) * 500));
        width_mm = 600;
        length_mm = doorSpan;
      } else if (minDist === dTop) {
        x_mm = Math.max(0, Math.min(whW - doorSpan, Math.round(x_mm / 500) * 500));
        y_mm = 0;
        width_mm = doorSpan;
        length_mm = 600;
      } else {
        x_mm = Math.max(0, Math.min(whW - doorSpan, Math.round(x_mm / 500) * 500));
        y_mm = Math.max(0, whL - 600);
        width_mm = doorSpan;
        length_mm = 600;
      }
    } else {
      // Clamp flush coordinates to warehouse wall boundaries
      if (dLeft <= 100) {
        x_mm = 0;
        y_mm = Math.max(0, Math.min(whL - doorSpan, y_mm));
        width_mm = 600;
        length_mm = doorSpan;
      } else if (dRight <= 100) {
        x_mm = Math.max(0, whW - 600);
        y_mm = Math.max(0, Math.min(whL - doorSpan, y_mm));
        width_mm = 600;
        length_mm = doorSpan;
      } else if (dTop <= 100) {
        x_mm = Math.max(0, Math.min(whW - doorSpan, x_mm));
        y_mm = 0;
        width_mm = doorSpan;
        length_mm = 600;
      } else {
        x_mm = Math.max(0, Math.min(whW - doorSpan, x_mm));
        y_mm = Math.max(0, whL - 600);
        width_mm = doorSpan;
        length_mm = 600;
      }
    }

    const newDoor = store.addLayoutObject({
      ...doorData,
      x_mm,
      y_mm,
      width_mm,
      length_mm,
      height_mm,
      object_type: objType,
    });
    store.select('layout_object', newDoor.id);
    setActiveTool('select');
    setIsDirty(true);
    syncStoreUI();
    rendererRef.current?.markDirty(false);
    const label = objType === 'door_both' ? 'Pintu Masuk & Keluar' : objType === 'door_exit' ? 'Pintu Keluar' : 'Pintu Masuk';
    showToast(`✓ ${label} '${newDoor.name}' (${(Math.max(width_mm, length_mm) / 1000).toFixed(1)}m × ${(height_mm / 1000).toFixed(1)}m) nempel pada dinding!`);
  }, [syncStoreUI, showToast]);

  const handleAddDoorEntry = useCallback((doorData) => {
    handleAddDoor({
      ...doorData,
      object_type: 'door_entry',
    });
  }, [handleAddDoor]);

  const handleAddDoorExit = useCallback((doorData) => {
    handleAddDoor({
      ...doorData,
      object_type: 'door_exit',
    });
  }, [handleAddDoor]);

  const handleAddDock = useCallback((dockData) => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const wh = store.snapshot?.warehouse;
    const whW = wh?.width_mm || 50000;
    const whL = wh?.length_mm || 80000;
    const width_mm = Math.max(1000, Number(dockData.width_mm) || 4000);
    const length_mm = Math.max(1000, Number(dockData.length_mm) || 6000);
    const safeX = Math.max(0, Math.min(whW - width_mm, Number(dockData.x_mm) || 0));
    const safeY = Math.max(0, Math.min(whL - length_mm, Number(dockData.y_mm) || 0));

    const collisions = store.spatialHash.query({
      x: safeX,
      y: safeY,
      width: width_mm,
      depth: length_mm,
    });
    if (collisions.length > 0) {
      showToast('⚠️ Gagal menambahkan dok: area tumpang tindih dengan rak atau objek lain!', 'warning');
      return;
    }

    const newDock = store.addLayoutObject({
      ...dockData,
      width_mm,
      length_mm,
      x_mm: safeX,
      y_mm: safeY,
      object_type: 'dock',
    });
    store.select('layout_object', newDock.id);
    setActiveTool('select');
    setIsFillDockMode(false);
    setIsDirty(true);
    syncStoreUI();
    rendererRef.current?.markDirty(false);
    showToast(`✓ Area Docking '${newDock.name}' (${(width_mm / 1000).toFixed(1)}m × ${(length_mm / 1000).toFixed(1)}m) berhasil dipasang ke denah!`);
  }, [syncStoreUI, showToast]);

  const handleAddAisleFromAsset = useCallback((aisleData) => {
    ensureSlotGridForAisle();
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const newAisle = store.addAisle(aisleData);

    if (newAisle && newAisle.error === 'COLLIDES_WITH_RACK') {
      showToast('⚠️ Jalan tidak dapat menimpa atau menghapus rak! Silakan geser posisi rak terlebih dahulu.', 'warning');
      return;
    }

    if (newAisle && newAisle.error === 'PEDESTRIAN_CANNOT_OVERLAP') {
      showToast('⚠️ Jalan pejalan kaki tidak bisa menimpa jalan lain! Silakan pilih posisi yang tidak bertindihan.', 'warning');
      return;
    }

    if (newAisle && newAisle.warnMinimumForkliftWidth) {
      showToast('⚠️ Lebar jalan forklift minimal 2.5 meter. Lebar otomatis disesuaikan ke 2.5m.', 'warning');
    }

    store.select('aisle', newAisle.id);
    setActiveTool('select');
    setIsFillAisleMode(false);
    setIsDirty(true);
    syncStoreUI();
    rendererRef.current?.markDirty(false);

    if (newAisle && newAisle.isMerged) {
      if (newAisle.is_both) {
        showToast(`✓ Jalan forklift & jalan manusia digabungkan menjadi Jalur Bersama '${newAisle.name}' (Dual Indikator 🚜🚶)!`, 'success');
      } else if (newAisle.type === 'forklift') {
        showToast(`✓ Jalan forklift bertabrakan & berhasil digabungkan menjadi satu lorong forklift!`, 'success');
      } else {
        showToast(`✓ Jalan pejalan kaki bertabrakan & berhasil digabungkan menjadi satu lorong!`, 'success');
      }
      return;
    }

    const isHoriz = (newAisle.width_mm || 0) >= (newAisle.length_mm || 0);
    showToast(`✓ Jalan / Lorong '${newAisle.name || newAisle.aisle_code}' [${isHoriz ? 'H • Horizontal' : 'V • Vertikal'}] berhasil dipasang!`);
  }, [syncStoreUI, showToast, ensureSlotGridForAisle]);

  const handleDeleteAssetItem = useCallback((type, id) => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    store.deleteEntity(type, id);
    syncStoreUI();
    rendererRef.current?.markDirty(false);
    showToast(`Aset berhasil dihapus dari denah.`, 'info');
  }, [syncStoreUI, showToast]);

  // Layer Visibility & Selection Handlers
  const handleToggleLayerVisibility = useCallback((layerType) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerType)) {
        next.delete(layerType);
      } else {
        next.add(layerType);
      }
      if (rendererRef.current) {
        rendererRef.current.setHiddenLayers(next, hiddenEntityIds);
      }
      return next;
    });
  }, [hiddenEntityIds]);

  const handleToggleEntityVisibility = useCallback((id) => {
    setHiddenEntityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (rendererRef.current) {
        rendererRef.current.setHiddenLayers(hiddenLayers, next);
      }
      return next;
    });
  }, [hiddenLayers]);

  const handleFocusEntityFromLayer = useCallback((type, item) => {
    if (!item || !containerRef.current || !viewportRef.current) return;
    const store = documentStoreRef.current;
    if (store) {
      store.select(type, item.id);
      syncStoreUI();
    }
    const container = containerRef.current;
    const vp = viewportRef.current;
    const scale = vp.scale;
    const itemW = Number(item.width_mm) || Number(item.length_mm) || 2000;
    const itemH = Number(item.depth_mm) || Number(item.length_mm) || Number(item.width_mm) || 1000;
    const cx = (Number(item.x_mm) || 0) + itemW / 2;
    const cy = (Number(item.y_mm) || 0) + itemH / 2;

    vp.tx = container.clientWidth / 2 - cx * scale;
    vp.ty = container.clientHeight / 2 - cy * scale;

    if (rendererRef.current) {
      rendererRef.current.viewport = vp;
      rendererRef.current.markDirty(false);
    }
    if (pointerControllerRef.current) {
      pointerControllerRef.current.viewport = vp;
    }
  }, [syncStoreUI]);

  const handleSelectEntityFromLayer = useCallback((type, id) => {
    if (!documentStoreRef.current) return;
    documentStoreRef.current.select(type, id);
    syncStoreUI();
    rendererRef.current?.markDirty(true);
  }, [syncStoreUI]);

  const handleDeleteEntityFromLayer = useCallback((type, id) => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const ok = store.deleteEntity(type, id);
    if (!ok) {
      showToast('Gagal menghapus layer (tidak ditemukan).', 'error');
      return;
    }
    setIsDirty(true);
    syncStoreUI();
    rendererRef.current?.markDirty(false);
    showToast(`Layer berhasil dihapus dari denah.`, 'info');
  }, [syncStoreUI, showToast]);

  const handleDeleteSelectedFromLayer = useCallback(() => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const selected = store.getSelectedItems();
    if (selected.length === 0) return;

    let deletedCount = 0;
    for (const { type, item } of selected) {
      const ok = store.deleteEntity(type, item.id || item.client_ref);
      if (ok) deletedCount++;
    }
    if (pointerControllerRef.current) {
      pointerControllerRef.current.clearSelection();
    }
    setIsDirty(true);
    syncStoreUI();
    rendererRef.current?.markDirty(false);
    showToast(`${deletedCount} layer terpilih berhasil dihapus.`, 'info');
  }, [syncStoreUI, showToast]);

  const handleCanvasDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback(
    (e) => {
      e.preventDefault();
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr || !containerRef.current || !viewportRef.current) return;
      try {
        const asset = JSON.parse(dataStr);
        const rect = containerRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const vp = viewportRef.current;
        const wx = (sx - vp.tx) / vp.scale;
        const wy = (sy - vp.ty) / vp.scale;

        // Snap ke kelipatan slot aktif (Horizontal atau Vertikal) sebagai dasar perhitungan
        const activeSlotW = slotRotated ? (slotConfig?.depthMm || 500) : (slotConfig?.lengthMm || 1000);
        const activeSlotD = slotRotated ? (slotConfig?.lengthMm || 1000) : (slotConfig?.depthMm || 500);
        const snappedX = Math.max(0, Math.round(wx / activeSlotW) * activeSlotW);
        const snappedY = Math.max(0, Math.round(wy / activeSlotD) * activeSlotD);

        // Pastikan salah satu centang slot menyala saat melakukan drop
        if (!showSlotGrid) {
          setShowSlotGrid(true);
          rendererRef.current?.setGridVisibility({ slot: true });
        }

        if (asset.type === 'door' || asset.type === 'door_both' || asset.type === 'door_entry' || asset.type === 'door_exit') {
          const isBoth = asset.type === 'door_both' || asset.type === 'door';
          const isExit = asset.type === 'door_exit';
          const objType = isBoth ? 'door_both' : isExit ? 'door_exit' : 'door_entry';

          const wh = documentStoreRef.current?.snapshot?.warehouse || snapshot?.warehouse;
          const whW = wh?.width_mm || 50000;
          const whL = wh?.length_mm || 80000;

          // Otomatis menempel pada dinding terdekat
          const doorSpan = Math.max(1000, Number(asset.width_mm) || 3000);
          const dLeft = Math.abs(wx);
          const dRight = Math.abs(whW - wx);
          const dTop = Math.abs(wy);
          const dBottom = Math.abs(whL - wy);
          const minDist = Math.min(dLeft, dRight, dTop, dBottom);

          let finalX = 0;
          let finalY = 0;
          let finalW = doorSpan;
          let finalL = 600;

          if (minDist === dLeft) {
            finalX = 0;
            finalY = Math.max(0, Math.min(whL - doorSpan, Math.round(wy / activeSlotD) * activeSlotD));
            finalW = 600;
            finalL = doorSpan;
          } else if (minDist === dRight) {
            finalX = Math.max(0, whW - 600);
            finalY = Math.max(0, Math.min(whL - doorSpan, Math.round(wy / activeSlotD) * activeSlotD));
            finalW = 600;
            finalL = doorSpan;
          } else if (minDist === dTop) {
            finalX = Math.max(0, Math.min(whW - doorSpan, Math.round(wx / activeSlotW) * activeSlotW));
            finalY = 0;
            finalW = doorSpan;
            finalL = 600;
          } else {
            finalX = Math.max(0, Math.min(whW - doorSpan, Math.round(wx / activeSlotW) * activeSlotW));
            finalY = Math.max(0, whL - 600);
            finalW = doorSpan;
            finalL = 600;
          }

          handleAddDoor({
            name: asset.name || (isBoth ? 'Pintu Masuk & Keluar' : isExit ? 'Pintu Keluar' : 'Pintu Masuk'),
            object_type: objType,
            width_mm: finalW,
            length_mm: finalL,
            height_mm: Number(asset.height_mm) || 2500,
            x_mm: finalX,
            y_mm: finalY,
            clearance_mm: 500,
          });
        } else if (asset.type === 'dock' || asset.type === 'docking_area') {
          handleAddDock({
            name: asset.name || 'Area Dok Muat',
            width_mm: asset.width_mm || 4000,
            length_mm: asset.length_mm || 6000,
            x_mm: snappedX,
            y_mm: snappedY,
            clearance_mm: 500,
          });
        } else if (asset.type === 'aisle' || asset.type === 'forklift_aisle') {
          const isForklift = asset.type === 'forklift_aisle';
          const prefix = isForklift ? 'FK' : 'A';
          const existingAisles = documentStoreRef.current?.snapshot?.aisles || [];
          const usedNums = existingAisles
            .map((a) => {
              const m = (a.aisle_code || '').match(new RegExp(`^${prefix}-(\\d+)$`));
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n) => n > 0);
          const nextNum = (usedNums.length > 0 ? Math.max(...usedNums) : 0) + 1;
          const code = `${prefix}-${String(nextNum).padStart(2, '0')}`;

          let targetW = asset.width_mm || (isForklift ? 3000 : 2000);
          let targetL = asset.length_mm || 12000;
          let targetX = snappedX;
          let targetY = snappedY;

          // Auto-fit ke celah bila di-drop tepat pada celah antar rak
          if (pointerControllerRef.current) {
            const fitted = pointerControllerRef.current._snapAisleToRackClearance({
              x: targetX,
              y: targetY,
              width: targetW,
              depth: targetL,
            });
            if (fitted && fitted.isAutoFitted) {
              targetX = fitted.x;
              targetY = fitted.y;
              targetW = fitted.width;
              targetL = fitted.depth;
            }
          }

          handleAddAisleFromAsset({
            aisle_code: code,
            name: asset.name || (isForklift ? `Jalur Forklift ${nextNum}` : `Jalur ${nextNum}`),
            width_mm: targetW,
            length_mm: targetL,
            x_mm: targetX,
            y_mm: targetY,
            direction: isForklift ? 'forklift' : (asset.direction || 'two_way'),
          });
        }
      } catch (err) {
        console.error('[DRAG DROP ASSET ERROR]', err);
      }
    },
    [handleAddDoor, handleAddDoorEntry, handleAddDoorExit, handleAddDock, handleAddAisleFromAsset, slotRotated, slotConfig, showSlotGrid]
  );

  const handleRotate = useCallback(() => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const selected = store.getSelectedItems();

    if (selected.length === 0) return;

    let hasCollision = false;
    let anyRotated = false;
    for (const { type, item } of selected) {
      const ok = store.rotateEntity(type, item.id);
      if (ok) {
        anyRotated = true;
      } else {
        hasCollision = true;
      }
    }
    if (hasCollision && !anyRotated) {
      showToast('⚠️ Tidak dapat memutar: ruang setelah rotasi bertabrakan dengan objek lain!', 'warning');
    } else if (anyRotated) {
      setIsDirty(true);
      syncStoreUI();
      rendererRef.current?.markDirty(false);
      if (hasCollision) {
        showToast('⚠️ Beberapa objek tidak dapat diputar karena bertabrakan.', 'warning');
      }
    }
  }, [syncStoreUI, showToast]);

  // --- ZONA & FASILITAS HANDLERS (Ribbon Tab 3) ---
  const [showZoneLabels, setShowZoneLabels] = useState(true);

  const handleToggleZoneLabels = useCallback(() => {
    setShowZoneLabels((prev) => !prev);
    if (rendererRef.current) {
      rendererRef.current.markDirty(false);
    }
  }, []);

  const handleAddZone = useCallback((zoneType, colorHex) => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const wh = store.snapshot?.warehouse;
    const whW = wh?.width_mm || 50000;
    const whL = wh?.length_mm || 80000;

    const centerWorldX = Math.round((-viewportRef.current.tx + 300) / viewportRef.current.scale);
    const centerWorldY = Math.round((-viewportRef.current.ty + 200) / viewportRef.current.scale);

    const safeW = Math.min(whW, 12000);
    const safeL = Math.min(whL, 8000);
    const safeX = Math.max(0, Math.min(whW - safeW, centerWorldX));
    const safeY = Math.max(0, Math.min(whL - safeL, centerWorldY));

    const newZone = store.addZone({
      name: `Zona ${zoneType}`,
      zone_code: `Z-${zoneType.toUpperCase().slice(0, 3)}`,
      color_hex: colorHex,
      x_mm: safeX,
      y_mm: safeY,
      width_mm: safeW,
      length_mm: safeL,
    });

    syncStoreUI();
    showToast(`Zona ${newZone.name} berhasil ditambahkan`);
  }, [syncStoreUI, showToast]);

  const handleAddLayoutObject = useCallback((objectType) => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const wh = store.snapshot?.warehouse;
    const whW = wh?.width_mm || 50000;
    const whL = wh?.length_mm || 80000;

    const centerWorldX = Math.round((-viewportRef.current.tx + 400) / viewportRef.current.scale);
    const centerWorldY = Math.round((-viewportRef.current.ty + 300) / viewportRef.current.scale);

    const dims =
      objectType === 'dock'
        ? { width_mm: 4000, length_mm: 4000, clearance_mm: 1000 }
        : objectType === 'door'
        ? { width_mm: 2000, length_mm: 1000, clearance_mm: 500 }
        : { width_mm: 1000, length_mm: 1000, clearance_mm: 500 };

    const safeW = Math.min(whW, dims.width_mm);
    const safeL = Math.min(whL, dims.length_mm);
    const safeX = Math.max(0, Math.min(whW - safeW, centerWorldX));
    const safeY = Math.max(0, Math.min(whL - safeL, centerWorldY));

    const newObj = store.addLayoutObject({
      object_type: objectType,
      x_mm: safeX,
      y_mm: safeY,
      ...dims,
      width_mm: safeW,
      length_mm: safeL,
    });

    store.select('layout_object', newObj.id);
    setActiveTool('select');
    syncStoreUI();
    showToast(`${newObj.name} berhasil ditambahkan ke kanvas`);
  }, [syncStoreUI, showToast]);

  const handleDelete = useCallback(() => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const selected = store.getSelectedItems();

    if (selected.length === 0) return;

    for (const { type, item } of selected) {
      store.deleteEntity(type, item.id);
    }
    if (pointerControllerRef.current) {
      pointerControllerRef.current.clearSelection();
    }
    syncStoreUI();
    rendererRef.current?.markDirty(false);
    showToast(`${selected.length} entitas berhasil dihapus dari layout`);
  }, [syncStoreUI, showToast]);

  // --- STEP 11: Bulk Location Generator Handlers ---
  const handleOpenGenerator = useCallback(() => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const selected = store.getSelectedItems();
    const rackItem = selected.find((s) => s.type === 'rack')?.item;

    if (!rackItem) {
      showToast('Pilih salah satu rak di kanvas untuk menerbitkan lokasi penyimpanan', 'error');
      return;
    }

    setSelectedRackForGenerator(rackItem);
    setGeneratorModalOpen(true);
  }, [showToast]);

  const handleLocationsGenerated = useCallback((result) => {
    showToast(
      `${result.generated_count} lokasi berhasil diterbitkan untuk rak ${result.rack_code}! (Total aktif: ${result.total_active_locations})`,
      'success'
    );
    loadLayoutSnapshot(warehouseId);
  }, [loadLayoutSnapshot, warehouseId, showToast]);

  // --- PHASE 4: Pathfinding & Routing Handlers ---
  const routingCandidates = React.useMemo(() => {
    if (!snapshot) return { docks: [], racks: [] };
    const docks = (snapshot.layout_objects || [])
      .filter((o) => o.object_type === 'dock' || o.object_type === 'door')
      .map((o) => ({ id: `${o.object_type}_${o.id}`, label: `${o.name || o.object_type} (${o.object_type.toUpperCase()})` }));

    const racks = (snapshot.racks || [])
      .filter((r) => !r.retired_at)
      .map((r) => ({ id: `pick_rack_${r.id}`, label: `Rak ${r.rack_code}` }));

    return { docks, racks };
  }, [snapshot]);

  const handleNameChange = useCallback((newName) => {
    setSnapshot((prev) => {
      if (!prev || !prev.warehouse) return prev;
      return {
        ...prev,
        warehouse: {
          ...prev.warehouse,
          name: newName,
        },
      };
    });

    if (documentStoreRef.current?.snapshot?.warehouse) {
      documentStoreRef.current.snapshot.warehouse.name = newName;
    }
    setIsDirty(true);
  }, []);

  const handleUpdateWarehouse = useCallback(async (newName, newWidthM, newLengthM, newHeightM) => {
    const wh = snapshot?.warehouse || {};
    const finalName = newName !== undefined ? newName.trim() : (wh.name || 'Main Warehouse');

    // Gunakan ukuran saat ini sebagai fallback jika dimensi tidak diisi / tidak valid
    const currentWidthM = Math.round((wh.width_mm || 50000) / 1000);
    const finalWidthM = (newWidthM !== undefined && newWidthM !== null && !isNaN(newWidthM) && Number(newWidthM) > 0)
      ? Number(newWidthM)
      : currentWidthM;

    const currentLengthM = Math.round((wh.length_mm || 80000) / 1000);
    const finalLengthM = (newLengthM !== undefined && newLengthM !== null && !isNaN(newLengthM) && Number(newLengthM) > 0)
      ? Number(newLengthM)
      : currentLengthM;

    const currentHeightM = Math.round((wh.height_mm || 8000) / 1000);
    const finalHeightM = (newHeightM !== undefined && newHeightM !== null && !isNaN(newHeightM) && Number(newHeightM) > 0)
      ? Number(newHeightM)
      : currentHeightM;

    if (!finalName) {
      showToast('Nama gudang tidak boleh kosong.', 'error');
      return;
    }
    if (finalWidthM < 5 || finalLengthM < 5) {
      showToast('Dimensi gudang minimal 5 meter (5000 mm).', 'error');
      return;
    }
    if (finalHeightM < 2) {
      showToast('Tinggi gudang minimal 2 meter (2000 mm).', 'error');
      return;
    }

    const width_mm = finalWidthM * 1000;
    const length_mm = finalLengthM * 1000;
    const height_mm = finalHeightM * 1000;

    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/warehouses/${warehouseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: finalName,
          width_mm,
          length_mm,
          height_mm,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Gagal memperbarui data gudang.');
      }

      const json = await res.json();
      const updatedWh = json.data;

      // Update state snapshot
      setSnapshot((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          warehouse: {
            ...prev.warehouse,
            name: updatedWh.name,
            width_mm: updatedWh.width_mm,
            length_mm: updatedWh.length_mm,
            height_mm: updatedWh.height_mm,
            layout_version: updatedWh.layout_version,
          },
        };
      });

      // Update document store (working snapshot & original snapshot to prevent version conflicts)
      if (documentStoreRef.current) {
        if (documentStoreRef.current.snapshot?.warehouse) {
          documentStoreRef.current.snapshot.warehouse.name = updatedWh.name;
          documentStoreRef.current.snapshot.warehouse.width_mm = updatedWh.width_mm;
          documentStoreRef.current.snapshot.warehouse.length_mm = updatedWh.length_mm;
          documentStoreRef.current.snapshot.warehouse.height_mm = updatedWh.height_mm;
          documentStoreRef.current.snapshot.warehouse.layout_version = updatedWh.layout_version;
        }
        if (documentStoreRef.current.originalSnapshot?.warehouse) {
          documentStoreRef.current.originalSnapshot.warehouse.name = updatedWh.name;
          documentStoreRef.current.originalSnapshot.warehouse.width_mm = updatedWh.width_mm;
          documentStoreRef.current.originalSnapshot.warehouse.length_mm = updatedWh.length_mm;
          documentStoreRef.current.originalSnapshot.warehouse.height_mm = updatedWh.height_mm;
          documentStoreRef.current.originalSnapshot.warehouse.layout_version = updatedWh.layout_version;
        }
      }

      // Update renderer & trigger redraw
      if (rendererRef.current) {
        rendererRef.current.snapshot = documentStoreRef.current?.snapshot || null;
        rendererRef.current.markDirty(false);
      }

      showToast(`Data gudang diperbarui: ${finalName} (${finalWidthM}m × ${finalLengthM}m × ${finalHeightM}m)`);
    } catch (err) {
      console.error('[UPDATE WAREHOUSE ERROR]', err);
      showToast(err.message, 'error');
    }
  }, [warehouseId, snapshot, showToast]);

  const handleSaveSlotConfig = useCallback((newConfig) => {
    setSlotConfig(newConfig);
    setIsDirty(true);
    try {
      localStorage.setItem('susuno_slot_config', JSON.stringify(newConfig));
    } catch {}
    if (rendererRef.current) {
      rendererRef.current.setSlotConfig(newConfig);
      if (documentStoreRef.current?.snapshot) {
        routingDataRef.current = buildLayoutRouting(
          documentStoreRef.current.snapshot,
          500, // 50cm matrix cell width
          500  // 50cm matrix cell depth
        );
        if (showGrid) {
          rendererRef.current.setGridMatrix(routingDataRef.current.grid, true);
        }
      }
      rendererRef.current.markDirty(false);
    }
    if (pointerControllerRef.current) {
      pointerControllerRef.current.updateSlotConfig(newConfig, slotRotated, isFillSlotMode, activeRackColor);
    }
    showToast(`Ukuran slot disimpan: ${newConfig.lengthMm / 10} × ${newConfig.depthMm / 10} cm`);
  }, [showGrid, showToast, slotRotated, isFillSlotMode, activeRackColor]);

  const handleToggleMeterGrid = useCallback(() => {
    setShowMeterGrid((prev) => {
      const next = !prev;
      rendererRef.current?.setGridVisibility({ meter: next });
      return next;
    });
  }, []);

  const handleToggleGridHorizontal = useCallback(() => {
    setShowGridHorizontal((prev) => {
      const next = !prev;
      rendererRef.current?.setGridVisibility({ horizontal: next });
      return next;
    });
  }, []);

  const handleToggleGridVertical = useCallback(() => {
    setShowGridVertical((prev) => {
      const next = !prev;
      rendererRef.current?.setGridVisibility({ vertical: next });
      return next;
    });
  }, []);

  const handleSelectSlotOrientation = useCallback(
    (orientation) => {
      const isVertical = orientation === 'vertical';
      const isAlreadyActive = isVertical ? showSlotVertical : showSlotHorizontal;

      if (isAlreadyActive) {
        // Toggle OFF if already active
        setShowSlotHorizontal(false);
        setShowSlotVertical(false);
        setShowSlotGrid(false);
        setIsFillSlotMode(false);
        rendererRef.current?.setGridVisibility({
          slot: false,
          slotHorizontal: false,
          slotVertical: false,
        });
        if (pointerControllerRef.current) {
          pointerControllerRef.current.updateSlotConfig(slotConfig, slotRotated, false, activeRackColor);
        }
        showToast('Mode slot grid nonaktif', 'info');
        return;
      }

      // Activate selected orientation & enable live slot filling
      setShowSlotHorizontal(!isVertical);
      setShowSlotVertical(isVertical);
      setSlotRotated(isVertical);
      setShowSlotGrid(true);
      setIsFillSlotMode(true);

      rendererRef.current?.setGridVisibility({
        slot: true,
        slotRotated: isVertical,
        slotHorizontal: !isVertical,
        slotVertical: isVertical,
      });

      if (pointerControllerRef.current) {
        pointerControllerRef.current.updateSlotConfig(slotConfig, isVertical, true, activeRackColor);
      }

      const lengthCm = Math.round((slotConfig?.lengthMm || 1000) / 10);
      const depthCm = Math.round((slotConfig?.depthMm || 500) / 10);
      showToast(
        isVertical
          ? `📦 Slot Vertikal Aktif (${depthCm} × ${lengthCm} cm) - Tarik/klik di kanvas untuk buat rak vertikal`
          : `📦 Slot Horizontal Aktif (${lengthCm} × ${depthCm} cm) - Tarik/klik di kanvas untuk buat rak horizontal`,
        'info'
      );
    },
    [slotConfig, showSlotHorizontal, showSlotVertical, slotRotated, activeRackColor, showToast]
  );

  const handleToggleSlotHorizontal = useCallback(() => {
    handleSelectSlotOrientation('horizontal');
  }, [handleSelectSlotOrientation]);

  const handleToggleSlotVertical = useCallback(() => {
    handleSelectSlotOrientation('vertical');
  }, [handleSelectSlotOrientation]);

  const handleToggleSlotGrid = useCallback(() => {
    setShowSlotGrid((prev) => {
      const next = !prev;
      rendererRef.current?.setGridVisibility({ slot: next });
      return next;
    });
  }, []);

  const handleToggleSlotRotate = useCallback(() => {
    setSlotRotated((prev) => {
      const next = !prev;
      setShowSlotHorizontal(!next);
      setShowSlotVertical(next);
      rendererRef.current?.setGridVisibility({ slotRotated: next, slotHorizontal: !next, slotVertical: next });
      pointerControllerRef.current?.updateSlotConfig(slotConfig, next, isFillSlotMode, activeRackColor);
      return next;
    });
  }, [slotConfig, isFillSlotMode, activeRackColor]);

  const handleToggleFillSlotMode = useCallback(() => {
    setIsFillSlotMode((prev) => {
      const next = !prev;
      if (next) {
        // Enforce: "untuk fill and drop semua harus menyalakan centang pada salah satu antara slot horizontal atau slot vertikal"
        if (!showSlotHorizontal && !showSlotVertical) {
          setShowSlotHorizontal(true);
          setShowSlotVertical(false);
          setSlotRotated(false);
        }
        setShowSlotGrid(true);
        rendererRef.current?.setGridVisibility({
          slot: true,
          slotRotated: slotRotated,
          slotHorizontal: !slotRotated,
          slotVertical: slotRotated,
        });
      }
      pointerControllerRef.current?.updateSlotConfig(slotConfig, slotRotated, next, activeRackColor);
      showToast(next ? '🎨 Mode Drag Fill Slot: AKTIF (Tarik kotak di kanvas untuk buat rak)' : 'Mode Drag Fill: NONAKTIF');
      return next;
    });
  }, [slotConfig, slotRotated, showSlotHorizontal, showSlotVertical, activeRackColor, showToast]);

  const warehouseHeightMm = snapshot?.warehouse?.height_mm || 10000;
  const slotHMm = slotConfig?.heightMm || 400;
  const maxSafeHeightMm = Math.max(1000, warehouseHeightMm - 1500);
  const maxLevelCount = Math.max(1, Math.floor(maxSafeHeightMm / slotHMm));

  const handleColorChange = useCallback(
    (newColor) => {
      setActiveRackColor(newColor);
      pointerControllerRef.current?.updateSlotConfig(slotConfig, slotRotated, isFillSlotMode, newColor);

      // Ubah juga warna rak yang sedang diseleksi jika ada
      if (documentStoreRef.current) {
        const selected = documentStoreRef.current.getSelectedItems();
        let updatedCount = 0;
        for (const { type, item } of selected) {
          if (type === 'rack') {
            item.color_hex = newColor;
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          setIsDirty(true);
          syncStoreUI();
          rendererRef.current?.markDirty(false);
          showToast(`Warna ${updatedCount} rak berhasil diubah menjadi ${newColor}`);
        }
      }
    },
    [slotConfig, slotRotated, isFillSlotMode, syncStoreUI, showToast]
  );

  const handleLevelCountChange = useCallback(
    (newCount) => {
      const clamped = Math.max(1, Math.min(maxLevelCount, newCount));
      setActiveLevelCount(clamped);
      if (newCount > maxLevelCount) {
        showToast(
          `Tingkat dibatasi maks ${maxLevelCount} Lt (Batas aman atap gudang ${(warehouseHeightMm / 1000).toFixed(1)}m - 1.5m clearance)`,
          'warning'
        );
      }
    },
    [maxLevelCount, warehouseHeightMm, showToast]
  );

  const handleToggleGrid = useCallback(() => {
    setShowGrid((prev) => {
      const next = !prev;
      if (rendererRef.current) {
        if (!routingDataRef.current && documentStoreRef.current?.snapshot) {
          routingDataRef.current = buildLayoutRouting(
            documentStoreRef.current.snapshot,
            500, // 50cm matrix cell width
            500  // 50cm matrix cell depth
          );
        }
        rendererRef.current.setGridMatrix(routingDataRef.current?.grid, next);
      }
      return next;
    });
  }, []);

  const handleTogglePathMode = useCallback(() => {
    setIsPathMode((prev) => {
      const next = !prev;
      if (!next) {
        setActiveRoute(null);
        if (rendererRef.current) rendererRef.current.setActiveRoute(null);
      } else {
        if (!routingDataRef.current && documentStoreRef.current?.snapshot) {
          routingDataRef.current = buildLayoutRouting(
            documentStoreRef.current.snapshot,
            500,
            500
          );
        }
      }
      return next;
    });
  }, []);

  const calculateRoute = useCallback((startId, goalId, agentProfile) => {
    if (!startId || !goalId) {
      setActiveRoute(null);
      if (rendererRef.current) rendererRef.current.setActiveRoute(null);
      return;
    }

    if (!routingDataRef.current && documentStoreRef.current?.snapshot) {
      routingDataRef.current = buildLayoutRouting(
        documentStoreRef.current.snapshot,
        500,
        500
      );
    }
    const graph = routingDataRef.current?.graph;
    if (!graph) return;

    const profile = agentProfile === 'forklift' ? { minAisleWidthMm: 3000 } : { minAisleWidthMm: 600 };
    const result = astar(graph, startId, goalId, { agentProfile: profile });

    if (result) {
      setActiveRoute(result);
      if (rendererRef.current) {
        rendererRef.current.setActiveRoute(result);
      }
    } else {
      setActiveRoute(null);
      if (rendererRef.current) rendererRef.current.setActiveRoute(null);
      showToast('Tidak ada rute yang terhubung antara kedua simpul ini.', 'warning');
    }
  }, [showToast, slotConfig]);

  useEffect(() => {
    if (isPathMode && pathStartNode && pathGoalNode) {
      calculateRoute(pathStartNode, pathGoalNode, pathAgentProfile);
    }
  }, [isPathMode, pathStartNode, pathGoalNode, pathAgentProfile, calculateRoute]);

  const handleResetRoute = useCallback(() => {
    setPathStartNode('');
    setPathGoalNode('');
    setActiveRoute(null);
    if (rendererRef.current) rendererRef.current.setActiveRoute(null);
  }, []);

  // --- SAVE BATCH PATCH & CONFLICT HANDLING (AC-14, AC-15) ---
  const handleSave = useCallback(async () => {
    if (!documentStoreRef.current || isSaving) return;
    const store = documentStoreRef.current;
    const batchPayload = store.generateBatchPatch();

    if (batchPayload.operations.length === 0) {
      setIsDirty(false);
      showToast('Denah layout saat ini sudah tersimpan dan tersinkronisasi', 'success');
      return true;
    }

    setIsSaving(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/warehouse-layout/warehouses/${warehouseId}/layout`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(batchPayload),
      });

      const json = await res.json();

      if (res.status === 409 && (json.code === 'VERSION_CONFLICT' || json.error === 'VERSION_CONFLICT')) {
        const latestVersion = json.details?.currentLayoutVersion || json.details?.current_version;
        // Jika hanya selisih nomor versi tanpa konflik struktur data, lakukan auto-rebase 1x agar aset pengguna tetap tersimpan
        if (latestVersion && latestVersion > (batchPayload.base_version || 0)) {
          const retryPayload = {
            ...batchPayload,
            expectedLayoutVersion: latestVersion,
            base_version: latestVersion,
          };
          const retryRes = await fetch(`${API_BASE_URL}/warehouse-layout/warehouses/${warehouseId}/layout`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            body: JSON.stringify(retryPayload),
          });

          const retryJson = await retryRes.json();
          if (retryRes.ok) {
            await loadLayoutSnapshot(warehouseId);
            setIsSaving(false);
            showToast('Layout berhasil disinkronkan & disimpan ke versi terbaru!', 'success');
            return true;
          }
        }

        // AC-15: Tangani konflik konkurensi dengan pop-up modal
        setConflictDetails({
          base_version: batchPayload.base_version,
          current_version: latestVersion || batchPayload.base_version + 1,
          message: json.message,
        });
        setConflictOpen(true);
        setIsSaving(false);
        return false;
      }

      if (!res.ok) {
        throw new Error(json.message || `Gagal menyimpan layout (HTTP ${res.status})`);
      }

      // Berhasil disimpan secara atomik: reload snapshot dari DB agar 100% konsisten
      await loadLayoutSnapshot(warehouseId);
      setIsSaving(false);
      showToast(json.message || 'Layout berhasil disimpan!', 'success');
      return true;
    } catch (err) {
      console.error('[SAVE ERROR]', err);
      showToast(err.message, 'error');
      setIsSaving(false);
      return false;
    }
  }, [warehouseId, isSaving, loadLayoutSnapshot, showToast]);

  const handleRackCodeChange = useCallback((newCode) => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const selected = store.getSelectedItems().filter((s) => s.type === 'rack');
    if (selected.length > 0) {
      for (const { item } of selected) {
        item.rack_code = newCode;
      }
      setIsDirty(true);
      syncStoreUI();
      if (rendererRef.current) {
        rendererRef.current.markDirty(false);
      }
    }
  }, [syncStoreUI]);

  const handleSaveRack = useCallback(async (rackData, targetRackId) => {
    setAddRackDrawerOpen(false);

    // 1. Jika ada rak yang dipilih, perbarui propertinya di store
    if (documentStoreRef.current) {
      const store = documentStoreRef.current;
      const targetId = targetRackId || store.getSelectedItems().find((s) => s.type === 'rack')?.item?.id;
      if (targetId) {
        store.updateEntity('rack', targetId, {
          rack_code: rackData.rack_code,
          color_hex: rackData.color_hex,
          level_count: rackData.level_count,
          height_mm: rackData.height_mm,
          bay_count: rackData.bay_count,
          length_mm: rackData.length_mm,
          depth_mm: rackData.depth_mm,
        });
        syncStoreUI();
        rendererRef.current?.markDirty(false);
      }
    }

    // 2. Simpan denah layout langsung ke database
    setIsDirty(true);
    await handleSave();
    showToast(`✓ Perubahan Rak ${rackData.rack_code || ''} berhasil disimpan!`, 'success');
  }, [handleSave, syncStoreUI, showToast]);

  const handleUpdateAsset = useCallback(async (type, id, updates) => {
    if (!documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const updated = store.updateEntity(type, id, updates);
    if (updated) {
      if (type === 'aisle') {
        store.mergeAisle(id);
      }
      syncStoreUI();
      rendererRef.current?.markDirty(false);
      setIsDirty(true);
      await handleSave();
      showToast(`✓ Aset ${updates.name || id} berhasil diperbarui & disimpan!`, 'success');
    }
  }, [handleSave, syncStoreUI, showToast]);

  const handleDiscardAndLeave = useCallback(() => {
    setUnsavedNavModalOpen(false);
    if (pendingTargetRoute && onNavigate) {
      onNavigate(pendingTargetRoute);
    } else if (onBack) {
      onBack();
    }
  }, [pendingTargetRoute, onNavigate, onBack]);

  const handleSaveAndLeave = useCallback(async () => {
    const saved = await handleSave();
    if (saved) {
      setUnsavedNavModalOpen(false);
      if (pendingTargetRoute && onNavigate) {
        onNavigate(pendingTargetRoute);
      } else if (onBack) {
        onBack();
      }
    }
  }, [handleSave, pendingTargetRoute, onNavigate, onBack]);

  const handleTriggerBack = useCallback(() => {
    if (isDirty) {
      setPendingTargetRoute('dashboard');
      setUnsavedNavModalOpen(true);
      return;
    }
    if (onBack) onBack();
    else if (onNavigate) onNavigate('dashboard');
  }, [isDirty, onBack, onNavigate]);

  // Global Keyboard Shortcuts (Del/Backspace hapus, R putar, Ctrl+Z undo, Ctrl+Y redo, Ctrl+S simpan)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Escape') {
        if (manageAssetsDrawerOpen) {
          e.preventDefault();
          setManageAssetsDrawerOpen(false);
          setIsFillAisleMode(false);
          setIsFillDockMode(false);
          return;
        }
        if (pointerControllerRef.current?.mode === 'placement') {
          e.preventDefault();
          handleCancelPlacement();
          return;
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (pointerControllerRef.current?.mode === 'placement') {
          pointerControllerRef.current.rotatePlacement();
          return;
        }
        handleRotate();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, handleRotate, handleUndo, handleRedo, handleSave, handleCancelPlacement]);

  // Viewport Handlers (Excel Model: fixed origin at ORIGIN_OFFSET = 84px)
  const handleZoom = (factor) => {
    if (!rendererRef.current || !containerRef.current) return;
    const vp = viewportRef.current;
    const nextVp = zoomAt(ORIGIN_OFFSET, ORIGIN_OFFSET, factor, vp);
    if (nextVp.tx > ORIGIN_OFFSET) nextVp.tx = ORIGIN_OFFSET;
    if (nextVp.ty > ORIGIN_OFFSET) nextVp.ty = ORIGIN_OFFSET;

    viewportRef.current = nextVp;
    setZoomPercent(Math.round((nextVp.scale / 0.015) * 100));
    rendererRef.current.viewport = nextVp;
    if (pointerControllerRef.current) {
      pointerControllerRef.current.viewport = nextVp;
    }
    rendererRef.current.markDirty();
  };

  const handleFitScreen = () => {
    if (!snapshot || !rendererRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const newVp = computeComfortableViewport(snapshot, container.clientWidth, container.clientHeight);
    viewportRef.current = newVp;
    setZoomPercent(Math.round((newVp.scale / 0.015) * 100));
    rendererRef.current.viewport = newVp;
    if (pointerControllerRef.current) {
      pointerControllerRef.current.viewport = newVp;
    }
    rendererRef.current.markDirty();
  };

  // STEP 12: Handle Inspeksi & Navigasi Spasial Lokasi (AC-17)
  const handleInspectLocation = (locId) => {
    setSelectedLocationIdForInspection(locId);
    setInspectorModalOpen(true);
  };

  const handleFocusLocation = (loc) => {
    if (!loc || !snapshot || !documentStoreRef.current) return;
    const store = documentStoreRef.current;
    const rackKey = `RACK:${loc.rack_id}`;

    // 1. Pilih rak di DocumentStore
    store.selectKey(rackKey, false);
    syncStoreUI();

    // 2. Pusatkan kamera / viewport pada rak (AC-17)
    const targetRack = snapshot.racks.find((r) => r.id === loc.rack_id);
    if (targetRack && containerRef.current) {
      const container = containerRef.current;
      const zoom = viewportRef.current.zoom;
      viewportRef.current.panX = container.clientWidth / 2 - (targetRack.x_mm + (targetRack.length_mm || 2000) / 2) * zoom;
      viewportRef.current.panY = container.clientHeight / 2 - (targetRack.y_mm + (targetRack.depth_mm || 1000) / 2) * zoom;
      if (rendererRef.current) {
        rendererRef.current.viewport = viewportRef.current;
        rendererRef.current.markDirty(true);
      }
      if (pointerControllerRef.current) {
        pointerControllerRef.current.viewport = viewportRef.current;
      }
    }

    // 3. Tampilkan toast info
    showToast(`Fokus ke lokasi ${loc.location_code} di Rak ${loc.rack_code}`);
  };

  if (loading) {
    return (
      <div className="dashboard-layout" style={{ height: '100vh', overflow: 'hidden' }}>
        <DashboardSidebar
          activePage="Warehouse Layout"
          warehouseName={warehouse?.warehouseName || 'Main Warehouse'}
          onNavigate={handleSidebarNavigate}
          open={navOpen}
          onClose={() => setNavOpen(false)}
        />
        <div className="dashboard-main" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="warehouse-layout-container">
            <div className="layout-state-banner">
              <div className="layout-state-spinner"></div>
              <p style={{ fontWeight: 600, color: '#3e5510' }}>Memuat layout gudang...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-layout" style={{ height: '100vh', overflow: 'hidden' }}>
        <DashboardSidebar
          activePage="Warehouse Layout"
          warehouseName={warehouse?.warehouseName || 'Main Warehouse'}
          onNavigate={handleSidebarNavigate}
          open={navOpen}
          onClose={() => setNavOpen(false)}
        />
        <div className="dashboard-main" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="warehouse-layout-container">
            <div className="layout-state-banner">
              <div style={{ color: '#dc2626', fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#191d17' }}>Gagal Memuat Layout</h3>
              <p style={{ color: '#737b6c', marginBottom: 20 }}>{error}</p>
              <button className="btn-layout-control btn-layout-primary" onClick={() => loadLayoutSnapshot(warehouseId)}>
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout" style={{ height: '100vh', overflow: 'hidden' }}>
      <DashboardSidebar
        activePage="Warehouse Layout"
        warehouseName={warehouse?.warehouseName || snapshot?.warehouse?.name || 'Main Warehouse'}
        onNavigate={handleSidebarNavigate}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <div className="dashboard-main" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="warehouse-layout-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`layout-toast-banner ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          <span>{toast.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* STEP 7: Interactive Editor Ribbon Toolbar (Office Style) */}
      <EditorToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        zoomPercent={zoomPercent}
        onOpenNav={() => setNavOpen(true)}
        canUndo={canUndo}
        canRedo={canRedo}
        isDirty={isDirty}
        isSaving={isSaving}
        hasSelection={selectedCount > 0}
        selectedCount={selectedCount}
        selectedType={documentStoreRef.current?.getSelectedItems()?.[0]?.type || 'rak'}
        slotConfig={slotConfig}
        onOpenSlotConfig={() => setSlotModalOpen(true)}
        warehouseName={snapshot?.warehouse?.name || 'Main Warehouse'}
        warehouseWidthM={Math.round((snapshot?.warehouse?.width_mm || 50000) / 1000)}
        warehouseLengthM={Math.round((snapshot?.warehouse?.length_mm || 80000) / 1000)}
        warehouseHeightM={Math.round((snapshot?.warehouse?.height_mm || 8000) / 1000)}
        onUpdateWarehouse={handleUpdateWarehouse}
        onNameChange={handleNameChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAddRack={() => {
          handleOpenAddRack();
          setDirectoryDrawerOpen(false);
        }}
        onAddAisle={handleAddAisle}
        onOpenAssets={() => {
          setManageAssetsDrawerOpen(true);
          setAddRackDrawerOpen(false);
          setLayersDrawerOpen(false);
          setDirectoryDrawerOpen(false);
        }}
        onRotate={handleRotate}
        onDelete={handleDelete}
        onGenerateLocations={handleOpenGenerator}
        onOpenLayers={() => {
          setLayersDrawerOpen(true);
          setAddRackDrawerOpen(false);
          setManageAssetsDrawerOpen(false);
          setDirectoryDrawerOpen(false);
        }}
        onOpenDirectory={() => {
          setDirectoryDrawerOpen(true);
          setAddRackDrawerOpen(false);
          setManageAssetsDrawerOpen(false);
          setLayersDrawerOpen(false);
        }}
        onToggleDirectory={() => {
          setDirectoryDrawerOpen((prev) => {
            const next = !prev;
            if (next) {
              setAddRackDrawerOpen(false);
              setManageAssetsDrawerOpen(false);
              setLayersDrawerOpen(false);
            }
            return next;
          });
        }}
        isDirectoryOpen={directoryDrawerOpen}
        totalLayersCount={
          (snapshot?.racks?.length || 0) +
          (snapshot?.layout_objects?.length || 0) +
          (snapshot?.aisles?.length || 0)
        }
        showGrid={showGrid}
        showGridMatrix={showGrid}
        onToggleGridMatrix={handleToggleGrid}
        showMeterGrid={showMeterGrid}
        onToggleMeterGrid={handleToggleMeterGrid}
        showGridHorizontal={showGridHorizontal}
        onToggleGridHorizontal={handleToggleGridHorizontal}
        showGridVertical={showGridVertical}
        onToggleGridVertical={handleToggleGridVertical}
        showSlotGrid={showSlotGrid}
        showSlotHorizontal={showSlotHorizontal}
        showSlotVertical={showSlotVertical}
        slotRotated={slotRotated}
        onToggleSlotHorizontal={handleToggleSlotHorizontal}
        onToggleSlotVertical={handleToggleSlotVertical}
        onSelectSlotOrientation={handleSelectSlotOrientation}
        isFillSlotMode={isFillSlotMode}
        activeRackColor={activeRackColor}
        onColorChange={handleColorChange}
        activeLevelCount={activeLevelCount}
        onLevelCountChange={handleLevelCountChange}
        maxLevelCount={maxLevelCount}
        isPathMode={isPathMode}
        onToggleSlotGrid={handleToggleSlotGrid}
        onToggleSlotRotate={handleToggleSlotRotate}
        onToggleFillSlotMode={handleToggleFillSlotMode}
        onTogglePathMode={handleTogglePathMode}
        onSave={handleSave}
        onFitScreen={handleFitScreen}
        onZoomIn={() => handleZoom(1.2)}
        onZoomOut={() => handleZoom(0.8)}
        onAddZone={handleAddZone}
        onAddLayoutObject={handleAddLayoutObject}
        showZoneLabels={showZoneLabels}
        onToggleZoneLabels={handleToggleZoneLabels}
      />

      {/* Canvas Viewport Area */}
      <div
        className="canvas-viewport-wrapper"
        ref={containerRef}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <canvas
          className="canvas-layer-base"
          ref={baseCanvasRef}
          style={{ display: viewMode === '2d' ? 'block' : 'none' }}
        />
        <canvas
          className="canvas-layer-overlay"
          ref={overlayCanvasRef}
          style={{ display: viewMode === '2d' ? 'block' : 'none' }}
        />

        {/* 3D Canvas Viewport */}
        {viewMode === '3d' && (
          <Warehouse3DCanvas
            snapshot={snapshot}
            onSwitchTo2D={() => setViewMode('2d')}
            activeRoute={activeRoute}
            selectedKeys={documentStoreRef.current?.selectedKeys || new Set()}
            hiddenLayers={hiddenLayers}
            showGrid={showGrid}
            showMeterGrid={showMeterGrid}
            showGridHorizontal={showGridHorizontal}
            showGridVertical={showGridVertical}
            showSlotGrid={showSlotGrid}
            showSlotHorizontal={showSlotHorizontal}
            showSlotVertical={showSlotVertical}
            slotConfig={slotConfig}
            slotRotated={slotRotated}
          />
        )}


        {/* Floating Stamp Placement Mode Banner */}
        {isPlacementActive && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 90,
              backgroundColor: '#191d17',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: '24px',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: '1.5px solid #5c732b',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <span>
              📍 Klik pada slot kanvas untuk meletakkan rak <strong style={{ color: '#fef08a' }}>{placementRackCode}</strong>{' '}
              <span style={{ opacity: 0.75, fontWeight: 400 }}>(Tekan <strong>[R]</strong> untuk putar, <strong>[ESC]</strong> untuk batal)</span>
            </span>
            <button
              type="button"
              onClick={handleCancelPlacement}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '3px 12px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Batal
            </button>
          </div>
        )}

        {/* Phase 4: Floating Pathfinding Panel */}
        <PathModePanel
          isOpen={isPathMode}
          onClose={handleTogglePathMode}
          pathStartNode={pathStartNode}
          setPathStartNode={setPathStartNode}
          pathGoalNode={pathGoalNode}
          setPathGoalNode={setPathGoalNode}
          pathAgentProfile={pathAgentProfile}
          setPathAgentProfile={setPathAgentProfile}
          routingCandidates={routingCandidates}
          activeRoute={activeRoute}
          onResetRoute={handleResetRoute}
        />


        {/* Modular Slot Config Drawer (Sidebar Kanan di Bawah Top Bar) */}
        <SlotConfigDrawer
          isOpen={slotModalOpen}
          initialConfig={slotConfig}
          activeColor={activeRackColor}
          onColorChange={handleColorChange}
          activeLevelCount={activeLevelCount}
          onLevelCountChange={handleLevelCountChange}
          isFillSlotMode={isFillSlotMode}
          onToggleFillSlotMode={handleToggleFillSlotMode}
          warehouseHeightMm={warehouseHeightMm}
          onClose={() => setSlotModalOpen(false)}
          onSave={handleSaveSlotConfig}
        />

        {/* Tata Rak Drawer (Sidebar Kanan di Bawah Top Bar) */}
        <AddRackDrawer
          isOpen={addRackDrawerOpen}
          slotConfig={slotConfig}
          slotRotated={slotRotated}
          existingRacks={snapshot?.racks || []}
          selectedRacks={
            documentStoreRef.current
              ? documentStoreRef.current.getSelectedItems().filter((s) => s.type === 'rack').map((s) => s.item)
              : []
          }
          warehouseHeightMm={warehouseHeightMm}
          activeColor={activeRackColor}
          onColorChange={handleColorChange}
          onApplyColorToSelected={handleColorChange}
          onRackCodeChange={handleRackCodeChange}
          activeLevelCount={activeLevelCount}
          onLevelCountChange={handleLevelCountChange}
          isFillSlotMode={isFillSlotMode}
          onToggleFillSlotMode={handleToggleFillSlotMode}
          onClose={() => setAddRackDrawerOpen(false)}
          onAddRack={handleConfirmAddRack}
          onSaveRack={handleSaveRack}
          onSelectRack={(id) => handleSelectEntityFromLayer('rack', id)}
          onDeleteRack={(id) => handleDeleteEntityFromLayer('rack', id)}
        />

        {/* Tata Aset Drawer (Pintu Masuk, Pintu Keluar, Area Docking, Jalan, Jalan Forklift) */}
        <ManageAssetsDrawer
          isOpen={manageAssetsDrawerOpen}
          warehouse={snapshot?.warehouse}
          walkwayConfig={walkwayConfig}
          onWalkwayConfigChange={handleWalkwayConfigChange}
          existingAssets={snapshot?.layout_objects || []}
          existingAisles={snapshot?.aisles || []}
          selectedAssets={
            documentStoreRef.current
              ? documentStoreRef.current.getSelectedItems().filter((s) => s.type !== 'rack').map((s) => s.item)
              : []
          }
          onClose={() => {
            setManageAssetsDrawerOpen(false);
            setIsFillAisleMode(false);
            setIsFillDockMode(false);
          }}
          onAddDoor={handleAddDoor}
          onAddDoorEntry={handleAddDoorEntry}
          onAddDoorExit={handleAddDoorExit}
          onAddDock={handleAddDock}
          onAddAisle={handleAddAisleFromAsset}
          onUpdateAsset={handleUpdateAsset}
          onSelectAsset={(type, id) => handleSelectEntityFromLayer(type, id)}
          onDeleteAsset={handleDeleteAssetItem}
          onSaveLayout={handleSave}
          isSaving={isSaving}
          isDirty={isDirty}
          isFillDockMode={isFillDockMode}
          onToggleFillDockMode={(cfg, explicitState) => {
            if (cfg) {
              setDockFillConfig(cfg);
            }
            setIsFillDockMode((prev) => {
              const next = typeof explicitState === 'boolean' ? explicitState : !prev;
              if (next) {
                if (!showSlotHorizontal && !showSlotVertical) {
                  setShowSlotHorizontal(true);
                  setShowSlotVertical(false);
                  setSlotRotated(false);
                }
                setShowSlotGrid(true);
                rendererRef.current?.setGridVisibility({
                  slot: true,
                  slotRotated: slotRotated,
                  slotHorizontal: !slotRotated,
                  slotVertical: slotRotated,
                });
                setIsFillSlotMode(false);
                setIsFillAisleMode(false);
              }
              return next;
            });
          }}
          isFillAisleMode={isFillAisleMode}
          onToggleFillAisleMode={(cfg, explicitState) => {
            if (cfg) {
              setAisleFillConfig(cfg);
            }
            setIsFillAisleMode((prev) => {
              const next = typeof explicitState === 'boolean' ? explicitState : !prev;
              if (next) {
                ensureSlotGridForAisle();
                setIsFillSlotMode(false);
                setIsFillDockMode(false);
              }
              return next;
            });
          }}
          onEnsureSlotGrid={ensureSlotGridForAisle}
          isSlotGridActive={Boolean(showSlotHorizontal || showSlotVertical || showSlotGrid)}
        />

        {/* Panel Layer Denah Gudang (Rak & Aset Terpasang) */}
        <LayersDrawer
          isOpen={layersDrawerOpen}
          onClose={() => setLayersDrawerOpen(false)}
          snapshot={snapshot}
          selectedKeys={documentStoreRef.current?.selectedKeys || new Set()}
          onSelectEntity={handleSelectEntityFromLayer}
          onFocusEntity={handleFocusEntityFromLayer}
          onDeleteEntity={handleDeleteEntityFromLayer}
          onDeleteSelectedEntity={handleDeleteSelectedFromLayer}
          hiddenLayers={hiddenLayers}
          onToggleLayerVisibility={handleToggleLayerVisibility}
          hiddenEntityIds={hiddenEntityIds}
          onToggleEntityVisibility={handleToggleEntityVisibility}
        />

        {/* STEP 12: Location & Rack Directory Drawer (Sidebar Kanan Langsung di Kanvas) */}
        <LocationDirectoryDrawer
          isOpen={directoryDrawerOpen}
          warehouseId={warehouseId}
          racks={snapshot?.racks || []}
          slotConfig={slotConfig}
          slotRotated={slotRotated}
          onClose={() => setDirectoryDrawerOpen(false)}
          onInspectLocation={handleInspectLocation}
          onFocusLocation={handleFocusLocation}
          onSelectRack={(id) => handleSelectEntityFromLayer('rack', id)}
          onFocusRack={(rack) => handleFocusEntityFromLayer('rack', rack)}
          onSaveRack={handleSaveRack}
          onDeleteRack={(id) => handleDeleteEntityFromLayer('rack', id)}
          onOpenLocationGenerator={(rack) => {
            setSelectedRackForGenerator(rack);
            setGeneratorModalOpen(true);
          }}
        />
      </div>

      {/* Conflict Dialog Modal (AC-15) */}
      <ConflictDialog
        isOpen={conflictOpen}
        conflictDetails={conflictDetails}
        onReload={() => loadLayoutSnapshot(warehouseId)}
        onDismiss={() => setConflictOpen(false)}
      />

      {/* STEP 11: Bulk Location Generator Modal */}
      <LocationGeneratorModal
        isOpen={generatorModalOpen}
        rack={selectedRackForGenerator}
        onClose={() => setGeneratorModalOpen(false)}
        onGenerated={handleLocationsGenerated}
      />

      {/* STEP 12: Location Inspector Modal */}
      <LocationInspectorModal
        isOpen={inspectorModalOpen}
        locationId={selectedLocationIdForInspection}
        onClose={() => setInspectorModalOpen(false)}
        onStatusUpdated={(updatedLoc) => {
          showToast(`Status ${updatedLoc.location_code} berhasil diperbarui.`);
        }}
      />

      {/* Unsaved Changes Guard Dialog */}
      {unsavedNavModalOpen && (
        <div className="layout-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="layout-modal-card" style={{ maxWidth: 440 }}>
            <div className="layout-modal-header">
              <div className="layout-modal-icon-warning">⚠️</div>
              <div>
                <h3 className="layout-modal-title">Perubahan Belum Disimpan</h3>
                <p className="layout-modal-subtitle">
                  Terdapat penataan tata letak gudang yang belum tersimpan ke database.
                </p>
              </div>
            </div>
            <div className="layout-modal-body">
              <p style={{ color: '#4b5563', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
                Jika Anda meninggalkan halaman sekarang, seluruh perubahan posisi, penambahan rak, atau lorong yang baru saja Anda buat akan hilang.
              </p>
            </div>
            <div className="layout-modal-footer" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                className="btn-layout-control"
                onClick={() => setUnsavedNavModalOpen(false)}
              >
                Tetap di Sini
              </button>
              <button
                className="btn-layout-control"
                style={{ backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}
                onClick={handleDiscardAndLeave}
              >
                Buang & Keluar
              </button>
              <button
                className="btn-layout-control btn-layout-primary"
                onClick={handleSaveAndLeave}
                disabled={isSaving}
              >
                {isSaving ? 'Menyimpan...' : '💾 Simpan & Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}


        </div>
      </div>
    </div>
  );
}
