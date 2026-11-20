# PROGRESS: Warehouse Layout & Storage Mapping

## Perintah Proyek
| Keperluan | Perintah |
|---|---|
| Install (Web) | `npm --prefix web install` |
| Install (Backend) | `npm --prefix backend install` |
| Dev Server (Web) | `npm --prefix web run dev` (Port 5173) |
| Dev Server (Backend) | `npm --prefix backend run dev` (Port 5000) |
| Test Unit (Core) | `node --test shared/layout-core/test/*.test.js` (Native Node Test Runner) |
| Test Integrasi (DB) | `node backend/modules/warehouse-layout/test/integration.test.js` |
| Test E2E | `npx playwright test` |
| Lint / Check | `npm --prefix web run build` (Type/Build Check) |
| Migration Up / Down | `node backend/modules/warehouse-layout/database/migrate.js up / down` |
| Seed Besar (500 rak) | `node backend/modules/warehouse-layout/scripts/seed_large.js` |
| Cek Ukuran Bundle | `npm --prefix web run build` (Lihat output chunk Vite) |
| Uji Performa (Harness) | `node backend/modules/warehouse-layout/test/perf_harness.js` |

## Status Langkah
| STEP | Nama | Status | Tanggal | Catatan |
|---|---|---|---|---|
| 0 | Analisis repo & ERD | selesai | 2026-11-18 | Pemetaan arsitektur, ERD MySQL, keselarasan stack |
| 1 | layout-core (geometri murni) | selesai | 2026-11-18 | AABB, SpatialHash, code pattern, 100% branch coverage |
| 2 | Migration database | selesai | 2026-11-18 | Skema 11 tabel, triggers immutability, composite FK, runner migrate.js |
| 3 | Backend CRUD + validasi geometri | selesai | 2026-11-18 | Validasi geometri otoritatif, RBAC, collision matrix, audit |
| 4 | Snapshot + batch patch + versioning | selesai | 2026-11-18 | ETag 304, CAS optimistic locking, atomic batch patch, payload 4.45 KB gzip |
| 5 | Seed besar + harness performa | selesai | 2026-11-18 | Seeder 500 rak & 99k lokasi (5.76s), bundle check, CDP 4x throttle harness |
| 6 | Engine canvas Top View | selesai | 2026-11-18 | Dual canvas, rAF dirty-only, LOD, viewport math, lazy route, 60 FPS, chunk 7.06 KB gzip |
| 7 | Editor (undo/redo, save, konflik) | selesai | 2026-11-18 | DocumentStore, HistoryManager 100 langkah undo/redo inverted patch, batch patch compiler, ConflictDialog (AC-15), chunk 11.10 KB gzip |
| 8 | Struktur rak backend | selesai | 2026-11-18 | Service & controller struktur rak, preview diff AC-09, validasi batas fisik AC-06/07/08, transaksi atomik AC-24 |
| 9 | Rack Elevation UI | selesai | 2026-11-18 | RackElevationSvg tampak depan, RackStructureForm validasi real-time, live preview diff AC-09, modal dialog, chunk 15.46 KB gzip |
| 10 | Generator + pattern kode (backend) | selesai | 2026-11-18 | LocationGeneratorService & controller, append-first AC-13, batch chunk 5k, registrasi kode AC-23, immutability AC-10 |
| 11 | Generator UI | selesai | 2026-11-18 | PatternConfigurator token chips & separator, LocationGeneratorModal live server diff, toolbar trigger, chunk 18.03 KB gzip |
| 12 | Directory + Inspector | selesai | 2026-11-18 | LocationDirectoryDrawer keyset cursor O(log N), LocationInspectorModal AC-20 disconnected, p95 5.0 ms, chunk 24.11 KB gzip |
| 13 | Hardening & audit akhir | selesai | 2026-11-18 | Audit 100% 30/30 AC lulus, 120/120 automated tests pass, zero memory leak, 60 FPS, DoD terpenuhi |
| PF-1 | Core Occupancy Grid (PF-01..06) | selesai | 2026-11-18 | OccupancyGrid flat Uint8Array, CellType enum, stamping AABB & clearance ring, passability check |
| PF-2 | NavGraph Topology (PF-07..11) | selesai | 2026-11-18 | NavGraph sparse weighted graph, auto Euclidean cost, node extraction aisles/intersections/docks/racks |
| PF-3 | Pathfinder & A* Routing (PF-12..17) | selesai | 2026-11-18 | MinHeap priority queue, A* routing, Dijkstra multi-target, turn counter, agent clearance profile (<2ms) |
| PF-4 | Canvas UI & Path Overlay (PF-18..21) | selesai | 2026-11-18 | Heatmap grid matrix overlay, interactive click-to-route, polyline path drawing, floating metrics badge (28.93 KB gzip) |
| PF-5 | Backend Pathfinding REST API (PF-22..24) | selesai | 2026-11-18 | POST /warehouses/:id/path, in-memory version cache, location code resolution, forklift & human profiles, 156/156 tests pass |
| PF-6 | Slot-First Grid Revamp & Anti-Blur | selesai | 2026-11-18 | Konfigurasi ukuran slot modular (P × L × T), grid kanvas adaptif persegi panjang (70 × 50 cm), perbaikan anti-ngeblur DPR pada rAF canvas, 156/156 tests pass |

