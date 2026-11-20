# Catatan Revisi: Analisis & Rencana Optimasi Kecepatan dan Keandalan Mobile SUSUNO

- **Tanggal & Waktu Pencatatan**: Sabtu, 21 November 2026 — Pukul `01:49:35 WIB` (`2026-11-21T01:49:35+07:00`)
- **Modul Target**: Aplikasi Mobile Flutter (`mobile/`)
- **Fokus Revisi**: Performa (Kecepatan Muat, Responsivitas UI, Efisiensi Jaringan) & Keandalan (Operasional Offline/LAN Lokal)
- **Mode Standar**: `skillai` (Caveman + Ponytail + Anti-Slop)

---

## 1. Analisis Akar Masalah (Root Cause Analysis)

### A. Sequential API Waterfall (13 Request HTTP Berurutan)
- **Lokasi**: `mobile/lib/state/warehouse_state.dart:957-1166` (`loadFromApi()`)
- **Temuan**:
  - Fungsi `loadFromApi()` mengeksekusi **13 request HTTP secara sekuensial (`await` satu per satu)**:
    1. `api.getLocations`
    2. `api.getWarehouseLayoutSnapshot`
    3. `api.getCategories`
    4. `api.getSuppliers`
    5. `api.getProducts`
    6. `api.getStockTransactions`
    7. `api.getMyShifts`
    8. `api.getTasks`
    9. `loadNotifications()`
    10. `loadAttendances()`
    11. `loadInboundShipments()`
    12. `loadOutboundShipments()`
    13. `loadAuditLogs()`
  - Akumulasi latensi jaringan membuat satu siklus refresh memakan waktu **2–4 detik** di jaringan normal, dan **>15 detik** saat sinyal lemah.
  - **Redundansi Pemanggilan**:
    - `navigate(int value)` (`warehouse_state.dart:1995-2001`) memanggil `loadFromApi()` setiap kali berpindah ke tab `0` atau `1` tanpa *throttling/cooldown*.
    - `StockScreen.initState()` (`mobile/lib/screens/stock_screen.dart:22-26`) memanggil `loadFromApi()` lagi saat tab `1` dibuka (terjadi *double fetch* bersamaan dengan `navigate(1)`).
    - `submitInboundInspection()` (`warehouse_state.dart:1259-1261`) dan `submitOutboundInspection()` (`warehouse_state.dart:1353-1355`) memanggil `loadInboundShipments()` + `loadAuditLogs()` lalu langsung memanggil `loadFromApi()` yang di dalamnya memanggil fungsi-fungsi tersebut lagi.

### B. Polling Heartbeat Terlalu Agresif (Setiap 3 Detik ke DNS Eksternal)
- **Lokasi**: `mobile/lib/state/warehouse_state.dart:80-137` (`_startConnectivityMonitoring()` & `checkConnectivity()`)
- **Temuan**:
  - `Timer.periodic(const Duration(seconds: 3))` terus-menerus menembak request HTTP baru (`http.get` tanpa reuse client) ke `https://dns.google/resolve`, fallback ke `1.1.1.1` dan `api.github.com`, ditambah `${ApiConfig.baseUrl}/app/latest`.
  - Mengakibatkan antrean socket HTTP menumpuk, boros CPU/baterai, dan memicu *false timeout* pada jaringan lambat.

### C. Full-Tree Widget Rebuild Akibat `context.watch<WarehouseState>()` di Root
- **Lokasi**:
  - `mobile/lib/main.dart:47` (`SusunoApp.build`)
  - `mobile/lib/screens/app_shell.dart:67` (`AppShell.build`)
  - `mobile/lib/screens/shift_hub_screen.dart:24` (`ShiftHubScreen.build`)
  - `mobile/lib/screens/stock_screen.dart:37` (`StockScreen.build`)
- **Temuan**:
  - Satu siklus `loadFromApi()` memanggil `notifyListeners()` hingga **5–6 kali** (dari sub-method `loadNotifications`, `loadInboundShipments`, `loadOutboundShipments`, `loadAuditLogs`, dan akhir `loadFromApi`).
  - Karena `SusunoApp` memantau seluruh `WarehouseState`, setiap `notifyListeners()` memicu rebuild ulang `MaterialApp` dan seluruh halaman aktif beserta filter list O(N×M).

### D. Lockout Navigasi ("Stalled Offline") pada Jaringan LAN Gudang
- **Lokasi**: `mobile/lib/screens/app_shell.dart:87-95` & `120-125`
- **Temuan**:
  - Pengecekan `final isOnline = s.connectionStatus == ConnectionStatus.online;` menganggap status `ConnectionStatus.localOnly` (server backend gudang terhubung, namun internet luar/Google DNS terputus) sebagai *offline*.
  - Akibatnya, saat staf berpindah tab di jaringan lokal gudang tanpa internet publik, layar terkunci menampilkan `_ConnectionLoadingView()`.

