# 📋 Laporan Analisis Menyeluruh Sistem SUSUNO

### Smart Warehouse Inventory System — Full Codebase Audit

**Tanggal:** 20 November 2026 | **Auditor:** AI Agent  
**Cakupan:** Web (React 19), Mobile (Flutter), Backend (Node.js/Express), **Deep Dive: Warehouse Layout Module**

---

## 1. RINGKASAN EKSEKUTIF

| Metrik | Nilai |
|--------|-------|
| **Total File Source** | ~170+ file (Web 90+, Mobile 26, Backend 50+) |
| **Modul Warehouse Layout** | **61 file** (29 frontend + 32 backend) |
| **File Terbesar** | `WarehouseLayoutPage.jsx` — **2,744 baris / 104 KB** |
| **Total Tabel Database** | 14 tabel core + **11 tabel warehouse layout** = 25 tabel |
| **API Endpoints** | ~65 core + **28 warehouse layout** = ~93 endpoint |
| **Backend Test Files** | 8 test suites warehouse layout |
| **Frontend Test Files** | 7 test suites warehouse layout |
| **Shared Library** | `shared/layout-core/` (geometry, spatial hash, pathfinding) |

### Kesehatan Keseluruhan: 🟢 **BAIK** (dengan catatan perbaikan)

Sistem SUSUNO merupakan proyek warehouse management yang **sangat matang dan well-engineered**. Arsitektur modul Warehouse Layout khususnya menunjukkan kecanggihan tingkat enterprise dengan fitur 2D canvas editor, 3D viewport, pathfinding A*, batch patch CAS locking, dan location directory paginated untuk 100,000+ bin.

### ⚠️ 5 Isu Paling Kritis

1. `WarehouseLayoutPage.jsx` terlalu monolitik (2,744 baris) — perlu decomposition
2. Hardcoded filter `Zone A` di `loadLayoutSnapshot` (line 351) — data bisa hilang
3. `documentStore.js` rebuild spatial hash pada **setiap mutasi** — O(n) per move
4. `pointerEvents.js` duplikasi logika collision detection (3x di moveEntity, rotateEntity, addAisle)
5. Web API service (`api.js`) tidak digunakan oleh modul Warehouse Layout — dual-fetch pattern

---

## 2. OVERVIEW ARSITEKTUR

### Diagram Sistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUSUNO SYSTEM ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🖥️ WEB MANAGEMENT CONSOLE          📱 MOBILE APP (Flutter)                │
│  React 19 + Vite + Canvas 2D/3D     9 Screens + ChangeNotifier             │
│  Port: 5173                          Target: Android/iOS                    │
│  ┌────────────────────────────┐      ┌──────────────────────────┐          │
│  │ App.jsx (State Router)    │      │ AppShell (Index Nav)     │          │
│  │ 12 Pages + WH Layout      │      │ WarehouseState           │          │
│  │ services/api.js            │      │ ApiService (HTTP)        │          │
│  └────────────┬───────────────┘      └───────────┬──────────────┘          │
│               │                                   │                        │
│               └──────────────┬────────────────────┘                        │
│                              ▼                                              │
│  ⚙️ BACKEND (Node.js / Express / MySQL)                                    │
│  Port: 5000 | Base: /api                                                   │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │ server.js → 18 Route Modules + WH Layout Module             │          │
│  │ Helmet + CORS + Rate Limiter + JWT Auth                      │          │
│  │ MySQL 25 Tables (14 core + 11 warehouse layout)              │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  📦 SHARED LIBRARY (layout-core)                                           │
│  Geometry, SpatialHash, OccupancyGrid, A*, Code Patterns                   │
│                                                                             │
│  🤖 AI MODULE                                                              │
│  Gemini SDK + Knowledge Base + Heuristic Utils                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Web Frontend** | React 19, Vite, Vanilla CSS, Native Canvas 2D API, Custom 3D Engine |
| **Mobile** | Flutter, Dart, Material 3, Plus Jakarta Sans font |
| **Backend** | Node.js, Express, MySQL 2 (pool), JWT Auth, Helmet, CORS |
| **AI** | Google Gemini SDK, Knowledge Base (markdown/txt), Heuristic utils |
| **Shared** | `layout-core` — geometry, spatial hash, occupancy grid, A*, code patterns |

---

## 3. MODUL WAREHOUSE LAYOUT (DEEP DIVE)

> Ini adalah modul paling kompleks dalam seluruh sistem SUSUNO. Terdiri dari **61 file**, mencakup canvas editor 2D, viewport 3D, pathfinding, location management untuk 100K+ bins, dan batch patch system dengan optimistic concurrency control.

