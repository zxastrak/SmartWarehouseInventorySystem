import React, { useEffect, useState, useRef, useCallback } from 'react';
import { typeOf, withProductTypes, cleanText } from './utils/productTypes.js';
import {
  authApi,
  productsApi,
  transactionsApi,
  purchaseOrdersApi,
  categoriesApi,
  suppliersApi,
  locationsApi,
  inboundApi,
  outboundApi,
  auditLogsApi,
  uploadApi,
  usersApi,
  getUser,
  getToken,
  isTokenExpired,
  clearAuthSession,
} from './utils/api.js';
import { stockStatus, inventorySeed, movementSeed } from './data/inventory.js';
import SignUp from './pages/SignUp.jsx';
import SignIn from './pages/SignIn.jsx';
import WarehouseSetup from './pages/WarehouseSetup.jsx';
import SecuritySetup from './pages/SecuritySetup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetLinkSent from './pages/ResetLinkSent.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import PasswordUpdated from './pages/PasswordUpdated.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Inbound from './pages/Inbound.jsx';
import Outbound from './pages/Outbound.jsx';
import AIInsight from './pages/AIInsight.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import Reports from './pages/Reports.jsx';
import AuditTrail from './pages/AuditTrail.jsx';
import Suppliers from './pages/Suppliers.jsx';
import StockMovementReports from './pages/StockMovementReports.jsx';
import StaffManagement from './pages/StaffManagement.jsx';
import Settings from './pages/Settings.jsx';
import SessionVerification from './components/SessionVerification.jsx';

import { staffSeed, staffRoles } from './data/staff.js';
import { defaultPreferences, validateStaff, validateProfile, strongPassword } from './utils/staffSettings.js';
import './styles/staffSettings.css';

import { supplierSeed } from './data/suppliers.js';
import { auditSeed, newAuditEvent } from './utils/auditTrail.js';
import { receivePurchaseOrder, revisePurchaseOrder, recordPOReceipt, poReceivingTotals } from './utils/purchaseOrderReceiving.js';
import { purchaseOrderSeed } from './data/purchaseOrders.js';
import { decidePurchaseOrder, createPurchaseOrder } from './utils/purchaseOrders.js';
import { newFulfillmentDraft, validatePicked, validatePacked, shipOutbound } from './utils/outboundFulfillment.js';
import { outboundSeed, readyToShipDraftSeed, packingDraftSeed } from './data/outbound.js';
import { resolveOutboundIssue } from './utils/outboundIssues.js';
import { createOutboundRecord, validateOutboundItems } from './utils/outbound.js';
import { rackSeed } from './data/receiving.js';
import { receiveShipment, inspectionSummary } from './utils/receiving.js';
import { inboundIssueSeed } from './data/inboundIssues.js';
import { resolveInboundIssue } from './utils/inboundIssues.js';
import { completedReceivingSeed } from './data/completedReceiving.js';
import { inboundSeed } from './data/inbound.js';

const ROUTE_PATH_MAP = {
  dashboard: '/dashboard',
  inbound: '/inbound',
  outbound: '/outbound',
  inventory: '/inventory',
  'purchase-orders': '/purchase-orders',
  suppliers: '/suppliers',
  reports: '/reports',
  'movement-reports': '/movement-reports',
  'ai-insight': '/ai-insight',
  'audit-trail': '/audit-trail',
  'staff-management': '/staff-management',
  settings: '/settings',
  'settings-profile': '/settings-profile',
  signin: '/signin',
  manager: '/signup',
  warehouse: '/warehouse-setup',
  security: '/security-setup',
  forgot: '/forgot-password',
  'reset-link-sent': '/reset-link-sent',
  'reset-password': '/reset-password',
  'password-updated': '/password-updated',
  'manager-verification': '/verification',
};

const PATH_ROUTE_MAP = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/inbound': 'inbound',
  '/outbound': 'outbound',
  '/inventory': 'inventory',
  '/purchase-orders': 'purchase-orders',
  '/suppliers': 'suppliers',
  '/reports': 'reports',
  '/movement-reports': 'movement-reports',
  '/ai-insight': 'ai-insight',
  '/audit-trail': 'audit-trail',
  '/staff-management': 'staff-management',
  '/settings': 'settings',
  '/settings-profile': 'settings-profile',
  '/signin': 'signin',
  '/login': 'signin',
  '/signup': 'manager',
  '/warehouse-setup': 'warehouse',
  '/security-setup': 'security',
  '/forgot-password': 'forgot',
  '/reset-link-sent': 'reset-link-sent',
  '/reset-password': 'reset-password',
  '/password-updated': 'password-updated',
  '/verification': 'manager-verification',
};

