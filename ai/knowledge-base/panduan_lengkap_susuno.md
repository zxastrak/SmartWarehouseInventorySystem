# Panduan Operasional & Standar Sistem SUSUNO (Smart Warehouse Inventory System)

Dokumen ini merupakan acuan resmi seluruh alur operasional, definisi teknis, pembagian peran, dan tata kelola pergudangan pada sistem SUSUNO.

---

## 1. Pengenalan Sistem & Pembagian Peran (Role Division)

SUSUNO adalah software manajemen gudang modern yang menghubungkan kendali manajerial dengan eksekusi lapangan secara terintegrasi:

- **Web Management Console (Peran: Manajer)**:
  - Berfungsi untuk mengontrol, memantau, dan mengelola seluruh aktivitas gudang dari meja kerja.
  - Memantau metriks penting pada **Dashboard**.
  - Mengelola data master (Katalog Produk, Supplier, Rak/Lokasi, Batas Minimum Stok, dan Harga).
  - Menerbitkan dan menyetujui Purchase Order (PO).
  - Menugaskan staf untuk inspeksi kedatangan barang.
  - Memberikan persetujuan akhir (*Approval*) atas hasil inspeksi barang sebelum resmi dicatat ke stok inventaris.
  - Bersifat *Read-Only* saat staf sedang melakukan pemeriksaan fisik barang di dok.

- **Mobile App Handheld (Peran: Staf Lapangan)**:
  - Berfungsi sebagai alat kerja utama di dok dan lorong rak gudang.
  - Menerima penugasan inspeksi barang dari manajer.
  - Memeriksa kondisi fisik dan jumlah aktual barang yang datang dari truk.
  - Memindai QR/barcode rak dan barang (Single / Multi Scan).
  - Melampirkan bukti foto jika ditemukan barang rusak/isu.
  - Melakukan mutasi perpindahan barang antar-rak.

---

## 2. Glosarium & Siklus Alur Pergerakan Barang

Pergerakan barang di gudang SUSUNO dibagi menjadi dua arah besar dengan tiga sub-proses transit utama:

| Istilah | Definisi & Alur Kerja |
|---|---|
| **Inbound** | Seluruh rangkaian proses memasukkan barang dari pihak luar (supplier) ke dalam gudang. |
| **Outbound** | Seluruh rangkaian proses mengeluarkan barang dari gudang menuju pemesan/cabang. |
| **Docking** | Area transit penanganan barang saat keluar dari truk kontainer (Inbound) atau sebelum dimuat ke dalam truk (Outbound). Seluruh arus Inbound dan Outbound melewati fase docking ini. |
| **Putaway** | Proses pemindahan dan penataan fisik barang dari area **Docking transit menuju rak penyimpanan akhir**. |
| **Dispatching** | Proses pengambilan barang dari **rak penyimpanan menuju area Docking transit** untuk dimuat ke truk pengiriman. |
| **Mutasi** | Proses perpindahan fisik barang dari satu lokasi penyimpanan ke lokasi lain (**Rak A menuju Rak B**) dalam gudang yang sama. |

---

## 3. Kebijakan & Spesifikasi Kode QR (QR Code Printing)

Sistem SUSUNO mendukung pencetakan kode QR untuk dua entitas utama:

1. **Kode QR Rak (Lokasi Penyimpanan)**:
   - **Karakteristik**: **Wajib Selalu Unik**.
   - Setiap baris, kolom, dan tingkatan rak memiliki identitas kode QR tersendiri yang tidak boleh sama, agar lokasi fisik barang dapat terlacak secara presisi.
2. **Kode QR Barang (Produk)**:
   - **Barang Generik (Komoditas Massal)**: Kode QR cukup dicetak **1 kali** untuk jenis produk tersebut dan dapat ditempel/discan berulang kali.
   - **Barang Unik (Serialized / Aset Bernilai Tinggi)**: Kode QR wajib dicetak **satu per satu secara individual** untuk membedakan tiap unit fisik.

---

## 4. Prosedur Lengkap Inspeksi & Scan Inbound

Alur inspeksi barang saat tiba di dok penerimaan:

```
Truk Tiba → Manajer Setujui Kedatangan → Manajer Tugaskan Staf → Tugas Muncul di Mobile Staf
  ↓
Staf Buka Tugas Mobile → Scan Rak (Single/Multi) → Scan Barang (Single/Multi)
  ↓
Konfirmasi Jumlah & Foto Isu (Jika Ada) → Kirim Laporan ke Manajer
  ↓
Manajer Review & Berikan Approval → Barang Otomatis Bertambah di Inventori
```

### Mekanisme Pemindaian (Scanning Mechanism):
1. **Pemindaian Rak (Scan Rak Terlebih Dahulu)**:
   - **Single Scan**: Digunakan untuk membaca 1 rak spesifik sebagai target penempatan.
   - **Multi Scan**: Digunakan untuk memindai beberapa rak sekaligus dalam satu rangkaian agar mempercepat alur kerja di lorong rak.
2. **Pemindaian Barang**:
   - Dilakukan setelah rak terverifikasi.
   - **Single Scan**: Cukup untuk barang bertipe generik (1 kali scan mewakili batch).
   - **Multi Scan / All Scan**: Wajib untuk barang bertipe unik agar seluruh nomor seri unit terdata.
3. **Penyelesaian & Eskalasi Isu**:
   - Jika kondisi fisik bagus: Staf menyelesaikan inspeksi dan mengirim draf verifikasi ke manajer.
   - Jika ada barang rusak/cacat/kurang: Staf menginput jumlah rusak dan melampirkan **bukti foto isu barang**.
   - Manajer meninjau draf laporan dan memberikan persetujuan (*ACC*). Begitu di-ACC, stok otomatis masuk ke inventori sistem.

---

## 5. Alur Rantai Pasok End-to-End (Supply Chain Flow)

### Skenario A: Bermitra dengan Supplier Baru
1. **Registrasi Mitra**: Buka menu *Suppliers*, input data lengkap mitra pemasok baru.
2. **Input Katalog Produk**: Daftarkan barang-barang penawaran supplier (nama, SKU, harga beli, satuan, kategori). Stok awal katalog ini bernilai 0.
3. **Penerbitan PO**: Buat Purchase Order (PO) dengan memilih barang dari katalog supplier tersebut.
4. **Jadwal Inbound**: Saat PO di-approve manajer, sistem otomatis menjadwalkan kedatangan Inbound truk.
5. **Eksekusi Lapangan**: Truk tiba → Tugaskan staf → Inspeksi & scan barang di mobile → Manajer approval → Barang resmi masuk stok.

### Skenario B: Pengadaan Berulang dari Supplier yang Sudah Terdaftar
1. **Purchase Order Langsung**: Buka menu *Purchase Orders*, pilih nama supplier terdaftar, pilih produk dari katalog yang sudah ada.
2. **Approval PO**: Manajer menyetujui PO (berlaku aturan anti self-approval).
3. **Inbound & Inspeksi**: Pengiriman otomatis terjadwal di Inbound dan masuk ke siklus inspeksi staf seperti biasa.

---

## 6. Fungsi Modul-Modul di Web Management Console

- **Dashboard**: Panel ringkasan utama yang menyajikan informasi kritis yang memerlukan atensi segera dari manajer (contoh: stok menipis, PO menunggu persetujuan, truk inbound aktif di dok).
- **Inventori**: Pusat pemantauan seluruh barang di gudang. Mengatur kuantitas stok, batas minimum pemesanan ulang (*reorder point*), harga barang, dan lokasi penempatan rak.
- **AI Insight**: Pusat analisis cerdas yang memberikan rekomendasi otomatis berbasis data historis (perkiraan habis stok, klasifikasi Fast/Slow moving, saran kuantitas restock).
- **Purchase Orders (PO)**: Modul transaksi pemesanan barang ke supplier berdasarkan katalog resmi.
- **Reports**: Laporan komprehensif seluruh aktivitas pergudangan (laporan stok opname, ringkasan pergerakan barang, riwayat pemenuhan outbound).
- **Audit Trail**: Catatan log kepatuhan yang merekam seluruh riwayat aktivitas pengguna (siapa mengubah apa, waktu kejadian, status sebelum dan sesudah perubahan) untuk akuntabilitas.
- **Staff Management**:
  - *Staff Accounts*: Pendaftaran akun dan kredensial login staf lapangan.
  - *Shift Management*: Penjadwalan dan rotasi jam kerja shift staf.
  - *Role Management*: Pengaturan hak akses (*permissions*) antara Manajer dan Staf.