### 3a. Arsitektur Frontend

#### File Utama & Tanggung Jawab

| File | Baris | Peran |
|------|-------|-------|
| `WarehouseLayoutPage.jsx` | 2,744 | **Orchestrator utama** — routing, state, event handlers, render |
| `documentStore.js` | 1,029 | **In-memory state store** — snapshot, mutation, selection, batch patch compiler |
| `history.js` | 140 | **Undo/Redo stack** — 100 step inverted JSON-patch |
| `renderer.js` | 1,754 | **Canvas 2D renderer** — dual layer (base + overlay), LOD, DPR cap, grid |
| `pointerEvents.js` | 1,384 | **Interaction controller** — hit-test, drag, pan, zoom, slot fill, rubber band |
| `viewport.js` | 142 | **Viewport math** — screen↔world transform, zoom-at-cursor, fitBounds |

#### State Management Pattern

```
WarehouseLayoutPage (React State — UI only)
  ├── DocumentStore (imperative, mutable snapshot)
  │     ├── SpatialHash (collision detection)
  │     └── Selection Set
  ├── HistoryManager (undo/redo stack)
  ├── LayoutRenderer (rAF dirty-flag loop)
  └── PointerController (native event handlers)
```

**Prinsip Desain:**
- **Zero React re-renders saat drag/pan/zoom** — semua interaksi canvas ditangani oleh class imperative (`PointerController`, `LayoutRenderer`), bukan React state
- React state hanya untuk UI toolbar, modal, dan loading
- `syncStoreUI()` callback menjembatani perubahan store ke React state saat operasi selesai

#### 15 Komponen Pendukung

| Komponen | Size | Fungsi |
|----------|------|--------|
| `EditorToolbar.jsx` | 40KB | Top toolbar lengkap: undo/redo, zoom, save, grid toggles, path mode, tools |
| `ManageAssetsDrawer.jsx` | 84KB | Drawer kelola aset: pintu, dok, jalan, forklift — drag-and-drop ke canvas |
| `LocationDirectoryDrawer.jsx` | 66KB | Direktori lokasi penyimpanan: cursor pagination, search, filter, rack detail |
| `Warehouse3DCanvas.jsx` | 67KB | **Custom 3D engine** (pure Canvas 2D projection, no WebGL!) |
| `AddRackDrawer.jsx` | 36KB | Form tambah rak: dimensi, kode, warna, level, preview |
| `LocationInspectorModal.jsx` | 35KB | Detail lokasi bin: status, dimensi, QR print, audit history |
| `SlotConfigDrawer.jsx` | 27KB | Konfigurasi dimensi slot modular (panjang × lebar × tinggi) |
| `LayersDrawer.jsx` | 23KB | Panel layer visibility (ala Figma/CAD) — hide/show/focus entities |
| `RackStructureForm.jsx` | 15KB | Editor struktur fisik rak: bays, levels, position count matrix |
| `SlotConfigModal.jsx` | 11KB | Modal slot config (versi popup) |
| `RackElevationSvg.jsx` | 10KB | SVG visual tampak samping rak (elevation view) |
| `LocationGeneratorModal.jsx` | 8KB | Bulk location code generator dengan pattern template |
| `RackElevationModal.jsx` | 6KB | Container modal untuk elevation SVG |
| `PatternConfigurator.jsx` | 5KB | Konfigurasi pattern kode lokasi |
| `ConflictDialog.jsx` | 2KB | Dialog konflik versi (CAS mismatch) |

---

### 3b. Arsitektur Backend

#### Database Schema (11 Tabel)

```
warehouses
  ├── zones (1:N)
  ├── aisles (1:N)
  ├── racks (1:N)
  │     ├── rack_bays (1:N)
  │     ├── rack_levels (1:N)
  │     ├── rack_bay_level_configs (N — bay × level matrix)
  │     ├── rack_aisle_access (N:M — via aisles)
  │     └── storage_locations (1:N — target 100,000 bins)
  ├── layout_objects (1:N — docks, doors, pillars, walls)
  └── code_registry (1:N — permanent, prevents code reuse)
```

**Tabel Utama:**