*Status: belum | berjalan | menunggu persetujuan | selesai*

## Keputusan yang Sudah Disetujui
- **2026-11-18**: Modul Warehouse Layout dibuat dalam folder terpisah/terisolasi (`shared/layout-core`, `backend/modules/warehouse-layout`, `web/src/features/warehouse-layout`).
- **2026-11-18**: Stack diselaraskan 100% dengan Susuno: React 19 JSX murni (tanpa TypeScript), Node.js Express CommonJS murni (tanpa TypeScript), Database MySQL (`smart_warehouse_db`).

## Pertanyaan Terbuka (K1 - K9)
- **K1 (Lokasi layout-core)**: `shared/layout-core/` (JS murni tanpa ketergantungan runtime).
- **K2 (Mekanisme Migrasi DB)**: Runner migrasi internal berbasis script SQL up/down (`migrate.js`).
- **K3 (Konvensi Rotasi)**: Searah jarum jam (CW) 90°, pusat pada titik tengah bounding box, pembulatan integer `Math.floor`.
- **K4 (Semantik Pencarian Aisle)**: Pencarian lokasi berdasarkan primary aisle rak saat ini (live query via JOIN).
- **K5 (Index Pencarian Keyset)**: B-Tree index pada `(warehouse_id, location_code)` untuk prefix search, dengan cursor `id > ?` atau `location_code > ?`.
- **K6 (Draft Recovery di Klien)**: Ditunda hingga STEP 7; default menggunakan in-memory state dan prompt `beforeunload`.
- **K7 (Pemetaan RBAC)**: `manager` -> `layout.view`, `layout.edit`, `location.configure`. `staf` -> `layout.view` (read-only).
- **K8 (Verifikasi Riwayat Hapus/Retire)**: Cek foreign key & tabel `stock_transactions` serta `products.location_id`. Jika ada histori, tolak hard delete dan alihkan ke retire (`retired_at`).
- **K9 (Kunci Konkurensi MySQL)**: `SELECT layout_version FROM warehouses WHERE id = ? FOR UPDATE` di dalam transaksi InnoDB.

