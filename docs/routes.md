# SUSUNO System Routing & File Map (`ROUTES.md`)

> **Single Source of Truth** untuk pemetaan rute, file navigasi, peran (guard / role), keterkaitan database, dan dependensi lintas modul pada sistem **SUSUNO Smart Warehouse Inventory System**.
> Dokumen ini dirancang sebagai acuan audit (`docs/audit.md`) dan pengembangan arsitektur antara **Backend**, **Web**, **Mobile**, dan **AI**.

---

## 1. Arsitektur & Prinsip Routing Global

Sistem SUSUNO terbagi menjadi 4 pilar utama yang saling terhubung:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               SUSUNO SYSTEM ARCHITECTURE                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. BACKEND SERVICE (Node.js / Express / MySQL)                                         │
│    Port: 5000 | Base URL: /api                                                         │
│    Routing: express.Router() modular per domain di folder backend/routes/              │
│    Guards: authMiddleware.verifyToken, authorizeRole('manager'), authorizeRole('staf') │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. WEB MANAGEMENT CONSOLE (React 19 / Vite / Vanilla CSS)                              │
│    Port: 5173 | Single Page Application (SPA)                                          │
│    Routing: State-driven router (`step` di src/App.jsx) + HTML5 History API Sync       │
│    Guards: manager session, localStorage ('susuno_token', 'susuno_user')              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. MOBILE APP (Flutter / Dart / Material 3)                                            │
│    Target: Android / iOS / Web Preview                                                 │
│    Routing: Indexed Shell Navigation (`s.page` di lib/screens/app_shell.dart)           │
│    Guards: WarehouseState.loggedIn, Role: Staf Lapangan                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. AI & PREDICTIVE ANALYTICS                                                           │
│    Folder: ai/ | Integrasi: Web (AIInsight.jsx) + Mobile (insight_screen.dart)         │
│    Database: ai_predictions | Heuristik: src/utils/aiInsights.js                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. BACKEND ROUTING & FILE MAP (`backend/`)

Server utama di-bootstrap melalui `backend/server.js`. Semua rute diakses melalui prefix `/api`.

### 2.1 Konfigurasi & Core Backend
| File Path | Komponen | Peran & Deskripsi |
|---|---|---|
| `backend/server.js` | Express Server App | Entry point backend, registrasi CORS, body parser JSON 25MB, static `/uploads`, dan mounting seluruh rute API. |
| `backend/config/db.js` | MySQL Connection Pool | Mengelola koneksi database MySQL menggunakan `mysql2/promise` dengan pooling terisolasi. |
| `backend/config/initCategories.js` | Data Seeder | Menginisialisasi kategori default gudang pada startup aplikasi jika tabel kosong. |
| `backend/middlewares/authMiddleware.js` | JWT Guard & RBAC | `verifyToken`: validasi Bearer JWT token.<br>`authorizeRole(...roles)`: proteksi berbasis role (`manager` atau `staf`). |
| `backend/utils/audit.js` | Audit Logger Utility | Helper pencatatan mutasi data otomatis ke tabel `audit_logs`. |
| `backend/database/smart_warehouse_db.sql` | SQL Schema | Definisi 14 tabel database lengkap: `users`, `products`, `locations`, `suppliers`, `purchase_orders`, `purchase_order_items`, `shifts`, `attendance_logs`, `tasks`, `task_assignments`, `stock_transactions`, `audit_logs`, `ai_predictions`, `categories`. |

---

### 2.2 Endpoint API, Controller, Model & Guard Backend

