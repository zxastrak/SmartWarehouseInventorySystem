# SUSUNO System Routing & File Map (`docs/routing.md`)

> Dokumen ini merupakan referensi resmi routing SUSUNO.  
> Versi audit dan peta rute lengkap yang dirujuk oleh [`docs/audit.md`](file:///d:/Coding/Susuno/docs/audit.md) tersedia di:
> - [`docs/routes.md`](file:///d:/Coding/Susuno/docs/routes.md) (Single Source of Truth Rute & Arsitektur)
> - [`docs/development-rules.md`](file:///d:/Coding/Susuno/docs/development-rules.md) (Aturan Pengembangan & Operasional)
> - [`docs/design.md`](file:///d:/Coding/Susuno/docs/design.md) (Panduan Resmi Style & Desain SUSUNO)
> - [`AGENTS.md`](file:///d:/Coding/Susuno/AGENTS.md) (Aturan Wajib Perilaku Agen AI)

Silakan buka tautan di atas untuk melihat pemetaan rute lengkap pada **Backend**, **Web**, **Mobile**, dan **AI**.

---

### Alur Handover Inbound: Mobile (Staf Dok) ➡️ Web (Warehouse Manager)

1. **Jadwal Inbound dari Purchase Order (Web / Manager):**
   - PO yang disetujui dijadwalkan armada kedatangannya di [`web/src/pages/Inbound.jsx`](file:///d:/Coding/Susuno/web/src/pages/Inbound.jsx). Status awal: `Scheduled`.
2. **Manager Menandai Barang Datang (Web Inbound):**
   - Saat armada truk pengiriman tiba di gerbang dok gudang, Manager menekan tombol **"Tandai Datang"** di [`web/src/components/ScheduledShipment.jsx`](file:///d:/Coding/Susuno/web/src/components/ScheduledShipment.jsx).
   - Dialog konfirmasi menandai kedatangan armada dan mengubah status menjadi `Arrived`.
3. **Inspect Items Muncul Otomatis pada Aplikasi Mobile Staf Lapangan (Home Mobile):**
   - Begitu pengiriman berstatus `Arrived`, tugas pemeriksaan fisik secara otomatis langsung muncul di layar Home aplikasi Mobile staf dok ([`mobile/lib/screens/dashboard_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/dashboard_screen.dart)) pada section teratas **"Tugas Inspeksi Dok Menunggu"**.
   - Kartu pengiriman ([`mobile/lib/widgets/warehouse_sections.dart`](file:///d:/Coding/Susuno/mobile/lib/widgets/warehouse_sections.dart)) menyediakan tombol langsung **"🔍 Mulai Inspeksi & Scan Barcode ›"**.
4. **Pemeriksaan Fisik & Scan Barcode oleh Staf Dok (Mobile):**
   - Staf dok di lapangan memegang fisik barang, menghitung jumlah aktual yang diterima (`accepted_qty`) dan jumlah cacat/rusak (`damaged_qty`).
   - Staf memindai barcode kemasan fisik menggunakan tombol **"+ Scan Fisik"**, memunculkan daftar visual barcode unit (`[║▌║ SKU-001]`, `[║▌║ SKU-002]`, dst.).
   - Staf mengisi catatan kondisi segel / kontainer, lalu menekan tombol **"Kirim Hasil Cek & Barcode ke Manager"** (`POST /api/inbound/:id/inspect`).
   - Status pengiriman berubah menjadi `Inspected` (*Menunggu Review & ACC Manager*).
5. **Manager Tidak Bisa Melakukan Input Apapun di Web (100% Read-Only):**
   - **Saat status `Arrived` / `Inspecting`**:
     - Halaman Web Inbound ([`web/src/components/InboundReceiving.jsx`](file:///d:/Coding/Susuno/web/src/components/InboundReceiving.jsx)) menampilkan banner status read-only: *"⏳ Sedang Menunggu Pemeriksaan Fisik & Scan Barcode dari Staf Dok (Mobile)"*.
     - Manager **TIDAK BISA** melakukan input kuantitas, tidak ada form input angka, tidak ada dropdown tambah produk, tidak ada tombol hapus produk, dan tidak ada form upload berkas.
     - Tabel daftar pesanan PO ditampilkan murni sebagai referensi read-only.
   - **Saat status `Inspected` (Staf Selesai Cek)**:
     - Halaman Web Inbound otomatis membuka tahap **Review & ACC** ([`web/src/components/InboundReceiving.jsx`](file:///d:/Coding/Susuno/web/src/components/InboundReceiving.jsx)).
     - Manager **HANYA BISA MEMBACA HASIL INPUTAN DARI STAF MOBILE**:
       - Membaca nama staf pemeriksa (`inspector`), waktu pemeriksaan dok, dan catatan segel lapangan.
       - Membaca tabel hasil hitungan aktual diterima vs rusak dan melihat visual chip barcode fisik hasil scan staf dok.
       - Tombol edit / koreksi hitungan dihilangkan bagi manager (karena keabsahan fisik dipegang oleh staf lapangan).
6. **Persetujuan ACC Manager & Update Stok Inventaris:**
   - Manager membaca dan memvalidasi laporan staf, mencentang konfirmasi: *"Saya telah membaca dan memverifikasi laporan hasil inputan dan pemindaian barcode dari staf mobile"*.
   - Manager menekan **"✅ ACC & Selesaikan Penerimaan"** (`POST /api/inbound/:id/receive`).
   - Stok resmi bertambah ke master inventaris sistem gudang.
7. **Tahap Setelah Inbound (Post-Inbound Navigation):**
   - Setelah di-ACC, dialog sukses menampilkan pilihan tahap operasional berikutnya:
     - 📦 **"Cek Stok Baru di Master Inventory ›"** (`onNavigate("inventory")`): Mengecek pertambahan stok produk yang baru saja masuk.
     - 📋 **"Kembali ke Daftar Inbound"** (`onBack()`): Melanjutkan pemantauan jadwal kedatangan inbound lainnya.
