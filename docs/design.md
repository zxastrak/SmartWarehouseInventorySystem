# SUSUNO Design System & Style Guide (`docs/style-design.md`)

> **Sistem Desain Resmi SUSUNO (Smart Warehouse Inventory System)**  
> Panduan terpadu untuk estetika visual, palet warna, tipografi, komponen antarmuka, dan standarisasi UX pada platform **Web (Manager Workspace)** dan **Mobile (Handheld Dok/Gudang)**.

---

## 1. Filosofi Desain & Karakter Visual

SUSUNO mengusung konsep **"Modern Industrial Forest & Clean Ergonomic Warehouse"**:
- **Tegas, Bersih, dan Profesional**: Mengutamakan kejelasan data pergudangan (kuantitas, SKU, status dok, telemetry) tanpa distraksi visual.
- **Palet Bertema Alam & Industri (Olive-Forest-Slate)**: Menghindari warna jenuh generik; menggunakan gradasi *Olive Green* dan *Forest* yang menenangkan mata saat digunakan berjam-jam di ruang kontrol atau dok.
- **Fungsionalitas Berbasis Peran (Role-driven Ergonomics)**:
  - **Web (Manager)**: Tampilan luas, densitas data tinggi, hierarki tabel yang rapi, dan konfirmasi alur kerja bertahap (*Read-Only review & ACC*).
  - **Mobile (Staf Lapangan)**: Tombol sentuh besar (*touch-friendly* min 44px), kontras tinggi, visual chip barcode yang jelas, dan alur scan tanpa hambatan.

---

## 2. Palet Warna & Semantic Tokens

### 2.1 Warna Utama (Brand & Accent)

| Token Name | Hex Code | Flutter / Web Value | Penggunaan Utama |
| :--- | :--- | :--- | :--- |
| **Olive Primary** | `#5c732b` | `Color(0xff5a7129)` | Brand utama, tombol aksi primer web, header sidebar, fokus aktif |
| **Forest Deep** | `#3e5510` | `Color(0xff2e5b32)` | Gradasi bawah sidebar, status disetujui, teks sukses kuat |
| **Forest Light** | `#dcebd9` | `Color(0xffedf4e4)` | Avatar background, hover menu sidebar, seleksi aktif |
| **Dark Charcoal / Ink** | `#191d17` | `Color(0xff0f172a)` | Warna teks utama, judul tebal, kontras tinggi |
| **Slate Muted** | `#737b6c` | `Color(0xff64748b)` | Teks sekunder, label formulir, keterangan waktu |
| **Border Line** | `#dfe4d9` | `Color(0xffe2e8f0)` | Garis pembatas kartu, tabel border, divider |
| **Canvas / Background** | `#f8f9f5` | `Color(0xfff9f9ff)` | Latar belakang halaman aplikasi |
| **Card Surface** | `#ffffff` | `Colors.white` | Latar kartu dashboard, form container, modal |

---

### 2.2 Status Semantik (Semantic Status Colors)

Digunakan secara konsisten untuk badge status pengiriman inbound/outbound, stok kritis, dan alert audit:

```
🟢 SUCCESS / RECEIVED / IN-STOCK
   Background: #f0fdf4 (Light Mint) | Border: #86efac | Text: #166534 / #16a34a

🔵 INSPECTING / ARRIVED / ACTIVE DOCK
   Background: #ecfeff (Soft Cyan) | Border: #67e8f9 | Text: #0e7490 / #0891b2

🟡 SCHEDULED / PENDING / WARNING
   Background: #fef3c7 (Warm Amber) | Border: #fde68a | Text: #92400e / #d97706

🔴 ISSUE / CRITICAL / DAMAGED / REJECTED
   Background: #fdecec (Light Rose) | Border: #fca5a5 | Text: #8a5a5b / #e11d48
```

---

## 3. Tipografi (Typography System)

SUSUNO menggunakan keluarga font **Inter** untuk keterbacaan optimal pada teks angka, kode SKU, dan label status.

### 3.1 Skala Ukuran Font (Web Hierarchy)

