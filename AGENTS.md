# SUSUNO Development & Agent Rules (`AGENTS.md`)

> **Aturan Wajib Agen AI untuk Proyek SUSUNO (Smart Warehouse Inventory System)**  
> File ini mengatur perilaku dan prosedur kerja wajib sebelum melakukan koding, desain antarmuka, maupun audit sistem.  
> *Dokumentasi Resmi Tim*: Terhubung langsung dengan [`docs/development-rules.md`](file:///d:/Coding/Susuno/docs/development-rules.md).

---

## 1. Aturan Wajib Sebelum Desain, Koding & Modifikasi (Planning & Docs Check)

> **GOLDEN RULE: STOP & PLAN FIRST!**  
> **DILARANG KERAS LANGSUNG MERUBAH, MEMODIFIKASI, ATAU MENULIS KODE TANPA MEMBUAT & MEMAPARKAN PLANNING TERLEBIH DAHULU KEPADA PENGGUNA.**

Setiap kali pengguna meminta untuk mendesain antarmuka, menambahkan fitur, memperbaiki bug, atau melakukan modifikasi apa pun:
1. **Wajib Planning Terlebih Dahulu Sebelum Merubah Kode**:
   - Paparkan rencana kerja (*planning*) yang jelas, terstruktur, bertahap, dan terukur dalam chat.
   - Rencana (*plan*) wajib mencakup:
     1. Analisis masalah & tujuan perubahan.
     2. Daftar file target yang akan disentuh beserta alasannya.
     3. Rincian tahapan langkah teknis (Step-by-step Execution Plan).
     4. Metode verifikasi & pengujian hasil kerja.
   - **Tunggu atau persilakan pengguna mengevaluasi rencana tersebut sebelum mulai mengubah file kode.**
2. **Wajib Membaca Rute Terlebih Dahulu**:
   - Baca [`docs/routes.md`](file:///d:/Coding/Susuno/docs/routes.md) dan [`docs/routing.md`](file:///d:/Coding/Susuno/docs/routing.md).
   - Pastikan rute, komponen yang sudah ada, serta keterkaitan antar modul (Backend, Web, Mobile) dipahami agar tidak menulis kode yang mubazir (*redundant*) atau merusak alur navigasi yang sudah berjalan.
3. **Wajib Membaca Dokumen Desain Terlebih Dahulu**:
   - Baca [`docs/design.md`](file:///d:/Coding/Susuno/docs/design.md) (atau `docs/style-design.md`).
   - Terapkan standar visual SUSUNO (*Modern Industrial Forest & Clean Ergonomic Warehouse*):
     - **Palet Warna**: Olive Primary (`#5c732b`), Deep Forest (`#3e5510`), Ink Charcoal (`#191d17`), Slate Muted (`#737b6c`), Canvas (`#f8f9f5`).
     - **Status Semantik**: Success/Mint (`#f0fdf4`), Inspecting/Cyan (`#ecfeff`), Scheduled/Amber (`#fef3c7`), Issue/Rose (`#fdecec`).
     - **Komponen**: `.inbound-primary`, `.inbound-secondary`, chip barcode `.barcode-badge-item` (`║▌║ SKU-001`), kartu `.dashboard-card` (radius 14px), banner `.banner-waiting-staff` & `.banner-review-staff`.

---

## 2. Aturan Perintah Audit (Audit Trigger Rule)

Apabila pengguna memberikan perintah **"audit"**:
1. **Akses / Login ke Modul Audit**:
   - Segera arahkan/login ke modul **Audit Trail / Audit Log** (pada Web: `/audit-trail`, pada Backend: API `/api/audit-logs`).
2. **Patuhi Panduan [`docs/audit.md`](file:///d:/Coding/Susuno/docs/audit.md)**:
   - Gunakan peta rute di [`docs/routes.md`](file:///d:/Coding/Susuno/docs/routes.md) untuk menelusuri file yang diaudit.
   - Hanya buka file yang relevan dengan fitur yang diaudit, jangan memindai seluruh repo secara acak.
   - Format laporan temuan: `file:line` -> issue -> fix.
   - Jangan mengubah kode secara langsung selama audit; laporkan temuan terlebih dahulu kepada pengguna.

---

## 3. Aturan Alur Handover Inbound (Role & Permission)

1. **Manager (Web)**:
   - Menandai kedatangan armada di dok penerimaan (`Mark as Arrived`).
   - Pada tahap inspeksi barang datang: **100% Read-Only** (tidak ada form input kuantitas, tidak ada upload berkas, tidak ada dropdown tambah/hapus barang).
   - Pada tahap review: Manager hanya membaca hasil inputan aktual dan barcode hasil scan dari staf dok, mencentang verifikasi, lalu memberikan persetujuan (**ACC**).
2. **Staf Lapangan (Mobile)**:
   - Tugas inspeksi barang datang otomatis muncul di halaman Home Mobile saat status pengiriman `Arrived`.
   - Staf memegang fisik barang, memasukkan kuantitas aktual diterima/rusak, memindai barcode fisik unit, dan mengirim laporan inspeksi ke Manager.
3. **Tanpa Penataan Rak di Inbound**:
   - Tahap Inbound tidak melibatkan pemilihan/penataan rak (*no-rack staging*). Penataan lokasi fisik dilakukan pada tahap terpisah setelah Inbound (*Putaway*).

---

## 4. Aturan Komunikasi & Rencana Perubahan (Singkat, Padat & Tidak Berbelit)

> **ATURAN KOMUNIKASI AGEN AI:**  
> **DILARANG BERBELIT-BELIT KETIKA MENYURUH / MENGAJUKAN PERUBAHAN.**

1. **Perubahan Non-Teknis (Nama, Label Teks, Judul, dsb.)**:
   - Cukup jelaskan secara singkat, padat, dan langsung to-the-point.
   - Jangan memberikan pengantar atau narasi teori yang berlebihan.
2. **Perubahan Teknis**:
   - Fokus langsung pada: (1) Masalah & Tujuan ringkas, (2) File target, (3) Poin langkah teknis to-the-point, (4) Verifikasi singkat.

---

*Aturan ini mengikat dan wajib dipatuhi oleh setiap sesi agen AI saat berinteraksi dalam repositori ini.*