---

## 7. Halaman Supplier (Manajemen Pemasok)

Halaman Supplier adalah pusat pengelolaan seluruh data mitra pemasok (supplier) yang bekerja sama dengan gudang. Manajer dapat mendaftarkan supplier baru, melihat detail lengkap, mengedit data, serta mendaftarkan katalog produk dari masing-masing supplier.

### 7.1 Registrasi & Identitas Supplier

Saat mendaftarkan supplier baru, manajer wajib mengisi data identitas berikut:

| Field | Keterangan |
|---|---|
| **Nama Perusahaan** | Nama resmi perusahaan pemasok. |
| **Nama PIC** | Nama Person in Charge (kontak utama) dari pihak supplier. |
| **Alamat Email** | Email resmi untuk korespondensi bisnis. |
| **Nomor Telepon** | Nomor telepon aktif PIC atau perusahaan. |
| **Alamat Gudang** | Alamat fisik gudang atau kantor supplier tempat pengiriman barang berasal. |
| **Nama Bank** | Nama institusi bank untuk keperluan pembayaran. |
| **Nomor Rekening** | Nomor rekening bank supplier. |
| **Nama Rekening** | Nama pemilik rekening sesuai data perbankan. |

### 7.2 Detail Supplier

Tombol **Detail** pada setiap baris supplier membuka halaman informasi lengkap yang mencakup:

- **Daftar Produk Terdaftar**: Menampilkan seluruh produk katalog yang telah didaftarkan dari supplier tersebut.
- **Total Unit Fisik**: Jumlah total unit barang yang saat ini dimiliki gudang dari supplier bersangkutan.
- **Estimasi Nilai Stok**: Perkiraan total nilai rupiah stok barang yang berasal dari supplier tersebut.
- **Produk Perlu Restock**: Daftar produk dari supplier yang stoknya sudah mendekati atau melewati batas minimum dan perlu segera dipesan ulang.
- **Riwayat Purchase Order**: Catatan lengkap seluruh PO yang pernah diterbitkan ke supplier tersebut, termasuk status dan detail masing-masing PO.

Pada halaman detail juga tersedia:
- **Tombol Edit**: Untuk memperbarui data identitas supplier.
- **Shortcut Buat PO**: Tombol pintas untuk langsung membuat Purchase Order baru ke supplier tersebut tanpa harus berpindah ke menu PO.

### 7.3 Pendaftaran Katalog Produk Supplier

Tab **Katalog Produk** digunakan untuk mendaftarkan barang-barang yang ditawarkan oleh supplier. Setiap produk katalog memiliki field berikut:

| Field | Keterangan | Aturan |
|---|---|---|
| **Nama Produk Katalog** | Nama resmi produk sesuai penawaran supplier. | Wajib diisi. |
| **Kode SKU** | Kode identitas unik produk. | Maksimal 7 karakter, hanya huruf kapital (A–Z) dan angka (0–9). |
| **Kategori Produk** | Klasifikasi jenis produk. | Dapat dikustomisasi sendiri oleh pengguna (contoh: Elektronik, Bahan Baku, Perlengkapan, dll). |
| **Harga Beli Satuan** | Harga beli per satuan barang dari supplier. | Wajib diisi, dalam format mata uang. |
| **Satuan Barang** | Unit pengemasan per satuan pembelian. | Dapat dikustomisasi (contoh: Dus, Karung, Galon, Pcs, Roll, dsb). |
| **Berat Barang** | Berat per satuan barang. | Opsional. |
| **Batas Minimum Order** | Jumlah minimum pemesanan per satuan. | Dihitung dalam konteks satuan barang yang dipilih (contoh: minimal 5 Dus, minimal 10 Galon). |
| **Foto Produk Katalog** | Gambar visual produk. | Mendukung upload file langsung maupun input dari URL/link gambar. |
| **Deskripsi / Catatan** | Keterangan tambahan mengenai produk. | Opsional, digunakan untuk mencatat spesifikasi, varian, atau informasi penting lainnya. |

> **Catatan Penting**: Produk yang didaftarkan di katalog supplier belum memiliki stok. Stok baru bertambah setelah Purchase Order diterbitkan, barang dikirim supplier, diterima di dok, diinspeksi oleh staf lapangan, dan disetujui (*approved*) oleh manajer melalui alur Inbound.