export default function App() {
  const [step, setStep] = useState(() => {
    const user = getUser();
    const currentPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') || '/' : '/';
    const target = PATH_ROUTE_MAP[currentPath];
    if (!user) {
      if (['signin', 'manager', 'warehouse', 'security', 'forgot', 'reset-link-sent', 'reset-password', 'password-updated'].includes(target)) {
        return target;
      }
      return 'signin';
    }
    if (target && target !== 'signin') {
      return target === 'settings-profile' ? 'settings' : target;
    }
    return 'dashboard';
  });
  const [manager, setManager] = useState(() => {
    const user = getUser();
    return user
      ? { fullName: user.name || user.fullName, email: user.email, role: user.role }
      : { fullName: 'Manager Utama', name: 'Manager Utama', email: 'manager@test.com', role: 'manager' };
  });
  const [warehouse, setWarehouse] = useState(null);
  const [security, setSecurity] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetExpiresAt, setResetExpiresAt] = useState(0);

  const [inventoryRequest, setInventoryRequest] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const sku = params.get('sku');
    return sku ? { sku, kind: 'report' } : null;
  });
  const [inboundRequest, setInboundRequest] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('inbound') || null;
  });
  const [outboundRequest, setOutboundRequest] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('outbound') || (window.location.pathname === '/outbound' ? params.get('id') : null) || null;
  });
  const [poRequest, setPoRequest] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('po') || params.get('orderId') || null;
  });
  const [supplierRequest, setSupplierRequest] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('supplier') || params.get('supplierId') || null;
  });
  const [poSupplierRequest, setPoSupplierRequest] = useState(null);
  const [reportOrigin, setReportOrigin] = useState(null);

  const [staffAccounts, setStaffAccounts] = useState([]);
  const [preferences, setPreferences] = useState(() => structuredClone(defaultPreferences));
  const [staffRequest, setStaffRequest] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('staffId') || null;
  });
  const [settingsView, setSettingsView] = useState('home');
  const [managementVisit, setManagementVisit] = useState(0);
  const [warehouseDirectory, setWarehouseDirectory] = useState([
    { warehouseName: 'Main Warehouse', warehouseCode: 'WH-01', city: 'Malang' },
  ]);
  const [otherSessions, setOtherSessions] = useState([]);
  const [passwordChangedAt, setPasswordChangedAt] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => new Date().toISOString());
  const failedSignIns = useRef({});

  const [inventoryItems, setInventoryItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [reportReference, setReportReference] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || params.get('reference') || null;
  });
  const [reportSku, setReportSku] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('sku') || null;
  });
  const [shipments, setShipments] = useState([]);
  const [poOrders, setPoOrders] = useState([]);
  const [outboundShipments, setOutboundShipments] = useState([]);
  const [outboundDrafts, setOutboundDrafts] = useState({});
  const [racks, setRacks] = useState(() => rackSeed.map((rack) => ({ ...rack })));
  const [receivingDrafts, setReceivingDrafts] = useState({});
  const [suppliersList, setSuppliersList] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);

  const effectiveManager = {
    fullName: manager?.fullName || manager?.name || 'Manager',
    email: manager?.email || '',
    phone: manager?.phone || '+62 812 3456 7890',
    jobTitle: manager?.jobTitle || (manager?.role === 'manager' ? 'Warehouse Manager' : 'Staff'),
    ...manager,
  };

  const effectiveWarehouse = warehouseDirectory.find((row) => row.warehouseName === preferences.warehouse.name) || {
    warehouseName: warehouse?.warehouseName || 'Main Warehouse',
    warehouseCode: warehouse?.warehouseCode || 'WH-01',
    city: warehouse?.city || 'Malang',
    ...warehouse,
  };

  const assignedWarehouses = [...new Set(warehouseDirectory.map((row) => row.warehouseName))];
  const sortedRacks = [...racks].sort((a, b) =>
    preferences.warehouse?.rackSort === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
  );

  // Theme support — applies to ALL pages when logged in
  useEffect(() => {
    if (!manager) {
      delete document.documentElement.dataset.susunoTheme;
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.susunoTheme =
        preferences.appearance.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : preferences.appearance.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [manager, preferences.appearance.theme]);

  // Idle session timeout
  useEffect(() => {
    if (!manager) return;
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => signOut('idle'), (preferences.security?.idleMinutes || 30) * 60000);
    };
    arm();
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((name) => window.addEventListener(name, arm, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, arm));
    };
  }, [manager, preferences.security?.idleMinutes]);

  // Synchronize browser URL (HTML5 History API) with back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
      const target = PATH_ROUTE_MAP[currentPath];
      const params = new URLSearchParams(window.location.search);

      if (target) {
        if (target === 'settings-profile') {
          setSettingsView('profile');
          setStep('settings');
        } else {
          setStep(target);
        }
      }

      const inbId = params.get('id') || params.get('inbound');
      setInboundRequest(target === 'inbound' ? (inbId || null) : null);

      const outbId = params.get('outbound') || (target === 'outbound' ? params.get('id') : null);
      setOutboundRequest(outbId || null);

      const poId = params.get('po') || params.get('orderId');
      setPoRequest(poId || null);

      const sku = params.get('sku');
      setInventoryRequest(sku ? { sku, kind: 'report' } : null);

      const staffId = params.get('staffId');
      setStaffRequest(staffId || null);

      const sup = params.get('supplier') || params.get('supplierId');
      setSupplierRequest(sup || null);

      setReportSku(params.get('sku') || null);
      setReportReference(params.get('ref') || params.get('reference') || null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keep browser address bar URL in sync with active step & query parameters
  useEffect(() => {
    const expectedPath = ROUTE_PATH_MAP[step] || (step === 'dashboard' ? '/dashboard' : `/${step}`);
    const searchParams = new URLSearchParams();

    if (step === 'inbound' && inboundRequest) {
      searchParams.set('id', inboundRequest);
    } else if (step === 'outbound' && outboundRequest) {
      searchParams.set('id', outboundRequest);
    } else if (step === 'purchase-orders' && poRequest) {
      searchParams.set('po', poRequest);
    } else if (step === 'inventory' && inventoryRequest?.sku) {
      searchParams.set('sku', inventoryRequest.sku);
    } else if (step === 'staff-management' && staffRequest) {
      searchParams.set('staffId', staffRequest);
    } else if (step === 'suppliers' && supplierRequest) {
      searchParams.set('supplier', supplierRequest);
    } else if (step === 'movement-reports') {
      if (reportSku && reportSku !== 'all') searchParams.set('sku', reportSku);
      if (reportReference) searchParams.set('ref', reportReference);
    }

    const query = searchParams.toString();
    const fullExpectedUrl = query ? `${expectedPath}?${query}` : expectedPath;
    const currentFullUrl = window.location.pathname + (window.location.search || '');

    if (currentFullUrl !== fullExpectedUrl && !(step === 'dashboard' && window.location.pathname === '/' && !query)) {
      window.history.pushState(null, '', fullExpectedUrl);
    }
  }, [step, inboundRequest, outboundRequest, poRequest, inventoryRequest, staffRequest, supplierRequest, reportSku, reportReference]);

  function logEvent(values) {
    const evt = newAuditEvent({
      user: effectiveManager.fullName,
      warehouse: effectiveWarehouse.warehouseName,
      ...values,
    });
    setAuditEvents((current) => [evt, ...current]);
    // Asynchronously log to MySQL audit_logs table
    auditLogsApi
      .create({
        action: values.action || 'EVENT',
        table_affected: values.module || 'System',
        record_id: typeof values.reference === 'number' ? values.reference : null,
      })
      .catch(() => {});
  }

  function auditExport(module) {
    return (values) => logEvent({ module, ...values });
  }

  function openAuditReference(event) {
    if (staffAccounts.some((row) => row.id === event.reference)) {
      setStaffRequest(event.reference);
      setStep('staff-management');
      return true;
    }
    if (poOrders.some((row) => row.id === event.reference)) {
      setPoRequest(event.reference);
      setStep('purchase-orders');
      return true;
    }
    if (shipments.some((row) => row.id === event.reference)) {
      setInboundRequest(event.reference);
      setStep('inbound');
      return true;
    }
    if (inventoryItems.some((row) => row.sku === event.reference)) {
      setInventoryRequest({ sku: event.reference, kind: 'report' });
      setStep('inventory');
      return true;
    }
    return false;
  }

  function navigatePage(next, params) {
    let target = next;
    if (target === 'Dashboard') target = 'dashboard';
    if (target === 'Inventory') target = 'inventory';
    if (target === 'Inbound') target = 'inbound';
    if (target === 'Outbound') target = 'outbound';
    if (target === 'AI Insight') target = 'ai-insight';
    if (target === 'Purchase Orders') target = 'purchase-orders';
    if (target === 'Suppliers') target = 'suppliers';
    if (target === 'Reports') target = 'reports';
    if (target === 'Audit Trail') target = 'audit-trail';
    if (target === 'Staff Management') target = 'staff-management';
    if (target === 'Settings') target = 'settings';

    if (['settings', 'settings-profile', 'staff-management'].includes(target)) {
      setManagementVisit((value) => value + 1);
    }
    setInventoryRequest(params?.sku ? { sku: params.sku, kind: params.kind || 'report' } : null);
    setInboundRequest(target === 'inbound' ? (params?.id || params?.inboundId || null) : null);
    setOutboundRequest(target === 'outbound' ? (params?.id || params?.outboundId || null) : null);
    setPoRequest(params?.orderId || params?.po || null);
    setPoSupplierRequest(params?.supplier || null);
    setSupplierRequest(params?.supplier || params?.supplierId || null);
    setReportOrigin(params?.origin || null);
    setStaffRequest(params?.staffId || null);
    setSettingsView(target === 'settings-profile' ? 'profile' : params?.view || 'home');
    const finalStep = target === 'settings-profile' ? 'settings' : target;
    setStep(finalStep);

    const expectedPath = ROUTE_PATH_MAP[target] || ROUTE_PATH_MAP[finalStep] || `/${finalStep}`;
    if (window.location.pathname !== expectedPath) {
      window.history.pushState(null, '', expectedPath);
    }
  }

  async function openPOInbound(po) {
    let existing = shipments.find((row) => row.po === po && !row.receivingCompleted && row.status !== 'Received');
    if (!existing) {
      const order = poOrders.find((row) => row.id === po);
      if (order) {
        const nextNum = Math.max(1000, ...shipments.map((row) => Number(String(row.id).replace('INB-', '')) || 0)) + 1;
        const generatedInbId = `INB-${nextNum}`;
        const autoShipment = {
          id: generatedInbId,
          po: order.id,
          supplier: order.supplier,
          status: 'Scheduled',
          date: order.expected || new Date().toISOString().slice(0, 10),
          time: '09:00',
          dock: 'D-01',
          staff: effectiveManager.fullName,
          carrier: order.delivery?.carrier || 'Supplier Logistics',
          reference: order.reference || '',
          items: order.products?.length || 1,
          units: order.products?.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0) || 0,
          products: (order.products || []).map((p) => ({ ...p })),
          warehouse: order.deliverTo?.split(' · ')[0] || effectiveWarehouse.warehouseName || 'Main Warehouse',
          source: 'Purchase Orders',
          scheduledAt: new Date().toISOString(),
          scheduledBy: effectiveManager.fullName,
        };

        if (order.backendId) {
          try {
            const res = await inboundApi.create({
              inbound_number: generatedInbId,
              purchase_order_id: order.backendId,
              po_number: order.id,
              supplier_id: order.supplier_id || null,
              supplier_name: order.supplier,
              scheduled_date: autoShipment.date,
              scheduled_time: autoShipment.time,
              dock: autoShipment.dock,
              assigned_staff: autoShipment.staff,
              carrier: autoShipment.carrier,
              reference: autoShipment.reference,
              units: autoShipment.units,
              items_count: autoShipment.items,
              items: (order.products || []).map((p) => {
                const invItem = inventoryItems.find((it) => it.sku === (p.code || p.sku));
                return {
                  product_id: invItem?.id || p.id || 1,
                  quantity: Number(p.quantity) || 1,
                  notes: `Item from PO ${order.id}`,
                };
              }),
            });
            if (res?.success && res.data?.shipmentId) {
              autoShipment.backendId = res.data.shipmentId;
            }
            await loadRemoteData();
          } catch (inbErr) {
            console.warn('Failed to sync openPOInbound to backend:', inbErr);
          }
        }

        existing = autoShipment;
        setShipments((curr) => {
          if (curr.some((s) => s.id === existing.id || (existing.backendId && s.backendId === existing.backendId))) {
            return curr;
          }
          return [existing, ...curr];
        });
      }
    }
    setInboundRequest(existing ? existing.id : null);
    setStep('inbound');
  }

  async function receivePO(id, draft) {
    const order = poOrders.find((row) => row.id === id);
    if (order && !preferences.warehouse?.allowPartial) {
      const accepted = (order.products || []).reduce(
        (sum, item) => sum + (draft.conditions?.[item.code] === 'Good condition' ? Number(draft.quantities?.[item.code]) || 0 : 0),
        0
      );
      if (accepted < poReceivingTotals(order).remaining) {
        return { error: 'Partial PO receipts are disabled in Warehouse Preferences. Receive all remaining accepted units or enable partial receipt.' };
      }
    }

    const result = receivePurchaseOrder({
      order,
      draft,
      shipments,
      inventory: inventoryItems,
      movements,
      racks,
      user: effectiveManager.fullName,
      date: new Date().toISOString(),
    });
    if (result.error) return result;
    setInventoryItems(result.inventory);
    setMovements(result.movements);
    setRacks(result.racks);
    setShipments((current) => [result.shipment, ...current]);
    setPoOrders((current) => current.map((row) => (row.id === id ? result.order : row)));
    logEvent({
      module: 'Purchase Orders',
      action: 'Goods received',
      reference: id,
      details: `${result.order.receipts.at(-1).units} accepted units · ${result.shipment.id}`,
      severity: result.shipment.receipt.dispositions.length ? 'Warning' : 'Info',
      changes: [
        { field: 'PO status', before: order?.status, after: result.order.status },
        ...result.shipment.receipt.stockChanges.map((row) => ({ field: row.sku, before: row.before, after: row.after })),
        { field: 'Movement reference', before: 'Not posted', after: result.shipment.id },
      ],
    });

    // Sinkronisasi status dan stok ke backend MySQL
    if (order?.backendId) {
      try {
        await purchaseOrdersApi.updateStatus(order.backendId, result.order.status.toLowerCase());
        for (const sc of result.shipment.receipt?.stockChanges || []) {
          const matchedItem = inventoryItems.find((it) => it.sku === sc.sku);
          if (matchedItem?.id) {
            const addedQty = sc.after - sc.before;
            if (addedQty > 0) {
              await transactionsApi.create({
                product_id: matchedItem.id,
                type: 'in',
                quantity: addedQty,
                notes: `Received from PO ${id}`,
              });
              await productsApi.update(matchedItem.id, {
                stock_quantity: sc.after,
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to sync PO status/stock to backend:', err);
      }
    }
    return result;
  }

  function revisePO(id, values) {
    const result = revisePurchaseOrder(
      poOrders.find((row) => row.id === id),
      values,
      effectiveManager.fullName,
      new Date().toISOString()
    );
    if (!result.error) {
      setPoOrders((current) => current.map((row) => (row.id === id ? result.order : row)));
      logEvent({
        module: 'Purchase Orders',
        action: 'Delivery updated',
        reference: id,
        status: 'Updated',
        details: values.notes,
        changes: [
          { field: 'Expected date', before: poOrders.find((row) => row.id === id)?.expected, after: result.order.expected },
          { field: 'PO status', before: poOrders.find((row) => row.id === id)?.status, after: result.order.status },
        ],
      });

      // Sinkronisasi revisi tanggal & status ke backend
      const matchedPO = poOrders.find((row) => row.id === id);
      if (matchedPO?.backendId) {
        purchaseOrdersApi
          .update(matchedPO.backendId, {
            expected_date: result.order.expected,
            status: result.order.status.toLowerCase(),
            notes: values.notes || matchedPO.notes,
          })
          .catch((err) => console.error('Failed to sync PO revision:', err));
      }
    }
    return result;
  }

  function reviewInsight(request) {
    if (!inventoryItems.some((item) => item.sku === request.sku)) return;
    setInventoryRequest(request);
    setStep('inventory');
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    const user = getUser();
    if (user) {
      setManager({ fullName: user.name || user.fullName, email: user.email, role: user.role });
    }
  }, []);

  const loadRemoteData = useCallback(async () => {
    try {
      // 1. Ambil data produk dari backend MySQL
      const prods = await productsApi.getAll();
      if (Array.isArray(prods)) {
        const mapped = prods.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category_name || 'General',
          category_id: p.category_id,
          current: Number(p.stock_quantity) || 0,
          reorder: Number(p.reorder_level) || 15,
          unit: p.unit || 'pcs',
          price: Number(p.price) || 0,
          rack: p.location_code || p.zone_location || 'A-01',
          zone: p.zone || 'Zone A',
          location_id: p.location_id,
          image_url: p.image_url || null,
          description: p.description || '',
          notes: p.description || '',
          status: stockStatus({ current: Number(p.stock_quantity) || 0, reorder: Number(p.reorder_level) || 15 }),
          warehouse: 'Main Warehouse',
          supplier: p.supplier_name || 'Warehouse Partner',
          supplier_id: p.supplier_id,
        }));
        setInventoryItems(mapped);
      } else {
        setInventoryItems([]);
      }

      // 2. Ambil riwayat pergerakan stok (transaksi)
      const txs = await transactionsApi.getAll();
      if (Array.isArray(txs)) {
        const mappedTx = txs.map((tx, idx) => ({
          id: tx.id || `TX-${idx + 1}`,
          date: tx.created_at || new Date().toISOString(),
          type: tx.type === 'in' ? 'Inbound received' : 'Outbound shipped',
          reference: `TX-${tx.id}`,
          sku: tx.sku || `SKU-${tx.product_id}`,
          change: tx.type === 'in' ? tx.quantity : -tx.quantity,
          rack: tx.location_code || 'A-01',
          user: tx.user_name || 'Staff',
          reason: tx.notes || (tx.type === 'in' ? 'Goods receipt' : 'Order dispatch'),
          after: tx.newStock ?? 0,
          warehouse: 'Main Warehouse',
        }));
        setMovements(mappedTx);
      } else {
        setMovements([]);
      }

      // 3. Ambil daftar Suppliers
      const sups = await suppliersApi.getAll();
      if (Array.isArray(sups)) {
        setSuppliersList(sups);
      } else {
        setSuppliersList([]);
      }

      // 4. Ambil daftar Purchase Orders
      const pos = await purchaseOrdersApi.getAll();
      if (Array.isArray(pos)) {
        const currentSups = Array.isArray(sups) ? sups : [];
        const formatStatus = (s) => {
          if (!s) return 'Pending';
          const lower = s.toLowerCase();
          if (lower === 'approved') return 'Approved';
          if (lower === 'in transit' || lower === 'in_transit') return 'In Transit';
          if (lower === 'partially received' || lower === 'partially_received') return 'Partially Received';
          if (lower === 'received' || lower === 'completed') return 'Received';
          if (lower === 'rejected' || lower === 'cancelled') return 'Rejected';
          if (lower === 'overdue') return 'Overdue';
          return 'Pending';
        };

        const mappedPOs = pos.map((po) => {
          const matchedSupplier = currentSups.find((s) => s.id === po.supplier_id);
          const supplierName = po.supplier_name || matchedSupplier?.name || 'Supplier';

          const calculatedTotal = po.total_amount
            ? Number(po.total_amount)
            : Array.isArray(po.items)
            ? po.items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0)
            : 0;

          return {
            id: po.po_number || `PO-${String(po.id).padStart(4, '0')}`,
            po_number: po.po_number || `PO-${String(po.id).padStart(4, '0')}`,
            backendId: po.id,
            supplier_id: po.supplier_id,
            supplier: supplierName,
            status: formatStatus(po.status),
            expected: po.expected_date
              ? po.expected_date.slice(0, 10)
              : po.created_at
              ? po.created_at.slice(0, 10)
              : new Date().toISOString().slice(0, 10),
            terms: po.payment_terms || 'Net 30',
            currency: 'IDR',
            reference: po.reference || '',
            notes: po.notes || '',
            deliverTo: po.deliver_to || 'Main Warehouse',
            total: calculatedTotal,
            created: po.created_at ? po.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            requestedBy: po.creator_name || 'Manager',
            approvedBy: po.approver_name || null,
            approvedAt: po.approved_at || null,
            decision:
              po.status?.toLowerCase() === 'approved' || po.status?.toLowerCase() === 'rejected'
                ? {
                    status: formatStatus(po.status),
                    user: po.approver_name || 'Manager',
                    date: po.approved_at || po.updated_at || po.created_at,
                  }
                : null,
            products:
              Array.isArray(po.items) && po.items.length > 0
                ? po.items.map((it) => ({
                    code: it.sku || `SKU-${it.product_id}`,
                    name: it.product_name || `Product ${it.product_id}`,
                    quantity: it.quantity,
                    unitPrice: Number(it.price) || 0,
                    received: it.received_quantity || 0,
                  }))
                : [],
          };
        });
        setPoOrders(withProductTypes(mappedPOs, []));
      } else {
        setPoOrders([]);
      }

      // 5. Ambil data Inbound Shipments dari backend MySQL
      const inbounds = await inboundApi.getAll();
      if (Array.isArray(inbounds)) {
        const mappedInbounds = inbounds.map((inb) => {
          const matchedPO = (pos || []).find((p) =>
            p.backendId === inb.purchase_order_id ||
            p.id === inb.purchase_order_id ||
            p.id === inb.po_number ||
            p.po_number === inb.po_number ||
            (p.po_number && inb.po_number && String(p.po_number).toLowerCase() === String(inb.po_number).toLowerCase())
          );
          const matchedSup = (sups || []).find((s) => s.id === inb.supplier_id);
          const supplierName =
            inb.supplier_name_from_db ||
            inb.supplier_name ||
            matchedSup?.name ||
            matchedPO?.supplier_name ||
            'Warehouse Partner';

          // Produk untuk shipment ini: ambil dari items shipment aktual atau dari PO yang terkait
          let shipmentItemsList = [];
          if (Array.isArray(inb.items) && inb.items.length > 0) {
            shipmentItemsList = inb.items.map((it) => {
              let parsedBarcodes = [];
              if (it.barcodes) {
                try {
                  parsedBarcodes = typeof it.barcodes === 'string' ? JSON.parse(it.barcodes) : it.barcodes;
                } catch (_) {
                  parsedBarcodes = String(it.barcodes).split(',').map((s) => s.trim()).filter(Boolean);
                }
              }
              return {
                code: it.sku || it.product_sku || `SKU-${it.product_id || it.id}`,
                sku: it.sku || it.product_sku || `SKU-${it.product_id || it.id}`,
                name: it.product_name || it.name || `Product ${it.product_id || it.id}`,
                quantity: Number(it.ordered_qty || it.expected_quantity || it.quantity || 1),
                ordered: Number(it.ordered_qty || it.expected_quantity || it.quantity || 1),
                received: it.accepted_qty !== null && it.accepted_qty !== undefined ? Number(it.accepted_qty) : Number(it.received_quantity || 0),
                damaged: Number(it.damaged_qty || 0),
                rejected: Number(it.rejected_qty || 0),
                barcodes: Array.isArray(parsedBarcodes) ? parsedBarcodes : [],
                notes: it.notes || '',
                category: it.category || '',
              };
            });
          } else if (Array.isArray(matchedPO?.items) && matchedPO.items.length > 0) {
            shipmentItemsList = matchedPO.items.map((it) => ({
              code: it.sku || `SKU-${it.product_id}`,
              sku: it.sku || `SKU-${it.product_id}`,
              name: it.product_name || `Product ${it.product_id}`,
              quantity: Number(it.quantity || 1),
              ordered: Number(it.quantity || 1),
              received: Number(it.received_quantity || 0),
              damaged: 0,
              rejected: 0,
              barcodes: [],
              notes: '',
              category: '',
            }));
          } else if (Array.isArray(matchedPO?.products) && matchedPO.products.length > 0) {
            shipmentItemsList = matchedPO.products.map((p) => ({
              ...p,
              sku: p.code || p.sku,
              ordered: p.quantity,
              barcodes: p.barcodes || [],
            }));
          }

          let allShipmentBarcodes = [];
          if (inb.scanned_barcodes) {
            try {
              allShipmentBarcodes = typeof inb.scanned_barcodes === 'string' ? JSON.parse(inb.scanned_barcodes) : inb.scanned_barcodes;
            } catch (_) {}
          }

          return {
            id: inb.inbound_number || `INB-${String(inb.id).padStart(4, '0')}`,
            backendId: inb.id,
            po: inb.po_number || (matchedPO ? matchedPO.po_number || `PO-${String(matchedPO.id).padStart(4, '0')}` : 'PO-0001'),
            purchase_order_id: inb.purchase_order_id,
            supplier: supplierName,
            supplier_id: inb.supplier_id,
            status: inb.status || 'Scheduled',
            date: inb.scheduled_date ? String(inb.scheduled_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
            time: inb.scheduled_time ? String(inb.scheduled_time).slice(0, 5) : '08:00',
            dock: inb.dock || 'D-01',
            staff: inb.assigned_staff || 'Staf Dok',
            inspector: inb.inspector || inb.assigned_staff || '',
            carrier: inb.carrier || 'Logistics Partner',
            reference: inb.reference || '',
            units: Number(inb.units) || 0,
            items: shipmentItemsList.length > 0 ? shipmentItemsList.length : (Number(inb.items_count) || (matchedPO?.items?.length || 1)),
            accepted_units: Number(inb.accepted_units) || 0,
            notes: inb.notes || '',
            evidence_url: inb.evidence_url || '',
            scanned_barcodes: allShipmentBarcodes,
            receivingCompleted: inb.status === 'Received',
            products: shipmentItemsList,
          };
        });
        setShipments(withProductTypes(mappedInbounds, []));
      } else {
        setShipments([]);
      }

      // 6. Ambil data Outbound Shipments dari backend MySQL
      const outbounds = await outboundApi.getAll();
      if (Array.isArray(outbounds)) {
        const mappedOutbounds = outbounds.map((out) => {
          const products = (out.items || []).map((it) => ({
            id: it.product_id,
            sku: it.product_sku || it.sku,
            name: it.product_name || it.name,
            rack: it.rack || 'A-01',
            quantity: Number(it.quantity || it.requested_qty || it.ordered_qty || 0),
            ordered_qty: Number(it.ordered_qty || it.quantity || 0),
            fulfilled_qty: Number(it.fulfilled_qty || it.shipped_qty || 0),
            damaged_qty: Number(it.damaged_qty || 0),
            barcodes: it.barcodes || [],
            current: Number(it.current_stock || 0),
            unit: it.unit || 'Pcs',
            category: it.category || 'Standard',
            image_url: it.image_url || null,
          }));

          const totalUnits = products.length > 0
            ? products.reduce((sum, p) => sum + p.quantity, 0)
            : Number(out.units) || 0;

          return {
            id: out.outbound_number || `OUT-${String(out.id).padStart(4, '0')}`,
            backendId: out.id,
            type: out.outbound_type || 'Customer order',
            destination: out.destination || 'Main Customer',
            reference: out.reference || `SO-${out.id}`,
            date: out.scheduled_date ? String(out.scheduled_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
            time: out.scheduled_time ? String(out.scheduled_time).slice(0, 5) : '09:00',
            dock: out.dock || '1',
            priority: out.priority || 'Normal',
            staff: out.assigned_staff || 'Staf Dok',
            assigned_staff: out.assigned_staff || 'Staf Dok',
            inspector: out.inspector || '',
            scanned_barcodes: out.scanned_barcodes || '',
            units: totalUnits,
            items: products.length || Number(out.items_count) || 1,
            status: out.status || 'Scheduled',
            carrier: out.carrier || '',
            tracking: out.tracking_number || '',
            notes: out.notes || '',
            products,
            dispatch:
              out.status === 'Shipped'
                ? {
                    carrier: out.carrier || 'Cargo Express',
                    units: totalUnits,
                    tracking: out.tracking_number || 'TRK-DEFAULT',
                    driver: 'Express Driver',
                    plate: 'B 1234 CD',
                    stockChanges: products.map((p) => ({
                      sku: p.sku,
                      name: p.name,
                      quantity: p.quantity,
                      box: 'Box 1',
                      before: p.current + p.quantity,
                      after: p.current,
                    })),
                    isHistoricalSample: false,
                  }
                : null,
          };
        });
        setOutboundShipments(withProductTypes(mappedOutbounds, []));
      } else {
        setOutboundShipments([]);
      }

      // 7. Ambil Audit Logs dari backend MySQL
      const logs = await auditLogsApi.getAll();
      if (Array.isArray(logs)) {
        const mappedLogs = logs.map((l, idx) => {
          let parsedBarcodes = [];
          if (l.scanned_barcodes) {
            try {
              parsedBarcodes = typeof l.scanned_barcodes === 'string' ? JSON.parse(l.scanned_barcodes) : l.scanned_barcodes;
            } catch (_) {
              parsedBarcodes = String(l.scanned_barcodes).split(',').map((s) => s.trim()).filter(Boolean);
            }
          }

          let detailsText = `Action ${l.action} on ${l.table_affected || 'database'}`;
          let referenceText = l.record_id ? `#${l.record_id}` : 'System';

          if (l.table_affected === 'inbound_shipments') {
            referenceText = l.inbound_number || `#${l.record_id}`;
            const barcodeInfo = parsedBarcodes.length > 0 ? ` · ${parsedBarcodes.length} barcode fisik discan` : '';
            detailsText = `Pemeriksaan dok ${referenceText}${barcodeInfo}`;
          } else if (l.table_affected === 'products' && l.product_sku) {
            referenceText = l.product_sku;
            detailsText = `Produk ${l.product_name || l.product_sku} diupdate`;
          }

          return {
            id: `EVT-${l.id || idx + 1}`,
            date: l.created_at || new Date().toISOString(),
            timestamp: l.created_at || new Date().toISOString(),
            module: l.table_affected ? l.table_affected.charAt(0).toUpperCase() + l.table_affected.slice(1) : 'System',
            action: l.action || 'Updated',
            reference: referenceText,
            user: l.user_name || (l.user_id === 1 ? 'Manager Utama' : 'System'),
            warehouse: 'Main Warehouse',
            status: 'Success',
            severity: 'Info',
            source: 'System',
            details: detailsText,
            barcodes: parsedBarcodes,
            changes: parsedBarcodes.length > 0 ? [{ field: 'Scanned Barcodes', before: 'None', after: parsedBarcodes.join(', ') }] : [],
          };
        });
        setAuditEvents(mappedLogs);
      } else {
        setAuditEvents([]);
      }

      // 8. Ambil data Lokasi / Racks dari backend MySQL
      const locs = await locationsApi.getAll();
      if (Array.isArray(locs) && locs.length > 0) {
        setRacks(
          locs.map((l) => ({
            id: l.location_code || `LOC-${l.id}`,
            zone: l.zone || 'General',
            capacity: 200,
            used: 0,
          }))
        );
      }

      // 9. Ambil data Akun Staf dari backend MySQL (tabel users dengan role 'staf')
      const remoteStaff = await usersApi.getAll('staf');
      if (Array.isArray(remoteStaff) && remoteStaff.length > 0) {
        setStaffAccounts(
          remoteStaff.map((u) => ({
            id: u.id,
            fullName: u.name,
            contact: u.email,
            role: u.role_title || 'Inventory Staff',
            username: u.email ? u.email.split('@')[0] : `staff_${u.id}`,
            warehouse: u.warehouse || 'Main Warehouse',
            warehouseCode: 'WH-01',
            createdAt: u.created_at || new Date().toISOString(),
            createdBy: 'Manager',
            lastLogin: null,
            passwordChangedAt: null,
            requirePasswordChange: false,
            suspended: !u.is_active,
          }))
        );
      }

      console.log('[Susuno Web] Database loaded successfully:', {
        products: Array.isArray(prods) ? prods.length : 0,
        purchaseOrders: Array.isArray(pos) ? pos.length : 0,
        suppliers: Array.isArray(sups) ? sups.length : 0,
        inbounds: Array.isArray(inbounds) ? inbounds.length : 0,
      });
    } catch (err) {
      console.error('Error loading remote data from backend:', err);
    }
  }, []);

  useEffect(() => {
    loadRemoteData();
    const interval = setInterval(() => {
      loadRemoteData();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadRemoteData]);

  // Staff Management operations
  async function createStaff(draft) {
    draft = {
      ...draft,
      warehouse:
        assignedWarehouses.find((name) => name.toLowerCase() === draft.warehouse.trim().toLowerCase()) ||
        draft.warehouse.trim(),
    };
    const errors = validateStaff(draft, staffAccounts, assignedWarehouses);
    if (Object.keys(errors).length) return { error: Object.values(errors)[0] };

    const email = draft.contact.includes('@')
      ? draft.contact.trim()
      : `${draft.username.trim().toLowerCase()}@staff.susuno.local`;

    try {
      const res = await usersApi.createStaff({
        name: draft.fullName.trim(),
        email,
        password: draft.password,
        role_title: draft.role,
        warehouse: draft.warehouse,
      });

      if (!res.success) {
        return { error: res.message || 'Gagal menyimpan akun staf ke database.' };
      }

      const newId = res.userId || 'STF-' + Date.now();
      const record = {
        id: newId,
        fullName: draft.fullName.trim(),
        contact: email,
        role: draft.role,
        username: draft.username.trim(),
        warehouse: draft.warehouse,
        warehouseCode: warehouseDirectory.find((row) => row.warehouseName === draft.warehouse)?.warehouseCode || 'WH-01',
        createdAt: new Date().toISOString(),
        createdBy: effectiveManager?.fullName || 'Manager',
        lastLogin: null,
        passwordChangedAt: null,
        requirePasswordChange: true,
        suspended: false,
      };
      setStaffAccounts((current) => [record, ...current]);
      logEvent({
        module: 'Staff Management',
        action: 'Staff account created',
        reference: `#${newId}`,
        details: record.fullName + ' · ' + record.role,
        changes: [
          { field: 'Account status', before: 'Not created', after: 'Active' },
          { field: 'Email', before: 'Not assigned', after: record.contact },
        ],
      });
      return { staff: record };
    } catch (err) {
      console.error('Failed to create staff account:', err);
      return { error: err.message || 'Terjadi kesalahan saat menghubungi server.' };
    }
  }

  async function editStaff(id, values) {
    values = {
      ...values,
      warehouse:
        assignedWarehouses.find((name) => name.toLowerCase() === values.warehouse.trim().toLowerCase()) ||
        values.warehouse.trim(),
    };
    const row = staffAccounts.find((item) => item.id === id);
    if (!row) return { error: 'Staff account not found.' };
    if (!staffRoles.includes(values.role) || !assignedWarehouses.includes(values.warehouse))
      return { error: 'Choose a valid role and warehouse.' };
    const changes = ['role', 'warehouse']
      .filter((key) => row[key] !== values[key])
      .map((key) => ({ field: key, before: row[key], after: values[key] }));
    if (!changes.length) return { unchanged: true };

    try {
      if (!isNaN(Number(id))) {
        await usersApi.update(id, {
          role_title: values.role,
          warehouse: values.warehouse,
        });
      }
      setStaffAccounts((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...values,
                warehouseCode: warehouseDirectory.find((row2) => row2.warehouseName === values.warehouse)?.warehouseCode || 'WH-01',
              }
            : item
        )
      );
      logEvent({ module: 'Staff Management', action: 'Staff assignment updated', reference: `#${id}`, details: row.fullName, changes });
      return {};
    } catch (err) {
      console.error('Failed to update staff:', err);
      return { error: err.message || 'Gagal memperbarui staf di database.' };
    }
  }

  async function resetStaff(id, newPassword) {
    const row = staffAccounts.find((item) => item.id === id);
    if (!row || row.suspended) return { error: 'Reactivate this staff account before resetting its credential.' };

    try {
      if (newPassword && row.contact) {
        await usersApi.resetPassword(row.contact, newPassword);
      }
      setStaffAccounts((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, requirePasswordChange: true, temporaryIssuedAt: new Date().toISOString() }
            : item
        )
      );
      logEvent({
        module: 'Staff Management',
        action: 'Temporary password reset',
        reference: `#${id}`,
        details: row.fullName + ' · Password reset in database',
        changes: [{ field: 'Password change required', before: row.requirePasswordChange, after: true }],
      });
      return {};
    } catch (err) {
      console.error('Failed to reset staff password:', err);
      return { error: err.message || 'Gagal mereset password di database.' };
    }
  }

  async function suspendStaff(id, suspended) {
    const row = staffAccounts.find((item) => item.id === id);
    if (!row) return { error: 'Staff account not found.' };
    if (row.suspended === suspended) return { unchanged: true };

    try {
      if (!isNaN(Number(id))) {
        if (suspended) {
          await usersApi.suspend(id);
        } else {
          await usersApi.activate(id);
        }
      }
      setStaffAccounts((current) => current.map((item) => (item.id === id ? { ...item, suspended } : item)));
      logEvent({
        module: 'Staff Management',
        action: suspended ? 'Staff access suspended' : 'Staff access reactivated',
        reference: `#${id}`,
        details: row.fullName,
        changes: [{ field: 'Suspended', before: row.suspended, after: suspended }],
      });
      return {};
    } catch (err) {
      console.error('Failed to toggle staff active status:', err);
      return { error: err.message || 'Gagal mengubah status staf di database.' };
    }
  }

  function saveManagerProfile(values) {
    const errors = validateProfile(values);
    if (Object.keys(errors).length) return { error: Object.values(errors)[0] };
    const next = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      jobTitle: values.jobTitle.trim(),
      photo: values.photo || null,
    };
    const changes = ['fullName', 'email', 'phone', 'jobTitle']
      .filter((key) => effectiveManager[key] !== next[key])
      .map((key) => ({ field: key, before: effectiveManager[key], after: next[key] }));
    if ((effectiveManager.photo || null) !== next.photo) {
      changes.push({
        field: 'Profile photo',
        before: effectiveManager.photo ? 'Set' : 'Not set',
        after: next.photo ? 'Updated' : 'Removed',
      });
    }
    if (!changes.length) return { unchanged: true };
    setManager((current) => ({ ...current, ...next }));
    setLoginEmail(next.email);
    logEvent({
      module: 'Settings',
      action: 'Manager profile updated',
      reference: 'MGR-001',
      details: 'Manager profile updated for this frontend session',
      changes,
    });
    return {};
  }

  function savePreferences(group, values) {
    if (group === 'warehouse') {
      values = {
        ...values,
        name:
          assignedWarehouses.find((name) => name.toLowerCase() === values.name.trim().toLowerCase()) ||
          values.name.trim(),
      };
    }
    if (!['warehouse', 'notifications', 'security', 'appearance'].includes(group)) {
      return { error: 'Unknown preferences section.' };
    }
    const current = preferences[group];
    if (Object.keys(current).some((key) => !(key in values))) return { error: 'Preferences are incomplete.' };
    if (
      group === 'warehouse' &&
      (!assignedWarehouses.includes(values.name) ||
        !['asc', 'desc'].includes(values.rackSort) ||
        !['reorder', 'critical'].includes(values.lowThreshold) ||
        ![7, 14, 30].includes(values.predictionDays))
    ) {
      return { error: 'Choose valid warehouse preferences.' };
    }
    if (group === 'security' && ![15, 30, 60].includes(values.idleMinutes)) {
      return { error: 'Choose a supported idle timeout.' };
    }
    if (
      group === 'appearance' &&
      (!['light', 'dark', 'system'].includes(values.theme) ||
        !['en-US', 'id-ID'].includes(values.language) ||
        !['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].includes(values.timeZone) ||
        !['medium', 'numeric'].includes(values.dateFormat) ||
        !['id-ID', 'en-US'].includes(values.numberLocale))
    ) {
      return { error: 'Choose valid appearance and regional preferences.' };
    }
    const changes = Object.keys(current)
      .filter((key) => current[key] !== values[key])
      .map((key) => ({ field: key, before: current[key], after: values[key] }));
    if (!changes.length) return { unchanged: true };
    setPreferences((old) => ({ ...old, [group]: { ...values } }));
    logEvent({
      module: 'Settings',
      action: group === 'security' && changes.some((row) => row.field === 'twoStep') ? 'Two-step verification updated' : 'Preferences updated',
      reference: group,
      details: group + ' preferences saved for this frontend session',
      changes,
    });
    return {};
  }

  function changeManagerPassword(current, next) {
    if (!strongPassword(next) || next === current) {
      return { error: 'Choose a different password with at least 10 characters, a letter, number, and symbol.' };
    }
    setPasswordChangedAt(new Date().toISOString());
    logEvent({
      module: 'Settings',
      action: 'Password changed',
      reference: 'MGR-001',
      details: 'Manager password updated; password values are not recorded',
      changes: [],
    });
    return {};
  }

  function revokeOtherSessions() {
    if (!otherSessions.length) return;
    setOtherSessions([]);
    logEvent({
      module: 'Settings',
      action: 'Demo sessions removed',
      reference: 'Session',
      details: 'Sample mobile session removed. No external device contacted',
      changes: [],
    });
  }

  function finishSignIn() {
    setSessionStartedAt(new Date().toISOString());
    setStep('dashboard');
    loadRemoteData();
  }

  // Purchase Order Operations
  async function decidePO(id, status) {
    const order = poOrders.find((row) => row.id === id);

    // Self-approval check: izinkan manajer menyetujui PO buatannya sendiri pada mode otoritas tunggal / simulasi
    const isSelfApproval = status === 'Approved' && order?.requestedBy && order.requestedBy === effectiveManager.fullName;
    if (isSelfApproval) {
      logEvent({
        module: 'Purchase Orders',
        action: 'Self-approval authorized',
        reference: id,
        details: `Disetujui oleh manajer pembuat (${order.requestedBy}) dalam mode otoritas tunggal / simulasi`,
      });
    }

    const result = decidePurchaseOrder(
      order,
      status,
      effectiveManager.fullName,
      new Date().toISOString()
    );
    if (!result.error) {
      setPoOrders((current) => current.map((row) => (row.id === id ? result.order : row)));
      logEvent({
        module: 'Purchase Orders',
        action: `Order ${status.toLowerCase()}`,
        reference: id,
        details: `Decision recorded: ${status}`,
        changes: [{ field: 'PO status', before: 'Pending', after: status }],
      });

      // Update PO status di backend MySQL (backend juga akan otomatis membuat Inbound Shipment dan items-nya)
      const matchedPO = poOrders.find((row) => row.id === id);
      if (matchedPO?.backendId) {
        try {
          await purchaseOrdersApi.updateStatus(matchedPO.backendId, status.toLowerCase());
          await loadRemoteData();
        } catch (err) {
          console.error('Failed to update PO status on backend:', err);
        }
      }

      // Pastikan Inbound Shipment juga masuk ke state UI jika belum termuat dari backend
      if (status === 'Approved') {
        const orderToSchedule = result.order || order;
        setShipments((current) => {
          const alreadyScheduled = current.some((s) => s.po === id && s.status !== 'Received');
          if (alreadyScheduled) return current;

          const nextNum = Math.max(1000, ...current.map((row) => Number(String(row.id).replace('INB-', '')) || 0)) + 1;
          const generatedInbId = `INB-${nextNum}`;
          const autoShipment = {
            id: generatedInbId,
            po: id,
            supplier: orderToSchedule.supplier,
            status: 'Scheduled',
            date: orderToSchedule.expected || new Date().toISOString().slice(0, 10),
            time: '09:00',
            dock: 'D-01',
            staff: effectiveManager.fullName,
            carrier: orderToSchedule.delivery?.carrier || 'Supplier Logistics',
            reference: orderToSchedule.reference || '',
            items: orderToSchedule.products?.length || 1,
            units: orderToSchedule.products?.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0) || 0,
            products: (orderToSchedule.products || []).map((p) => ({ ...p })),
            warehouse: orderToSchedule.deliverTo?.split(' · ')[0] || effectiveWarehouse.warehouseName || 'Main Warehouse',
            source: 'Auto-Scheduled from PO',
            scheduledAt: new Date().toISOString(),
            scheduledBy: effectiveManager.fullName,
          };

          return [autoShipment, ...current];
        });

        logEvent({
          module: 'Inbound',
          action: 'Inbound auto-scheduled',
          reference: id,
          details: `Auto-scheduled from approved PO ${id}`,
          changes: [{ field: 'Status', before: 'Unscheduled', after: 'Scheduled' }],
        });
      }
    }
    return result;
  }

  async function createPO(values) {
    const result = createPurchaseOrder({
      values,
      orders: poOrders,
      inventory: inventoryItems,
      user: effectiveManager.fullName,
      date: new Date().toISOString(),
    });
    if (!result.error) {
      let supplierId = 1;
      let matchedSupplier = suppliersList.find((s) => s.name?.toLowerCase().trim() === values.supplier.toLowerCase().trim());

      try {
        if (!matchedSupplier || !matchedSupplier.id || typeof matchedSupplier.id !== 'number') {
          const createSupRes = await suppliersApi.create({ name: values.supplier.trim() });
          if (createSupRes.success && createSupRes.data?.supplierId) {
            supplierId = createSupRes.data.supplierId;
            matchedSupplier = { id: supplierId, name: values.supplier.trim() };
            setSuppliersList((curr) => [...curr, matchedSupplier]);
          }
        } else {
          supplierId = matchedSupplier.id;
        }

        const orderWithSup = {
          ...result.order,
          supplier: values.supplier.trim(),
          supplier_id: supplierId,
        };

        setPoOrders((current) => [orderWithSup, ...current]);
        logEvent({
          module: 'Purchase Orders',
          action: 'Order created',
          reference: result.order.id,
          details: `${values.supplier.trim()} · Pending approval`,
          changes: [{ field: 'PO status', before: 'Not created', after: 'Pending' }],
        });

        const poItems = [];
        for (const p of values.products) {
          const matchedItem = inventoryItems.find(
            (it) =>
              (it.sku && it.sku.toLowerCase() === p.code?.toLowerCase()) ||
              (it.code && it.code.toLowerCase() === p.code?.toLowerCase()) ||
              it.id === p.product_id ||
              (it.name && it.name.toLowerCase() === p.name?.toLowerCase())
          );
          let productId = matchedItem?.id;
          if (!productId || typeof productId !== 'number') {
            try {
              const createProdRes = await productsApi.create({
                name: p.name || p.code || 'Product',
                sku: p.code || `SKU-${Date.now()}`,
                price: Number(p.unitPrice) || 0,
                supplier_id: supplierId,
                stock_quantity: 0,
                unit: 'pcs',
              });
              if (createProdRes.success && (createProdRes.data?.productId || createProdRes.data?.id)) {
                productId = createProdRes.data?.productId || createProdRes.data?.id;
              }
            } catch (_) {}
          }
          if (!productId && inventoryItems.length > 0) {
            productId = inventoryItems[0].id;
          }
          poItems.push({
            product_id: productId || 6,
            quantity: Number(p.quantity) || 1,
            price: Number(p.unitPrice) || 0,
          });
        }
        if (poItems.length > 0) {
          const res = await purchaseOrdersApi.create({
            po_number: result.order.id,
            supplier_id: supplierId,
            expected_date: values.expected,
            payment_terms: values.terms || 'Net 30',
            reference: values.reference || '',
            notes: values.notes || '',
            deliver_to: values.deliverTo || 'Main Warehouse',
            total_amount: result.order.total,
            status: 'pending',
            items: poItems,
          });
          if (res.success && (res.data?.poId || res.data?.id)) {
            const backendId = res.data?.poId || res.data?.id;
            setPoOrders((current) =>
              current.map((row) =>
                row.id === result.order.id
                  ? { ...row, backendId, supplier: values.supplier.trim(), supplier_id: supplierId }
                  : row
              )
            );
          }
        }
      } catch (err) {
        console.error('Failed to create PO on backend:', err);
      }
    }
    return result;
  }

  // Suppliers Management
  async function createSupplier(data) {
    try {
      const res = await suppliersApi.create(data);
      if (!res.success) {
        if (res.status === 401 || res.data?.message?.toLowerCase().includes('token')) {
          return { error: 'Sesi login telah berakhir atau token tidak ditemukan. Silakan logout lalu login kembali dengan akun Manager.' };
        }
        const errorMsg = res.data?.error
          ? `${res.data.message || 'Error'}: ${res.data.error}`
          : (res.data?.message || res.error || 'Gagal menyimpan supplier ke database MySQL');
        return { error: errorMsg };
      }
      const newId = res.data?.supplierId;
      const newSupplier = { id: newId, ...data, created_at: new Date().toISOString() };
      setSuppliersList((current) => [newSupplier, ...current]);

      try {
        const refreshed = await suppliersApi.getAll();
        if (Array.isArray(refreshed) && refreshed.length > 0) {
          setSuppliersList(refreshed);
        }
      } catch (syncErr) {
        console.warn('Sync suppliers warning:', syncErr);
      }

      logEvent({
        module: 'Suppliers',
        action: 'Supplier created',
        reference: `SUP-${String(newId).padStart(3, '0')}`,
        details: `${data.name} · PIC: ${data.contact_person || '-'}`,
      });
      return { success: true, supplier: newSupplier };
    } catch (err) {
      return { error: err.message || 'Gagal menyimpan supplier' };
    }
  }

  async function updateSupplier(id, data) {
    try {
      const res = await suppliersApi.update(id, data);
      if (!res.success) {
        if (res.status === 401 || res.data?.message?.toLowerCase().includes('token')) {
          return { error: 'Sesi login telah berakhir atau token tidak ditemukan. Silakan logout lalu login kembali dengan akun Manager.' };
        }
        const errorMsg = res.data?.error
          ? `${res.data.message || 'Error'}: ${res.data.error}`
          : (res.data?.message || res.error || 'Gagal memperbarui data supplier di database');
        return { error: errorMsg };
      }
      setSuppliersList((current) => current.map((s) => (s.id === id ? { ...s, ...data } : s)));

      try {
        const refreshed = await suppliersApi.getAll();
        if (Array.isArray(refreshed) && refreshed.length > 0) {
          setSuppliersList(refreshed);
        }
      } catch (syncErr) {
        console.warn('Sync suppliers warning:', syncErr);
      }

      logEvent({
        module: 'Suppliers',
        action: 'Supplier updated',
        reference: `SUP-${String(id).padStart(3, '0')}`,
        details: `Updated info for ${data.name}`,
      });
      return { success: true };
    } catch (err) {
      return { error: err.message || 'Gagal memperbarui supplier' };
    }
  }

  async function deleteSupplier(id) {
    try {
      const matched = suppliersList.find((s) => s.id === id);
      const res = await suppliersApi.remove(id);
      if (!res.success) {
        if (res.status === 401 || res.data?.message?.toLowerCase().includes('token')) {
          return { error: 'Sesi login telah berakhir atau token tidak ditemukan. Silakan logout lalu login kembali dengan akun Manager.' };
        }
        const errorMsg = res.data?.error
          ? `${res.data.message || 'Error'}: ${res.data.error}`
          : (res.data?.message || res.error || 'Gagal menghapus supplier dari database');
        return { error: errorMsg };
      }
      setSuppliersList((current) => current.filter((s) => s.id !== id));

      try {
        const refreshed = await suppliersApi.getAll();
        if (Array.isArray(refreshed)) {
          setSuppliersList(refreshed);
        }
      } catch (syncErr) {
        console.warn('Sync suppliers warning:', syncErr);
      }

      logEvent({
        module: 'Suppliers',
        action: 'Supplier deleted',
        reference: `SUP-${String(id).padStart(3, '0')}`,
        details: `Deleted supplier ${matched?.name || id}`,
        severity: 'Warning',
      });
      return { success: true };
    } catch (err) {
      return { error: err.message || 'Gagal menghapus supplier' };
    }
  }

  async function registerCatalogProduct(productData) {
    try {
      let finalImageUrl = productData.image_url || null;
      if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
        try {
          const upRes = await uploadApi.uploadImage(finalImageUrl, 'products', productData.sku);
          if (upRes.success && upRes.url) {
            finalImageUrl = upRes.url;
          }
        } catch (upErr) {
          console.warn('Upload image warning, using data URI fallback:', upErr);
        }
      }

      const res = await productsApi.create({
        name: productData.name.trim(),
        sku: productData.sku.trim(),
        category_id: productData.category_id ? Number(productData.category_id) : null,
        supplier_id: productData.supplier_id ? Number(productData.supplier_id) : null,
        stock_quantity: Number(productData.stock_quantity) || 0,
        unit: productData.unit || 'pcs',
        price: Number(productData.price) || 0,
        location_id: productData.location_id ? Number(productData.location_id) : 1,
        image_url: finalImageUrl,
        description: productData.notes || productData.description || '',
      });

      if (!res.success) {
        const errorMsg = res.data?.message || res.error || 'Gagal mendaftarkan produk katalog ke database';
        return { error: errorMsg };
      }

      const newId = res.data?.productId;
      const matchedSupplier = suppliersList.find((s) => s.id === Number(productData.supplier_id));
      const supplierName = matchedSupplier?.name || productData.supplier_name || 'Warehouse Partner';

      const newProductItem = {
        id: newId,
        sku: productData.sku.trim(),
        name: productData.name.trim(),
        category: productData.category_name || 'General',
        category_id: productData.category_id ? Number(productData.category_id) : null,
        current: Number(productData.stock_quantity) || 0,
        reorder: Number(productData.reorder) || 15,
        unit: productData.unit || 'pcs',
        price: Number(productData.price) || 0,
        rack: 'A-01',
        zone: 'Zone A',
        location_id: productData.location_id || 1,
        image_url: finalImageUrl,
        description: productData.notes || '',
        notes: productData.notes || '',
        status: stockStatus({ current: Number(productData.stock_quantity) || 0, reorder: Number(productData.reorder) || 15 }),
        warehouse: 'Main Warehouse',
        supplier: supplierName,
        supplier_id: Number(productData.supplier_id),
      };

      setInventoryItems((curr) => [newProductItem, ...curr]);

      try {
        const refreshedProds = await productsApi.getAll();
        if (Array.isArray(refreshedProds) && refreshedProds.length > 0) {
          const mapped = refreshedProds.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category_name || 'General',
            category_id: p.category_id,
            current: Number(p.stock_quantity) || 0,
            reorder: Number(p.reorder_level) || 15,
            unit: p.unit || 'pcs',
            price: Number(p.price) || 0,
            rack: p.location_code || p.zone_location || 'A-01',
            zone: p.zone || 'Zone A',
            location_id: p.location_id,
            image_url: p.image_url || null,
            description: p.description || '',
            notes: p.description || '',
            status: stockStatus({ current: Number(p.stock_quantity) || 0, reorder: Number(p.reorder_level) || 15 }),
            warehouse: 'Main Warehouse',
            supplier: p.supplier_name || 'Warehouse Partner',
            supplier_id: p.supplier_id,
          }));
          setInventoryItems(mapped);
        }
      } catch (syncErr) {
        console.warn('Sync products warning:', syncErr);
      }

      logEvent({
        module: 'Suppliers',
        action: 'Catalog product registered',
        reference: newProductItem.sku,
        details: `${newProductItem.name} for ${supplierName}`,
      });

      return { success: true, product: newProductItem };
    } catch (err) {
      return { error: err.message || 'Gagal mendaftarkan produk' };
    }
  }

  // Outbound Operations
  async function createOutbound(draft) {
    // Validasi stok sebelum membuat outbound
    if (Array.isArray(draft.products) && draft.products.length > 0) {
      const stockWarnings = draft.products
        .map((p) => {
          const invItem = inventoryItems.find((it) => it.sku === (p.code || p.sku));
          if (!invItem) return null;
          const available = Number(invItem.current) || 0;
          const requested = Number(p.quantity) || 0;
          if (available < requested) {
            return `${invItem.name} (${p.code || p.sku}): stok tersedia ${available}, diminta ${requested}`;
          }
          return null;
        })
        .filter(Boolean);

      if (stockWarnings.length > 0) {
        return {
          error: `Stok tidak mencukupi untuk ${stockWarnings.length} produk:\n• ${stockWarnings.join('\n• ')}\n\nPerbarui stok terlebih dahulu melalui Inbound sebelum membuat outbound.`,
          stockWarning: true,
        };
      }
    }

    const result = createOutboundRecord({
      draft,
      shipments: outboundShipments,
      inventory: inventoryItems,
      user: effectiveManager.fullName,
      date: new Date().toISOString(),
    });
    if (result.error) return result;
    setOutboundShipments((current) => [result.shipment, ...current]);
    logEvent({
      module: 'Outbound',
      action: 'Outbound created',
      reference: result.shipment.id,
      details: `${result.shipment.units} units scheduled`,
      changes: [{ field: 'Status', before: 'Not created', after: 'Scheduled' }],

    });

    try {
      const itemsToSchedule = draft.products.map((p) => {
        const item = inventoryItems.find((it) => it.sku === (p.sku || p.code));
        return {
          product_id: item?.id || p.id || 1,
          quantity: Number(p.quantity) || 0,
          sku: p.sku || p.code,
        };
      });

      const res = await outboundApi.create({
        outbound_number: result.shipment.id,
        outbound_type: draft.type,
        destination: draft.destination,
        reference: draft.reference,
        scheduled_date: draft.date,
        scheduled_time: draft.time,
        priority: draft.priority,
        assigned_staff: draft.staff || effectiveManager.fullName,
        units: result.shipment.units,
        items_count: result.shipment.items,
        notes: draft.notes,
        carrier: draft.carrier,
        items: itemsToSchedule,
      });

      if (res.success && res.data?.shipmentId) {
        setOutboundShipments((current) =>
          current.map((row) => (row.id === result.shipment.id ? { ...row, backendId: res.data.shipmentId } : row))
        );
      }
    } catch (err) {
      console.error('Failed to sync outbound creation to backend:', err);
    }

    return result;
  }

  function startOutboundPicking(id) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || shipment.status !== 'Scheduled') return { error: 'Only Scheduled shipments can start picking.' };
    const error = validateOutboundItems(shipment.products, inventoryItems);
    if (error) return { error };
    const updated = { ...shipment, status: 'Picking', pickingStartedAt: new Date().toISOString() };
    setOutboundShipments((current) => current.map((row) => (row.id === id ? updated : row)));
    setOutboundDrafts((current) => ({ ...current, [id]: current[id] || newFulfillmentDraft(updated) }));
    logEvent({
      module: 'Outbound',
      action: 'Picking started',
      reference: id,
      details: 'Scheduled order started picking',
      changes: [{ field: 'Status', before: shipment.status, after: updated.status }],
    });

    outboundApi.updateStatus(shipment.backendId || id, 'Picking').catch(() => {});

    return { shipment: updated };
  }

  async function markOutboundArrived(id) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || shipment.status !== 'Scheduled') return { error: 'Only a Scheduled shipment can be marked as arrived.' };
    const updated = { ...shipment, status: 'Arrived', arrivedAt: new Date().toISOString(), arrivedBy: effectiveManager.fullName };
    setOutboundShipments((current) => current.map((row) => (row.id === id && row.status === 'Scheduled' ? updated : row)));
    logEvent({
      module: 'Outbound',
      action: 'Outbound vehicle arrived at dock',
      reference: id,
      status: 'Updated',
      details: `Dock ${updated.dock || '1'} · ${updated.date} · ${updated.time}`,
      changes: [{ field: 'Status', before: 'Scheduled', after: 'Arrived' }],
    });
    try {
      await outboundApi.updateStatus(shipment.backendId || id, 'Arrived');
    } catch (err) {
      console.error('Failed to update outbound status to Arrived:', err);
    }
    return { shipment: updated };
  }

  async function updateOutboundStaff(id, assignedStaff) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment) return { error: 'Outbound shipment not found.' };

    const staffName = assignedStaff ? assignedStaff.trim() : 'Semua Staf Lapangan';
    const updated = {
      ...shipment,
      staff: staffName,
      assigned_staff: staffName,
    };

    setOutboundShipments((current) => current.map((row) => (row.id === id ? updated : row)));
    logEvent({
      module: 'Outbound',
      action: 'Staff assignment updated',
      reference: id,
      status: 'Updated',
      details: `Assigned to ${staffName}`,
      changes: [{ field: 'Assigned Staff', before: shipment.staff, after: staffName }],
    });

    try {
      await outboundApi.update(shipment.backendId || id, {
        assigned_staff: staffName,
      });
    } catch (err) {
      console.error('Failed to update outbound staff assignment:', err);
    }

    return { shipment: updated };
  }

  function saveOutboundDraft(id, draft) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || shipment.dispatch || shipment.pickIssue) return;
    setOutboundDrafts((current) => ({ ...current, [id]: draft }));
  }

  function advanceOutbound(id, draft) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || !['Scheduled', 'Picking', 'Packing', 'Ready to Ship'].includes(shipment.status) || shipment.dispatch || shipment.pickIssue) {
      return { error: 'This shipment cannot continue.' };
    }
    if (!['pick', 'pack', 'ready'].includes(draft.stage)) return { error: 'Unknown fulfillment stage.' };
    const error =
      draft.stage === 'ready'
        ? validatePacked(shipment, draft, inventoryItems)
        : draft.stage === 'pack'
        ? validatePicked(shipment, draft, inventoryItems)
        : '';
    if (error) return { error };
    const updated = {
      ...shipment,
      status: { pick: 'Picking', pack: 'Packing', ready: 'Ready to Ship' }[draft.stage],
    };
    setOutboundShipments((current) => current.map((row) => (row.id === id ? updated : row)));
    setOutboundDrafts((current) => ({ ...current, [id]: { ...draft, savedAt: new Date().toISOString() } }));
    if (shipment.status !== updated.status) {
      logEvent({
        module: 'Outbound',
        action: 'Fulfilment stage updated',
        reference: id,
        status: 'Updated',
        details: updated.status,
        changes: [{ field: 'Status', before: shipment.status, after: updated.status }],
      });
      outboundApi.updateStatus(shipment.backendId || id, updated.status).catch(() => {});
    }
    return { shipment: updated };
  }

  async function completeOutbound(id, draft) {
    const shipment = outboundShipments.find((row) => row.id === id);
    const result = shipOutbound({
      shipment,
      draft,
      inventory: inventoryItems,
      movements,
      user: effectiveManager.fullName,
      date: new Date().toISOString(),
    });
    if (result.error) return result;
    setInventoryItems(result.inventory);
    setMovements(result.movements);
    setOutboundShipments((current) => current.map((row) => (row.id === id ? result.shipment : row)));
    setOutboundDrafts((current) => ({ ...current, [id]: result.draft }));
    logEvent({
      module: 'Outbound',
      action: 'Outbound shipped',
      reference: id,
      details: `${result.shipment.dispatch.units} units shipped`,
      changes: [
        { field: 'Status', before: shipment.status, after: 'Shipped' },
        ...result.shipment.dispatch.stockChanges.map((row) => ({ field: row.sku, before: row.before, after: row.after })),
      ],
    });

    try {
      const itemsShipped = (result.shipment.dispatch?.stockChanges || []).map((sc) => {
        const item = inventoryItems.find((it) => it.sku === sc.sku);
        return {
          product_id: item?.id || 1,
          quantity: sc.before - sc.after,
        };
      });

      if (itemsShipped.length > 0) {
        await outboundApi.dispatchShipment(shipment.backendId || id, {
          carrier: draft.carrier || 'Express',
          tracking_number: draft.tracking || 'TRK-DEFAULT',
          items: itemsShipped,
          notes: `Dispatched outbound order ${id}`,
        });

        // Sinkronisasi ulang stok master dan mutasi dari database MySQL
        const freshProducts = await productsApi.getAll();
        if (Array.isArray(freshProducts) && freshProducts.length > 0) {
          setInventoryItems((current) =>
            current.map((inv) => {
              const matched = freshProducts.find((p) => p.sku === inv.sku || p.id === inv.id);
              return matched
                ? { ...inv, current: matched.stock_quantity, updated: new Date().toISOString() }
                : inv;
            })
          );
        }
      }
    } catch (err) {
      console.error('Failed to sync outbound dispatch to backend:', err);
    }

    return result;
  }

  function reportOutboundIssue(id, issue, draft) {
    const shipment = outboundShipments.find((row) => row.id === id);
    if (!shipment || !['Picking', 'Scheduled'].includes(shipment.status) || !['Missing stock', 'Damaged stock', 'Wrong stock'].includes(issue.type) || !issue.notes.trim()) {
      return { error: 'Choose an issue type and provide notes for an active picking order.' };
    }
    const updated = {
      ...shipment,
      status: 'Issue',
      pickIssue: { ...issue, reportedAt: new Date().toISOString(), user: effectiveManager.fullName },
    };
    setOutboundShipments((current) => current.map((row) => (row.id === id ? updated : row)));
    setOutboundDrafts((current) => ({ ...current, [id]: draft }));
    logEvent({
      module: 'Outbound',
      action: 'Pick issue reported',
      reference: id,
      severity: 'Warning',
      details: issue.notes,
      changes: [{ field: 'Status', before: shipment.status, after: 'Issue' }],
    });

    outboundApi.updateStatus(shipment.backendId || id, 'Issue').catch(() => {});

    return { shipment: updated };
  }

  function reviewOutboundIssue(id, values) {
    const result = resolveOutboundIssue({
      shipment: outboundShipments.find((row) => row.id === id),
      shipments: outboundShipments,
      inventory: inventoryItems,
      draft: outboundDrafts[id],
      values,
      user: effectiveManager.fullName,
      date: new Date().toISOString(),
    });
    if (result.error) return result;
    setOutboundShipments((current) => {
      const next = current.map((row) => (row.id === id ? result.shipment : row));
      return result.backorder ? [result.backorder, ...next] : next;
    });
    if (result.draft) setOutboundDrafts((current) => ({ ...current, [id]: result.draft }));
    logEvent({
      module: 'Outbound',
      action: result.onHold ? 'Shipment held' : 'Pick issue resolved',
      reference: id,
      details: values.note,
      changes: [{ field: 'Status', before: 'Issue', after: result.shipment.status }],
    });

    outboundApi.updateStatus(id, result.shipment.status).catch(() => {});

    return result;
  }

  // Inbound Operations
  async function startInboundInspection(id, options = null) {
    const shipment = shipments.find((row) => row.id === id);
    if (!shipment) return;

    const assignedStaff = typeof options === 'object' && options?.assigned_staff ? options.assigned_staff : shipment.staff;
    const notes = typeof options === 'object' && options?.notes ? options.notes : 'Ditugaskan ke staf dok untuk inspeksi fisik & scan barcode';

    const updated = { 
      ...shipment, 
      status: 'Inspecting', 
      staff: assignedStaff, 
      assigned_staff: assignedStaff, 
      notes, 
      inspectedAt: new Date().toISOString() 
    };
    setShipments((current) => current.map((row) => (row.id === id ? updated : row)));

    logEvent({
      module: 'Inbound',
      action: 'Inspection dispatched to staff',
      reference: id,
      details: `Ditugaskan ke ${assignedStaff} · ${shipment.supplier} · ${shipment.po}`,
      changes: [{ field: 'Status', before: shipment.status, after: 'Inspecting' }],
    });

    inboundApi.inspect(shipment.backendId || id, {
      status: 'Inspecting',
      inspector: assignedStaff,
      notes,
    }).catch((err) => console.error('Failed to sync inspecting status to backend:', err));
  }

  function saveReceivingDraft(id, draft) {
    setReceivingDrafts((current) => ({ ...current, [id]: draft }));
    setShipments((current) => current.map((row) => (row.id === id && row.status === 'Arrived' ? { ...row, status: 'Inspecting' } : row)));

    const shipment = shipments.find((row) => row.id === id);
    if (shipment) {
      inboundApi.inspect(shipment.backendId || id, {
        inspector: effectiveManager?.fullName,
        notes: draft?.notes,
      }).catch(() => {});
    }
  }

  async function completeReceiving(id, draft) {
    const shipment = shipments.find((row) => row.id === id);
    if (!shipment) return 'Shipment not found.';
    const linkedPO = poOrders.find((row) => row.id === shipment.po);
    if (linkedPO && !preferences.warehouse?.allowPartial && inspectionSummary(draft.rows).accepted < poReceivingTotals(linkedPO).remaining) {
      return 'Partial PO receipts are disabled in Warehouse Preferences.';
    }

    const result = receiveShipment({
      shipment,
      draft,
      inventory: inventoryItems,
      movements,
      racks,
      user: effectiveManager.fullName,
      date: new Date().toISOString(),
    });
    if (result.error) return result.error;
    setInventoryItems(result.inventory);
    setMovements(result.movements);
    setRacks(result.racks);
    setShipments((current) => current.map((row) => (row.id === id ? result.shipment : row)));
    setPoOrders((current) => current.map((order) => (order.id === shipment.po ? recordPOReceipt(order, result.shipment.receipt, id) : order)));
    setReceivingDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    logEvent({
      module: 'Inbound',
      action: 'Goods received',
      reference: id,
      details: `Accepted ${result.shipment.receipt.summary.accepted} units · ${shipment.po}`,
      changes: [
        { field: 'Status', before: shipment.status, after: 'Received' },
        ...result.shipment.receipt.stockChanges.map((row) => ({ field: row.sku, before: row.before, after: row.after })),
      ],
    });

    // Sinkronisasi ke Backend MySQL
    try {
      const itemsToReceive = (result.shipment.receipt?.stockChanges || []).map((sc) => {
        const item = inventoryItems.find((it) => it.sku === sc.sku);
        return {
          product_id: item?.id || 1,
          accepted_qty: sc.after - sc.before,
          notes: `Received via Inbound ${id}`,
        };
      });

      if (itemsToReceive.length > 0) {
        await inboundApi.completeReceiving(shipment.backendId || id, itemsToReceive, `Goods received for PO ${shipment.po}`);
      }

      const matchedPO = poOrders.find((row) => row.id === shipment.po);
      if (matchedPO?.backendId) {
        const updatedPO = recordPOReceipt(matchedPO, result.shipment.receipt, id);
        await purchaseOrdersApi.updateStatus(matchedPO.backendId, updatedPO.status.toLowerCase());
      }
      await loadRemoteData();
    } catch (err) {
      console.error('Failed to sync receiving to backend:', err);
    }

    return '';
  }

  function resolveIssue(id, values) {
    const shipment = shipments.find((row) => row.id === id);
    const result = resolveInboundIssue({
      shipment,
      ...values,
      inventory: inventoryItems,
      racks,
      existingDraft: receivingDrafts[id],
      user: effectiveManager.fullName,
      date: new Date().toISOString(),
    });
    if (result.error) return result;
    setShipments((current) => current.map((row) => (row.id === id ? result.shipment : row)));
    setReceivingDrafts((current) => ({ ...current, [id]: result.draft }));
    logEvent({
      module: 'Inbound',
      action: 'Receiving issue resolved',
      reference: id,
      details: result.shipment.issueResolution?.title || 'Resolution saved',
      changes: [],
    });

    inboundApi.updateStatus(shipment.backendId || id, result.shipment.status, values.note).catch(() => {});

    return result;
  }

  async function markInboundArrived(id) {
    const shipment = shipments.find((row) => row.id === id);
    if (!shipment || shipment.status !== 'Scheduled') return { error: 'Only a Scheduled shipment can be marked as arrived.' };
    const updated = { ...shipment, status: 'Arrived', arrivedAt: new Date().toISOString(), arrivedBy: effectiveManager.fullName };
    setShipments((current) => current.map((row) => (row.id === id && row.status === 'Scheduled' ? updated : row)));
    logEvent({
      module: 'Inbound',
      action: 'Shipment arrived',
      reference: id,
      status: 'Updated',
      details: `${updated.date} · ${updated.time}`,
      changes: [
        { field: 'Status', before: shipment.status, after: updated.status },
        { field: 'Date', before: shipment.date, after: updated.date },
      ],
    });

    try {
      await inboundApi.updateStatus(shipment.backendId || id, 'Arrived');
    } catch (err) {
      console.error('Failed to sync arrived status to backend:', err);
    }

    return { shipment: updated };
  }

  async function editInboundSchedule(id, draft) {
    const shipment = shipments.find((row) => row.id === id);
    if (!shipment || shipment.status !== 'Scheduled') return { error: 'Only Scheduled shipments can be rescheduled.' };
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(draft.date) &&
      !Number.isNaN(Date.parse(draft.date)) &&
      new Date(draft.date).toISOString().slice(0, 10) === draft.date;
    const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validDate || !validTime(draft.time)) return { error: 'Choose a valid arrival date and start time.' };
    if (draft.endTime && (!validTime(draft.endTime) || draft.endTime <= draft.time)) {
      return { error: 'End time must be later than start time on the same day.' };
    }
    if (!draft.dock?.trim()) return { error: 'Enter a receiving dock.' };
    if (!draft.staff?.trim()) return { error: 'Enter an assigned staff member.' };
    const updated = {
      ...shipment,
      date: draft.date,
      time: draft.time,
      endTime: draft.endTime || '',
      dock: draft.dock.trim().toUpperCase(),
      staff: draft.staff.trim(),
      scheduleUpdatedAt: new Date().toISOString(),
    };
    setShipments((current) => current.map((row) => (row.id === id && row.status === 'Scheduled' ? updated : row)));
    logEvent({
      module: 'Inbound',
      action: 'Schedule updated',
      reference: id,
      status: 'Updated',
      details: `${updated.date} · ${updated.time}`,
      changes: [
        { field: 'Status', before: shipment.status, after: updated.status },
        { field: 'Date', before: shipment.date, after: updated.date },
      ],
    });

    try {
      await inboundApi.update(shipment.backendId || id, {
        scheduled_date: draft.date,
        scheduled_time: draft.time,
        dock: draft.dock,
        assigned_staff: draft.staff,
      });
    } catch (err) {
      console.error('Failed to sync schedule update to backend:', err);
    }

    return { shipment: updated };
  }

  async function updateInboundStaff(id, assignedStaff) {
    const shipment = shipments.find((row) => row.id === id);
    if (!shipment) return { error: 'Shipment not found.' };

    const staffName = (assignedStaff || '').trim() || 'Semua Staf Lapangan';
    const updated = {
      ...shipment,
      staff: staffName,
      assigned_staff: staffName,
      assignedStaff: staffName,
    };
    setShipments((current) => current.map((row) => (row.id === id ? updated : row)));

    logEvent({
      module: 'Inbound',
      action: 'Staff assignment updated',
      reference: id,
      status: 'Updated',
      details: `Ditugaskan ke: ${staffName}`,
      changes: [
        { field: 'Assigned to', before: shipment.staff || shipment.assigned_staff || 'Staf Dok', after: staffName },
      ],
    });

    try {
      await inboundApi.update(shipment.backendId || id, {
        assigned_staff: staffName,
      });
    } catch (err) {
      console.error('Failed to sync staff assignment to backend:', err);
    }

    return { success: true, shipment: updated };
  }

  async function createInbound(draft) {
    if (!poOrders.some((row) => row.id === draft.po && row.status === 'Approved') || shipments.some((row) => row.po === draft.po))
      return null;
    const nextNumber = Math.max(1000, ...shipments.map((row) => Number(String(row.id).replace('INB-', '')) || 0)) + 1;
    const generatedId = `INB-${nextNumber}`;
    const shipment = {
      ...draft,
      scheduledAt: new Date().toISOString(),
      scheduledBy: effectiveManager.fullName,
      carrier: (draft.carrier || '').trim(),
      reference: (draft.reference || '').trim(),
      id: generatedId,
    };
    setShipments((current) => [shipment, ...current]);
    logEvent({
      module: 'Inbound',
      action: 'Inbound created',
      reference: shipment.id,
      details: `${shipment.po} · ${shipment.units} units`,
      changes: [{ field: 'Status', before: 'Not created', after: 'Scheduled' }],
    });

    try {
      const matchedPO = poOrders.find((row) => row.id === draft.po);
      const poProducts = matchedPO?.products || draft.products || [];
      const res = await inboundApi.create({
        inbound_number: generatedId,
        purchase_order_id: matchedPO?.backendId || (matchedPO ? Number(String(matchedPO.id).replace(/\D/g, '')) : null),
        po_number: draft.po,
        supplier_id: matchedPO?.supplier_id || null,
        supplier_name: draft.supplier,
        scheduled_date: draft.date,
        scheduled_time: draft.time,
        dock: draft.dock,
        assigned_staff: draft.staff,
        carrier: draft.carrier,
        reference: draft.reference,
        units: draft.units,
        items_count: draft.items || poProducts.length || 1,
        items: poProducts.map((p) => {
          const invItem = inventoryItems.find((it) => it.sku === (p.code || p.sku));
          return {
            product_id: invItem?.id || p.id || 1,
            quantity: p.quantity || p.ordered || 0,
            notes: `Item from ${draft.po}`,
          };
        }),
      });
      if (res.success && res.data?.shipmentId) {
        setShipments((current) =>
          current.map((row) => (row.id === generatedId ? { ...row, backendId: res.data.shipmentId } : row))
        );
      }
    } catch (err) {
      console.error('Failed to sync inbound creation to backend:', err);
    }

    return shipment;
  }

  function signOut(reason = 'manual') {
    try { localStorage.removeItem('susuno_demo_mode'); } catch (_) {}
    clearAuthSession();
    logEvent({
      module: 'Authentication',
      action: reason === 'idle' ? 'Session expired' : 'Signed out',
      reference: 'Session',
      details: reason === 'idle' ? 'Frontend inactivity timeout reached' : 'Frontend session signed out',
    });
    setSecurity(null);
    setManager(null);
    setStep('signin');
  }

  async function saveProduct(draft) {
    const original = inventoryItems.find((item) => item.sku === draft.sku);
    const updated = new Date().toISOString().slice(0, 16);
    const { reason, ...item } = draft;
    const changes = ['name', 'category', 'current', 'reorder', 'rack', 'supplier', 'barcode']
      .filter((key) => original && original[key] !== item[key])
      .map((key) => ({ field: key, before: original[key], after: item[key] }));
    if (changes.length) {
      logEvent({
        module: 'Inventory',
        action: original?.current !== item.current ? 'Stock adjusted' : 'Product updated',
        reference: item.sku,
        status: 'Updated',
        details: `${item.name} · ${reason || 'Product fields updated'}`,
        changes,
      });
    }
    setInventoryItems((current) => current.map((row) => (row.sku === item.sku ? { ...item, updated } : row)));
    if (original && original.current !== item.current) {
      setMovements((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sku: item.sku,
          category: item.category,
          date: updated,
          type: 'Stock adjustment',
          reference: `ADJ-${Date.now()}`,
          before: original.current,
          change: item.current - original.current,
          after: item.current,
          rack: item.rack,
          user: effectiveManager.fullName,
          reason: (reason || '').trim(),
          warehouse: item.warehouse,
        },
      ]);
    }

    try {
      if (original?.id) {
        let finalImageUrl = item.image_url !== undefined ? item.image_url : (original.image_url || null);
        if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
          try {
            const upRes = await uploadApi.uploadImage(finalImageUrl, 'products', item.sku);
            if (upRes.success && upRes.url) {
              finalImageUrl = upRes.url;
            }
          } catch (upErr) {
            console.warn('Upload image warning:', upErr);
          }
        }

        await productsApi.update(original.id, {
          name: item.name,
          sku: item.sku,
          category_id: item.category_id !== undefined ? item.category_id : original.category_id,
          supplier_id: item.supplier_id !== undefined ? item.supplier_id : original.supplier_id,
          unit: item.unit || original.unit,
          stock_quantity: item.current !== undefined ? item.current : original.current,
          price: item.price !== undefined ? item.price : original.price,
          location_id: item.location_id !== undefined ? item.location_id : original.location_id,
          image_url: finalImageUrl,
          description: item.notes || item.description !== undefined ? (item.notes || item.description) : (original.description || ''),
        });
        if (original.current !== item.current) {
          await transactionsApi.create({
            product_id: original.id,
            type: item.current > original.current ? 'in' : 'out',
            quantity: Math.abs(item.current - original.current),
            notes: reason || 'Stock adjustment from Web',
          });
        }
      } else {
        let finalImageUrl = item.image_url || null;
        if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
          try {
            const upRes = await uploadApi.uploadImage(finalImageUrl, 'products', item.sku);
            if (upRes.success && upRes.url) {
              finalImageUrl = upRes.url;
            }
          } catch (upErr) {
            console.warn('Upload image warning:', upErr);
          }
        }

        const res = await productsApi.create({
          name: item.name,
          sku: item.sku,
          category_id: item.category_id,
          supplier_id: item.supplier_id,
          stock_quantity: item.current || 0,
          price: item.price || 0,
          unit: item.unit || 'pcs',
          location_id: item.location_id || 1,
          image_url: finalImageUrl,
          description: item.notes || item.description || '',
        });
        if (res.success && res.data?.productId) {
          setInventoryItems((current) =>
            current.map((row) => (row.sku === item.sku ? { ...row, id: res.data.productId, image_url: finalImageUrl } : row))
          );
        }
      }
    } catch (err) {
      console.error('Failed to sync product to backend:', err);
    }
  }

  function backToSignIn(email = recoveryEmail) {
    setLoginEmail(email);
    setResetExpiresAt(0);
    setStep('signin');
  }

  function sendResetLink(email) {
    setRecoveryEmail(email);
    setResetExpiresAt(Date.now() + 15 * 60 * 1000);
    setStep('reset-link-sent');
  }

  function continueFromManager(data) {
    setManager(data);
    setStep('warehouse');
  }

  function backToManager(data) {
    setWarehouse(data);
    setStep('manager');
  }

  function continueFromWarehouse(data) {
    setWarehouseDirectory((current) => [...current.filter((row) => row.warehouseName !== data.warehouseName), { ...data }]);
    setPreferences((current) => ({ ...current, warehouse: { ...current.warehouse, name: data.warehouseName } }));
    setWarehouse(data);
    setStep('security');
  }

  function backToWarehouse(data) {
    setSecurity(data);
    setStep('warehouse');
  }

  function changeEmail(data) {
    setSecurity(data);
    setStep('manager');
  }

  async function handleSignIn(credentials) {
    const email = credentials.email.toLowerCase();
    const result = await authApi.login(credentials);

    if (result.success) {
      setManager({ fullName: result.user.name, email: result.user.email, role: result.user.role });
      setLoginEmail(result.user.email);
      failedSignIns.current[email] = 0;
      logEvent({
        module: 'Authentication',
        action: 'Signed in',
        reference: 'Session',
        details: `Manager ${result.user.name} logged in via backend API`,
      });
      if (preferences.security?.twoStep) {
        setStep('manager-verification');
      } else {
        finishSignIn();
      }
      return { success: true };
    }

    // Demo fallback for manager login
    if (email === 'demo@warehouse.com' || email === 'manager@test.com' || email === 'manager@test') {
      const demoUser = { fullName: 'Manager Utama', name: 'Manager Utama', email: 'manager@test.com', role: 'manager' };
      try { 
        localStorage.setItem('susuno_demo_mode', 'true'); 
        setAuthSession('demo_token', demoUser);
      } catch (_) {}
      setManager(demoUser);
      setLoginEmail('manager@test.com');
      finishSignIn();
      return { success: true };
    }

    if (result.status === 401 || result.status === 403) {
      failedSignIns.current[email] = (failedSignIns.current[email] || 0) + 1;
      logEvent({
        module: 'Authentication',
        action: 'Login failed',
        user: 'Unauthenticated',
        reference: 'Sign in',
        status: 'Failure',
        severity: failedSignIns.current[email] >= 3 ? 'Critical' : 'Warning',
        details: result.message || `Failed sign-in attempt ${failedSignIns.current[email]} for this session identity`,
        changes: [],
      });
      return { success: false, message: result.message };
    }

    failedSignIns.current[email] = (failedSignIns.current[email] || 0) + 1;
    return {
      success: false,
      message: result.message || 'Email atau password salah',
    };
  }

  // 2. View Routing
  if (step === 'manager-verification') {
    return <SessionVerification onVerify={finishSignIn} onCancel={() => setStep('signin')} />;
  }

  if (step === 'staff-management') {
    return (
      <StaffManagement
        key={managementVisit}
        initialStaffId={staffRequest}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        staff={staffAccounts}
        warehouses={assignedWarehouses}
        regional={preferences.appearance}
        onNavigate={navigatePage}
        onSignOut={signOut}
        onCreate={createStaff}
        onEdit={editStaff}
        onReset={resetStaff}
        onSuspend={suspendStaff}
      />
    );
  }

  if (step === 'settings') {
    return (
      <Settings
        key={managementVisit}
        initialView={settingsView}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        preferences={preferences}
        warehouses={assignedWarehouses}
        onNavigate={navigatePage}
        onSignOut={signOut}
        onSaveProfile={saveManagerProfile}
        onSavePreferences={savePreferences}
        onChangePassword={changeManagerPassword}
        onRevokeSessions={revokeOtherSessions}
        otherSessions={otherSessions}
        currentSession={{
          startedAt: sessionStartedAt,
          passwordChangedAt,
          browser:
            (navigator.userAgent.includes('Edg/')
              ? 'Edge'
              : navigator.userAgent.includes('Chrome/')
              ? 'Chrome'
              : navigator.userAgent.includes('Firefox/')
              ? 'Firefox'
              : 'Browser') +
            ' · ' +
            (navigator.userAgent.includes('Windows')
              ? 'Windows'
              : navigator.userAgent.includes('Android')
              ? 'Android'
              : navigator.userAgent.includes('Mac')
              ? 'macOS'
              : 'Current device'),
        }}
        securityEvents={auditEvents.filter(
          (row) =>
            row.module === 'Authentication' ||
            (row.module === 'Settings' && ['Password changed', 'Two-step verification updated', 'Demo sessions removed'].includes(row.action))
        )}
      />
    );
  }

  if (step === 'dashboard') {
    return (
      <Dashboard
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        inventory={inventoryItems}
        shipments={shipments}
        orders={poOrders}
        onNavigate={navigatePage}
        onSignOut={signOut}
      />
    );
  }

  if (step === 'reports') {
    return (
      <Reports
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        items={inventoryItems}
        movements={movements}
        orders={poOrders}
        onNavigate={navigatePage}
        onSignOut={signOut}
        onAudit={auditExport('Reports')}
        onMovements={() => {
          setReportSku(null);
          setReportReference(null);
          setReportOrigin('reports');
          setStep('movement-reports');
        }}
      />
    );
  }

  if (step === 'audit-trail') {
    return (
      <AuditTrail
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        events={auditEvents}
        onNavigate={navigatePage}
        onSignOut={signOut}
        onAudit={auditExport('Audit Trail')}
        onOpenReference={openAuditReference}
      />
    );
  }

  if (step === 'purchase-orders') {
    return (
      <PurchaseOrders
        initialOrderId={poRequest}
        initialSupplier={poSupplierRequest}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        orders={poOrders}
        inventory={inventoryItems}
        suppliers={suppliersList}
        onDecide={decidePO}
        onCreate={createPO}
        racks={sortedRacks}
        shipments={shipments}
        onReceive={receivePO}
        onRevise={revisePO}
        onOpenInbound={openPOInbound}
        onMovements={(reference) => {
          setReportOrigin(null);
          setReportSku(null);
          setReportReference(reference);
          setStep('movement-reports');
        }}
        onNavigate={navigatePage}
        onSignOut={signOut}
      />
    );
  }

  if (step === 'suppliers') {
    return (
      <Suppliers
        initialSupplier={supplierRequest}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        suppliers={suppliersList}
        inventory={inventoryItems}
        orders={poOrders}
        onCreateSupplier={createSupplier}
        onUpdateSupplier={updateSupplier}
        onDeleteSupplier={deleteSupplier}
        onRegisterCatalogItem={registerCatalogProduct}
        onUpdateProduct={saveProduct}
        onNavigate={navigatePage}
        onSignOut={signOut}
      />
    );
  }

  if (step === 'ai-insight') {
    return (
      <AIInsight
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        items={inventoryItems}
        onReview={reviewInsight}
        onNavigate={navigatePage}
        onSignOut={signOut}
      />
    );
  }

  if (step === 'outbound') {
    return (
      <Outbound
        initialShipmentId={outboundRequest}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        shipments={outboundShipments}
        inventory={inventoryItems}
        drafts={outboundDrafts}
        onSaveDraft={saveOutboundDraft}
        onAdvance={advanceOutbound}
        onShip={completeOutbound}
        onReportIssue={reportOutboundIssue}
        onResolveIssue={reviewOutboundIssue}
        onViewMovements={(reference) => {
          setReportOrigin(null);
          setReportSku(null);
          setReportReference(reference);
          setStep('movement-reports');
        }}
        onCreate={createOutbound}
        onStartPicking={startOutboundPicking}
        onMarkArrived={markOutboundArrived}
        onUpdateStaff={updateOutboundStaff}
        staffAccounts={staffAccounts}
        onNavigate={navigatePage}
        onSignOut={signOut}
      />
    );
  }

  if (step === 'inbound') {
    return (
      <Inbound
        initialShipmentId={inboundRequest}
        purchaseOrders={poOrders}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        shipments={shipments}
        movements={movements}
        inventory={inventoryItems}
        racks={sortedRacks}
        staffAccounts={staffAccounts}
        receivingDrafts={receivingDrafts}
        onSaveDraft={saveReceivingDraft}
        onInspect={startInboundInspection}
        onCompleteReceiving={completeReceiving}
        onResolveIssue={resolveIssue}
        onUpdateStaff={updateInboundStaff}
        onViewMovements={(reference) => {
          setReportOrigin(null);
          setReportSku(null);
          setReportReference(reference);
          setStep('movement-reports');
        }}
        onCreate={createInbound}
        onMarkArrived={markInboundArrived}
        onEditSchedule={editInboundSchedule}
        onNavigate={navigatePage}
        onSignOut={signOut}
      />
    );
  }

  if (step === 'inventory') {
    return (
      <Inventory
        initialRequest={inventoryRequest}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        items={inventoryItems}
        shipments={shipments}
        movements={movements}
        onSave={saveProduct}
        onNavigate={navigatePage}
        onReport={(sku) => {
          setReportOrigin(null);
          setReportReference(null);
          setReportSku(sku);
          setStep('movement-reports');
        }}
        onSignOut={signOut}
      />
    );
  }

  if (step === 'movement-reports') {
    return (
      <StockMovementReports
        reportOrigin={reportOrigin}
        key={`${reportSku || 'all'}-${reportReference || 'all'}`}
        reference={reportReference}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        items={inventoryItems}
        movements={movements}
        sku={reportSku}
        onBack={() =>
          setStep(
            reportOrigin === 'reports'
              ? 'reports'
              : reportReference?.startsWith('OUT-')
              ? 'outbound'
              : reportReference
              ? 'inbound'
              : 'inventory'
          )
        }
        onNavigate={navigatePage}
        onSignOut={signOut}
      />
    );
  }

  if (step === 'forgot') {
    return (
      <ForgotPassword
        initialEmail=""
        onBack={(email) => {
          setLoginEmail(email || '');
          setStep('signin');
        }}
      />
    );
  }

  if (step === 'reset-link-sent') {
    return (
      <ResetLinkSent
        email={recoveryEmail}
        expiresAt={resetExpiresAt}
        onResend={() => setResetExpiresAt(Date.now() + 15 * 60 * 1000)}
        onOpenReset={() => {
          if (Date.now() < resetExpiresAt) setStep('reset-password');
        }}
        onBack={backToSignIn}
      />
    );
  }

  if (step === 'reset-password') {
    return (
      <ResetPassword
        expiresAt={resetExpiresAt}
        onUpdated={() => {
          setResetExpiresAt(0);
          setStep('password-updated');
        }}
        onExpired={() => setStep('forgot')}
      />
    );
  }

  if (step === 'password-updated') {
    return <PasswordUpdated onSignIn={() => backToSignIn()} />;
  }

  if (step === 'signin') {
    return (
      <SignIn
        initialEmail={loginEmail || manager?.email || ''}
        onCreateAccount={() => setStep('manager')}
        onSignIn={handleSignIn}
      />
    );
  }

  if (step === 'security') {
    return (
      <SecuritySetup
        initialData={security}
        onBack={backToWarehouse}
        email={manager?.email ?? ''}
        onChangeEmail={changeEmail}
        manager={effectiveManager}
        warehouse={effectiveWarehouse}
        onSignIn={() => {
          setSecurity(null);
          setLoginEmail(manager?.email ?? '');
          setStep('signin');
        }}
      />
    );
  }

  if (step === 'warehouse') {
    return (
      <WarehouseSetup
        initialData={warehouse}
        onBack={backToManager}
        onContinue={continueFromWarehouse}
      />
    );
  }

  return <SignUp initialData={manager} onContinue={continueFromManager} onSignIn={() => setStep('signin')} />;
}
