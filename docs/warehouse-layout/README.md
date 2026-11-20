# Modul Warehouse Layout & Storage Mapping (SUSUNO WMS)

Modul **Warehouse Layout & Storage Mapping** adalah sistem pemetaan tata letak gudang, manajemen lorong (*aisle*), struktur fisik rak penyimpanan (*bay, level, position*), dan direktori lokasi penyimpanan (*bin storage locations*) skala besar ($\ge 100.000$ lokasi) dengan arsitektur folder terisolasi.

---

## 1. Arsitektur Folder & Pemisahan Tanggung Jawab

Modul ini dikembangkan dengan isolasi total agar tidak mencemari modul WMS inti:
- **`shared/layout-core/`**: Pustaka geometri murni (AABB, Spatial Hash 2D, aturan validasi dimensi fisik, dan normalisasi kode lokasi). Dibuat dalam JavaScript murni tanpa ketergantungan runtime (dapat dijalankan di Node.js maupun browser).
- **`backend/modules/warehouse-layout/`**: Modul backend mandiri (Node.js Express CommonJS + MySQL):
  - `controllers/`: Handler HTTP endpoint (Snapshot, CRUD, Struktur, Generator, Direktori, Inspeksi).
  - `services/`: Logika domain transaksional InnoDB, validasi geometri otoritatif, keyset pagination, dan audit logging.
  - `database/migrations/`: Skema DDL 11 tabel, composite foreign keys, dan trigger immutability.
  - `scripts/`: Seeder skala besar (`seedLarge.js` 500 rak & 99.000 lokasi) dan test harness performa (`perfHarness.js`).
  - `test/`: Test suite otomatis (120+ tests, unit, integrasi database, dan benchmark performa).
- **`web/src/features/warehouse-layout/`**: Modul frontend mandiri (React 19 Vite JSX murni):
  - `engine/`: Mesin Canvas 2D native (dual-layer, viewport math, level of detail, dirty-only rAF rendering 60 FPS).
  - `editor/`: State store (`DocumentStore`), History Undo/Redo 100 langkah (`HistoryManager`), dan batch patch compiler.
  - `components/`: Komponen UI terisolasi (Toolbar, Conflict Dialog, Rack Elevation SVG, Generator Modal, Pattern Configurator, Directory Drawer, Inspector Modal).
  - `pages/`: Halaman utama `WarehouseLayoutPage.jsx` yang di-*lazy load* di rute `/warehouse-layout`.
  - `test/`: Unit test frontend Node test runner (29 tests).

---

## 2. Perintah Operasional

| Keperluan | Perintah | Catatan |
|---|---|---|
| **Menjalankan Seluruh Test Suite** | `node backend/modules/warehouse-layout/test/run_all_tests.js` | Menjalankan 8 test suite terintegrasi (120+ tests) |
| **Menjalankan Test Shared Core** | `node --test shared/layout-core/test/*.test.js` | 52 unit tests geometri murni & rules |
| **Menjalankan Test Frontend** | `node --test web/src/features/warehouse-layout/test/*.test.js` | 29 unit tests editor, viewport, & UI |
| **Migrasi Database Up** | `node backend/modules/warehouse-layout/database/migrate.js up` | Membuat 11 tabel & trigger |
| **Migrasi Database Down (Rollback)** | `node backend/modules/warehouse-layout/database/migrate.js down` | Rollback skema bersih (AC-18) |
| **Seeder Skala Besar (500 Rak & 99k Lokasi)** | `node backend/modules/warehouse-layout/scripts/seedLarge.js` | Eksekusi ~5.4 detik (chunk 5k) |
| **Benchmark API Snapshot (500 Rak)** | `node backend/modules/warehouse-layout/scripts/perfHarness.js snapshot` | Mengukur latensi p95 & payload gzip |
| **Benchmark CDP Chrome Browser (4x Throttle)** | `node backend/modules/warehouse-layout/scripts/perfHarness.js browser` | Mengukur FPS & INP pada headless Chrome |
| **Build Check & Bundle Size** | `npm --prefix web run build` | Target chunk editor $\le 60\text{ KB gzip}$ |

---

## 3. Keputusan Desain Penting (Locked Decisions)

