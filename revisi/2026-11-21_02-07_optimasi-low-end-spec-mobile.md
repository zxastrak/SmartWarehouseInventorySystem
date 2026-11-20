# Catatan Revisi: Optimasi Aplikasi Mobile SUSUNO untuk HP Low-End Spec

- **Tanggal & Waktu Pencatatan**: Sabtu, 21 November 2026 — Pukul `02:07:02 WIB` (`2026-11-21T02:07:02+07:00`)
- **Modul Target**: Aplikasi Mobile Flutter (`mobile/`)
- **Fokus Revisi**: Peringanan GPU, VRAM, Layout Pass, dan Engine Renderer khusus HP *Low-Entry / Budget* (RAM 2–4 GB, Chipset Entry-Level)
- **Mode Standar**: `skillai` (Caveman + Ponytail + Anti-Slop)
- **Rekomendasi Model Eksekutor**: `Gemini 3.8 Flash (Low)` / `Gemini 3.8 Flash (Medium)`

---

## 1. Analisis Bottleneck Spesifik HP Low-End

1. **Impeller (Vulkan Backend) Bermasalah di Chipset Entry-Level**
   - **Lokasi**: `mobile/android/app/src/main/AndroidManifest.xml:34-39`
   - **Masalah**: Flutter mengaktifkan Impeller (Vulkan) secara default di Android. Pada GPU kelas budget (Mali-G52, PowerVR, Adreno 5xx/610), driver Vulkan sering memicu *shader stutter* & *frame drop* saat scroll. Mematikan Impeller mengembalikan renderer ke **Skia OpenGL ES** yang jauh lebih stabil dan ringan.

2. **Decode Gambar Resolusi Penuh ke VRAM Tanpa `cacheWidth`**
   - **Lokasi & Ukuran File**:
     - `warehouse_staff.png` (513.3 KB) di `mobile/lib/screens/login_screen.dart:558-561`
     - `logout_staff.png` (163.4 KB) di `mobile/lib/screens/profile_screen.dart:516-519`
     - `susuno_logo.png` (80.3 KB) di `mobile/lib/screens/login_screen.dart:891-896`, `mobile/lib/screens/app_shell.dart:1093-1098`, `mobile/lib/screens/splash_screen.dart:168-174`
     - `action_*.png` (~75 KB × 4 file) di `mobile/lib/screens/shift_hub_screen.dart:827-832`
   - **Masalah**: Tanpa parameter `cacheWidth`, Flutter mendekode bitmap ukuran penuh (1024×1024 px = 4–12 MB RAM per gambar) lalu mengecilkannya di GPU setiap frame, padahal di layar hanya berukuran `28px`–`270px`.

3. **Tab 2 (`WarehouseMapScreen`) Tetap Ter-Mount di `IndexedStack` + Animasi 60 FPS Tanpa Henti**
   - **Lokasi**:
     - `mobile/lib/screens/app_shell.dart:106-115`
     - `mobile/lib/screens/warehouse_map_screen.dart:95-98`
   - **Masalah**:
     - Saat `_page2Mode == _Page2Mode.map`, `WarehouseMapScreen` tetap hidup di `IndexedStack` walaupun staf sedang di tab Tugas/Stok.
     - Di dalam `WarehouseMapScreen.initState()`, `_pulseAnimCtrl..repeat(reverse: true)` terus berjalan 60 FPS tanpa henti.

4. **Double Layout Pass Akibat `IntrinsicHeight`**
   - **Lokasi**:
     - `mobile/lib/screens/stock_screen.dart:70-99`
     - `mobile/lib/screens/activity_screen.dart:109-130`
     - `mobile/lib/screens/profile_screen.dart:149-170`
   - **Masalah**: `IntrinsicHeight` memaksa Flutter menghitung layout anak-anaknya 2 kali lipat per frame.

---

## 2. Rencana Eksekusi Kode (Blueprint Siap Eksekusi)

### Langkah 1 — Aktifkan OpenGL ES (Matikan Impeller) di `mobile/android/app/src/main/AndroidManifest.xml`
Di bawah `<meta-data android:name="flutterEmbedding" android:value="2" />` (baris 36–38), tambahkan:
```xml
        <meta-data
            android:name="io.flutter.embedding.android.EnableImpeller"
            android:value="false" />
```