| Domain / Prefix | HTTP Method & Path | Controller & Method | Model Terkait | Guard / Role | File Route |
|---|---|---|---|---|---|
| **Auth** (`/api/auth`) | `POST /login` | `authController.login` | `userModel.js` | `Public` | `backend/routes/authRoute.js:7` |
| | `POST /register` | `authController.register` | `userModel.js` | `manager` | `backend/routes/authRoute.js:6` |
| | `POST /reset-password` | `authController.resetPassword` | `userModel.js` | `Public` | `backend/routes/authRoute.js:8` |
| **Users** (`/api/users`) | `GET /` | `userController.getAll` | `userModel.js` | `manager` | `backend/routes/userRoute.js:10` |
| | `GET /:id` | `userController.getById` | `userModel.js` | `manager` | `backend/routes/userRoute.js:11` |
| | `PUT /:id` | `userController.update` | `userModel.js` | `manager` | `backend/routes/userRoute.js:12` |
| | `DELETE /:id` | `userController.remove` | `userModel.js` | `manager` | `backend/routes/userRoute.js:13` |
| | `PATCH /:id/activate` | `userController.activate` | `userModel.js` | `manager` | `backend/routes/userRoute.js:14` |
| **Products** (`/api/products`) | `GET /` | `productController.getAll` | `productModel.js` | `authenticated` | `backend/routes/productRoute.js:8` |
| | `GET /sku/:sku` | `productController.findBySku` | `productModel.js` | `authenticated` | `backend/routes/productRoute.js:9` |
| | `GET /:id` | `productController.getById` | `productModel.js` | `authenticated` | `backend/routes/productRoute.js:10` |
| | `POST /` | `productController.create` | `productModel.js` | `manager` | `backend/routes/productRoute.js:11` |
| | `PUT /:id` | `productController.update` | `productModel.js` | `manager` | `backend/routes/productRoute.js:12` |
| | `DELETE /:id` | `productController.remove` | `productModel.js` | `manager` | `backend/routes/productRoute.js:13` |
| **Categories** (`/api/categories`) | `GET /` | `categoryController.getAll` | `categoryModel.js` | `authenticated` | `backend/routes/categoryRoute.js:7` |
| | `GET /:id` | `categoryController.getById` | `categoryModel.js` | `authenticated` | `backend/routes/categoryRoute.js:8` |
| | `POST /` | `categoryController.create` | `categoryModel.js` | `manager` | `backend/routes/categoryRoute.js:9` |
| | `PUT /:id` | `categoryController.update` | `categoryModel.js` | `manager` | `backend/routes/categoryRoute.js:10` |
| | `DELETE /:id` | `categoryController.remove` | `categoryModel.js` | `manager` | `backend/routes/categoryRoute.js:11` |
| **Locations** (`/api/locations`) | `GET /` | `locationController.getAll` | `locationModel.js` | `authenticated` | `backend/routes/locationRoute.js:7` |
| | `GET /:id` | `locationController.getById` | `locationModel.js` | `authenticated` | `backend/routes/locationRoute.js:8` |
| | `POST /` | `locationController.create` | `locationModel.js` | `manager` | `backend/routes/locationRoute.js:9` |
| | `PUT /:id` | `locationController.update` | `locationModel.js` | `manager` | `backend/routes/locationRoute.js:10` |
| | `DELETE /:id` | `locationController.remove` | `locationModel.js` | `manager` | `backend/routes/locationRoute.js:11` |
| **Suppliers** (`/api/suppliers`) | `GET /` | `supplierController.getAll` | `supplierModel.js` | `authenticated` | `backend/routes/supplierRoute.js:7` |
| | `GET /:id` | `supplierController.getById` | `supplierModel.js` | `authenticated` | `backend/routes/supplierRoute.js:8` |
| | `POST /` | `supplierController.create` | `supplierModel.js` | `manager` | `backend/routes/supplierRoute.js:9` |
| | `PUT /:id` | `supplierController.update` | `supplierModel.js` | `manager` | `backend/routes/supplierRoute.js:10` |
| | `DELETE /:id` | `supplierController.remove` | `supplierModel.js` | `manager` | `backend/routes/supplierRoute.js:11` |
| **Purchase Orders** (`/api/purchase-orders`) | `GET /` | `purchaseOrderController.getAll` | `purchaseOrderModel.js` | `authenticated` | `backend/routes/purchaseOrderRoute.js:8` |
| | `GET /:id` | `purchaseOrderController.getById` | `purchaseOrderModel.js` | `authenticated` | `backend/routes/purchaseOrderRoute.js:9` |
| | `POST /` | `purchaseOrderController.create` | `purchaseOrderModel.js` | `manager` | `backend/routes/purchaseOrderRoute.js:7` |
| | `PUT /:id` | `purchaseOrderController.update` | `purchaseOrderModel.js` | `manager` | `backend/routes/purchaseOrderRoute.js:10` |
| | `PUT /:id/status` | `purchaseOrderController.updateStatus` | `purchaseOrderModel.js` | `manager` | `backend/routes/purchaseOrderRoute.js:11` |
| | `PATCH /:id/status` | `purchaseOrderController.updateStatus` | `purchaseOrderModel.js` | `manager` | `backend/routes/purchaseOrderRoute.js:12` |
| **Inbound** (`/api/inbound`) | `GET /` | `inboundController.getAll` | `inboundModel.js` | `authenticated` | `backend/routes/inboundRoute.js:5` |
| | `GET /:id` | `inboundController.getById` | `inboundModel.js` | `authenticated` | `backend/routes/inboundRoute.js:6` |
| | `POST /` | `inboundController.create` | `inboundModel.js` | `manager` | `backend/routes/inboundRoute.js:7` |
| | `PUT /:id` | `inboundController.update` | `inboundModel.js` | `manager` | `backend/routes/inboundRoute.js:8` |
| | `PUT /:id/status` | `inboundController.updateStatus` | `inboundModel.js` | `authenticated` | `backend/routes/inboundRoute.js:9` |
| | `POST /:id/inspect` | `inboundController.inspect` | `inboundModel.js` | `authenticated` | `backend/routes/inboundRoute.js:10` |
| | `PUT /:id/inspect` | `inboundController.inspect` | `inboundModel.js` | `authenticated` | `backend/routes/inboundRoute.js:11` |
| | `POST /:id/receive` | `inboundController.completeReceiving` | `inboundModel.js` | `authenticated` | `backend/routes/inboundRoute.js:12` |
| | `DELETE /:id` | `inboundController.remove` | `inboundModel.js` | `manager` | `backend/routes/inboundRoute.js:13` |
| **Outbound** (`/api/outbound`) | `GET /` | `outboundController.getAll` | `outboundModel.js` | `authenticated` | `backend/routes/outboundRoute.js:9` |
| | `GET /:id` | `outboundController.getById` | `outboundModel.js` | `authenticated` | `backend/routes/outboundRoute.js:10` |
| | `POST /` | `outboundController.create` | `outboundModel.js` | `manager` | `backend/routes/outboundRoute.js:11` |
| | `POST /:id/inspect` | `outboundController.inspect` | `outboundModel.js` | `authenticated` | `backend/routes/outboundRoute.js:12` |
| | `PUT /:id/inspect` | `outboundController.inspect` | `outboundModel.js` | `authenticated` | `backend/routes/outboundRoute.js:13` |
| | `POST /:id/dispatch` | `outboundController.dispatch` | `outboundModel.js` | `manager` | `backend/routes/outboundRoute.js:14` |
| | `POST /:id/ship` | `outboundController.dispatch` | `outboundModel.js` | `manager` | `backend/routes/outboundRoute.js:16` |
| | `PUT /:id/status` | `outboundController.updateStatus` | `outboundModel.js` | `authenticated` | `backend/routes/outboundRoute.js:17` |
| | `DELETE /:id` | `outboundController.remove` | `outboundModel.js` | `manager` | `backend/routes/outboundRoute.js:18` |
| **Stock Transactions** (`/api/stock-transactions`) | `POST /` | `stockTransactionController.create` | `stockTransactionModel.js` | `staf` | `backend/routes/stockTransactionRoute.js:7` |
| | `GET /` | `stockTransactionController.getAll` | `stockTransactionModel.js` | `manager` | `backend/routes/stockTransactionRoute.js:8` |
| | `GET /me` | `stockTransactionController.getMine` | `stockTransactionModel.js` | `authenticated` | `backend/routes/stockTransactionRoute.js:9` |
| | `GET /product/:product_id` | `stockTransactionController.getByProduct` | `stockTransactionModel.js` | `authenticated` | `backend/routes/stockTransactionRoute.js:10` |
| **Tasks** (`/api/tasks`) | `GET /` | `taskController.getAll` | `taskModel.js` | `authenticated` | `backend/routes/taskRoute.js:7` |
| | `GET /:id` | `taskController.getById` | `taskModel.js` | `authenticated` | `backend/routes/taskRoute.js:8` |
| | `GET /:id/history` | `taskController.getHistory` | `taskModel.js` | `authenticated` | `backend/routes/taskRoute.js:9` |
| | `POST /` | `taskController.create` | `taskModel.js` | `manager` | `backend/routes/taskRoute.js:10` |
| | `PATCH /:id/reassign` | `taskController.reassign` | `taskModel.js` | `manager, staf` | `backend/routes/taskRoute.js:11` |
| | `PATCH /:id/status` | `taskController.updateStatus` | `taskModel.js` | `manager, staf` | `backend/routes/taskRoute.js:12` |
| **Shifts** (`/api/shifts`) | `GET /me` | `shiftController.getMine` | `shiftModel.js` | `authenticated` | `backend/routes/shiftRoute.js:7` |
| | `GET /` | `shiftController.getAll` | `shiftModel.js` | `manager` | `backend/routes/shiftRoute.js:8` |
| | `GET /:id` | `shiftController.getById` | `shiftModel.js` | `manager` | `backend/routes/shiftRoute.js:9` |
| | `POST /` | `shiftController.create` | `shiftModel.js` | `manager` | `backend/routes/shiftRoute.js:10` |
| | `PUT /:id` | `shiftController.update` | `shiftModel.js` | `manager` | `backend/routes/shiftRoute.js:11` |
| | `DELETE /:id` | `shiftController.remove` | `shiftModel.js` | `manager` | `backend/routes/shiftRoute.js:12` |
| **Attendances** (`/api/attendances`) | `POST /check-in` | `attendanceController.checkIn` | `attendanceModel.js` | `staf` | `backend/routes/attendanceRoute.js:7` |
| | `POST /check-out` | `attendanceController.checkOut` | `attendanceModel.js` | `staf` | `backend/routes/attendanceRoute.js:8` |
| | `GET /me` | `attendanceController.getMine` | `attendanceModel.js` | `staf` | `backend/routes/attendanceRoute.js:9` |
| | `GET /` | `attendanceController.getAll` | `attendanceModel.js` | `manager` | `backend/routes/attendanceRoute.js:10` |
| **Audit Logs** (`/api/audit-logs`) | `GET /` | `auditLogController.getAll` | `auditLogModel.js` | `manager` | `backend/routes/auditLogRoute.js:7` |
| **Uploads** (`/api/upload`) | `POST /` | Multer Disk Storage | N/A (`backend/uploads/`) | `authenticated` | `backend/routes/uploadRoute.js:29` |
| **App OTA Update** (`/api/app`) | `GET /latest` | `appUpdateRoute` | `appVersion.json` | `Public` | `backend/routes/appUpdateRoute.js:14` |
| | `GET /download` | `appUpdateRoute` | File APK (`backend/uploads/susuno-mobile.apk`) | `Public` | `backend/routes/appUpdateRoute.js:29` |
| | `POST /publish` | `appUpdateRoute` | Multer APK Upload | `manager` | `backend/routes/appUpdateRoute.js:51` |