| Level | Size | Weight | Line Height | Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **Display H1** | `44px` / `2.75rem` | `800` (ExtraBold) | `1.2` (letter-spacing: -1.1px) | Judul halaman utama (*Dashboard, Inbound, Inventory*) |
| **Page Title H2** | `24px` - `28px` | `700` (Bold) | `1.3` | Judul sub-halaman & modal heading |
| **Section Title** | `20px` | `700` (Bold) | `1.3` (letter-spacing: -0.3px) | Judul kartu dashboard & tabel |
| **Card / Subhead** | `15px` - `16px` | `600` / `700` | `1.4` | Header pengiriman, nama supplier |
| **Body Standard** | `13px` - `14px` | `400` / `500` | `1.5` | Paragraf penjelasan, isi sel tabel |
| **Caption / Meta** | `11px` - `12px` | `400` / `500` | `1.4` | Subtext, waktu kedatangan, label PO |
| **Micro Tag** | `10px` | `700` (Bold) | `1.2` (uppercase) | Status pills, badge peran |
| **Monospace / SKU** | `12px` - `13px` | `600` | - | Barcode kemasan, SKU produk, Rak koordinat |

### 3.2 Tipografi Mobile (Flutter)

Mobile App SUSUNO Redesign menggunakan keluarga font **Plus Jakarta Sans** (*assets/fonts/*) untuk keterbacaan ergonomis optimal di lingkungan gudang:
- **Font Family**: `Plus Jakarta Sans` (Weights: `Regular 400`, `Medium 500`, `SemiBold 600`, `Bold 700`, `ExtraBold 800`).
- **AppBar Title**: `18px` - `20px`, Bold, White (`#ffffff`).
- **Telemetry Metric Value**: `22px` - `26px`, ExtraBold (`#0f172a`).
- **Section Heading**: `13px` - `14px`, Bold (`#14532d` / `#1e293b`).
- **Body & Card Text**: `11px` - `12px`, Regular/Medium (`#334155`).
- **Tags & Barcode Badges**: `9.5px` - `10.5px`, SemiBold (`║▌║ SKU-001`).

---

## 4. Layout, Spacing & Grid System

### 4.1 Layout Web Manager Workspace

- **Sidebar Kiri**:
  - Lebar: `256px` (Fixed).
  - Background: `linear-gradient(180deg, #5c732b 0%, #3e5510 100%)`.
  - Item Menu: Tinggi minimum `58px`, padding `12px 24px`, indikator aktif `border-left: 6px solid #dcebd9`.
- **Top Navigation Bar**:
  - Tinggi: `78px`.
  - Komponen: Search global (lebar maks `578px`, shortcut kbd `Ctrl+K`), tombol notifikasi ber-badge dot `#8a5a5b`, profil avatar bulat `44px`.
- **Main Content Area**:
  - Margin kiri: `256px`.
  - Padding: `25px 28px 18px 30px`.
  - Grid Dashboard: `grid-template-columns: minmax(0, 1.83fr) minmax(0, 1fr)`.
  - Gap antar kartu: `14px` - `20px`.

### 4.2 Spacing Scale (8pt Grid)

| Spacing Token | Pixels | Penggunaan |
| :--- | :--- | :--- |
| `space-1` | `4px` | Padding mikro badge, gap ikon kecil |
| `space-2` | `8px` | Gap antar tombol, margin input caption |
| `space-3` | `12px` | Padding dalam tombol, gap baris tabel |
| `space-4` | `16px` | Padding kartu standar, gap kolom |
| `space-5` | `20px` | Margin antar section, padding modal |
| `space-6` | `24px` | Padding layout besar, margin judul |
| `space-8` | `32px` | Margin pemisah antar modul |

---

## 5. Spesifikasi Komponen UI (Component Standards)

### 5.1 Tombol (Buttons)

1. **Tombol Primer (`.inbound-primary`)**:
   - Background: `#5c732b` (Hover: `#4c6023`).
   - Warna teks: `#ffffff` (Font-weight: `700`).
   - Border radius: `8px` - `10px`.
   - Padding: `10px 18px`.
   - Box-shadow: `0 2px 6px rgba(92, 115, 43, 0.25)`.

2. **Tombol Sekunder (`.inbound-secondary`)**:
   - Background: `#ffffff` (Hover: `#f8fafc`).
   - Border: `1px solid #cbd5e1`.
   - Warna teks: `#334155` (Font-weight: `600`).
   - Border radius: `8px`.

3. **Tombol Link (`.dashboard-link`)**:
   - Background: transparan, tanpa border.
   - Warna teks: `#5c732b` (Hover: `underline`).
   - Font-size: `12px`.

---

### 5.2 Kartu & Panel (`.dashboard-card`)

- **Latar**: `#ffffff`.
- **Border**: `1px solid #dfe4d9`.
- **Border Radius**: `14px`.
- **Padding**: `16px 20px`.
- **Shadow**: `0 1px 3px rgba(0, 0, 0, 0.04)`.

---

### 5.3 Chip Barcode Fisik (`.barcode-badge-item`)

Elemen khusus untuk menampilkan hasil pemindaian staf dok lapangan:
- **Tampilan**: `║▌║ [KODE-BARCODE]`.
- **Background**: `#ffffff`.
- **Border**: `1px solid #bae6fd`.
- **Warna Teks**: `#0369a1` (Monospace, bold).
- **Border Radius**: `6px`.
- **Padding**: `3px 8px`.
- **Micro-shadow**: `0 1px 2px rgba(2, 132, 199, 0.08)`.

---

### 5.4 Banner Notifikasi & Alur Status

1. **Banner Menunggu Cek Staf (Read-Only Manager)**:
   - Gradasi: `linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)`.
   - Border: `1px solid #7dd3fc`.
   - Ikon: `⏳`.
   - Teks Utama: `#0369a1` (15.5px, bold).
   - Teks Pendukung: `#0f766e` (13px).

2. **Banner Review Laporan Staf Dok**:
   - Gradasi: `linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)`.
   - Border: `1px solid #67e8f9`.
   - Ikon: `📱`.
   - Teks Utama: `#0e7490` (15.5px, bold).

---

### 5.5 Tabel Data Pergudangan

- **Header (`thead th`)**:
  - Background: `#f8fafc`.
  - Font: `11px`, font-weight `700`, uppercase, letter-spacing `0.5px`, color `#64748b`.
  - Border bawah: `1px solid #e2e8f0`.
- **Baris (`tbody tr`)**:
  - Padding: `12px 14px`.
  - Border bawah: `1px solid #f1f5f9`.
  - Hover: Background `#f8faf5`.
- **Kolom Kuantitas**:
  - Diterima (Accepted): Bold `#166534`.
  - Cacat / Kurang: Bold `#e11d48`.

---

## 6. Standar Interaksi Antar Peran (UX Rule)

| Peran | Perangkat | Hak Akses Input Inbound | Tampilan UI |
| :--- | :--- | :--- | :--- |
| **Manager** | Web Browser Desktop | **Read-Only** pada tahap inspeksi. Tidak dapat mengubah angka hitungan fisik lapangan. Hanya menyetujui (**ACC**) laporan staf. | Dashboard lebar, status tracking dok, banner informatif, tabel read-only, tombol ACC. |
| **Staf Dok** | Mobile App / Scanner | **Input Penuh**: input kuantitas diterima & rusak, scan barcode fisik unit per unit, foto bukti, catatan kondisi segel. | Single-column home, kartu tugas inspeksi di paling atas, tombol scan kamera/barcode, sheet konfirmasi. |

---

## 7. Aksesibilitas & State Interaktif

- **Focus Ring**: `outline: 3px solid #8a5a5b; outline-offset: 3px;` pada semua elemen interaktif yang diakses via keyboard.
- **Rasio Kontras**: Semua teks memenuhi standar WCAG AA (rasio kontras teks utama terhadap background > 4.5:1).
- **Empty States**: Menampilkan ilustrasi/ikon semantik beserta instruksi langkah selanjutnya, bukan halaman kosong.

---

*Dokumen ini dirawat sebagai standar acuan desain untuk pengembangan modul Web dan Mobile SUSUNO.*  
*Terkait: [`docs/routing.md`](file:///d:/Coding/Susuno/docs/routing.md) • [`docs/warehouse.md`](file:///d:/Coding/Susuno/docs/warehouse.md)*