### Langkah 2 — Tambahkan `cacheWidth` pada Semua `Image.asset`
1. **`mobile/lib/screens/app_shell.dart:1093-1098`**:
   - Tambahkan `cacheWidth: 102,`:
     ```dart
     Image.asset(
       'assets/images/susuno_logo.png',
       width: 34,
       height: 34,
       cacheWidth: 102,
       fit: BoxFit.contain,
     ),
     ```
2. **`mobile/lib/screens/shift_hub_screen.dart:827-832`**:
   - Tambahkan `cacheWidth: 84,` pada ikon aksi cepat (`28x28` px):
     ```dart
     Image.asset(
       imageAsset!,
       width: 28,
       height: 28,
       cacheWidth: 84,
       fit: BoxFit.contain,
     )
     ```
3. **`mobile/lib/screens/login_screen.dart:558-561` & `891-896`**:
   - Pada `warehouse_staff.png` (baris 558): tambahkan `cacheWidth: 480,`.
   - Pada `susuno_logo.png` (baris 891): tambahkan `cacheWidth: 108,`.
4. **`mobile/lib/screens/profile_screen.dart:516-519`**:
   - Pada `logout_staff.png`: tambahkan `cacheWidth: 420,`.

### Langkah 3 — Lazy-Mount Tab 2 & Matikan Loop 60 FPS Peta
1. **`mobile/lib/screens/app_shell.dart:106-115`**:
   - Pastikan index ke-2 pada `IndexedStack` hanya me-mount `WarehouseMapScreen` atau `ScannerScreen` ketika `s.page == 2`:
     ```dart
     s.page != 2
         ? const SizedBox.shrink()
         : (_page2Mode == _Page2Mode.map
             ? WarehouseMapScreen(
                 isEmbeddedInShell: true,
                 onSwitchToScanner: () {
                   setState(() {
                     _page2Mode = _Page2Mode.singleScan;
                   });
                 },
               )
             : const ScannerScreen()),
     ```
2. **`mobile/lib/screens/warehouse_map_screen.dart:95-98`**:
   - Hapus `..repeat(reverse: true)` pada `_pulseAnimCtrl` (cukup inisialisasi dengan `value: 0.5`) agar CPU/GPU tidak dipaksa menggambar ulang kanvas peta terus-menerus 60 kali per detik.

### Langkah 4 — Hapus `IntrinsicHeight` pada Kartu Metrik
1. **`mobile/lib/screens/stock_screen.dart:70-99`**:
   - Hapus wrapper `IntrinsicHeight` dan `crossAxisAlignment: CrossAxisAlignment.stretch` pada `Row` metrik (`Safe Stock`, `Putaway`, `Dispatching`).
2. **`mobile/lib/screens/activity_screen.dart:109-130`**:
   - Hapus wrapper `IntrinsicHeight` dan `crossAxisAlignment: CrossAxisAlignment.stretch` pada `Row` metrik (`Inbound Hari Ini`, `Outbound Hari Ini`).
3. **`mobile/lib/screens/profile_screen.dart:149-170`**:
   - Hapus wrapper `IntrinsicHeight` dan `crossAxisAlignment: CrossAxisAlignment.stretch` pada `Row` `_ShiftCard`.

---

## 3. Verifikasi & Cara Build ke HP Low-End

1. **Verifikasi Kode**:
   - Jalankan `flutter analyze` di direktori `mobile/` (pastikan `No issues found!`).
   - Jalankan `flutter test test/scanner_resolve_test.dart` (pastikan semua test lulus).
2. **Perintah Wajib Saat Jalankan / Install di HP Low-End (Jangan Pakai Debug Mode)**:
   - Untuk run langsung via kabel USB:
     ```powershell
     flutter run --release
     ```
   - Untuk build APK super ringan khusus arsitektur HP (`arm64-v8a` / `armeabi-v7a`):
     ```powershell
     flutter build apk --release --split-per-abi
     ```
