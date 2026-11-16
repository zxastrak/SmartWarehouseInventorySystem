# SUSUNO System Development & Operational Rules (`docs/development-rules.md`)

> **Dokumen Resmi Aturan Pengembangan & Operasional SUSUNO (Smart Warehouse Inventory System)**  
> Dokumen ini adalah acuan tata kelola teknis, prosedur coding tim, standar arsitektur lintas modul (Backend, Web, Mobile, AI), serta protokol keamanan dan audit sistem.  
> *Versi AI Agent*: Mengikat secara otomatis pada [`AGENTS.md`](file:///d:/Coding/Susuno/AGENTS.md) di direktori utama repositori.

---

## 1. Aturan Emas Pengembangan (Golden Rule: Stop & Plan First)

> **DILARANG MERUBAH, MEMODIFIKASI, ATAU MENULIS KODE TANPA MEMBUAT & MEMAPARKAN PLANNING TERLEBIH DAHULU.**

Setiap penambahan fitur, perubahan UI/UX, perbaikan bug, atau refactoring kode:
1. **Pemaparan Rencana Kerja (Planning)**:
   - Paparkan analisis masalah & tujuan perubahan.
   - Cantumkan daftar file target yang akan disentuh beserta alasannya.
   - Uraikan rincian tahapan langkah teknis (Step-by-step Execution Plan).
   - Tentukan metode verifikasi & pengujian hasil kerja.
   - Tunggu konfirmasi atau evaluasi dari pengguna/tim sebelum memodifikasi kode.
2. **Kepatuhan Rute & Navigasi**:
   - Selalu membaca [`docs/routes.md`](file:///d:/Coding/Susuno/docs/routes.md) sebelum memodifikasi alur halaman untuk mencegah rute duplikat (*redundant*) atau merusak *History State* navigasi.
3. **Kepatuhan Standar Desain**:
   - Selalu membaca [`docs/design.md`](file:///d:/Coding/Susuno/docs/design.md) untuk menjaga konsistensi visual tema *Modern Industrial Forest* (Olive `#5c732b`, Forest `#3e5510`, radius kartu 14px, chip barcode fisik).

---

## 2. Aturan Alur Bisnis Handover Inbound (Role & Permission)

Alur penerimaan barang masuk (*Inbound*) diatur dengan batasan peran yang sangat ketat:

### 2.1 Warehouse Manager (Web Console)
- **Status `Scheduled`**: Meninjau jadwal PO dan armada supplier yang akan datang.
- **Status `Arrived`**: Menandai kedatangan armada di dok penerimaan (*Mark as Arrived*).
- **Status `Inspecting` / Fisik Barang Datang**: **100% Read-Only**.
  - Manager **DILARANG** menginput kuantitas barang masuk, tidak ada dropdown tambah/hapus produk, dan tidak ada form upload dokumen pada tahap ini.
  - Halaman Web wajib menampilkan banner: *"Sedang Menunggu Pemeriksaan Fisik & Scan Barcode dari Staf Dok (Mobile)"*.
- **Status `Inspected` (Review & ACC)**:
  - Manager membaca hasil laporan aktual dan visual chip barcode yang diunggah staf dok.
  - Mencetang verifikasi pertanggungjawaban fisik.
  - Memberikan persetujuan (**ACC**) untuk memperbarui stok inventaris gudang.

### 2.2 Staf Dok & Gudang (Mobile App)
- Tugas inspeksi otomatis muncul di layar utama Mobile saat armada berstatus `Arrived`.
- Staf memegang fisik barang, menghitung aktual jumlah diterima (`accepted_qty`) dan rusak (`damaged_qty`).
- Staf memindai barcode fisik unit demi unit menggunakan kamera atau scanner hardware (`[║▌║ SKU-001]`).
- Mengirim laporan inspeksi digital ke sistem backend untuk ditinjau oleh Manager.

### 2.3 Prinsip No-Rack Staging
- Tahap Inbound **TIDAK BOLEH** melibatkan penataan lokasi rak (*rack placement*).
- Barang yang di-ACC ditempatkan di area staging dok. Penataan rak fisik dilakukan pada modul terpisah setelah Inbound selesai (*Putaway Flow*).

---

## 3. Aturan Standar Aplikasi Mobile (Mobile Standalone & OTA Update)

1. **Dukungan Jaringan Fleksibel (Dynamic Server IP)**:
   - Aplikasi mobile tidak boleh bergantung pada hardcoded IP emulator (`10.0.2.2`).
   - Layar login wajib menyediakan konfigurasi IP server (`ApiConfig.setCustomBaseUrl`) agar HP fisik dapat terhubung via Wi-Fi lokal (`http://192.168.x.x:5000/api`) atau URL tunnel publik.
2. **Mekanisme In-App OTA Update**:
   - Mobile mendeteksi versi rilis melalui endpoint backend `GET /api/app/latest`.
   - Jika `versionCode` server lebih tinggi dari versi terpasang, aplikasi menampilkan dialog pembaruan nirkabel dan tautan unduhan APK (`GET /api/app/download`).
   - Penandatanganan build (*signingConfig*) menggunakan kunci konsisten agar Android mengizinkan pembaruan langsung (*in-place update*) tanpa konflik tanda tangan (*signature mismatch*).
3. **Kompilasi Multi-Drive Windows**:
   - File `gradle.properties` wajib mematikan `kotlin.incremental=false` untuk mencegah kegagalan build `different roots error` akibat pemisahan drive `C:` dan `D:`.

---

## 4. Aturan Protokol Audit Sistem (Audit Trigger Rule)

Saat menerima perintah **"audit"**:
1. Langsung arahkan navigasi ke antarmuka **Audit Trail** (Web: `/audit-trail`, Backend: `/api/audit-logs`).
2. Patuhi panduan teknis pada [`docs/audit.md`](file:///d:/Coding/Susuno/docs/audit.md).
3. Gunakan peta rute pada [`docs/routes.md`](file:///d:/Coding/Susuno/docs/routes.md) untuk menelusuri file terkait tanpa memindai seluruh direktori secara acak.
4. Format pelaporan temuan wajib: `file:line` -> `issue` -> `fix`.
5. Jangan mengubah kode secara spontan selama proses audit berlangsung.

---

## 5. Aturan Komunikasi & Rencana Perubahan (Singkat, Padat & Tidak Berbelit)

1. **Perubahan Non-Teknis (Nama, Label Teks, Judul, dsb.)**:
   - Jelaskan secara singkat, padat, dan langsung to-the-point tanpa narasi berbelit.
2. **Perubahan Teknis**:
   - Sajikan rencana kerja secara ringkas dan terfokus pada:
     - Masalah & Tujuan ringkas.
     - File target.
     - Langkah teknis poin per poin.
     - Verifikasi.

