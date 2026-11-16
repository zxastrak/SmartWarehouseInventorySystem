# SUSUNO System Routing & File Map (`routing.md`)

> **Dokumen Peta Rute & File Lengkap (Backend, Web, Mobile, AI)**  
> **Aplikasi:** SUSUNO Smart Warehouse Inventory System  
> **Dokumen Kepatuhan Audit:** Sinkron dengan [`docs/routes.md`](file:///d:/Coding/Susuno/docs/routes.md), [`docs/development-rules.md`](file:///d:/Coding/Susuno/docs/development-rules.md), dan [`docs/audit.md`](file:///d:/Coding/Susuno/docs/audit.md).

---

## 1. Arsitektur Global & Rangkuman Ekosistem

SUSUNO Smart Warehouse Inventory System dibangun di atas 4 modul utama:
- **Backend (`backend/`)**: REST API berbasis Node.js Express & MySQL (`smart_warehouse_db`).
- **Web Management Console (`web/`)**: Single Page Application (SPA) berbasis React 19, Vite, dan Vanilla CSS murni untuk Warehouse Manager.
- **Mobile Application (`mobile/`)**: Aplikasi mobile berbasis Flutter (Material 3) untuk Staf Lapangan Gudang.
- **AI Analytics (`ai/`)**: Modul peramalan kebutuhan stok, deteksi anomali, dan optimasi kapasitas ruang gudang.

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
│    Routing: State-driven router (`step` state di src/App.jsx)                          │
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

### 2.1 File Inti & Konfigurasi Backend
- [backend/server.js](file:///d:/Coding/Susuno/backend/server.js): Entry point Express, registrasi CORS, body parser JSON limit 25MB, static `/uploads`, dan mounting 15 rute API modular.
- [backend/config/db.js](file:///d:/Coding/Susuno/backend/config/db.js): Konfigurasi koneksi MySQL pool menggunakan `mysql2/promise`.
- [backend/config/initCategories.js](file:///d:/Coding/Susuno/backend/config/initCategories.js): Seeder kategori gudang default pada saat aplikasi pertama kali menyala.
- [backend/middlewares/authMiddleware.js](file:///d:/Coding/Susuno/backend/middlewares/authMiddleware.js): Middleware otentikasi JWT (`verifyToken`) dan otorisasi peran (`authorizeRole('manager')`, `authorizeRole('staf')`).
- [backend/utils/audit.js](file:///d:/Coding/Susuno/backend/utils/audit.js): Utilitas helper pencatatan otomatis ke tabel `audit_logs`.
- [backend/database/smart_warehouse_db.sql](file:///d:/Coding/Susuno/backend/database/smart_warehouse_db.sql): Skema DDL 14 tabel database lengkap.

### 2.2 Rute API, Controller, Model & Guard Backend

| Domain / Prefix | HTTP Method & Path | Controller & Handler | Model File | Guard / Role | File Route |
|---|---|---|---|---|---|
| **Auth** (`/api/auth`) | `POST /login` | `authController.login` | `userModel.js` | `Public` | [`backend/routes/authRoute.js`](file:///d:/Coding/Susuno/backend/routes/authRoute.js#L7) |
| | `POST /register` | `authController.register` | `userModel.js` | `manager` | [`backend/routes/authRoute.js`](file:///d:/Coding/Susuno/backend/routes/authRoute.js#L6) |
| | `POST /reset-password` | `authController.resetPassword` | `userModel.js` | `Public` | [`backend/routes/authRoute.js`](file:///d:/Coding/Susuno/backend/routes/authRoute.js#L8) |
| **Users** (`/api/users`) | `GET /` | `userController.getAll` | `userModel.js` | `manager` | [`backend/routes/userRoute.js`](file:///d:/Coding/Susuno/backend/routes/userRoute.js#L10) |
| | `GET /:id` | `userController.getById` | `userModel.js` | `manager` | [`backend/routes/userRoute.js`](file:///d:/Coding/Susuno/backend/routes/userRoute.js#L11) |
| | `PUT /:id` | `userController.update` | `userModel.js` | `manager` | [`backend/routes/userRoute.js`](file:///d:/Coding/Susuno/backend/routes/userRoute.js#L12) |
| | `DELETE /:id` | `userController.remove` | `userModel.js` | `manager` | [`backend/routes/userRoute.js`](file:///d:/Coding/Susuno/backend/routes/userRoute.js#L13) |
| | `PATCH /:id/activate` | `userController.activate` | `userModel.js` | `manager` | [`backend/routes/userRoute.js`](file:///d:/Coding/Susuno/backend/routes/userRoute.js#L14) |
| **Products** (`/api/products`) | `GET /` | `productController.getAll` | `productModel.js` | `authenticated` | [`backend/routes/productRoute.js`](file:///d:/Coding/Susuno/backend/routes/productRoute.js#L8) |
| | `GET /sku/:sku` | `productController.findBySku` | `productModel.js` | `authenticated` | [`backend/routes/productRoute.js`](file:///d:/Coding/Susuno/backend/routes/productRoute.js#L9) |
| | `GET /:id` | `productController.getById` | `productModel.js` | `authenticated` | [`backend/routes/productRoute.js`](file:///d:/Coding/Susuno/backend/routes/productRoute.js#L10) |
| | `POST /` | `productController.create` | `productModel.js` | `manager` | [`backend/routes/productRoute.js`](file:///d:/Coding/Susuno/backend/routes/productRoute.js#L11) |
| | `PUT /:id` | `productController.update` | `productModel.js` | `manager` | [`backend/routes/productRoute.js`](file:///d:/Coding/Susuno/backend/routes/productRoute.js#L12) |
| | `DELETE /:id` | `productController.remove` | `productModel.js` | `manager` | [`backend/routes/productRoute.js`](file:///d:/Coding/Susuno/backend/routes/productRoute.js#L13) |
| **Categories** (`/api/categories`) | `GET /` | `categoryController.getAll` | `categoryModel.js` | `authenticated` | [`backend/routes/categoryRoute.js`](file:///d:/Coding/Susuno/backend/routes/categoryRoute.js#L7) |
| | `GET /:id` | `categoryController.getById` | `categoryModel.js` | `authenticated` | [`backend/routes/categoryRoute.js`](file:///d:/Coding/Susuno/backend/routes/categoryRoute.js#L8) |
| | `POST /` | `categoryController.create` | `categoryModel.js` | `manager` | [`backend/routes/categoryRoute.js`](file:///d:/Coding/Susuno/backend/routes/categoryRoute.js#L9) |
| | `PUT /:id` | `categoryController.update` | `categoryModel.js` | `manager` | [`backend/routes/categoryRoute.js`](file:///d:/Coding/Susuno/backend/routes/categoryRoute.js#L10) |
| | `DELETE /:id` | `categoryController.remove` | `categoryModel.js` | `manager` | [`backend/routes/categoryRoute.js`](file:///d:/Coding/Susuno/backend/routes/categoryRoute.js#L11) |
| **Locations** (`/api/locations`) | `GET /` | `locationController.getAll` | `locationModel.js` | `authenticated` | [`backend/routes/locationRoute.js`](file:///d:/Coding/Susuno/backend/routes/locationRoute.js#L7) |
| | `GET /:id` | `locationController.getById` | `locationModel.js` | `authenticated` | [`backend/routes/locationRoute.js`](file:///d:/Coding/Susuno/backend/routes/locationRoute.js#L8) |
| | `POST /` | `locationController.create` | `locationModel.js` | `manager` | [`backend/routes/locationRoute.js`](file:///d:/Coding/Susuno/backend/routes/locationRoute.js#L9) |
| | `PUT /:id` | `locationController.update` | `locationModel.js` | `manager` | [`backend/routes/locationRoute.js`](file:///d:/Coding/Susuno/backend/routes/locationRoute.js#L10) |
| | `DELETE /:id` | `locationController.remove` | `locationModel.js` | `manager` | [`backend/routes/locationRoute.js`](file:///d:/Coding/Susuno/backend/routes/locationRoute.js#L11) |
| **Suppliers** (`/api/suppliers`) | `GET /` | `supplierController.getAll` | `supplierModel.js` | `authenticated` | [`backend/routes/supplierRoute.js`](file:///d:/Coding/Susuno/backend/routes/supplierRoute.js#L7) |
| | `GET /:id` | `supplierController.getById` | `supplierModel.js` | `authenticated` | [`backend/routes/supplierRoute.js`](file:///d:/Coding/Susuno/backend/routes/supplierRoute.js#L8) |
| | `POST /` | `supplierController.create` | `supplierModel.js` | `manager` | [`backend/routes/supplierRoute.js`](file:///d:/Coding/Susuno/backend/routes/supplierRoute.js#L9) |
| | `PUT /:id` | `supplierController.update` | `supplierModel.js` | `manager` | [`backend/routes/supplierRoute.js`](file:///d:/Coding/Susuno/backend/routes/supplierRoute.js#L10) |
| | `DELETE /:id` | `supplierController.remove` | `supplierModel.js` | `manager` | [`backend/routes/supplierRoute.js`](file:///d:/Coding/Susuno/backend/routes/supplierRoute.js#L11) |
| **Purchase Orders** (`/api/purchase-orders`) | `GET /` | `purchaseOrderController.getAll` | `purchaseOrderModel.js` | `authenticated` | [`backend/routes/purchaseOrderRoute.js`](file:///d:/Coding/Susuno/backend/routes/purchaseOrderRoute.js#L8) |
| | `GET /:id` | `purchaseOrderController.getById` | `purchaseOrderModel.js` | `authenticated` | [`backend/routes/purchaseOrderRoute.js`](file:///d:/Coding/Susuno/backend/routes/purchaseOrderRoute.js#L9) |
| | `POST /` | `purchaseOrderController.create` | `purchaseOrderModel.js` | `manager` | [`backend/routes/purchaseOrderRoute.js`](file:///d:/Coding/Susuno/backend/routes/purchaseOrderRoute.js#L7) |
| | `PUT /:id` | `purchaseOrderController.update` | `purchaseOrderModel.js` | `manager` | [`backend/routes/purchaseOrderRoute.js`](file:///d:/Coding/Susuno/backend/routes/purchaseOrderRoute.js#L10) |
| | `PUT /:id/status` | `purchaseOrderController.updateStatus` | `purchaseOrderModel.js` | `manager` | [`backend/routes/purchaseOrderRoute.js`](file:///d:/Coding/Susuno/backend/routes/purchaseOrderRoute.js#L11) |
| | `PATCH /:id/status` | `purchaseOrderController.updateStatus` | `purchaseOrderModel.js` | `manager` | [`backend/routes/purchaseOrderRoute.js`](file:///d:/Coding/Susuno/backend/routes/purchaseOrderRoute.js#L12) |
| **Inbound** (`/api/inbound`) | `GET /` | `inboundController.getAll` | `inboundModel.js` | `authenticated` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L5) |
| | `GET /:id` | `inboundController.getById` | `inboundModel.js` | `authenticated` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L6) |
| | `POST /` | `inboundController.create` | `inboundModel.js` | `manager` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L7) |
| | `PUT /:id` | `inboundController.update` | `inboundModel.js` | `manager` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L8) |
| | `PUT /:id/status` | `inboundController.updateStatus` | `inboundModel.js` | `authenticated` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L9) |
| | `POST /:id/inspect` | `inboundController.inspect` | `inboundModel.js` | `authenticated` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L10) |
| | `PUT /:id/inspect` | `inboundController.inspect` | `inboundModel.js` | `authenticated` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L11) |
| | `POST /:id/receive` | `inboundController.completeReceiving` | `inboundModel.js` | `authenticated` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L12) |
| | `DELETE /:id` | `inboundController.remove` | `inboundModel.js` | `manager` | [`backend/routes/inboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/inboundRoute.js#L13) |
| **Outbound** (`/api/outbound`) | `GET /` | `outboundController.getAll` | `outboundModel.js` | `authenticated` | [`backend/routes/outboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/outboundRoute.js#L5) |
| | `GET /:id` | `outboundController.getById` | `outboundModel.js` | `authenticated` | [`backend/routes/outboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/outboundRoute.js#L6) |
| | `POST /` | `outboundController.create` | `outboundModel.js` | `manager` | [`backend/routes/outboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/outboundRoute.js#L7) |
| | `PUT /:id/status` | `outboundController.updateStatus` | `outboundModel.js` | `authenticated` | [`backend/routes/outboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/outboundRoute.js#L8) |
| | `DELETE /:id` | `outboundController.remove` | `outboundModel.js` | `manager` | [`backend/routes/outboundRoute.js`](file:///d:/Coding/Susuno/backend/routes/outboundRoute.js#L9) |
| **Stock Transactions** (`/api/stock-transactions`) | `POST /` | `stockTransactionController.create` | `stockTransactionModel.js` | `staf` | [`backend/routes/stockTransactionRoute.js`](file:///d:/Coding/Susuno/backend/routes/stockTransactionRoute.js#L7) |
| | `GET /` | `stockTransactionController.getAll` | `stockTransactionModel.js` | `manager` | [`backend/routes/stockTransactionRoute.js`](file:///d:/Coding/Susuno/backend/routes/stockTransactionRoute.js#L8) |
| | `GET /me` | `stockTransactionController.getMine` | `stockTransactionModel.js` | `authenticated` | [`backend/routes/stockTransactionRoute.js`](file:///d:/Coding/Susuno/backend/routes/stockTransactionRoute.js#L9) |
| | `GET /product/:product_id` | `stockTransactionController.getByProduct` | `stockTransactionModel.js` | `authenticated` | [`backend/routes/stockTransactionRoute.js`](file:///d:/Coding/Susuno/backend/routes/stockTransactionRoute.js#L10) |
| **Tasks** (`/api/tasks`) | `GET /` | `taskController.getAll` | `taskModel.js` | `authenticated` | [`backend/routes/taskRoute.js`](file:///d:/Coding/Susuno/backend/routes/taskRoute.js#L7) |
| | `GET /:id` | `taskController.getById` | `taskModel.js` | `authenticated` | [`backend/routes/taskRoute.js`](file:///d:/Coding/Susuno/backend/routes/taskRoute.js#L8) |
| | `GET /:id/history` | `taskController.getHistory` | `taskModel.js` | `authenticated` | [`backend/routes/taskRoute.js`](file:///d:/Coding/Susuno/backend/routes/taskRoute.js#L9) |
| | `POST /` | `taskController.create` | `taskModel.js` | `manager` | [`backend/routes/taskRoute.js`](file:///d:/Coding/Susuno/backend/routes/taskRoute.js#L10) |
| | `PATCH /:id/reassign` | `taskController.reassign` | `taskModel.js` | `manager, staf` | [`backend/routes/taskRoute.js`](file:///d:/Coding/Susuno/backend/routes/taskRoute.js#L11) |
| | `PATCH /:id/status` | `taskController.updateStatus` | `taskModel.js` | `manager, staf` | [`backend/routes/taskRoute.js`](file:///d:/Coding/Susuno/backend/routes/taskRoute.js#L12) |
| **Shifts** (`/api/shifts`) | `GET /me` | `shiftController.getMine` | `shiftModel.js` | `authenticated` | [`backend/routes/shiftRoute.js`](file:///d:/Coding/Susuno/backend/routes/shiftRoute.js#L7) |
| | `GET /` | `shiftController.getAll` | `shiftModel.js` | `manager` | [`backend/routes/shiftRoute.js`](file:///d:/Coding/Susuno/backend/routes/shiftRoute.js#L8) |
| | `GET /:id` | `shiftController.getById` | `shiftModel.js` | `manager` | [`backend/routes/shiftRoute.js`](file:///d:/Coding/Susuno/backend/routes/shiftRoute.js#L9) |
| | `POST /` | `shiftController.create` | `shiftModel.js` | `manager` | [`backend/routes/shiftRoute.js`](file:///d:/Coding/Susuno/backend/routes/shiftRoute.js#L10) |
| | `PUT /:id` | `shiftController.update` | `shiftModel.js` | `manager` | [`backend/routes/shiftRoute.js`](file:///d:/Coding/Susuno/backend/routes/shiftRoute.js#L11) |
| | `DELETE /:id` | `shiftController.remove` | `shiftModel.js` | `manager` | [`backend/routes/shiftRoute.js`](file:///d:/Coding/Susuno/backend/routes/shiftRoute.js#L12) |
| **Attendances** (`/api/attendances`) | `POST /check-in` | `attendanceController.checkIn` | `attendanceModel.js` | `staf` | [`backend/routes/attendanceRoute.js`](file:///d:/Coding/Susuno/backend/routes/attendanceRoute.js#L7) |
| | `POST /check-out` | `attendanceController.checkOut` | `attendanceModel.js` | `staf` | [`backend/routes/attendanceRoute.js`](file:///d:/Coding/Susuno/backend/routes/attendanceRoute.js#L8) |
| | `GET /me` | `attendanceController.getMine` | `attendanceModel.js` | `staf` | [`backend/routes/attendanceRoute.js`](file:///d:/Coding/Susuno/backend/routes/attendanceRoute.js#L9) |
| | `GET /` | `attendanceController.getAll` | `attendanceModel.js` | `manager` | [`backend/routes/attendanceRoute.js`](file:///d:/Coding/Susuno/backend/routes/attendanceRoute.js#L10) |
| **Audit Logs** (`/api/audit-logs`) | `GET /` | `auditLogController.getAll` | `auditLogModel.js` | `manager` | [`backend/routes/auditLogRoute.js`](file:///d:/Coding/Susuno/backend/routes/auditLogRoute.js#L7) |
| **Uploads** (`/api/upload`) | `POST /` | Multer Disk Storage | N/A | `authenticated` | [`backend/routes/uploadRoute.js`](file:///d:/Coding/Susuno/backend/routes/uploadRoute.js#L29) |

---

## 3. WEB ROUTING & FILE MAP (`web/`)

Web frontend SUSUNO menggunakan state routing (`step`) di [web/src/App.jsx](file:///d:/Coding/Susuno/web/src/App.jsx).

### 3.1 Peta Halaman & Routing Web

| State `step` | Halaman Utama (`File:Line`) | Guard / Role | Komponen Sub-fitur | File CSS |
|---|---|---|---|---|
| `manager` | [`pages/SignUp.jsx`](file:///d:/Coding/Susuno/web/src/pages/SignUp.jsx) (App.jsx:2320) | `Public / Guest` | `SignUpSteps`, `BrandPanel`, `FormField`, `PasswordInput` | `styles/signup.css` |
| `warehouse` | [`pages/WarehouseSetup.jsx`](file:///d:/Coding/Susuno/web/src/pages/WarehouseSetup.jsx) (App.jsx:2310) | `Onboarding Guest` | `SignUpSteps`, `BrandPanel`, `FormField` | `styles/signup.css` |
| `security` | [`pages/SecuritySetup.jsx`](file:///d:/Coding/Susuno/web/src/pages/SecuritySetup.jsx) (App.jsx:2292) | `Onboarding Guest` | `SignUpSteps`, `BrandPanel`, `FormField`, `PasswordInput` | `styles/signup.css` |
| `signin` | [`pages/SignIn.jsx`](file:///d:/Coding/Susuno/web/src/pages/SignIn.jsx) (App.jsx:2281) | `Public / Guest` | `BrandPanel`, `FormField`, `PasswordInput` | `styles/signup.css` |
| `forgot` | [`pages/ForgotPassword.jsx`](file:///d:/Coding/Susuno/web/src/pages/ForgotPassword.jsx) (App.jsx:2238) | `Public / Guest` | `RecoveryLayout`, `FormField` | `styles/recovery.css` |
| `reset-link-sent` | [`pages/ResetLinkSent.jsx`](file:///d:/Coding/Susuno/web/src/pages/ResetLinkSent.jsx) (App.jsx:2250) | `Public / Guest` | `RecoveryLayout` | `styles/recovery.css` |
| `reset-password` | [`pages/ResetPassword.jsx`](file:///d:/Coding/Susuno/web/src/pages/ResetPassword.jsx) (App.jsx:2264) | `Public / Guest` | `RecoveryLayout`, `FormField`, `PasswordInput` | `styles/recovery.css` |
| `password-updated` | [`pages/PasswordUpdated.jsx`](file:///d:/Coding/Susuno/web/src/pages/PasswordUpdated.jsx) (App.jsx:2277) | `Public / Guest` | `RecoveryLayout` | `styles/recovery.css` |
| `manager-verification`| [`components/SessionVerification.jsx`](file:///d:/Coding/Susuno/web/src/components/SessionVerification.jsx) (App.jsx:1940) | `Manager Guarded` | Re-auth dialog box | `styles/recovery.css` |
| `dashboard` | [`pages/Dashboard.jsx`](file:///d:/Coding/Susuno/web/src/pages/Dashboard.jsx) (App.jsx:2009) | `Manager` | `DashboardSidebar`, `WarehouseHeader`, `DashboardIcon` | `styles/dashboard.css` |
| `inventory` | [`pages/Inventory.jsx`](file:///d:/Coding/Susuno/web/src/pages/Inventory.jsx) (App.jsx:2177) | `Manager` | `InventoryProductPanel`, `ManagementShell` | `styles/inventory.css` |
| `inbound` | [`pages/Inbound.jsx`](file:///d:/Coding/Susuno/web/src/pages/Inbound.jsx) (App.jsx:2146) | `Manager` | `ScheduledShipment`, `InboundReceiving`, `InboundIssueReview`, `CompletedReceiving`, `CreateInbound` | `styles/inbound.css`, `styles/scheduled.css`, `styles/receiving.css`, `styles/inboundIssues.css`, `styles/completedReceiving.css` |
| `outbound` | [`pages/Outbound.jsx`](file:///d:/Coding/Susuno/web/src/pages/Outbound.jsx) (App.jsx:2119) | `Manager` | `ScheduledOutbound`, `OutboundFulfillment`, `OutboundIssueReview`, `CompletedOutbound`, `CreateOutbound` | `styles/outbound.css`, `styles/scheduledOutbound.css`, `styles/outboundFulfillment.css`, `styles/outboundIssueReview.css` |
| `purchase-orders` | [`pages/PurchaseOrders.jsx`](file:///d:/Coding/Susuno/web/src/pages/PurchaseOrders.jsx) (App.jsx:2058) | `Manager` | `PurchaseOrderFlow`, `ManagementShell` | `styles/purchaseOrders.css`, `styles/purchaseOrderFlow.css` |
| `suppliers` | [`pages/Suppliers.jsx`](file:///d:/Coding/Susuno/web/src/pages/Suppliers.jsx) (App.jsx:2087) | `Manager` | `ManagementShell` | `styles/suppliers.css` |
| `reports` | [`pages/Reports.jsx`](file:///d:/Coding/Susuno/web/src/pages/Reports.jsx) (App.jsx:2023) | `Manager` | `ReportExport`, `ManagementShell` | `styles/reportsAudit.css` |
| `movement-reports` | [`pages/StockMovementReports.jsx`](file:///d:/Coding/Susuno/web/src/pages/StockMovementReports.jsx) (App.jsx:2210) | `Manager` | `MovementExport`, `ManagementShell` | `styles/reportsAudit.css` |
| `ai-insight` | [`pages/AIInsight.jsx`](file:///d:/Coding/Susuno/web/src/pages/AIInsight.jsx) (App.jsx:2106) | `Manager` | `ManagementShell` | `styles/aiInsight.css` |
| `audit-trail` | [`pages/AuditTrail.jsx`](file:///d:/Coding/Susuno/web/src/pages/AuditTrail.jsx) (App.jsx:2044) | `Manager` | `ManagementShell` | `styles/reportsAudit.css` |
| `staff-management` | [`pages/StaffManagement.jsx`](file:///d:/Coding/Susuno/web/src/pages/StaffManagement.jsx) (App.jsx:1944) | `Manager` | `ManagementShell` | `styles/staffSettings.css` |
| `settings` | [`pages/Settings.jsx`](file:///d:/Coding/Susuno/web/src/pages/Settings.jsx) (App.jsx:1964) | `Manager` | `ManagementShell`, `PasswordInput` | `styles/staffSettings.css` |
| *(deprecated)* | [`pages/ProductCatalog.jsx`](file:///d:/Coding/Susuno/web/src/pages/ProductCatalog.jsx) | *Deprecated* | Fitur telah diintegrasikan langsung ke dalam modal detail Supplier | `styles/productCatalog.css` |

### 3.2 Modul Desainer Denah 2D (`web/src/floor-designer/`)
- `store/useDesignerStore.js`: Zustand store untuk elemen, selection, zoom, pan, dan undo/redo hingga 50 langkah.
- `types/layout.js`: Tipe dan skema elemen `rack`, `zone`, `wall`, `pillar`, `dock`, `path`.
- `components/Canvas/WarehouseCanvas.jsx`: Viewport render SVG dengan support Space+Drag pan dan mouse wheel zoom.
- `components/Canvas/GridPattern.jsx`: Grid pattern SVG 1m dan 0.5m.
- `components/Canvas/Rulers.jsx`: Mistar metrik atas dan kiri dalam satuan meter.
- `components/Canvas/ResizeHandles.jsx`: Handle 8 titik untuk manipulasi dimensi elemen.
- `components/Elements/`: Render komponen SVG (`RackElement`, `ZoneElement`, `WallPillarElement`, `PathElement`).
- `components/Toolbar/TopToolbar.jsx`: Kontrol zoom, snap, undo, redo, simpan.
- `components/Toolbox/LeftToolbox.jsx`: Palet alat penambahan elemen denah.
- `components/Inspector/RightInspector.jsx`: Panel editor atribut elemen aktif.
- `utils/`: `geometry.js`, `collision.js`, `validation.js`.

---

## 4. MOBILE ROUTING & FILE MAP (`mobile/`)

Aplikasi Flutter untuk staf gudang berorientasi tugas harian.

### 4.1 Entry Point & Konfigurasi
- [mobile/lib/main.dart](file:///d:/Coding/Susuno/mobile/lib/main.dart): Inisialisasi provider `WarehouseState`, konfigurasi tema `appTheme`, conditional routing ke `AppShell` atau `LoginScreen`.
- [mobile/lib/core/api_config.dart](file:///d:/Coding/Susuno/mobile/lib/core/api_config.dart): Konfigurasi URL backend untuk Android emulator (`10.0.2.2:5000`) dan Desktop/Web (`localhost:5000`).
- [mobile/lib/core/app_theme.dart](file:///d:/Coding/Susuno/mobile/lib/core/app_theme.dart): Palet warna khas Susuno (Olive `#5c732b`, Soft Sage `#eef3e9`) dan mode High Contrast.
- [mobile/lib/models/models.dart](file:///d:/Coding/Susuno/mobile/lib/models/models.dart): Model Dart data produk, staf, transaksi stok, presensi, tugas, dan shift.
- [mobile/lib/services/api_service.dart](file:///d:/Coding/Susuno/mobile/lib/services/api_service.dart): Layanan API HTTP terhubung ke backend Express.
- [mobile/lib/state/warehouse_state.dart](file:///d:/Coding/Susuno/mobile/lib/state/warehouse_state.dart): State container reaktif (`ChangeNotifier`) pengelola data sesi dan navigasi.

### 4.2 Peta Halaman & Tab Navigasi Mobile (`s.page`)

| Page Index (`s.page`) | Halaman Flutter | Guard / Role | Widget Utama | Fungsi Operasional Staf Lapangan |
|---|---|---|---|---|
| *(N/A)* | [`screens/login_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/login_screen.dart) | `Public / Staf` | `Brand`, `ui.dart` | Login staf lapangan menggunakan email dan kata sandi. |
| `0` | [`screens/dashboard_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/dashboard_screen.dart) | `Staf Gudang` | `TaskProgressChart`, `WarehouseSections` | Ringkasan tugas shift hari ini, progres pemindahan barang, dan alert stok. |
| `1` | [`screens/stock_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/stock_screen.dart) | `Staf Gudang` | Pencarian SKU, filter kategori, badge stok | Pengecekan jumlah stok fisik barang dan posisi nomor rak. |
| `2` | [`screens/scanner_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/scanner_screen.dart) | `Staf Gudang` | `qr_scanner.dart`, `barcode_input.dart` | Scan Barcode/QR kamera fisik atau input manual untuk pencarian produk & audit. |
| `3` | [`screens/alerts_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/alerts_screen.dart) | `Staf Gudang` | Alert list card | Notifikasi barang menipis, peringatan jadwal inspeksi, dan pengumuman shift. |
| `4` | [`screens/activity_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/activity_screen.dart) *(audit: true)* | `Staf Gudang` | Audit trail list | Log aktivitas transaksi stok yang telah dikerjakan oleh staf. |
| `5` | [`screens/activity_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/activity_screen.dart) / [`screens/stock_flows.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/stock_flows.dart) | `Staf Gudang` | `StockFlows` stepper wizard | Panduan alur langkah demi langkah penerimaan (Putaway) dan pengeluaran (Picking). |
| `6` | [`screens/insight_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/insight_screen.dart) | `Staf Gudang` | Card wawasan stok AI | Rekomendasi prediksi stok cepat habis untuk prioritas penataan rak. |
| `7` | [`screens/orders_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/orders_screen.dart) | `Staf Gudang` | Daftar PO & jadwal truk | Pemantauan kedatangan truk supplier pengirim barang masuk. |
| `8` | [`screens/profile_screen.dart`](file:///d:/Coding/Susuno/mobile/lib/screens/profile_screen.dart) | `Staf Gudang` | Presensi Check-in/out, switch kontras tinggi | Profil pengguna staf, pencatatan absensi jam masuk/keluar kerja, dan keluar sistem. |

---

## 5. AI MODULE FILE MAP (`ai/`)

- [ai/README.md](file:///d:/Coding/Susuno/ai/README.md): Direktori kerja tim AI.
- `backend/database/smart_warehouse_db.sql` (Tabel `ai_predictions`): Tempat persistensi hasil peramalan kebutuhan stok.
- [web/src/pages/AIInsight.jsx](file:///d:/Coding/Susuno/web/src/pages/AIInsight.jsx) & [web/src/utils/aiInsights.js](file:///d:/Coding/Susuno/web/src/utils/aiInsights.js): Halaman visualisasi rekomendasi pemesanan ulang dan analitik perputaran barang gudang untuk manajer.
- [mobile/lib/screens/insight_screen.dart](file:///d:/Coding/Susuno/mobile/lib/screens/insight_screen.dart): Antarmuka wawasan operasional ringkas untuk staf lapangan.

---

## 6. TABEL ACUAN PENELUSURAN AUDIT (`docs/audit.md`)

| Alur / Fitur | Web Step | Mobile Page | Endpoint API Backend | Guard / Role | File yang Ditelusuri (Files to Trace) | Tabel Database |
|---|---|---|---|---|---|---|
| **Otentikasi & Akun Manajer** | `signin`, `manager`, `security` | - | `POST /api/auth/login`<br>`POST /api/auth/register` | `Public` / `manager` | `web/src/pages/SignIn.jsx`<br>`web/src/pages/SignUp.jsx`<br>`backend/controllers/authController.js`<br>`backend/models/userModel.js` | `users` |
| **Otentikasi & Presensi Staf** | - | `LoginScreen`, `ProfileScreen (8)` | `POST /api/auth/login`<br>`POST /api/attendances/check-in`<br>`POST /api/attendances/check-out` | `staf` | `mobile/lib/screens/login_screen.dart`<br>`mobile/lib/screens/profile_screen.dart`<br>`mobile/lib/services/api_service.dart`<br>`backend/controllers/attendanceController.js` | `users`, `attendance_logs` |
| **Katalog & Inventaris Produk** | `inventory` | `StockScreen (1)` | `GET /api/products`<br>`POST /api/products`<br>`PUT /api/products/:id` | `manager` / `staf` | `web/src/pages/Inventory.jsx`<br>`web/src/components/InventoryProductPanel.jsx`<br>`mobile/lib/screens/stock_screen.dart`<br>`backend/controllers/productController.js`<br>`backend/models/productModel.js` | `products`, `categories`, `locations` |
| **Penerimaan Barang (Inbound)** | `inbound` | `StockFlows (5)` | `GET /api/inbound`<br>`POST /api/inbound`<br>`POST /api/inbound/:id/inspect`<br>`POST /api/inbound/:id/receive` | `manager` / `authenticated` | `web/src/pages/Inbound.jsx`<br>`web/src/components/InboundReceiving.jsx`<br>`web/src/components/InboundIssueReview.jsx`<br>`backend/controllers/inboundController.js`<br>`backend/models/inboundModel.js` | `inbound_shipments`, `inbound_shipment_items`, `stock_transactions`, `products` |
| **Pengiriman Barang (Outbound)** | `outbound` | `StockFlows (5)` | `GET /api/outbound`<br>`POST /api/outbound`<br>`PUT /api/outbound/:id/status` | `manager` / `authenticated` | `web/src/pages/Outbound.jsx`<br>`web/src/components/CreateOutbound.jsx`<br>`web/src/components/OutboundFulfillment.jsx`<br>`backend/controllers/outboundController.js`<br>`backend/models/outboundModel.js` | `outbound_shipments`, `outbound_shipment_items`, `stock_transactions`, `products` |
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
   - **Tanpa Alokasi Rak**: Tahapan pemilihan rak gudang telah dihapus dari Inbound agar staf dock dapat fokus cepat pada verifikasi fisik kuantitas dan kondisi barang.
   - Barang bagus (*Good condition*) langsung disetujui masuk inventaris gudang.
   - Barang bermasalah (*Damaged / Rejected*) dicatat bersama bukti foto/dokumen sebagai issue dan tidak menambah stok aktif.
5. **Penyelesaian Penerimaan (`completeReceiving` & `backend/models/inboundModel.js`):**
   - Menambah stok produk di master `products` (`stock_quantity`).
   - Mencatat mutasi ke `stock_transactions` (tipe `in`).
   - Otomatis memperbarui item PO menjadi diterima (*Received*) dan menutup PO jika seluruh unit telah lengkap.
   - Mengubah status PO terkait menjadi `Received` (atau `Partially Received` jika ada unit rusak/kurang).
