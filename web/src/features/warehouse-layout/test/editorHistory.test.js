/**
 * Unit Test untuk Editor History & Document Store
 * Menguji:
 * - Stack undo/redo berbasis inverted patch
 * - Batas maksimal 100 riwayat (shifting ceiling)
 * - Invariant: 100 mutasi lalu 100 undo mengembalikan data awal secara identik
 * - Kompilasi Batch Patch (create, update, delete) untuk sinkronisasi atomik
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryManager } from '../editor/history.js';
import { DocumentStore } from '../editor/documentStore.js';

function createMockSnapshot() {
  return {
    warehouse: { id: 1, name: 'Gudang Utama', layout_version: 3, width_mm: 50000, length_mm: 30000 },
    zones: [{ id: 1, name: 'Zone A', x_mm: 0, y_mm: 0, width_mm: 20000, length_mm: 20000 }],
    aisles: [
      { id: 10, aisle_code: 'A-01', name: 'Lorong 1', x_mm: 2000, y_mm: 2000, width_mm: 2000, length_mm: 10000 },
    ],
    racks: [
      { id: 101, rack_code: 'R-01', x_mm: 5000, y_mm: 5000, length_mm: 2400, depth_mm: 1000, rotation: 0 },
      { id: 102, rack_code: 'R-02', x_mm: 8000, y_mm: 5000, length_mm: 2400, depth_mm: 1000, rotation: 0 },
    ],
    layout_objects: [],
  };
}

test('HistoryManager - Batas kedalaman 100 langkah (max depth ceiling)', () => {
  const history = new HistoryManager(100);

  for (let i = 1; i <= 150; i++) {
    history.push({ step: i }, { step: -i }, `Langkah ${i}`);
  }

  assert.equal(history.undoStack.length, 100, 'Kedalaman stack harus tepat 100');
  assert.equal(history.undoStack[0].forward.step, 51, 'Elemen paling awal harus ter-shift ke 51');
  assert.equal(history.undoStack[99].forward.step, 150, 'Elemen terakhir adalah 150');
});

test('DocumentStore & History - Undo & Redo Geser Posisi (Move)', () => {
  const history = new HistoryManager(100);
  const store = new DocumentStore(createMockSnapshot(), history);

  const initialX = store.racks[0].x_mm;
  const initialY = store.racks[0].y_mm;

  // 1. Geser rak #101
  store.moveEntity('rack', 101, 6500, 7200);
  assert.equal(store.racks[0].x_mm, 6500);
  assert.equal(store.racks[0].y_mm, 7200);
  assert.equal(history.isDirty(), true);

  // 2. Undo
  history.undo((patch) => store.applyPatch(patch));
  assert.equal(store.racks[0].x_mm, initialX, 'Setelah undo posisi X harus kembali ke awal');
  assert.equal(store.racks[0].y_mm, initialY, 'Setelah undo posisi Y harus kembali ke awal');
  assert.equal(history.isDirty(), false, 'Status dirty harus false saat kembali ke saved state');

  // 3. Redo
  history.redo((patch) => store.applyPatch(patch));
  assert.equal(store.racks[0].x_mm, 6500, 'Setelah redo posisi X harus kembali ke 6500');
  assert.equal(store.racks[0].y_mm, 7200, 'Setelah redo posisi Y harus kembali ke 7200');
});

test('DocumentStore & History - Undo & Redo Rotasi 90 Derajat (Rotate)', () => {
  const history = new HistoryManager(100);
  const store = new DocumentStore(createMockSnapshot(), history);

  const initialRot = store.racks[0].rotation;

  // Putar 90 derajat CW
  store.rotateEntity('rack', 101);
  assert.equal(store.racks[0].rotation, 90);

  // Undo rotasi
  history.undo((patch) => store.applyPatch(patch));
  assert.equal(store.racks[0].rotation, initialRot, 'Rotasi harus kembali ke 0 setelah undo');

  // Redo rotasi
  history.redo((patch) => store.applyPatch(patch));
  assert.equal(store.racks[0].rotation, 90, 'Rotasi harus kembali ke 90 setelah redo');
});

test('DocumentStore & History - Undo & Redo Tambah Rak (Add)', () => {
  const history = new HistoryManager(100);
  const store = new DocumentStore(createMockSnapshot(), history);

  const countBefore = store.racks.length;

  // Tambah rak baru
  const newRack = store.addRack({ rack_code: 'R-NEW', x_mm: 12000, y_mm: 6000 });
  assert.equal(store.racks.length, countBefore + 1);
  assert.equal(store.racks[countBefore].rack_code, 'R-NEW');

  // Undo add -> Rak harus terhapus
  history.undo((patch) => store.applyPatch(patch));
  assert.equal(store.racks.length, countBefore);
  assert.equal(store.findEntity('rack', newRack.id), null);

  // Redo add -> Rak harus muncul kembali
  history.redo((patch) => store.applyPatch(patch));
  assert.equal(store.racks.length, countBefore + 1);
  assert.equal(store.findEntity('rack', newRack.id)?.rack_code, 'R-NEW');
});

test('DocumentStore & History - Undo & Redo Hapus Rak (Delete)', () => {
  const history = new HistoryManager(100);
  const store = new DocumentStore(createMockSnapshot(), history);

  const countBefore = store.racks.length;

  // Hapus rak #101
  store.deleteEntity('rack', 101);
  assert.equal(store.racks.length, countBefore - 1);
  assert.equal(store.findEntity('rack', 101), null);

  // Undo delete -> Rak harus dipulihkan
  history.undo((patch) => store.applyPatch(patch));
  assert.equal(store.racks.length, countBefore);
  const restored = store.findEntity('rack', 101);
  assert.ok(restored !== null);
  assert.equal(restored.x_mm, 5000);

  // Redo delete -> Rak terhapus lagi
  history.redo((patch) => store.applyPatch(patch));
  assert.equal(store.racks.length, countBefore - 1);
});

test('DocumentStore Invariant - 100 Operasi Mutasi lalu 100 Undo kembali identik ke awal', () => {
  const history = new HistoryManager(100);
  const initialData = createMockSnapshot();
  const store = new DocumentStore(initialData, history);

  // Lakukan 100 mutasi bergantian (geser, putar)
  for (let i = 1; i <= 50; i++) {
    store.moveEntity('rack', 101, 5000 + i * 20, 5000 + i * 15);
    store.moveEntity('rack', 102, 8000 + i * 10, 5000 + i * 25);
  }

  assert.equal(history.undoStack.length, 100);

  // Lakukan 100 kali undo
  for (let i = 0; i < 100; i++) {
    history.undo((patch) => store.applyPatch(patch));
  }

  assert.equal(history.canUndo(), false);
  assert.equal(history.isDirty(), false);

  // Rak harus memiliki koordinat awal secara tepat
  assert.equal(store.racks[0].x_mm, initialData.racks[0].x_mm);
  assert.equal(store.racks[0].y_mm, initialData.racks[0].y_mm);
  assert.equal(store.racks[1].x_mm, initialData.racks[1].x_mm);
  assert.equal(store.racks[1].y_mm, initialData.racks[1].y_mm);
});

test('DocumentStore - Kompilasi Batch Patch (Create, Update, Delete)', () => {
  const history = new HistoryManager(100);
  const store = new DocumentStore(createMockSnapshot(), history);

  // 1. Update rak #101
  store.moveEntity('rack', 101, 5500, 5500);

  // 2. Delete rak #102
  store.deleteEntity('rack', 102);

  // 3. Create rak baru
  const created = store.addRack({ rack_code: 'R-NEW-01', x_mm: 15000, y_mm: 10000 });

  // Generate batch patch payload
  const patch = store.generateBatchPatch();

  assert.equal(patch.base_version, 3);
  assert.equal(patch.operations.length, 3);

  const updateOp = patch.operations.find((op) => op.op === 'update' && op.entity === 'rack');
  assert.ok(updateOp);
  assert.equal(updateOp.id, 101);
  assert.equal(updateOp.data.x_mm, 5500);

  const deleteOp = patch.operations.find((op) => op.op === 'delete' && op.entity === 'rack');
  assert.ok(deleteOp);
  assert.equal(deleteOp.id, 102);

  const createOp = patch.operations.find((op) => op.op === 'create' && op.entity === 'rack');
  assert.ok(createOp);
  assert.equal(createOp.data.rack_code, 'R-NEW-01');
  assert.equal(createOp.client_ref, created.client_ref);
});

test('DocumentStore - Hapus Layer (Delete Entity with Prefixes, Aliases & ClientRef)', () => {
  const history = new HistoryManager(100);
  const snapshot = {
    ...createMockSnapshot(),
    layout_objects: [
      { id: 201, object_type: 'door_entry', name: 'Pintu Masuk' },
      { id: 202, object_type: 'dock_loading', name: 'Dok 1' },
    ],
  };
  const store = new DocumentStore(snapshot, history);

  // 1. Hapus dengan prefix "rack:101"
  assert.equal(store.deleteEntity('rack', 'rack:101'), true, 'Harus bisa hapus dengan prefix rack:101');
  assert.equal(store.findEntity('rack', 101), null);

  // 2. Hapus pintu dengan alias "door"
  assert.equal(store.deleteEntity('door', 201), true, 'Harus bisa hapus door dengan alias');
  assert.equal(store.snapshot.layout_objects.length, 1);

  // 3. Hapus dok dengan alias "dock"
  assert.equal(store.deleteEntity('dock', 202), true, 'Harus bisa hapus dock dengan alias');
  assert.equal(store.snapshot.layout_objects.length, 0);

  // 4. Hapus entitas baru berbasis client_ref
  const newAisle = store.addAisle({ name: 'Lorong Baru', x_mm: 20000, y_mm: 15000 });
  assert.ok(newAisle.client_ref);
  assert.equal(store.deleteEntity('aisle', newAisle.client_ref), true, 'Harus bisa hapus lewat client_ref');
});

test('DocumentStore - Proteksi Zero-Collision pada MoveEntity (Menolak Tumpang Tindih)', () => {
  const store = new DocumentStore(createMockSnapshot());
  // Rack 101: x=5000, y=5000, length=2400, depth=1000 (area: [5000..7400, 5000..6000])
  // Rack 102: x=8000, y=5000, length=2400, depth=1000 (area: [8000..10400, 5000..6000])

  // Coba pindahkan Rack 101 ke x=7000 (akan menimpa Rack 102 dari 7000 s/d 9400, tumpang tindih 1400mm)
  const moveFailed = store.moveEntity('rack', 101, 7000, 5000);
  assert.equal(moveFailed, false, 'Gerakan harus ditolak karena tumpang tindih dengan Rack 102');
  assert.equal(store.findEntity('rack', 101).x_mm, 5000, 'Posisi Rack 101 harus tetap di x=5000');

  // Pindahkan ke area kosong x=5000, y=7000 (tidak tumpang tindih)
  const moveSuccess = store.moveEntity('rack', 101, 5000, 7000);
  assert.equal(moveSuccess, true, 'Gerakan ke area kosong harus berhasil');
  assert.equal(store.findEntity('rack', 101).y_mm, 7000, 'Posisi Rack 101 berubah ke y=7000');
});

test('DocumentStore - Proteksi Zero-Collision pada RotateEntity (Menolak Rotasi jika Bertabrakan)', () => {
  const store = new DocumentStore({
    warehouse: { id: 1, width_mm: 50000, length_mm: 30000 },
    zones: [],
    aisles: [],
    racks: [
      // Dua rak diletakkan sangat dekat berjarak 200mm
      { id: 1, rack_code: 'R-01', x_mm: 2000, y_mm: 2000, length_mm: 2400, depth_mm: 1000, rotation: 0 },
      { id: 2, rack_code: 'R-02', x_mm: 2000, y_mm: 3200, length_mm: 2400, depth_mm: 1000, rotation: 0 },
    ],
    layout_objects: [],
  });

  // Jika R-01 di (2000, 2000) panjang 2400 kedalaman 1000 diputar 90 derajat:
  // Center: (3200, 2500). Footprint baru: width 1000, depth 2400.
  // Area baru: [2700..3700, 1300..3700] -> Y baru mencapai 3700mm, menabrak R-02 yang berada di Y=[3200..4200]!
  const rotateFailed = store.rotateEntity('rack', 1);
  assert.equal(rotateFailed, false, 'Rotasi harus ditolak karena footprint baru menabrak rak di bawahnya');
  assert.equal(store.findEntity('rack', 1).rotation, 0, 'Rotasi R-01 harus tetap 0');
});

test('DocumentStore - Proteksi Batas Gudang (Input/Perpindahan tidak boleh keluar batas gudang)', () => {
  const store = new DocumentStore({
    warehouse: { id: 1, width_mm: 50000, length_mm: 30000 },
    zones: [],
    aisles: [],
    racks: [
      { id: 1, rack_code: 'R-01', x_mm: 5000, y_mm: 5000, length_mm: 2400, depth_mm: 1000, rotation: 0 },
    ],
    layout_objects: [],
  });

  // 1. Move rack mencoba melebihi batas kanan gudang (x=60000 pada gudang 50000)
  store.moveEntity('rack', 1, 60000, 5000);
  const rack = store.findEntity('rack', 1);
  assert.ok(rack.x_mm + 2400 <= 50000, 'Ujung kanan rak tidak boleh melebihi lebar gudang');
  assert.equal(rack.x_mm, 50000 - 2400, 'Posisi X harus di-clamp ke batas maksimum gudang');

  // 2. Move rack mencoba melebihi batas bawah gudang (y=40000 pada gudang 30000)
  store.moveEntity('rack', 1, 10000, 40000);
  assert.ok(rack.y_mm + 1000 <= 30000, 'Ujung bawah rak tidak boleh melebihi panjang gudang');
  assert.equal(rack.y_mm, 30000 - 1000, 'Posisi Y harus di-clamp ke batas maksimum gudang');

  // 3. Move rack dengan koordinat negatif
  store.moveEntity('rack', 1, -500, -200);
  assert.equal(rack.x_mm, 0, 'Posisi X negatif harus di-clamp ke 0');
  assert.equal(rack.y_mm, 0, 'Posisi Y negatif harus di-clamp ke 0');

  // 4. Tambah lorong di luar batas gudang
  const aisle = store.addAisle({ x_mm: 55000, y_mm: 35000, width_mm: 3000, length_mm: 4000 });
  assert.ok(aisle.x_mm + aisle.width_mm <= 50000, 'Lorong tidak boleh melebihi lebar gudang');
  assert.ok(aisle.y_mm + aisle.length_mm <= 30000, 'Lorong tidak boleh melebihi panjang gudang');

  // 5. Tambah objek dok di luar batas gudang
  const dock = store.addLayoutObject({ x_mm: 70000, y_mm: 50000, width_mm: 4000, length_mm: 6000 });
  assert.ok(dock.x_mm + dock.width_mm <= 50000, 'Dok tidak boleh melebihi lebar gudang');
  assert.ok(dock.y_mm + dock.length_mm <= 30000, 'Dok tidak boleh melebihi panjang gudang');
});

test('DocumentStore - Proteksi Jalan Tidak Menimpa Rak (Zero-Collision)', () => {
  const store = new DocumentStore(createMockSnapshot());

  // Coba tambah jalan tepat di atas rak 101 (x=5000, y=5000)
  const res = store.addAisle({
    x_mm: 5000,
    y_mm: 5000,
    width_mm: 2000,
    length_mm: 5000,
  });

  assert.equal(res.error, 'COLLIDES_WITH_RACK', 'Menambahkan jalan di atas rak harus ditolak');
  assert.ok(res.message.includes('geser posisi rak'), 'Pesan harus menginstruksikan untuk menggeser rak');
  assert.equal(store.snapshot.aisles.length, 1, 'Jumlah lorong tidak boleh bertambah jika menimpa rak');
});

test('DocumentStore - Penggabungan Jalan Forklift & Manusia Menjadi Jalur Bersama (Dual Indikator)', () => {
  const store = new DocumentStore(createMockSnapshot());

  // Aisle 10 sudah ada di x=2000, y=2000, width=2000, length=10000 (Jalur Standar / Manusia)
  assert.equal(store.snapshot.aisles.length, 1);

  // Tambahkan Jalur Forklift yang bertindihan dengan Aisle 10 (misal di x=2000, y=3000)
  const mergedRes = store.addAisle({
    x_mm: 2000,
    y_mm: 3000,
    width_mm: 2500,
    length_mm: 8000,
    type: 'forklift',
    direction: 'forklift',
    name: 'Jalur Forklift Utama',
  });

  assert.equal(mergedRes.isMerged, true, 'Harus digabungkan bukan ditindih');
  assert.equal(mergedRes.type, 'both', 'Tipe harus menjadi both (Jalur Bersama)');
  assert.equal(mergedRes.name, 'Jalur Bersama (Forklift & Pejalan)');
  assert.ok(mergedRes.width_mm >= 2500, 'Lebar harus memenuhi standar forklift minimal 2.5m');
  assert.equal(store.snapshot.aisles.length, 1, 'Jumlah entitas lorong tetap 1 karena digabung (tidak duplikat/tindih)');
});

test('DocumentStore - Jalan Manusia Bertemu di Ujung Menjadi Satu (Tidak Tumpang Tindih)', () => {
  const store = new DocumentStore({
    warehouse: { id: 1, width_mm: 50000, length_mm: 30000 },
    zones: [],
    aisles: [
      // Jalur manusia horizontal dari x=2000 s/d 12000 (width=10000), y=5000, length=1000
      { id: 10, aisle_code: 'A-01', name: 'Jalur Manusia 1', x_mm: 2000, y_mm: 5000, width_mm: 10000, length_mm: 1000, type: 'standard' },
    ],
    racks: [],
    layout_objects: [],
  });

  assert.equal(store.snapshot.aisles.length, 1);

  // Tambahkan jalan manusia kedua tepat di ujung x=12000 (bertemu di ujung)
  const merged = store.addAisle({
    x_mm: 12000,
    y_mm: 5000,
    width_mm: 8000,
    length_mm: 1000,
    type: 'standard',
    name: 'Jalur Manusia 2',
  });

  assert.equal(merged.isMerged, true, 'Harus digabungkan menjadi satu');
  assert.equal(store.snapshot.aisles.length, 1, 'Total jalan harus tetap 1 entitas lorong terpadu');
  assert.equal(merged.x_mm, 2000);
  assert.equal(merged.width_mm, 18000, 'Lebar gabungan horizontal harus 10000 + 8000 = 18000mm');
});

test('DocumentStore - Proteksi Jalan Pejalan Menolak Menimpa Jalan Lain (Pejalan Tidak Bisa Menimpa)', () => {
  const store = new DocumentStore({
    warehouse: { id: 1, width_mm: 50000, length_mm: 30000 },
    zones: [],
    aisles: [
      // Jalur pejalan horizontal x=5000..15000, y=10000..11000
      { id: 10, aisle_code: 'A-01', name: 'Jalur Pejalan 1', x_mm: 5000, y_mm: 10000, width_mm: 10000, length_mm: 1000, type: 'standard' },
    ],
    racks: [],
    layout_objects: [],
  });

  // Coba tambahkan jalan pejalan lain yang menimpa (x=10000..22000, y=10000)
  const result = store.addAisle({
    x_mm: 10000,
    y_mm: 10000,
    width_mm: 12000,
    length_mm: 1000,
    type: 'standard',
    name: 'Jalur Pejalan Menimpa',
  });

  assert.equal(result.error, 'PEDESTRIAN_CANNOT_OVERLAP', 'Pejalan tidak bisa menimpa jalan lain harus ditolak');
  assert.equal(store.snapshot.aisles.length, 1, 'Jumlah lorong tidak boleh bertambah');
});

test('DocumentStore - Jalan Forklift BISA Menimpa Jalan Lain (Menjadi Jalur Bersama & Set Lebar Min 2.5m)', () => {
  const store = new DocumentStore({
    warehouse: { id: 1, width_mm: 50000, length_mm: 30000 },
    zones: [],
    aisles: [
      // Jalur pejalan horizontal x=5000..15000, y=10000..11000
      { id: 10, aisle_code: 'A-01', name: 'Jalur Pejalan 1', x_mm: 5000, y_mm: 10000, width_mm: 10000, length_mm: 1000, type: 'standard' },
    ],
    racks: [],
    layout_objects: [],
  });

  // Forklift menimpa jalan pejalan dengan lebar 2.0m (di bawah 2.5m)
  const result = store.addAisle({
    x_mm: 8000,
    y_mm: 10000,
    width_mm: 12000,
    length_mm: 2000, // Di bawah 2.5m
    type: 'forklift',
    name: 'Jalur Forklift Utama',
  });

  assert.equal(result.isMerged, true, 'Forklift BISA menimpa jalan lain dan otomatis digabung');
  assert.equal(result.type, 'both', 'Menjadi jalur bersama');
  assert.equal(result.is_both, true);
  assert.equal(result.warnMinimumForkliftWidth, true, 'Harus memberi peringatan jika di bawah 2.5m');
  assert.ok(result.length_mm >= 2500, 'Lebar forklift harus otomatis diset minimal 2.5m');
});

test('DocumentStore - Jalan Forklift BISA Menimpa Dok Tanpa Ditolak', () => {
  const store = new DocumentStore({
    warehouse: { id: 1, width_mm: 50000, length_mm: 30000 },
    zones: [],
    aisles: [],
    racks: [],
    layout_objects: [
      { id: 201, object_type: 'dock', name: 'Dok Muat', x_mm: 4000, y_mm: 4000, width_mm: 4000, length_mm: 6000 },
    ],
  });

  const fk = store.addAisle({
    x_mm: 4000,
    y_mm: 4000,
    width_mm: 3000,
    length_mm: 10000,
    type: 'forklift',
    name: 'Jalur Forklift Dok',
  });

  assert.ok(!fk.error, 'Forklift tidak boleh ditolak saat menimpa dok');
  assert.equal(store.snapshot.aisles.length, 1, 'Lorong forklift berhasil ditambahkan di atas dok');
});