### E. Penundaan Statis Splash Screen (3.05 Detik)
- **Lokasi**: `mobile/lib/screens/splash_screen.dart:60-61` & `108`
- **Temuan**:
  - Animasi loading bar ditahan statis selama `2800ms` + `250ms` sebelum menampilkan halaman Login/AppShell.

---

## 2. Rencana Eksekusi Perbaikan (Execution Blueprint)

> **Catatan untuk Eksekutor**: Karena analisis dan baris kode sudah dipetakan secara spesifik di bawah ini, eksekusi cukup mengikuti 4 langkah minimal (*Ponytail minimal diff*) berikut:

### Langkah 1 — Paralelisasi & Cooldown di `mobile/lib/state/warehouse_state.dart`
1. Tambahkan variabel state untuk deduplikasi & throttle:
   - `bool _isFetchingApi = false;`
   - `DateTime? _lastApiFetch;`
2. Ubah `Future<void> loadFromApi({bool force = false})`:
   - Jika `_isFetchingApi` bernilai `true`, langsung `return`.
   - Jika `!force && _lastApiFetch != null && DateTime.now().difference(_lastApiFetch!) < const Duration(seconds: 5)`, langsung `return`.
   - Jalankan fetch paralel menggunakan `Future.wait`:
     - Batch paralel: `getLocations`, `getWarehouseLayoutSnapshot`, `getCategories`, `getSuppliers`, `getProducts`, `getStockTransactions`, `getMyShifts`, `getTasks`, `getTaskNotifications`, `getAttendancesMe`, `getInboundShipments`, `getOutboundShipments`, `getAuditLogsMe`.
   - Proses hasil di memori dan panggil `notifyListeners()` **hanya 1 kali** di blok `finally`.
3. Pada `submitInboundInspection` (`line 1259-1261`) dan `submitOutboundInspection` (`line 1353-1355`), hapus panggilan ganda `loadInboundShipments()` dan `loadAuditLogs()` sebelum `loadFromApi(force: true)`.

### Langkah 2 — Optimasi Heartbeat Koneksi di `mobile/lib/state/warehouse_state.dart`
1. Ubah interval `_connectivityTimer` (`line 82`) dari `Duration(seconds: 3)` menjadi `Duration(seconds: 12)`.
2. Cek kesehatan backend lokal (`${ApiConfig.baseUrl}/app/latest`) terlebih dahulu dengan timeout `2500ms`.

### Langkah 3 — Perbaiki Lockout LAN & Rebuild di `mobile/lib/screens/app_shell.dart` & `mobile/lib/main.dart`
1. Di `app_shell.dart:87`:
   - Ubah `final isOnline = s.connectionStatus == ConnectionStatus.online;` menjadi:
     ```dart
     final isOnline = s.connectionStatus == ConnectionStatus.online ||
         s.connectionStatus == ConnectionStatus.localOnly;
     ```
2. Di `main.dart:47`:
   - Ganti `final s = context.watch<WarehouseState>();` dengan `context.select`:
     ```dart
     final (loggedIn, highContrast) = context.select<WarehouseState, (bool, bool)>(
       (s) => (s.loggedIn, s.staff.highContrast),
     );
     ```

### Langkah 4 — Hapus Double-Fetch & Pangkas Splash Delay
1. Di `mobile/lib/screens/stock_screen.dart:22-26`:
   - Panggil `loadFromApi()` hanya jika `items.isEmpty` (karena `navigate(1)` sudah memicu fetch).
2. Di `mobile/lib/screens/splash_screen.dart:60`:
   - Ubah durasi `_progressController` dari `Duration(milliseconds: 2800)` menjadi `Duration(milliseconds: 1200)`.

---

## 3. Verifikasi Pasca-Eksekusi
- Jalankan `flutter analyze` di folder `mobile/` (pastikan 0 error).
- Jalankan `flutter test` di folder `mobile/` (pastikan seluruh test lulus).

---

## 4. Rekomendasi Model Murah & Cocok untuk Mengeksekusi Revisi Ini

Karena **akar masalah, file target, nomor baris, dan potongan kode solusi sudah dipetakan secara lengkap** di dokumen ini, pekerjaan eksekusi tidak lagi membutuhkan penalaran arsitektur berat:

1. **Pilihan Paling Hemat & Cepat (Rekomendasi Utama)**:
   - **`Gemini 3.8 Flash (Low)`** atau **`Gemini 3.8 Flash (Medium)`** (atau varian **`Gemini 4 Hydrogen / Neon (Low/Medium)`**)
   - **Alasan**: Biaya token/kuota paling murah dan kecepatan generasi paling tinggi. Sangat cocok untuk mengeksekusi *blueprint* terstruktur (`edit_file` + `flutter analyze`).
2. **Alternatif Open-Weight / Hemat Kuota Premium**:
   - **`GPT-OSS 120B (Medium)`** atau **`Claude Sonnet 5.5 (Low)`**
   - **Alasan**: Kuota masih 100% utuh, hemat dibandingkan model tier *High / Opus / Argon High*, dan presisi untuk melakukan *refactoring* Dart/Flutter sesuai instruksi dokumen revisi ini.