| Tabel | Kolom Kunci | Constraint |
|-------|-------------|------------|
| `warehouses` | `code` (UK), `width_mm`, `length_mm`, `height_mm`, `layout_version` | CHECK dims > 0 |
| `zones` | `zone_code` (UK per WH), `color_hex`, `x/y/width/length_mm` | FK warehouse, CHECK dims > 0 |
| `aisles` | `aisle_code` (UK per WH), `direction`, `retired_at` | FK warehouse, CHECK dims > 0 |
| `racks` | `rack_code` (UK per WH), `rotation` (0/90/180/270), `version` | FK warehouse + zone, CHECK rotation IN (0,90,180,270) |
| `rack_bays` | `bay_number` (UK per rack) | FK rack |
| `rack_levels` | `level_number` (UK per rack), `height_from_floor_mm` | FK rack |
| `rack_bay_level_configs` | `position_count`, `last_issued_position_number` | FK rack + bay + level (composite) |
| `storage_locations` | `location_code` (UK per WH), `manual_status` (ENUM), `position_number` | FK bay + level (composite) |
| `code_registry` | `code_type`, `normalized_code` (UK per WH) | Permanent, no CASCADE |
| `layout_objects` | `object_type`, `clearance_mm`, `rotation` | FK warehouse |
| `rack_aisle_access` | `access_side`, `is_primary` | FK rack + aisle, UK (rack_id, aisle_id) |

#### Data Integrity Triggers (5 Trigger MySQL)

1. **`trg_prevent_rack_code_update`** — Immutabilitas `rack_code` (AC-10)
2. **`trg_prevent_location_code_update`** — Immutabilitas `location_code` (AC-10)
3. **`trg_check_primary_aisle_insert`** — Validasi primary aisle & warehouse match (AC-21)
4. **`trg_check_primary_aisle_update`** — Update guard primary aisle (AC-21)
5. **`trg_check_last_issued_pos_update`** — Append-first expansion (monotonic counter)

#### API Routes (28 Endpoints)

| Group | Endpoints | Method |
|-------|-----------|--------|
| **Snapshot & Batch Patch** | `/warehouses/:id/layout` | GET, PATCH |
| **Pathfinding** | `/warehouses/:id/path` | POST |
| **Warehouses** | `/warehouses` | POST, GET, GET/:id, PUT/:id |
| **Zones** | `/zones`, `/warehouses/:id/zones` | POST, GET, DELETE |
| **Aisles** | `/aisles`, `/warehouses/:id/aisles` | POST, GET, DELETE |
| **Racks** | `/racks` | POST, GET, GET/:id, PUT/:id, PUT/:id/aisles, DELETE/:id |
| **Rack Structure** | `/racks/:id/structure` | GET, POST preview, PUT |
| **Location Generator** | `/racks/:id/generate-locations` | POST preview, POST |
| **Location Directory** | `/warehouses/:id/locations/overview`, `/locations` | GET×3, PATCH status |
| **Layout Objects** | `/layout-objects` | POST, GET, DELETE |

#### Services Layer

| Service | Tanggung Jawab |
|---------|----------------|
| `batchPatchService.js` | **CAS (Compare-And-Swap) atomic batch operations** — optimistic locking per entity & per layout version, all-or-nothing rollback |
| `layoutValidationService.js` | **Geometry validation** — boundary check, zone containment, physical collision detection (rack vs rack, rack vs aisle, rack vs obstacle) |
| `rackStructureService.js` | **Rack internal structure** — bay/level/position matrix CRUD, structural diff preview |
| `locationGeneratorService.js` | **Bulk location code generator** — append-first (AC-13), pattern rendering, chunked inserts (5,000/batch), code registry |
| `locationDirectoryService.js` | **High-performance directory** — keyset cursor pagination, deferred joins, <30ms latency target on 100K rows |
| `pathService.js` | **Spatial pathfinding** — builds OccupancyGrid + NavGraph, A* & Dijkstra multi-target, in-memory cache by layout version |

#### RBAC Middleware

File: `middlewares/layoutRbac.js`

| Permission | Akses |
|------------|-------|
| `layout.view` | manager, staf |
| `layout.edit` | manager only |
| `location.configure` | manager only |

---

### 3c. 3D/Canvas Rendering Engine

Sistem rendering terdiri dari **2 mode**:

**Mode 2D (Canvas Top View):**
- Dual-canvas architecture: `baseCanvas` (static objects) + `overlayCanvas` (selection, ghosts, rubber band)
- Dirty-flag `requestAnimationFrame` loop — hanya render saat ada perubahan
- DPR (Device Pixel Ratio) capped at 2 untuk performa konsisten
- Viewport culling via `SpatialHash.query()` pada visible bounds
- Adaptive grid: 1m dan 5m lines + modular slot grid (custom dimensions)
- Level of Detail (LOD): label teks hanya muncul pada zoom level tertentu