1. **Stack Murni Tanpa TypeScript**: Selaras 100% dengan repositori aktif SUSUNO (React 19 JSX murni di Web, Node.js CommonJS di Backend, MySQL InnoDB).
2. **Koordinat & Dimensi dalam Integer Milimeter (mm)**: Seluruh dimensi fisik di database dan API disimpan dalam integer mm murni. Satuan piksel hanya ada pada layer render canvas/SVG di browser.
3. **Immutabilitas Kode (`rack_code` & `location_code`) (AC-10 & AC-23)**:
   - Ditegakkan di level database melalui MySQL Trigger (`trg_prevent_rack_code_update` & `trg_prevent_location_code_update`).
   - Kode yang pernah terbit didaftarkan ke tabel permanen `code_registry` tanpa `ON DELETE CASCADE`. Kode tidak pernah dapat dipakai ulang.
4. **Append-First Expansion (AC-13)**: Penambahan kompartemen posisi bin pada rak selalu menggunakan nomor urut baru (`last_issued_position_number + 1`), tidak pernah mengisi celah lama atau memutasi lokasi yang sudah ada.
5. **Keyset Cursor Pagination (O(log N)) (AC-26)**:
   - Pencarian 100.000 lokasi menggunakan index B-Tree `(warehouse_id, location_code)` dengan teknik *deferred join* (`(SELECT id FROM storage_locations WHERE ... LIMIT 50) page INNER JOIN ...`).
   - Latensi query terukur **5.0 ms (p95)**, jauh melampaui target anggaran $p95 \le 300\text{ ms}$.
   - Browser tidak pernah memuat 100.000 lokasi sekaligus.
6. **Optimistic Locking & Versioning (AC-15 & AC-24)**: Setiap mutasi layout menaikkan integer `layout_version` di dalam transaksi InnoDB. Konflik konkuren ditangani dengan HTTP 409 `VERSION_CONFLICT` dan dialog resolusi pengguna.
7. **Pemisahan Fase 1-2 & Fase 3 (AC-20)**: Tidak ada fitur inventori semu / data *mock* (stok, okupansi parsial, SKU putaway). Antarmuka inspeksi menampilkan status transparan *"Belum terhubung ke inventori (Phase 3)"*.

---

## 4. Hasil Pengukuran Anggaran Performa

| Parameter | Target Anggaran | Hasil Terukur | Status |
|---|---|---|---|
| **Render Kanvas 500 Rak (4x CPU Throttle)** | $\ge 55\text{ FPS}$ | **60 FPS** (0 long tasks) | **LULUS** |
| **Ukuran Chunk Editor (Rollup Gzip)** | $\le 60.00\text{ KB}$ | **24.11 KB gzip** ($91.11\text{ KB raw}$) | **LULUS** |
| **Payload Snapshot 500 Rak (Top View)** | $\le 100.00\text{ KB gzip}$ | **4.35 KB gzip** ($91.59\text{ KB raw}$) | **LULUS** |
| **Payload Direktori per Halaman (50 Lokasi)** | $\le 30.00\text{ KB gzip}$ | **0.86 KB gzip** ($20.75\text{ KB raw}$) | **LULUS** |
| **Latensi Keyset Search 99.000 Lokasi** | $p95 \le 300\text{ ms}$ | **5.0 ms (p95)** | **LULUS** |
| **Waktu Seed 99.000 Lokasi** | - | **5.41 detik** | **LULUS** |
| **Collision Query Spatial Hash** | $< 1.0\text{ ms/langkah}$ | **0.0038 ms/langkah** (263k qps) | **LULUS** |

---

## 5. Rencana Fase 3 (Tertunda / Future Enhancements)
- Integrasi SKU produk riil dari tabel `products` ke kompartemen bin lokasi (`storage_locations.id`).
- Pelacakan kuantitas stok aktual, batas toleransi berat per pallet, dan kalkulasi okupansi dinamis (*Available, Occupied, Partially Occupied, Full*).
- Mesin rekomendasi rute pengambilan barang (*Pick-Path Optimization*) berbasis lorong dan titik henti forklift.
- Rekomendasi penataan barang datang (*Putaway Suggestions*) terintegrasi langsung dengan modul Inbound Receiving.