---

## 8. Modul Purchase Orders (PO) & Formulir New Purchase Order

Menu **Purchase Orders** adalah pusat pengelolaan transaksi pemesanan barang kepada mitra pemasok (supplier). Menu ini memungkinkan manajer merencanakan pengadaan barang, memantau pengiriman barang yang sedang berjalan, serta mengevaluasi riwayat pesanan.

### 8.1 Data & Metrik Ringkasan Utama (Summary Cards)

Pada bagian atas halaman Purchase Orders, terdapat panel ringkasan metrik operasional yang menyajikan 4 data penting:

1. **Orderan Terbuka / Proses Pengiriman (*Open Orders*)**:
   - Menampilkan total pesanan yang berstatus aktif dan sedang dalam proses pengiriman oleh supplier menuju gudang (*In Transit* atau *Awaiting Delivery*).
2. **Menunggu Persetujuan Manajer (*Pending Approval*)**:
   - Menampilkan pesanan PO baru yang telah dibuat namun masih menunggu persetujuan (*review/ACC*) dari manajer gudang sebelum resmi dikirim ke supplier.
3. **Telat dari Semestinya (*Overdue*)**:
   - Menampilkan pesanan aktif yang telah melewati perkiraan tanggal kedatangan (*expected date*) yang dijanjikan, sehingga memerlukan tindak lanjut atau eskalasi ke pihak supplier.
4. **Total PO dalam Bulan Ini (*This Month*)**:
   - Menampilkan akumulasi total jumlah pesanan PO yang diterbitkan dalam bulan berjalan serta nilai total nominal transaksinya dalam mata uang Rupiah (IDR).

---

### 8.2 Alur Pembuatan Purchase Order Baru (New Purchase Order)

Pembuatan pesanan baru dilakukan melalui tombol **"+ New Purchase Order"** dengan alur tahapan operasional sebagai berikut:

1. **Memilih Supplier**:
   - Manajer memilih mitra pemasok resmi dari daftar dropdown supplier yang sudah terdaftar.
2. **Menampilkan Informasi Rekening Resmi Supplier**:
   - Begitu supplier dipilih, sistem secara otomatis menampilkan rincian rekening pembayaran resmi supplier (*Nama Bank, Nomor Rekening, dan Atas Nama Pemilik Rekening*) lengkap dengan tombol salin cepat untuk mempermudah bagian keuangan dan administrasi pembayaran.
3. **Menentukan Tanggal Estimasi Kedatangan (*Expected Date*)**:
   - Menentukan tanggal target armada truk/barang tiba di dok penerimaan gudang (minimal hari ini ke depan).
4. **Memilih Produk Katalog (Terkunci Sebelum Supplier Dipilih)**:
   - Kolom pemilihan produk baru aktif setelah supplier ditentukan.
   - Dropdown hanya menyajikan daftar produk resmi (Kode SKU dan Nama Barang) yang terdaftar pada katalog supplier bersangkutan. Kategori barang dan harga satuan beli otomatis terisi dari data katalog.
5. **Mengatur Kuantitas Barang (*Quantity*) & Satuan**:
   - Mengisi jumlah unit barang yang akan dibeli sesuai dengan satuan kemasan produk (*pcs, box, dus, karung, roll, dsb.*).
6. **Notifikasi & Peringatan Minimum Order (*MOQ Alert*)**:
   - Sistem memiliki validasi otomatis: Jika jumlah barang yang dimasukkan berada **di bawah batas minimum order** yang telah ditentukan pada katalog supplier, antarmuka akan menampilkan **notifikasi peringatan visual secara langsung**:
     > ⚠️ *Jumlah pesanan berada di bawah batas minimum pembelian katalog supplier (Min: X unit).*
   - Sistem mencegah pengiriman draf pesanan sebelum kuantitas disesuaikan minimal setara batas minimum pembelian.
7. **Penerbitan Purchase Order**:
   - Setelah seluruh rincian barang dan catatan tervalidasi, manajer menekan tombol untuk menerbitkan Purchase Order.
   - PO baru otomatis terdaftar dengan status `Pending Approval` untuk ditinjau sebelum dijadwalkan ke Inbound pengiriman.