**Mode 3D (Warehouse3DCanvas):**
- **100% Pure Canvas 2D projection** — tanpa WebGL, Three.js, atau library 3D lainnya
- Isometric projection menggunakan manual `projectPoint()` function
- 360° horizontal orbit, 15°–88° vertical pitch clamp
- Cross-product back-face culling untuk solid cuboid rendering
- Rack visualization: industrial blue uprights, orange beams, diagonal bracing
- Cardboard box rendering: kraft-colored boxes with tape lines
- Pintu & dok warna-warni (entry=hijau, exit=merah, both=biru, glass=cyan)

**Color Palette (Renderer):**

| Token | Hex | Penggunaan |
|-------|-----|------------|
| `canvasBg` | `#f8f9f5` | Latar belakang canvas |
| `warehouseWall` | `#191d17` | Garis dinding gudang |
| `gridMajor` | `#b5c4a5` | Grid 5m major |
| `gridMinor` | `#e2e7dc` | Grid 1m minor |
| `gridSlot` | `#a78bfa` | Grid slot modular (violet) |
| `rackBorder` | `#3e5510` | Border rak (Forest Deep) |
| `rackFill` | `#eef3e2` | Fill rak (Light Forest) |
| `aisleFill` | `#fef9c3` | Fill jalan (Light Yellow) |
| `selectionBorder` | `#0284c7` | Border seleksi (Blue) |
| `collisionBorder` | `#dc2626` | Indikator tabrakan (Red) |

---

### 3d. Peta Fitur Lengkap (28 Fitur)

| # | Fitur | Frontend | Backend | Status |
|---|-------|----------|---------|--------|
| 1 | Top View 2D Floor Plan Editor | `WarehouseLayoutPage` + engine | Snapshot API | ✅ Aktif |
| 2 | 3D Perspective Viewport | `Warehouse3DCanvas` | — | ✅ Aktif |
| 3 | Drag-and-Drop Rack Placement | `PointerController` | — | ✅ Aktif |
| 4 | Interactive Stamp Placement | `PointerController.startPlacement()` | — | ✅ Aktif |
| 5 | Slot Fill Mode (Rubber Band) | `PointerController` slot fill | — | ✅ Aktif |
| 6 | Undo/Redo (100 steps) | `HistoryManager` | — | ✅ Aktif |
| 7 | Batch Save (CAS Locking) | `DocumentStore.compilePatch()` | `BatchPatchService` | ✅ Aktif |
| 8 | Collision Detection | `SpatialHash` + geometry | `LayoutValidationService` | ✅ Aktif |
| 9 | Zone Management | `LayersDrawer`, canvas | `zoneController` | ✅ Aktif |
| 10 | Aisle Management | `ManageAssetsDrawer`, canvas | `aisleController` | ✅ Aktif |
| 11 | Door Management (Entry/Exit/Both) | `ManageAssetsDrawer`, canvas | `layoutObjectController` | ✅ Aktif |
| 12 | Dock Management | `ManageAssetsDrawer`, canvas | `layoutObjectController` | ✅ Aktif |
| 13 | Forklift Lane Support (Min 2.5m) | Minimum width validation | — | ✅ Aktif |
| 14 | Pedestrian + Forklift Merge | `addAisle()` auto-merge logic | — | ✅ Aktif |
| 15 | Rack Structure Editor (Bay/Level) | `RackStructureForm` | `rackStructureService` | ✅ Aktif |
| 16 | Rack Elevation View (SVG) | `RackElevationSvg` | — | ✅ Aktif |
| 17 | Bulk Location Generator | `LocationGeneratorModal` | `LocationGeneratorService` | ✅ Aktif |
| 18 | Location Directory (100K+) | `LocationDirectoryDrawer` | `LocationDirectoryService` | ✅ Aktif |
| 19 | Location Inspector | `LocationInspectorModal` | `locationDirectoryController` | ✅ Aktif |
| 20 | Code Registry (Immutable) | — | `code_registry` table + triggers | ✅ Aktif |
| 21 | Layer Visibility (Figma-like) | `LayersDrawer` | — | ✅ Aktif |
| 22 | Pathfinding (A* + Dijkstra) | Path mode UI | `PathService` | ✅ Aktif |
| 23 | Grid System (Meter + Slot) | `renderer.js` grid drawing | — | ✅ Aktif |
| 24 | FPS Counter | `onFrameRendered` callback | — | ✅ Aktif |
| 25 | Keyboard Shortcuts | Space=Pan, ESC=Cancel, R=Rotate | — | ✅ Aktif |
| 26 | Unsaved Changes Guard | `beforeunload` + nav modal | — | ✅ Aktif |
| 27 | Version Conflict Dialog | `ConflictDialog` | CAS version check | ✅ Aktif |
| 28 | RBAC Middleware | — | `layoutRbac.js` | ✅ Aktif |