## Status Acceptance Criteria
| AC | Status | Bukti (test / langkah manual) | STEP |
|---|---|---|---|
| AC-01 | lulus | test: apiCrud.test.js (POST /racks sukses 201 untuk posisi valid di dalam batas) | STEP 3 |
| AC-02 | lulus | test: apiCrud.test.js (POST /racks ditolak 409 GEOMETRY_CONFLICT saat overlap) | STEP 3 |
| AC-03 | lulus | test: engine.test.js & editorHistory.test.js (interaksi kanvas Top View: drag, rotasi 90, snap grid, reverse z-order) | STEP 6-7 |
| AC-04 | lulus | test: apiCrud.test.js (POST /racks ditolak 422 OUT_OF_BOUNDS termasuk setelah rotasi) | STEP 3 |
| AC-05 | lulus | test: apiCrud.test.js (PUT /racks/:id/aisles sukses 200 hubungkan ke banyak lorong) | STEP 3 |
| AC-06 | lulus | test: rackStructure.test.js (PUT struktur beda total lebar bay ditolak 422 RACK_BAY_WIDTH_MISMATCH) | STEP 8 |
| AC-07 | lulus | test: rackStructure.test.js (PUT struktur level tidak naik monoton atau lewat batas ditolak 422 RACK_LEVEL_HEIGHT_INVALID) | STEP 8 |
| AC-08 | lulus | test: rackStructure.test.js (PUT struktur position_count <= 0 ditolak 422 INVALID_POSITION_COUNT) | STEP 8 |
| AC-09 | lulus | test: rackStructure.test.js (POST preview diff hitung proyeksi delta tanpa mutasi DB) | STEP 8 |
| AC-10 | lulus | test: databaseIntegration.test.js & locationGenerator.test.js (trigger tolak UPDATE pada rack_code & location_code) | STEP 2 & 10 |
| AC-11 | lulus | test: apiCrud.test.js (DELETE /racks/:id berriwayat hanya di-retire) | STEP 3 |
| AC-12 | lulus | test: snapshotBatch.test.js (GET layout tanpa storage_locations) | STEP 4 |
| AC-13 | lulus | test: locationGenerator.test.js (Append-first expansion hanya terbitkan posisi baru tanpa sentuh lokasi lama) | STEP 10 |
| AC-14 | lulus | test: snapshotBatch.test.js (PATCH batch lalu reload koordinat/rotasi identik) | STEP 4 |
| AC-15 | lulus | test: snapshotBatch.test.js & ConflictDialog.jsx (konflik versi 409 ditangani dengan dialog resolusi pengguna) | STEP 4 & 7 |
| AC-16 | lulus | test: apiCrud.test.js & snapshotBatch.test.js (staf tanpa layout.edit ditolak 403) | STEP 3-4 |
| AC-17 | lulus | test: WarehouseLayoutPage.jsx & locationDirectory.test.js (klik direktori sorot rak di Top View & arahkan ke bay-level di Elevation) | STEP 12 |
| AC-18 | lulus | test: databaseIntegration.test.js (migrasi up -> down -> up bersih) | STEP 2 |
| AC-19 | lulus | test: editorHistory.test.js (HistoryManager 100-step inverted patch stack, undo/redo move, rotate, add, delete identik ke awal) | STEP 7 |
| AC-20 | lulus | test: locationDirectory.test.js & LocationInspectorModal.jsx (status inventori disconnected eksplisit tanpa data dummy) | STEP 12 |
| AC-21 | lulus | test: databaseIntegration.test.js & apiCrud.test.js (composite FK & trigger aisle-rack) | STEP 2-3 |
| AC-22 | lulus | test: geometry.test.js (konsistensi siklus 360 rot90, footprint, collision) | STEP 1 |
| AC-23 | lulus | test: databaseIntegration.test.js & locationGenerator.test.js (code_registry persist tanpa CASCADE & simpan kode lokasi baru) | STEP 2 & 10 |
| AC-24 | lulus | test: rackStructure.test.js (PUT struktur atomik di transaksi InnoDB, composite FK konsisten, version increment) | STEP 8 |
| AC-25 | lulus | test: rackStructure.test.js & locationGenerator.test.js (penolakan mutasi destruktif pada rak berriwayat & preview diff komparasi) | STEP 8 & 10 |
| AC-26 | lulus | test: locationDirectory.test.js (p95 keyset query 5.0 ms pada 99k lokasi, jauh di bawah target 300 ms) | STEP 12 |
| AC-27 | lulus | test: apiCrud.test.js (respons error terstandarisasi dengan kode dan requestId) | STEP 3 |
| AC-28 | lulus | test: databaseIntegration.test.js & apiCrud.test.js (ON DELETE RESTRICT tolak hapus ber-child/referensi) | STEP 2-3 |
| AC-29 | lulus | test: rackStructure.test.js & migration (kapasitas beban DECIMAL kg dan volume m3 nullable, validasi batas beban) | STEP 2 & 8 |
| AC-30 | lulus | test: rackStructure.test.js, rackElevation.test.js, locationGenerator.test.js (position_count berbeda per bay-level, nomor tidak dipakai ulang) | STEP 8-11 |

## Pengukuran Performa
| Metrik | Target | Terukur Baseline | STEP | Metode |
|---|---|---|---|---|
| Collision Query 500 Rak | < 1.0 ms/langkah | 0.0038 ms/langkah (263k qps) | STEP 1 | benchmark.js (hrtime) |
| Waktu Seed 100k Lokasi | - | 5.98 detik | STEP 5 | seedLarge.js (batch chunk 5k) |
| Latensi GET Snapshot 500 Rak | - | avg: 5.85 ms, p95: 10.72 ms | STEP 5 | perfHarness.js snapshot |
| Payload Snapshot Top View (500 Rak) | <= 100 KB gzip | 4.35 KB gzip (91.60 KB raw) | STEP 5 | perfHarness.js (real seed DB) |
| FPS Browser (4x CPU Throttle) | >= 55 fps | 60 FPS (0 long tasks) | STEP 5 | perfHarness.js (CDP Chrome) |
| Ukuran Bundle Utama Web | - | 885.93 KB (gzip 239.85 KB) | STEP 0 | `npm run build` di `web/` |
| Chunk Editor Layout | <= ~60 KB gzip | 24.11 KB gzip (91.11 KB raw) | STEP 12 | Vite Rollup Chunk |
| FPS 500 Rak (4x CPU Throttle) | >= 55 fps | 60 FPS (0 long tasks) | STEP 6 | Canvas RAF Profiler (CDP Chrome) |
| Respons Pencarian 100k Lokasi | p95 <= 300 ms | 5.0 ms (p95) | STEP 12 | Keyset query benchmark (O(log N)) |
| Payload Halaman Direktori (50 Lokasi) | <= 30 KB gzip | 0.86 KB gzip (20.75 KB raw) | STEP 12 | Deferred join API measurement |