---

## 3. WEB ROUTING & FILE MAP (`web/`)

Web frontend berbasis **React 19 + Vite** menggunakan router berbasis state internal di [`web/src/App.jsx`](file:///d:/Coding/Susuno/web/src/App.jsx) (`step` state) yang disinkronisasikan dua arah secara real-time dengan **HTML5 History API** (`window.history.pushState` dan listener `popstate`). Hal ini memungkinkan bilah alamat / search bar URL browser selalu menampilkan rute aktif (`/inbound`, `/inventory`, `/dashboard`, dll), mendukung tombol Back/Forward browser, serta dapat diakses langsung (*direct link load*).

### 3.1 Peta Rute Navigasi Web (`App.jsx` -> `step`)

| Route / Step Identifier | Halaman Utama (`File:Line`) | Guard / Role | Komponen Sub-fitur | File Styling Terkait | Layanan & Utilitas |
|---|---|---|---|---|---|
| `manager` | [`pages/SignUp.jsx`](file:///d:/Coding/Susuno/web/src/pages/SignUp.jsx) (App.jsx:2320) | `Public / Guest` | `SignUpSteps`, `BrandPanel`, `FormField`, `PasswordInput` | `styles/signup.css` | Inisiasi profil manager pendaftaran baru. |
| `warehouse` | [`pages/WarehouseSetup.jsx`](file:///d:/Coding/Susuno/web/src/pages/WarehouseSetup.jsx) (App.jsx:2310) | `Onboarding Guest` | `SignUpSteps`, `BrandPanel`, `FormField` | `styles/signup.css` | Konfigurasi awal identitas & kode gudang fisik. |
| `security` | [`pages/SecuritySetup.jsx`](file:///d:/Coding/Susuno/web/src/pages/SecuritySetup.jsx) (App.jsx:2292) | `Onboarding Guest` | `SignUpSteps`, `BrandPanel`, `FormField`, `PasswordInput` | `styles/signup.css` | Pengaturan kata sandi dan proteksi akun baru. |
| `signin` | [`pages/SignIn.jsx`](file:///d:/Coding/Susuno/web/src/pages/SignIn.jsx) (App.jsx:2281) | `Public / Guest` | `BrandPanel`, `FormField`, `PasswordInput` | `styles/signup.css` | Otentikasi manajer ke sistem Susuno. Memanggil `POST /api/auth/login`. |
| `forgot` | [`pages/ForgotPassword.jsx`](file:///d:/Coding/Susuno/web/src/pages/ForgotPassword.jsx) (App.jsx:2238) | `Public / Guest` | `RecoveryLayout`, `FormField` | `styles/recovery.css` | Permintaan pemulihan sandi via email. |
| `reset-link-sent` | [`pages/ResetLinkSent.jsx`](file:///d:/Coding/Susuno/web/src/pages/ResetLinkSent.jsx) (App.jsx:2250) | `Public / Guest` | `RecoveryLayout` | `styles/recovery.css` | Notifikasi pengiriman tautan reset ke email target. |
| `reset-password` | [`pages/ResetPassword.jsx`](file:///d:/Coding/Susuno/web/src/pages/ResetPassword.jsx) (App.jsx:2264) | `Public / Guest` | `RecoveryLayout`, `FormField`, `PasswordInput` | `styles/recovery.css` | Formulir pembaruan sandi baru (`POST /api/auth/reset-password`). |
| `password-updated` | [`pages/PasswordUpdated.jsx`](file:///d:/Coding/Susuno/web/src/pages/PasswordUpdated.jsx) (App.jsx:2277) | `Public / Guest` | `RecoveryLayout` | `styles/recovery.css` | Konfirmasi keberhasilan pembaharuan kata sandi. |
| `manager-verification` | [`components/SessionVerification.jsx`](file:///d:/Coding/Susuno/web/src/components/SessionVerification.jsx) (App.jsx:1940) | `Manager Guarded` | Re-auth dialog box | `styles/recovery.css` | Verifikasi ulang kredensial untuk operasi berisiko tinggi. |
| `dashboard` | [`pages/Dashboard.jsx`](file:///d:/Coding/Susuno/web/src/pages/Dashboard.jsx) (App.jsx:2009) | `Manager` | `DashboardSidebar`, `WarehouseHeader`, `DashboardIcon` | `styles/dashboard.css` | Ringkasan KPI gudang, aktivitas terkini, alert stok menipis, shortcut navigasi. |
| `inbound` | [`pages/Inbound.jsx`](file:///d:/Coding/Susuno/web/src/pages/Inbound.jsx) (App.jsx:2146) | `Manager` | `ScheduledShipment`, `InboundReceiving`, `InboundIssueReview`, `CompletedReceiving`, `CreateInbound` | `styles/inbound.css`, `styles/scheduled.css`, `styles/receiving.css`, `styles/inboundIssues.css`, `styles/completedReceiving.css` | Alur penerimaan barang terintegrasi: jadwal armada masuk dari PO, inspeksi fisik dok lapangan oleh staf via Mobile (`Inspected`), review & approval manager di Web Console, dan update stok otomatis ke inventaris (bebas pemetaan rak pada tahap inbound). |
| `outbound` | [`pages/Outbound.jsx`](file:///d:/Coding/Susuno/web/src/pages/Outbound.jsx) (App.jsx:2119) | `Manager` | `ScheduledOutbound`, `OutboundFulfillment`, `OutboundIssueReview`, `CompletedOutbound`, `CreateOutbound` | `styles/outbound.css`, `styles/scheduledOutbound.css`, `styles/outboundFulfillment.css`, `styles/outboundIssueReview.css` | Alur pengiriman barang: jadwal pengiriman, validasi stok, pemungutan (picking), packing, issue barang, dispatch. |
| `purchase-orders` | [`pages/PurchaseOrders.jsx`](file:///d:/Coding/Susuno/web/src/pages/PurchaseOrders.jsx) (App.jsx:2058) | `Manager` | `PurchaseOrderFlow`, `ManagementShell` | `styles/purchaseOrders.css`, `styles/purchaseOrderFlow.css` | Siklus PO: buat order pengadaan, validasi anti self-approval, persetujuan/penolakan, konversi ke jadwal inbound, ekspor PDF. |
| `suppliers` | [`pages/Suppliers.jsx`](file:///d:/Coding/Susuno/web/src/pages/Suppliers.jsx) (App.jsx:2087) | `Manager` | `ManagementShell` | `styles/suppliers.css` | Direktori mitra pemasok, performa lead time, katalog produk terkait tiap supplier. |
| `reports` | [`pages/Reports.jsx`](file:///d:/Coding/Susuno/web/src/pages/Reports.jsx) (App.jsx:2023) | `Manager` | `ReportExport`, `ManagementShell` | `styles/reportsAudit.css` | Laporan analitik nilai valuasi inventaris, tingkat perputaran, breakdown per kategori. |
| `movement-reports` | [`pages/StockMovementReports.jsx`](file:///d:/Coding/Susuno/web/src/pages/StockMovementReports.jsx) (App.jsx:2210) | `Manager` | `MovementExport`, `ManagementShell` | `styles/reportsAudit.css` | Jejak mutasi stok terperinci (INBOUND, OUTBOUND, ADJUSTMENT, TRANSFER) berdasarkan SKU atau nomor referensi dokumen. |
| `ai-insight` | [`pages/AIInsight.jsx`](file:///d:/Coding/Susuno/web/src/pages/AIInsight.jsx) (App.jsx:2106) | `Manager` | `ManagementShell` | `styles/aiInsight.css` | Prediksi kebutuhan stok masa depan, kalkulasi safety stock, deteksi produk slow-moving & fast-moving. |
| `audit-trail` | [`pages/AuditTrail.jsx`](file:///d:/Coding/Susuno/web/src/pages/AuditTrail.jsx) (App.jsx:2044) | `Manager` | `ManagementShell` | `styles/reportsAudit.css` | Log audit kepatuhan ISO/keamanan mencatat siapa, kapan, apa yang diubah pada seluruh tabel database. |
| `staff-management` | [`pages/StaffManagement.jsx`](file:///d:/Coding/Susuno/web/src/pages/StaffManagement.jsx) (App.jsx:1944) | `Manager` | `ManagementShell` | `styles/staffSettings.css` | Manajemen staf gudang: tambah staf baru, atur shift kerja, pantau presensi kehadiran, aktivasi/deaktivasi akun. |
| `settings` | [`pages/Settings.jsx`](file:///d:/Coding/Susuno/web/src/pages/Settings.jsx) (App.jsx:1964) | `Manager` | `ManagementShell`, `PasswordInput` | `styles/staffSettings.css` | Sub-view: `home`, `warehouse`, `notifications`, `appearance` (Dark/Light mode global), `profile`, `password`. |
| *(deprecated)* | [`pages/ProductCatalog.jsx`](file:///d:/Coding/Susuno/web/src/pages/ProductCatalog.jsx) | *Deprecated* | N/A | `styles/productCatalog.css` | *Catatan: Fitur katalog produk mandiri telah digabung ke dalam detail modal menu Supplier.* |

---

### 3.2 Utilitas & Layanan Web (`web/src/utils/` & `web/src/services/`)

| File | Tanggung Jawab |
|---|---|
| `web/src/services/api.js` | Klien REST API terpadu (Fetch wrapper dengan interceptor token, penanganan error jaringan offline, mapping method ke seluruh rute backend Express). |
| `web/src/utils/aiInsights.js` | Algoritma heuristik prediksi lonjakan permintaan, estimasi waktu kehabisan stok (stockout days), dan rekomendasi restock. |
| `web/src/utils/auditTrail.js` | Parser dan formatter log aktivitas ke format laporan yang mudah dibaca manajer. |
| `web/src/utils/completedReceiving.js` | Utilitas agregasi riwayat penerimaan barang dan efisiensi durasi inspeksi dock. |
| `web/src/utils/exportMovements.js` | Generator ekspor data pergerakan barang ke format CSV. |
| `web/src/utils/inboundIssues.js` | Klasifikasi dan rekomendasi resolusi anomali barang masuk (rusak, kuantitas kurang, kemasan pecah). |
| `web/src/utils/outbound.js` | Pengelola state transisi status pesanan keluar (SCHEDULED -> ALLOCATED -> PICKED -> SHIPPED). |
| `web/src/utils/outboundFulfillment.js` | Logika kalkulasi rute pemungutan barang (picking list) dan verifikasi ketersediaan stok fisik. |
| `web/src/utils/outboundIssues.js` | Manajemen penanganan kendala fulfillment pengiriman. |
| `web/src/utils/productTypes.js` | Daftar kategori dan klasifikasi produk standar gudang. |
| `web/src/utils/productUnits.js` | Definisi satuan unit inventaris (Pcs, Box, Carton, Pallet, Kg, Liter). |
| `web/src/utils/purchaseOrderPdf.js` | Generator dokumen PDF resmi Purchase Order untuk dikirim ke pihak supplier. |
| `web/src/utils/purchaseOrderReceiving.js` | Konverter otomatis data PO yang disetujui menjadi jadwal Inbound Shipment. |
| `web/src/utils/purchaseOrders.js` | Kalkulasi nilai total, PPN, status verifikasi, dan aturan larangan self-approval. |
| `web/src/utils/receiving.js` | Helper alokasi rak fisik saat barang masuk tiba di loading dock. |
| `web/src/utils/reportData.js` | Agregator metrik inventaris untuk grafik dan ringkasan eksekutif. |
| `web/src/utils/reportExport.js` | Generator berkas ekspor laporan inventaris. |
| `web/src/utils/staffSettings.js` | Validator konfigurasi akun staf dan pembagian shift kerja. |

---

## 4. MOBILE ROUTING & FILE MAP (`mobile/`)

Aplikasi mobile dibangun dengan **Flutter** dan ditujukan khusus untuk **Staf Gudang Lapangan**.

### 4.1 Entry Point & Konfigurasi Mobile
| File Path | Komponen | Peran & Deskripsi |
|---|---|---|
| `mobile/lib/main.dart` | `SusunoApp` | Entry point Flutter. Menyediakan `ChangeNotifierProvider<WarehouseState>`, menginisialisasi tema aplikasi `appTheme`, serta menentukan rute awal: jika `loggedIn` -> `AppShell()`, jika tidak -> `LoginScreen()`. |
| `mobile/lib/core/api_config.dart` | `ApiConfig` | Konfigurasi URL backend & OTA Update: otomatis mendeteksi platform (Android emulator: `http://10.0.2.2:5000/api`, Real Device/Desktop: dinamis via `setCustomBaseUrl()`). Menyimpan konstanta versi aktif (`currentVersion: '1.0.0'`, `currentVersionCode: 1`) dan rute `/app/latest` & `/app/download`. |
| `mobile/lib/core/app_theme.dart` | `appTheme()` | Definisi tema visual Material 3 Susuno dengan tipografi **Plus Jakarta Sans** & Inter (Olive `#5c732b`, Soft Sage `#eef3e9`, Card border, mode high-contrast avionics HUD). |
| `mobile/lib/models/models.dart` | Data Models | Serialisasi model Dart: `Product`, `WarehouseStaff`, `StockTransactionItem`, `ShiftItem`, `AttendanceRecord`, `TaskItem`, `InboundShipment`, `InboundItem`. |
| `mobile/lib/services/api_service.dart` | `ApiService` | Klien HTTP Flutter (`http.Client`): login, products by SKU, transaksi stok, presensi, ambil shift, update task, inspeksi inbound (`submitInboundInspection`), dan cek pembaruan aplikasi (`checkAppUpdate`). |
| `mobile/lib/state/warehouse_state.dart` | `WarehouseState` | State management reaktif (`ChangeNotifier`): status login, profil staf, navigasi halaman aktif (`s.page`), daftar produk, riwayat transaksi, antrean inspeksi inbound dok, sinkronisasi offline. |

---

### 4.2 Peta Halaman & Navigasi Mobile (`AppShell` -> `s.page`)

Navigasi aplikasi dikelola melalui drawer samping dan bottom navigation bar di [`mobile/lib/screens/app_shell.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/app_shell.dart).

| Page Index (`s.page`) | Halaman Flutter | Guard / Role | Komponen & Widget Terkait | Fungsi & Deskripsi Operasional Staf |
|---|---|---|---|---|
| *(N/A)* | [`screens/login_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/login_screen.dart) | `Public / Staf` | `Brand`, `ui.dart`, `_showServerDialog` | Layar login staf lapangan. Dilengkapi tombol konfigurasi IP Server untuk menghubungkan HP fisik ke PC secara nirkabel (`http://192.168.x.x:5000/api`). |
| `0` | [`screens/dashboard_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/dashboard_screen.dart) | `Staf Gudang` | `TaskProgressChart`, `WarehouseSections`, `CartonMenu` | Dashboard operasional staf: tugas inspeksi dok menunggu (`Arrived`), status shift hari ini, tugas aktif, peringatan stok. |
| `1` | [`screens/stock_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/stock_screen.dart) | `Staf Gudang` | `ui.dart` (Stock badges, search filter) | Monitoring stok gudang: pencarian produk berdasarkan nama/SKU, kategori, dan pengecekan jumlah ketersediaan fisik. |
| `2` | [`screens/scanner_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/scanner_screen.dart) | `Staf Gudang` | `qr_scanner.dart`, `barcode_input.dart` | Pemindai Barcode / QR Code kamera bawaan atau input manual SKU untuk pencarian cepat, konfirmasi putaway, atau picking. |
| `3` | [`screens/alerts_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/alerts_screen.dart) | `Staf Gudang` | `ui.dart` | Notifikasi real-time: pemberitahuan barang menipis di bawah safety stock, tenggat waktu penataan barang, dan instruksi manager. |
| `4` | [`screens/activity_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/activity_screen.dart) *(audit: true)* | `Staf Gudang` | `ui.dart` | Riwayat aktivitas pencatatan dan log pergerakan stok yang telah dilakukan oleh akun staf terkait. |
| `5` | [`screens/shift_hub_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/shift_hub_screen.dart) | `Staf Gudang` | `ui.dart`, Shift cards | **Shift Hub Screen:** Hub jadwal kerja staf, kalender shift operasional, filter tanggal penugasan, dan ringkasan presensi. |
| `6` | [`screens/stock_flows.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/stock_flows.dart) | `Staf Gudang` | `StockFlows` stepper wizard | Panduan alur kerja fisik penerimaan barang masuk (Inbound Putaway) dan pemenuhan pesanan keluar (Outbound Picking). |
| `7` | [`screens/insight_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/insight_screen.dart) | `Staf Gudang` | `ui.dart` | Layar ringkasan wawasan prediksi AI untuk membantu staf mengantisipasi barang yang diprediksi akan segera habis. |
| `8` | [`screens/profile_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/profile_screen.dart) | `Staf Gudang` | Presensi button, theme toggle, Update Panel | Profil akun staf, presensi (Check-In/Out), switch tema, fast-sign PIN, serta **Panel Pembaruan Aplikasi (In-App OTA Update)** untuk unduh APK baru langsung dari server gudang. |

---

## 5. AI MODULE FILE MAP (`ai/`)

Modul kecerdasan buatan dirancang untuk mengoptimalkan efisiensi rantai pasok dan pemanfaatan kapasitas rak gudang.

| File Path | Status | Integrasi Sistem Terkait | Deskripsi & Rencana Arsitektur |
|---|---|---|---|
| `ai/README.md` | Aktif (Marker tim AI) | Repositori tim AI Damar | Penanda modul model AI peramalan kebutuhan inventaris. |
| `backend/database/smart_warehouse_db.sql` (Tabel `ai_predictions`) | Aktif di Database | Backend MySQL | Skema penyimpanan hasil inferensi AI: `id`, `product_id`, `predicted_demand`, `confidence_score`, `prediction_date`, `created_at`. |
| `web/src/pages/AIInsight.jsx` | Aktif di Web | Web Management Console | Antarmuka visualisasi prediksi stok bagi manajer: deteksi dini kehabisan stok, kalkulasi safety stock dinamis, rekomendasi kuantitas pemesanan ulang. |
| `web/src/utils/aiInsights.js` | Aktif di Web | Utilitas Heuristik Web | Logika perhitungan perkiraan run-out date, klasifikasi perputaran barang (Fast, Medium, Slow Moving), dan scoring urgensi restock. |
| `mobile/lib/screens/insight_screen.dart` | Aktif di Mobile | Mobile App Staf | Tampilan ringkas wawasan stok untuk memprioritaskan penataan dan audit fisik barang berisiko tinggi di rak. |
| *(Planned Service)* | Rencana Integrasi | `/api/ai` | Layanan inferensi berkala (cron job/FastAPI) yang membaca data historis mutasi dari `stock_transactions` dan mengunggah hasil ke `ai_predictions`. |

---

## 6. TABEL ACUAN AUDIT LINTAS FITUR (`docs/audit.md` Compliant)

Tabel berikut dirancang khusus untuk memenuhi instruksi penelusuran audit di `docs/audit.md`:

| Fitur / Alur Operasional | Web State (`step`) | Mobile View (`page`) | Backend API Endpoint | Guard / Role | File yang Harus Ditelusuri (Files to Trace) | Tabel Database Terkait |
|---|---|---|---|---|---|---|
| **Otentikasi & Profil Manajer** | `signin`, `manager`, `security` | - | `POST /api/auth/login`<br>`POST /api/auth/register` | `Public` / `manager` | `web/src/pages/SignIn.jsx`<br>`web/src/pages/SignUp.jsx`<br>`backend/controllers/authController.js`<br>`backend/models/userModel.js` | `users` |
| **Otentikasi & Presensi Staf** | - | `LoginScreen`, `ProfileScreen (8)` | `POST /api/auth/login`<br>`POST /api/attendances/check-in`<br>`POST /api/attendances/check-out` | `staf` | `mobile/lib/screens/login_screen.dart`<br>`mobile/lib/screens/profile_screen.dart`<br>`mobile/lib/services/api_service.dart`<br>`backend/controllers/attendanceController.js` | `users`, `attendance_logs` |
| **Katalog & Inventaris Produk** | `inventory` | `StockScreen (1)` | `GET /api/products`<br>`POST /api/products`<br>`PUT /api/products/:id` | `manager` (Web)<br>`staf` (Mobile) | `web/src/pages/Inventory.jsx`<br>`web/src/components/InventoryProductPanel.jsx`<br>`mobile/lib/screens/stock_screen.dart`<br>`backend/controllers/productController.js`<br>`backend/models/productModel.js` | `products`, `categories`, `locations` |
| **Penerimaan Barang (Inbound)** | `inbound` | `StockFlows (5)` | `GET /api/inbound`<br>`POST /api/inbound`<br>`POST /api/inbound/:id/inspect`<br>`POST /api/inbound/:id/receive` | `manager` / `authenticated` | `web/src/pages/Inbound.jsx`<br>`web/src/components/InboundReceiving.jsx`<br>`web/src/components/InboundIssueReview.jsx`<br>`backend/controllers/inboundController.js`<br>`backend/models/inboundModel.js` | `inbound_shipments`, `inbound_shipment_items`, `stock_transactions`, `products` |
| **Pengiriman Barang (Outbound)** | `outbound` | `ShiftHubScreen (0)` | `GET /api/outbound`<br>`POST /api/outbound`<br>`POST /api/outbound/:id/inspect`<br>`POST /api/outbound/:id/dispatch`<br>`PUT /api/outbound/:id/status` | `manager` / `authenticated` | `web/src/pages/Outbound.jsx`<br>`web/src/components/CreateOutbound.jsx`<br>`web/src/components/ScheduledOutbound.jsx`<br>`web/src/components/OutboundFulfillment.jsx`<br>`mobile/lib/screens/shift_hub_screen.dart`<br>`backend/controllers/outboundController.js`<br>`backend/models/outboundModel.js` | `outbound_shipments`, `outbound_shipment_items`, `stock_transactions`, `products` |
| **Pengadaan (Purchase Orders)** | `purchase-orders` | `OrdersScreen (7)` | `GET /api/purchase-orders`<br>`POST /api/purchase-orders`<br>`PUT /api/purchase-orders/:id/status` | `manager` | `web/src/pages/PurchaseOrders.jsx`<br>`web/src/components/PurchaseOrderFlow.jsx`<br>`web/src/utils/purchaseOrders.js`<br>`backend/controllers/purchaseOrderController.js`<br>`backend/models/purchaseOrderModel.js` | `purchase_orders`, `purchase_order_items`, `suppliers` |
| **Mitra Pemasok (Suppliers)** | `suppliers` | - | `GET /api/suppliers`<br>`POST /api/suppliers`<br>`PUT /api/suppliers/:id` | `manager` | `web/src/pages/Suppliers.jsx`<br>`backend/controllers/supplierController.js`<br>`backend/models/supplierModel.js` | `suppliers`, `products` |
| **Jejak Audit & Kepatuhan** | `audit-trail` | `ActivityScreen (4)` | `GET /api/audit-logs` | `manager` | `web/src/pages/AuditTrail.jsx`<br>`web/src/utils/auditTrail.js`<br>`mobile/lib/screens/activity_screen.dart`<br>`backend/controllers/auditLogController.js`<br>`backend/utils/audit.js` | `audit_logs` |
| **Wawasan AI & Peramalan** | `ai-insight` | `InsightScreen (6)` | - (Heuristik web / Direct table) | `manager` / `staf` | `web/src/pages/AIInsight.jsx`<br>`web/src/utils/aiInsights.js`<br>`mobile/lib/screens/insight_screen.dart` | `ai_predictions`, `products`, `stock_transactions` |
| **Manajemen Staf & Shift** | `staff-management` | `ProfileScreen (8)` | `GET /api/users`<br>`GET /api/shifts`<br>`POST /api/shifts` | `manager` | `web/src/pages/StaffManagement.jsx`<br>`web/src/utils/staffSettings.js`<br>`backend/controllers/userController.js`<br>`backend/controllers/shiftController.js` | `users`, `shifts`, `attendance_logs` |
| **Pemindaian QR/Barcode Fisik** | - | `ScannerScreen (2)` | `GET /api/products/sku/:sku` | `staf` | `mobile/lib/screens/scanner_screen.dart`<br>`mobile/lib/widgets/qr_scanner.dart`<br>`mobile/lib/widgets/barcode_input.dart`<br>`backend/controllers/productController.js` | `products`, `locations` |

---

## 7. Alur Terintegrasi: Supplier → Purchase Order → Inbound → Inventory Putaway

Alur rantai pasok Susuno telah disinkronkan secara end-to-end:
1. **Supplier & Katalog (`Suppliers.jsx`):**
   - Mendaftarkan data mitra vendor dan katalog penawaran barang mereka (nama, SKU, harga beli satuan, kategori).
   - Status: Stok awal 0, berfungsi sebagai referensi pengadaan resmi sebelum barang dibeli.
2. **Purchase Order (`PurchaseOrders.jsx`):**
   - Saat memilih supplier tertentu, form pemesanan otomatis memprioritaskan dan memuat katalog resmi milik supplier tersebut lengkap dengan SKU dan harga beli.
   - Manager menyetujui PO (`Approved`). Aturan anti self-approval aktif mencegah pembuat PO menyetujui pesanannya sendiri.
3. **Auto-Scheduling ke Inbound (`App.jsx` -> `decidePO`):**
   - Begitu status PO menjadi `Approved`, sistem **secara otomatis** menjadwalkan kedatangan pengiriman truk di Inbound (`INB-xxxx`, status `Scheduled`).
   - Tombol **"Buka Pengiriman Inbound (Dock)"** di halaman PO menampilkan status truk dan langsung membuka shipment terkait di Inbound.
4. **Dock Inspection & Receiving (`InboundReceiving.jsx`):**
   - Staf dock memeriksa jumlah dan kondisi fisik barang saat tiba (`Arrived` -> `Inspecting`).
   - **Tanpa Alokasi Rak**: Tahapan pemilihan rak gudang telah dihapus dari Inbound agar staf dock fokus verifikasi fisik kuantitas dan kondisi barang.
   - Barang bagus (*Good condition*) langsung disetujui masuk inventaris gudang.
   - Barang bermasalah (*Damaged / Rejected*) dicatat bersama bukti foto/dokumen sebagai issue dan tidak menambah stok aktif.
5. **Penyelesaian Penerimaan (`completeReceiving` & `backend/models/inboundModel.js`):**
   - Menambah stok produk di master `products` (`stock_quantity`).
   - Mencatat mutasi ke `stock_transactions` (tipe `in`).
   - Otomatis memperbarui item PO menjadi diterima (*Received*) dan menutup PO jika seluruh unit telah lengkap.
   - Mengubah status PO terkait menjadi `Received` (atau `Partially Received` jika ada unit rusak/kurang).

---

## 8. Catatan Pemeliharaan & Aturan Update

1. **Sinkronisasi Saat Tambah Endpoint Baru:** Bila menambahkan rute Express di `backend/routes/`, wajib menambahkan entri di Seksi 2 dan Seksi 6 dokumen ini beserta guard role yang ditetapkan.
2. **Sinkronisasi Web Step:** Bila menambahkan halaman baru di Web, daftarkan nilai `step` di Seksi 3.1 beserta komponen dan sub-komponennya.
3. **Sinkronisasi Mobile Screen:** Bila menambahkan layar di Flutter, daftarkan `s.page` index di Seksi 4.2.
4. **Kepatuhan Audit:** Auditor wajib membaca dokumen ini terlebih dahulu sebelum membuka file kode sebagaimana diatur pada `docs/audit.md`.