---

### 3e. Penilaian Test Coverage

| Test Suite | Layer | Cakupan |
|------------|-------|---------|
| `editorHistory.test.js` | Frontend | undo/redo stack, isDirty, max steps |
| `engine.test.js` | Frontend | viewport transforms, zoom math |
| `locationDirectoryUi.test.js` | Frontend | drawer UI, pagination, search |
| `locationGeneratorUi.test.js` | Frontend | modal flow, pattern preview |
| `pathfindingUi.test.js` | Frontend | path mode toggle, route display |
| `rackElevation.test.js` | Frontend | SVG elevation rendering |
| `warehouse3d.test.js` | Frontend | 3D projection, orbit, culling |
| `apiCrud.test.js` | Backend | CRUD endpoints semua entity |
| `databaseIntegration.test.js` | Backend | Migrasi, trigger, FK constraints |
| `locationDirectory.test.js` | Backend | Keyset pagination, search, filter |
| `locationGenerator.test.js` | Backend | Bulk generate, append-first, registry |
| `pathApi.test.js` | Backend | A* route, cache, edge cases |
| `rackStructure.test.js` | Backend | Bay/level CRUD, diff preview |
| `snapshotBatch.test.js` | Backend | CAS lock, batch patch, conflict |
| `run_all_tests.js` | Backend | Test orchestrator |

> **Penilaian:** Test coverage **sangat baik** — 15 test suites mencakup unit, integration, dan edge cases. Ini jauh di atas rata-rata proyek sejenis.

---

### 3f. Isu Kritis & Bug yang Ditemukan

| # | Severity | File : Line | Isu |
|---|----------|-------------|-----|
| 1 | 🔴 **Critical** | `WarehouseLayoutPage.jsx:351` | **Hardcoded filter Zone A** — `layoutData.zones.filter(z => z.zone_code !== 'ZONE-A')` menghapus zona apapun bernama Zone A dari rendering. Jika user membuat zona bernama Zone A, datanya tak pernah tampil. |
| 2 | 🔴 **Critical** | `WarehouseLayoutPage.jsx` (seluruh file) | **File terlalu monolitik** (2,744 baris) — 50+ useState hooks, 30+ useCallback, 15+ useEffect. Sangat sulit dimaintain dan di-debug. |
| 3 | 🟡 **High** | `documentStore.js:_rebuildSpatialHash` | **`_rebuildSpatialHash()` dipanggil setiap mutasi** (move, rotate, add, delete). Pada layout 500+ rak, O(n) rebuild per operasi drag membuat framerate drop. |
| 4 | 🟡 **High** | `WarehouseLayoutPage.jsx:29-32` | **Token key mismatch** — `getAuthToken()` membaca `susuno_auth_token` lalu fallback `susuno_token`, sementara `api.js` hanya membaca `susuno_token`. Bisa menyebabkan token mismatch. |
| 5 | 🟡 **High** | `documentStore.js:192-210, 259-277, 453-466` | **Duplikasi logika collision** — logika forklift/dock collision exemption diulang 3x di `moveEntity`, `rotateEntity`, dan `addAisle`. Harus di-extract ke helper method. |
| 6 | 🟡 **High** | WH Layout vs core modules | **Dual API pattern** — Warehouse Layout menggunakan direct `fetch()`, modul lain menggunakan `ApiService`. Dua pola akses API berbeda dalam satu aplikasi. |
| 7 | 🟠 **Medium** | `WarehouseLayoutPage.jsx:753` | **useEffect dependency** `[snapshot, syncStoreUI]` pada canvas init — `snapshot` berubah setiap `syncStoreUI()`, berpotensi trigger canvas re-initialization. |
| 8 | 🟠 **Medium** | `pointerEvents.js:115-116` | **Memory leak potensial** — `window` keydown/keyup listeners tidak dijamin cleanup jika komponen unmount tanpa `destroy()`. |
| 9 | 🟠 **Medium** | `layoutRbac.js` | **RBAC terlalu sederhana** — hanya 3 permission, tidak ada granular per-entity atau per-warehouse permission. |
| 10 | 🟠 **Medium** | `Warehouse3DCanvas.jsx` | **3D canvas berat** pada layout besar karena pure Canvas 2D projection tanpa GPU acceleration (WebGL). |

---

### 3g. Concern Performa

| Area | Detail | Dampak |
|------|--------|--------|
| **SpatialHash Rebuild** | Full O(n) rebuild per mutation | 🟡 Noticeable pada 200+ objek |
| **Batch Patch Size** | Backend sequential loop per operation | 🟡 Lambat pada 50+ operasi |
| **Location Directory** | Keyset cursor pagination (optimized) | 🟢 <30ms target pada 100K rows |
| **Path Routing Cache** | In-memory, keyed by layout_version | 🟢 Efisien, auto-invalidate |
| **3D Rendering** | Pure Canvas 2D projection, no WebGL | 🟡 Berat pada 100+ rak |
| **Canvas DPR** | Capped at 2× | 🟢 Konsisten |
| **Renderer Loop** | Dirty-flag rAF (not continuous) | 🟢 Efisien — idle = 0 CPU |

### 3h. Kepatuhan UX/Design

| Aspek | Status | Detail |
|-------|--------|--------|
| Palet Olive Primary `#5c732b` | ✅ | Rack border, default color, toolbar |
| Forest Deep `#3e5510` | ✅ | Rack border di renderer |
| Canvas Background `#f8f9f5` | ✅ | `PALETTE.canvasBg` |
| Selection Blue `#0284c7` | ✅ | Selection border & handles |
| Collision Red `#dc2626` | ✅ | Collision indicator |
| Border Radius 14px Cards | ⚠️ Sebagian | Drawer menggunakan custom styling |
| Toast Notifications | ✅ | Custom toast di toolbar area |
| Keyboard Shortcuts | ✅ | Space=Pan, Esc=Cancel, R=Rotate |
| Unsaved Guard | ✅ | `beforeunload` + custom modal |

---

## 4. ANALISIS APLIKASI WEB (Non-Layout)

### Routing Architecture

- **State-driven router** di `App.jsx` menggunakan `step` state + HTML5 History API sync
- 12 halaman utama (dashboard, inbound, outbound, purchase-orders, suppliers, dll.)
- Guard: localStorage `susuno_token` + `susuno_user`

### API Service Pattern

- Central `ApiService` class di `services/api.js` — fetch wrapper dengan token interceptor
- Error handling: network error detection, JSON parse fallback
- Token storage: `localStorage.susuno_token`

### Key Pages

| Page | Kompleksitas | Fitur Utama |
|------|-------------|-------------|
| Dashboard | Medium | KPI widgets, shift status, stok alert |
| Inbound | Tinggi | 5 sub-components, alur bertahap (Scheduled → Arrived → Inspecting → Inspected → Received) |
| Outbound | Tinggi | Mirror dari Inbound (Scheduled → Allocated → Picked → Shipped) |
| Purchase Orders | Tinggi | PO flow, anti self-approval, PDF export, auto-schedule ke Inbound |
| Suppliers | Medium | Direktori vendor, katalog produk, performa lead time |
| Staff Management | Tinggi | 3 tab (Accounts, Shifts, Roles), Google Calendar view |
| Inventory | Medium | Daftar produk, search, kategori |

### Pola Positif Web

- ✅ Read-only enforcement yang ketat pada Inbound (Manager tidak bisa edit hitungan staf)
- ✅ Alur handover Mobile → Web yang terdefinisi dengan jelas
- ✅ AI Chatbot widget terintegrasi (AIChatbotWidget.jsx)
- ✅ Dark/Light mode (Settings → Appearance)

---

## 5. ANALISIS APLIKASI MOBILE (Flutter)

### Architecture

- 9 screens dalam `AppShell` via indexed navigation
- State management: `ChangeNotifier` (`WarehouseState`)
- API: Custom `ApiService` HTTP client
- Dynamic base URL: Android emulator → `10.0.2.2`, real device → configurable IP

### Screens Map

| Index | Screen | Fungsi |
|-------|--------|--------|
| 0 | Dashboard | Tugas inspeksi dok, shift hari ini, tugas aktif |
| 1 | Stock | Monitoring stok, search produk |
| 2 | Scanner | Barcode/QR scan kamera + input manual |
| 3 | Alerts | Notifikasi stok menipis, tenggat waktu |
| 4 | Activity | Log aktivitas staf (audit trail) |
| 5 | Shift Hub | Jadwal shift, kalender, presensi |
| 6 | Stock Flows | Stepper wizard inbound putaway & outbound picking |
| 7 | Insight | Prediksi AI ringkas |
| 8 | Profile | Check-in/out, tema, OTA update |

### Mobile-Web Feature Parity

| Fitur | Web (Manager) | Mobile (Staf) |
|-------|---------------|---------------|
| Dashboard | ✅ KPI Overview | ✅ Task-centric |
| Inbound Inspection | ✅ Read-only review + ACC | ✅ Full input (qty, barcode, foto) |
| Barcode Scan | ❌ Tidak ada | ✅ Camera + manual |
| Warehouse Layout | ✅ Full editor | ❌ Tidak ada |
| AI Insight | ✅ Full dashboard | ✅ Ringkasan |
| Shift Management | ✅ Full CRUD | ✅ View + presensi |
| OTA App Update | ❌ N/A | ✅ In-app APK download |

---

## 6. ANALISIS BACKEND & DATABASE

### Server Configuration

- Port 5000, Helmet security headers, CORS whitelist
- Body parser limit 25MB (untuk foto upload)
- Rate limiter aktif di semua `/api/*`
- Error handler: strip stack trace dari response ke client

### Database: 25 Tabel Total

**Core (14 tabel):**
`users`, `products`, `locations`, `suppliers`, `purchase_orders`, `purchase_order_items`, `shifts`, `attendance_logs`, `tasks`, `task_assignments`, `stock_transactions`, `audit_logs`, `ai_predictions`, `categories`

**Warehouse Layout (11 tabel):**
`warehouses`, `zones`, `aisles`, `racks`, `rack_aisle_access`, `rack_bays`, `rack_levels`, `rack_bay_level_configs`, `storage_locations`, `code_registry`, `layout_objects`

### Security Measures

- ✅ JWT token verification via `authMiddleware.verifyToken`
- ✅ Role-based access: `manager`, `staf`
- ✅ Parameterized SQL queries (no raw string concatenation)
- ✅ Helmet HTTP headers
- ✅ CORS origin whitelist (localhost + private IPs)
- ✅ Rate limiting
- ✅ Error message sanitization (no stack traces to client)
- ✅ X-Powered-By disabled

---

## 7. CONCERN LINTAS MODUL

### 7.1 Dual API Pattern

> ⚠️ **Peringatan:** Modul Warehouse Layout **tidak menggunakan** `services/api.js` central service. Sebaliknya, ia melakukan `fetch()` langsung dengan token dari `localStorage.getItem('susuno_auth_token')` atau `localStorage.getItem('susuno_token')`. Sementara modul lain menggunakan `ApiService` yang baca `susuno_token`. **Ini menciptakan dua pola akses API yang berbeda** dan bisa menyebabkan token key mismatch.

### 7.2 Error Handling Inconsistency

- Modul core (Inbound, Outbound, dll): error handling via `ApiService.request()` catch
- Modul Warehouse Layout: error handling inline per `fetch()` call
- Backend error response: mix antara `{ error, message }` dan `{ error, code, message, requestId }`

### 7.3 Styling Architecture

- Modul core: Vanilla CSS files per page (`styles/inbound.css`, `styles/dashboard.css`)
- Modul Warehouse Layout: **single CSS file** `warehouseLayout.css` (34KB)
- Tidak ada CSS module, Tailwind, atau CSS-in-JS — potential class name collision

### 7.4 State Management

- Web core: Semua state di `App.jsx` via props drilling ke child components
- Warehouse Layout: Hybrid imperative (DocumentStore) + React state — lebih baik
- Mobile: `ChangeNotifier` (single global state)
- **Tidak ada state management library** (Redux, Zustand, Riverpod)

---

## 8. REGISTRASI ISU & STATUS PERBAIKAN

| # | Level | Area | Isu | Lokasi | Status |
|---|-------|------|-----|--------|--------|
| 1 | 🔴 Critical | WH Layout | Hardcoded Zone A filter menghapus data valid | `WarehouseLayoutPage.jsx:351` | ✅ **Resolved** (Filter dihapus) |
| 2 | 🔴 Critical | WH Layout | WarehouseLayoutPage.jsx terlalu besar (2,744 lines) | Seluruh file | 🔄 *In Progress* (Diekstrak `PathModePanel.jsx`) |
| 3 | 🟡 High | WH Layout | SpatialHash full rebuild O(n) setiap mutasi | `documentStore.js:_rebuildSpatialHash` | ✅ **Resolved** (O(1) incremental update/remove) |
| 4 | 🟡 High | WH Layout | Token key mismatch (`susuno_auth_token` vs `susuno_token`) | `WarehouseLayoutPage.jsx:32` | ✅ **Resolved** (Standarisasi ke `susuno_token`) |
| 5 | 🟡 High | WH Layout | Duplikasi logika collision 3x (DRY violation) | `documentStore.js:192-210, 259-277` | ✅ **Resolved** (Diekstrak ke `_filterEffectiveCollisions`) |
| 6 | 🟡 High | Arsitektur | Dual API pattern (direct fetch vs ApiService) | WH Layout vs core modules | ✅ **Resolved** (Menambahkan layout endpoint ke `ApiService`) |
| 7 | 🟠 Medium | WH Layout | useEffect dependency bisa trigger canvas re-init | `WarehouseLayoutPage.jsx:753` | ✅ **Resolved** (Lifecycle decouple via `layoutSessionKey`) |
| 8 | 🟠 Medium | WH Layout | Memory leak: window listeners tanpa guaranteed cleanup | `pointerEvents.js:115-116` | ✅ **Resolved** (Stabilisasi lifecycle canvas & cleanup) |
| 9 | 🟠 Medium | WH Layout | RBAC terlalu sederhana — no per-entity permission | `layoutRbac.js` | ✅ **Resolved** (Per-warehouse scope guard ditambahkan) |
| 10 | 🟠 Medium | WH Layout | 3D canvas berat tanpa WebGL | `Warehouse3DCanvas.jsx` | ⏳ Future Scalability |
| 11 | 🟠 Medium | CSS | Single 34KB CSS file tanpa modularisasi | `warehouseLayout.css` | ⏳ Planned |
| 12 | 🟠 Medium | Web | App.jsx monolithic router | `App.jsx` | ⏳ Planned |
| 13 | 🔵 Low | WH Layout | Toast timeout tanpa debounce | `WarehouseLayoutPage.jsx:267` | ✅ **Resolved** (Debounced timeout via `toastTimeoutRef`) |
| 14 | 🔵 Low | WH Layout | `computeComfortableViewport` default magic numbers | `WarehouseLayoutPage.jsx:47` | ✅ **Resolved** (Dikonversi ke konstanta deklaratif) |
| 15 | 🔵 Low | Backend | Error format tidak konsisten antar modul | Semua controllers | ✅ **Resolved** (Standardisasi `code` pada layout controllers) |

---

## 9. REKOMENDASI (Prioritas)

### 🔴 Prioritas Tinggi (Harus Segera)

**1. Hapus hardcoded Zone A filter** di `WarehouseLayoutPage.jsx:351`
- Jika dimaksudkan sebagai cleanup sementara, pindahkan ke konfigurasi atau hapus sepenuhnya

**2. Decompose `WarehouseLayoutPage.jsx`** menjadi:
- `useLayoutEngine()` — custom hook untuk canvas init, renderer, pointer
- `useLayoutData()` — custom hook untuk fetch, snapshot, save
- `useToolbarState()` — custom hook untuk toolbar state management
- `LayoutCanvas.jsx` — canvas container component
- `PathModePanel.jsx` — pathfinding UI component

**3. Unify API pattern** — Buat `WarehouseLayoutPage` menggunakan `ApiService` yang sama, atau buat `LayoutApiService` yang konsisten

### 🟡 Prioritas Menengah

**4. Optimize SpatialHash** — Gunakan incremental update (insert/remove single entity) alih-alih full rebuild

**5. Extract collision logic** menjadi `CollisionRules` helper class di `documentStore.js`

**6. Fix token key inconsistency** — Standarisasi ke satu key (`susuno_token`) di seluruh codebase

### 🟠 Prioritas Rendah

**7. CSS modularisasi** — Split `warehouseLayout.css` menjadi per-component CSS modules

**8. Consider WebGL** untuk Warehouse3DCanvas jika performa menjadi masalah pada layout besar

**9. Enhance RBAC** — Tambahkan per-warehouse permission jika multi-warehouse diaktifkan

**10. Tambahkan accessibility** — ARIA labels pada canvas toolbar buttons, keyboard navigation pada drawers

---

## APRESIASI ARSITEKTUR

Meskipun ada isu-isu di atas, modul Warehouse Layout menunjukkan **engineering quality yang sangat tinggi**:

- ✅ CAS locking + optimistic concurrency = enterprise-grade data safety
- ✅ Append-first location generation = safe for audit trail
- ✅ Immutable code registry = compliance-ready
- ✅ Custom 2D/3D engine tanpa dependency = zero bundle overhead
- ✅ 15 test suites = coverage di atas rata-rata
- ✅ Shared `layout-core` library = DRY antara frontend & backend

> Ini adalah salah satu implementasi warehouse layout editor paling komprehensif dalam konteks web application.

---

*Laporan ini dihasilkan oleh analisis otomatis pada 20 November 2026.*
