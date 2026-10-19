import React, { useEffect, useState, useRef } from 'react';
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
import {auditSeed,newAuditEvent} from './utils/auditTrail.js';
import {receivePurchaseOrder,revisePurchaseOrder,recordPOReceipt} from './utils/purchaseOrderReceiving.js';
import {purchaseOrderSeed} from './data/purchaseOrders.js';
import {decidePurchaseOrder,createPurchaseOrder} from './utils/purchaseOrders.js';
import {newFulfillmentDraft, validatePicked, validatePacked, shipOutbound} from './utils/outboundFulfillment.js';
import {outboundSeed, readyToShipDraftSeed, packingDraftSeed} from './data/outbound.js';
import {resolveOutboundIssue} from './utils/outboundIssues.js';
import {createOutboundRecord, validateOutboundItems} from './utils/outbound.js';
import { rackSeed } from './data/receiving.js';
import { receiveShipment } from './utils/receiving.js';
import { inboundIssueSeed } from './data/inboundIssues.js';
import { resolveInboundIssue } from './utils/inboundIssues.js';
import { completedReceivingSeed } from './data/completedReceiving.js';
import { inboundSeed } from './data/inbound.js';
import StockMovementReports from './pages/StockMovementReports.jsx';
import { inventorySeed, movementSeed } from './data/inventory.js';
import api from './services/api.js';

export default function App() {
  const [step, setStep] = useState('signin');
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [backendTasks, setBackendTasks] = useState([]);
  const [inventoryRequest,setInventoryRequest]=useState(null);
  const [inboundRequest,setInboundRequest]=useState(null);
  const [poRequest,setPoRequest]=useState(null);
  const [reportOrigin,setReportOrigin]=useState(null);
  const [auditEvents,setAuditEvents]=useState(()=>auditSeed(movementSeed));
  const failedSignIns=useRef({});
  function logEvent(values){setAuditEvents(current=>[newAuditEvent({user:manager?.fullName||'Naura',warehouse:warehouse?.warehouseName||'Main Warehouse',...values}),...current]);}
  function auditExport(module){return values=>logEvent({module,...values});}
  function openAuditReference(event){if(poOrders.some(row=>row.id===event.reference)){setPoRequest(event.reference);setStep('purchase-orders');return true;}if(shipments.some(row=>row.id===event.reference)){setInboundRequest(event.reference);setStep('inbound');return true;}if(inventoryItems.some(row=>row.sku===event.reference)){setInventoryRequest({sku:event.reference,kind:'report'});setStep('inventory');return true;}return false;}
  function navigatePage(next){setInventoryRequest(null);setInboundRequest(null);setPoRequest(null);setReportOrigin(null);setStep(next);}
  function openPOInbound(po){setInboundRequest(shipments.find(row=>row.po===po&&!row.receivingCompleted&&row.status!=='Received')?.id||null);setStep('inbound');}
  function receivePO(id,draft){const result=receivePurchaseOrder({order:poOrders.find(row=>row.id===id),draft,shipments,inventory:inventoryItems,movements,racks,user:manager?.fullName||'Naura',date:new Date().toISOString()});if(result.error)return result;setInventoryItems(result.inventory);setMovements(result.movements);setRacks(result.racks);setShipments(current=>[result.shipment,...current]);setPoOrders(current=>current.map(row=>row.id===id?result.order:row));logEvent({module:'Purchase Orders',action:'Goods received',reference:id,details:`${result.order.receipts.at(-1).units} accepted units · ${result.shipment.id}`,severity:result.shipment.receipt.dispositions.length?'Warning':'Info',changes:[{field:'PO status',before:poOrders.find(row=>row.id===id)?.status,after:result.order.status},...result.shipment.receipt.stockChanges.map(row=>({field:row.sku,before:row.before,after:row.after})),{field:'Movement reference',before:'Not posted',after:result.shipment.id}]});return result;}
  function revisePO(id,values){const result=revisePurchaseOrder(poOrders.find(row=>row.id===id),values,manager?.fullName||'Naura',new Date().toISOString());if(!result.error){setPoOrders(current=>current.map(row=>row.id===id?result.order:row));logEvent({module:'Purchase Orders',action:'Delivery updated',reference:id,status:'Updated',details:values.notes,changes:[{field:'Expected date',before:poOrders.find(row=>row.id===id)?.expected,after:result.order.expected},{field:'PO status',before:poOrders.find(row=>row.id===id)?.status,after:result.order.status}]});}return result;}
  function reviewInsight(request){if(!inventoryItems.some(item=>item.sku===request.sku))return;setInventoryRequest(request);setStep('inventory');}
  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  const [manager, setManager] = useState(null);
  const [warehouse, setWarehouse] = useState(null);
  const [security, setSecurity] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetExpiresAt, setResetExpiresAt] = useState(0);

  const [inventoryItems, setInventoryItems] = useState(() => inventorySeed.map(item => ({...item})));
  const [movements, setMovements] = useState(() => movementSeed.map(row => ({...row})));
  const [reportReference, setReportReference] = useState(null);
  const [reportSku, setReportSku] = useState(null);
  const [shipments, setShipments] = useState(() => inboundSeed.map(row => ({...row, ...completedReceivingSeed[row.id], ...inboundIssueSeed[row.id]})));

  const [poOrders,setPoOrders]=useState(()=>structuredClone(purchaseOrderSeed));
  function decidePO(id,status){const result=decidePurchaseOrder(poOrders.find(row=>row.id===id),status,manager?.fullName||'Naura',new Date().toISOString());if(!result.error){setPoOrders(current=>current.map(row=>row.id===id?result.order:row));logEvent({module:'Purchase Orders',action:`Order ${status.toLowerCase()}`,reference:id,details:`Decision recorded: ${status}`,changes:[{field:'PO status',before:'Pending',after:status}]});}return result;}
  function createPO(values){const result=createPurchaseOrder({values,orders:poOrders,inventory:inventoryItems,user:manager?.fullName||'Naura',date:new Date().toISOString()});if(!result.error){setPoOrders(current=>[result.order,...current]);logEvent({module:'Purchase Orders',action:'Order created',reference:result.order.id,details:`${result.order.supplier} · Pending approval`,changes:[{field:'PO status',before:'Not created',after:'Pending'}]});}return result;}

  const [outboundShipments, setOutboundShipments] = useState(() => outboundSeed.map(row => ({...row})));
  const [outboundDrafts, setOutboundDrafts] = useState(() => structuredClone({...readyToShipDraftSeed,...packingDraftSeed}));
  function createOutbound(draft) {
    const result = createOutboundRecord({draft, shipments:outboundShipments, inventory:inventoryItems, user:manager?.fullName || 'Naura', date:new Date().toISOString()});
    if (result.error) return result;
    setOutboundShipments(current => [result.shipment, ...current]);
    logEvent({module:'Outbound',action:'Outbound created',reference:result.shipment.id,details:`${result.shipment.units} units scheduled`,changes:[{field:'Status',before:'Not created',after:'Scheduled'}]});
    return result;
  }
  function startOutboundPicking(id) {
    const shipment = outboundShipments.find(row => row.id === id);
    if (!shipment || shipment.status !== 'Scheduled') return {error:'Only Scheduled shipments can start picking.'};
    const error = validateOutboundItems(shipment.products, inventoryItems);
    if (error) return {error};
    const updated = {...shipment, status:'Picking', pickingStartedAt:new Date().toISOString()};
    setOutboundShipments(current => current.map(row => row.id === id ? updated : row));
    setOutboundDrafts(current => ({...current,[id]:current[id] || newFulfillmentDraft(updated)}));
    logEvent({module:'Outbound',action:'Picking started',reference:id,details:'Scheduled order started picking',changes:[{field:'Status',before:shipment.status,after:updated.status}]});
    return {shipment:updated};
  }

  function saveOutboundDraft(id, draft) {
    const shipment = outboundShipments.find(row => row.id === id);
    if (!shipment || shipment.dispatch || shipment.pickIssue) return;
    setOutboundDrafts(current => ({...current, [id]:draft}));
  }
  function advanceOutbound(id, draft) {
    const shipment = outboundShipments.find(row => row.id === id);
    if (!shipment || !['Scheduled','Picking','Packing','Ready to Ship'].includes(shipment.status) || shipment.dispatch || shipment.pickIssue) return {error:'This shipment cannot continue.'};
    if (!['pick','pack','ready'].includes(draft.stage)) return {error:'Unknown fulfillment stage.'};
    const error = draft.stage === 'ready' ? validatePacked(shipment,draft,inventoryItems) : draft.stage === 'pack' ? validatePicked(shipment,draft,inventoryItems) : '';
    if (error) return {error};
    const updated = {...shipment, status:{pick:'Picking',pack:'Packing',ready:'Ready to Ship'}[draft.stage]};
    setOutboundShipments(current => current.map(row => row.id === id ? updated : row));
    setOutboundDrafts(current => ({...current, [id]:{...draft,savedAt:new Date().toISOString()}}));
    if(shipment.status!==updated.status)logEvent({module:'Outbound',action:'Fulfilment stage updated',reference:id,status:'Updated',details:updated.status,changes:[{field:'Status',before:shipment.status,after:updated.status}]});
    return {shipment:updated};
  }
  function completeOutbound(id,draft) {
    const shipment = outboundShipments.find(row => row.id === id);
    const result = shipOutbound({shipment,draft,inventory:inventoryItems,movements,user:manager?.fullName || 'Naura',date:new Date().toISOString()});
    if (result.error) return result;
    setInventoryItems(result.inventory);setMovements(result.movements);
    setOutboundShipments(current => current.map(row => row.id === id ? result.shipment : row));
    setOutboundDrafts(current => ({...current,[id]:result.draft}));
    logEvent({module:'Outbound',action:'Outbound shipped',reference:id,details:`${result.shipment.dispatch.units} units shipped`,changes:[{field:'Status',before:shipment.status,after:'Shipped'},...result.shipment.dispatch.stockChanges.map(row=>({field:row.sku,before:row.before,after:row.after}))]});
    return result;
  }
  function reportOutboundIssue(id,issue,draft) {
    const shipment = outboundShipments.find(row => row.id === id);
    if (!shipment || !['Picking','Scheduled'].includes(shipment.status) || !['Missing stock','Damaged stock','Wrong stock'].includes(issue.type) || !issue.notes.trim()) return {error:'Choose an issue type and provide notes for an active picking order.'};
    const updated = {...shipment,status:'Issue',pickIssue:{...issue,reportedAt:new Date().toISOString(),user:manager?.fullName || 'Naura'}};
    setOutboundShipments(current => current.map(row => row.id === id ? updated : row));
    setOutboundDrafts(current => ({...current,[id]:draft}));
    logEvent({module:'Outbound',action:'Pick issue reported',reference:id,severity:'Warning',details:issue.notes,changes:[{field:'Status',before:shipment.status,after:'Issue'}]});
    return {shipment:updated};
  }

  function reviewOutboundIssue(id,values) {
    const result=resolveOutboundIssue({shipment:outboundShipments.find(row=>row.id===id),shipments:outboundShipments,inventory:inventoryItems,draft:outboundDrafts[id],values,user:manager?.fullName||'Naura',date:new Date().toISOString()});
    if(result.error)return result;
    setOutboundShipments(current=>{const next=current.map(row=>row.id===id?result.shipment:row);return result.backorder?[result.backorder,...next]:next;});
    if(result.draft)setOutboundDrafts(current=>({...current,[id]:result.draft}));
    logEvent({module:'Outbound',action:result.onHold?'Shipment held':'Pick issue resolved',reference:id,details:values.note,changes:[{field:'Status',before:'Issue',after:result.shipment.status}]});
    return result;
  }

  const [racks, setRacks] = useState(() => rackSeed.map(rack => ({...rack})));
  const [receivingDrafts, setReceivingDrafts] = useState({});
  function saveReceivingDraft(id, draft) { setReceivingDrafts(current => ({...current, [id]:draft})); setShipments(current => current.map(row => row.id === id && row.status === 'Arrived' ? {...row, status:'Inspecting'} : row)); }
  function completeReceiving(id, draft) {
    const shipment = shipments.find(row => row.id === id);
    if (!shipment) return 'Shipment not found.';
    const result = receiveShipment({shipment, draft, inventory:inventoryItems, movements, racks, user:manager?.fullName || 'Naura', date:new Date().toISOString()});
    if (result.error) return result.error;
    setInventoryItems(result.inventory); setMovements(result.movements); setRacks(result.racks);
    setShipments(current => current.map(row => row.id === id ? result.shipment : row));
    setPoOrders(current=>current.map(order=>order.id===shipment.po?recordPOReceipt(order,result.shipment.receipt,id):order));
    setReceivingDrafts(current => {const next={...current};delete next[id];return next;});
    logEvent({module:'Inbound',action:'Goods received',reference:id,details:`Accepted ${result.shipment.receipt.summary.accepted} units · ${shipment.po}`,changes:[{field:'Status',before:shipment.status,after:'Received'},...result.shipment.receipt.stockChanges.map(row=>({field:row.sku,before:row.before,after:row.after}))]});
    return '';
  }

  function resolveIssue(id, values) {
    const shipment = shipments.find(row => row.id === id);
    const result = resolveInboundIssue({shipment, ...values, inventory:inventoryItems, racks, existingDraft:receivingDrafts[id], user:manager?.fullName || 'Naura', date:new Date().toISOString()});
    if (result.error) return result;
    setShipments(current => current.map(row => row.id === id ? result.shipment : row));
    setReceivingDrafts(current => ({...current, [id]: result.draft}));
    logEvent({module:'Inbound',action:'Receiving issue resolved',reference:id,details:result.shipment.issueResolution?.title||'Resolution saved',changes:[]});
    return result;
  }

  function markInboundArrived(id) {
    const shipment = shipments.find(row => row.id === id);
    if (!shipment || shipment.status !== 'Scheduled') return {error: 'Only a Scheduled shipment can be marked as arrived.'};
    const updated = {...shipment, status: 'Arrived', arrivedAt: new Date().toISOString(), arrivedBy: manager?.fullName || 'Naura'};
    setShipments(current => current.map(row => row.id === id && row.status === 'Scheduled' ? updated : row));
    logEvent({module:'Inbound',action:updated.status==='Arrived'?'Shipment arrived':'Schedule updated',reference:id,status:'Updated',details:`${updated.date} · ${updated.time}`,changes:[{field:'Status',before:shipment.status,after:updated.status},{field:'Date',before:shipment.date,after:updated.date}]});
    return {shipment: updated};
  }

  function editInboundSchedule(id, draft) {
    const shipment = shipments.find(row => row.id === id);
    if (!shipment || shipment.status !== 'Scheduled') return {error: 'Only Scheduled shipments can be rescheduled.'};
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && !Number.isNaN(Date.parse(draft.date)) && new Date(draft.date).toISOString().slice(0,10) === draft.date;
    const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validDate || !validTime(draft.time)) return {error: 'Choose a valid arrival date and start time.'};
    if (draft.endTime && (!validTime(draft.endTime) || draft.endTime <= draft.time)) return {error: 'End time must be later than start time on the same day.'};
    if (!['D-01', 'D-02', 'D-03', 'D-04'].includes(draft.dock)) return {error: 'Choose a receiving dock.'};
    if (!['Naura', 'Idam', 'Ocha', 'Raka', shipment.staff].includes(draft.staff)) return {error: 'Choose an assigned staff member.'};
    const updated = {...shipment, date: draft.date, time: draft.time, endTime: draft.endTime || '', dock: draft.dock, staff: draft.staff, scheduleUpdatedAt: new Date().toISOString()};
    setShipments(current => current.map(row => row.id === id && row.status === 'Scheduled' ? updated : row));
    logEvent({module:'Inbound',action:updated.status==='Arrived'?'Shipment arrived':'Schedule updated',reference:id,status:'Updated',details:`${updated.date} · ${updated.time}`,changes:[{field:'Status',before:shipment.status,after:updated.status},{field:'Date',before:shipment.date,after:updated.date}]});
    return {shipment: updated};
  }

  function createInbound(draft) {
    if (!poOrders.some(row=>row.id===draft.po&&row.status==='Approved') || shipments.some(row => row.po === draft.po)) return null;
    const nextNumber = Math.max(...shipments.map(row => Number(row.id.slice(4)))) + 1;
    const shipment = {...draft, scheduledAt:new Date().toISOString(), scheduledBy:manager?.fullName || 'Naura', carrier:draft.carrier.trim(), reference:draft.reference.trim(), id:`INB-${nextNumber}`};
    setShipments(current => [shipment, ...current]);
    logEvent({module:'Inbound',action:'Inbound created',reference:shipment.id,details:`${shipment.po} · ${shipment.units} units`,changes:[{field:'Status',before:'Not created',after:'Scheduled'}]});
    return shipment;
  }

  function signOut() { logEvent({module:'Authentication',action:'Signed out',reference:'Session',details:'Frontend session signed out'});setSecurity(null); setStep('signin'); }
  function saveProduct(draft) {
    const original = inventoryItems.find(item => item.sku === draft.sku);
    const updated = new Date().toISOString().slice(0,16);
    const { reason, ...item } = draft;
    const changes=['name','current','reorder','rack','supplier','barcode'].filter(key=>original[key]!==item[key]).map(key=>({field:key,before:original[key],after:item[key]}));
    if(changes.length)logEvent({module:'Inventory',action:original.current!==item.current?'Stock adjusted':'Product updated',reference:item.sku,status:'Updated',details:`${item.name} · ${reason||'Product fields updated'}`,changes});
    setInventoryItems(current => current.map(row => row.sku === item.sku ? {...item, updated} : row));
    if (original.current !== item.current) {
      setMovements(current => [...current, {id: crypto.randomUUID(), sku:item.sku, date:updated, type:'Stock adjustment', reference:`ADJ-${Date.now()}`, before:original.current, change:item.current-original.current, after:item.current, rack:item.rack, user:manager?.fullName || 'Naura', reason:reason.trim(), warehouse:item.warehouse}]);
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

  async function syncBackendData() {
    if (!api.token) return;
    setSyncStatus('syncing');
    try {
      const [productsRes, txRes, tasksRes, auditRes] = await Promise.allSettled([
        api.getProducts(),
        api.getStockTransactions(),
        api.getTasks(),
        api.getAuditLogs(),
      ]);

      if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value)) {
        setInventoryItems(current => {
          const map = new Map(current.map(i => [i.sku, i]));
          productsRes.value.forEach(p => {
            const loc = p.zone_location || 'RACK-A1-01-A';
            const existing = map.get(p.sku) || {};
            map.set(p.sku, {
              ...existing,
              id: p.id,
              name: p.name,
              sku: p.sku,
              current: Number(p.stock_quantity) || 0,
              reorder: existing.reorder || 10,
              rack: loc,
              warehouse: existing.warehouse || 'Main Warehouse',
              supplier: existing.supplier || 'Main Supplier',
              price: p.price,
              unit: p.unit || 'pcs',
              updated: p.updated_at ? p.updated_at.replace('T', ' ').slice(0, 16) : new Date().toISOString().slice(0, 16),
            });
          });
          return Array.from(map.values());
        });
      }

      if (txRes.status === 'fulfilled' && Array.isArray(txRes.value)) {
        const mappedMovements = txRes.value.map(tx => ({
          id: `TX-${tx.id}`,
          sku: tx.sku || `SKU-${tx.product_id}`,
          name: tx.product_name || `Produk #${tx.product_id}`,
          date: tx.created_at ? tx.created_at.replace('T', ' ').slice(0, 16) : new Date().toISOString().slice(0, 16),
          type: tx.type === 'in' ? 'Stock In (Mobile)' : 'Stock Out (Mobile)',
          reference: `ST-${tx.id}`,
          before: 0,
          change: tx.type === 'in' ? Number(tx.quantity) : -Number(tx.quantity),
          after: 0,
          rack: 'RACK-A1-01-A',
          user: tx.user_name || `Staf #${tx.user_id}`,
          reason: tx.notes || 'Pencatatan mutasi lapangan',
          warehouse: 'Main Warehouse',
        }));
        setMovements(current => {
          const ids = new Set(mappedMovements.map(m => m.id));
          return [...mappedMovements, ...current.filter(m => !ids.has(m.id))];
        });
      }

      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) {
        setBackendTasks(tasksRes.value);
      }

      if (auditRes.status === 'fulfilled' && Array.isArray(auditRes.value)) {
        const mappedLogs = auditRes.value.map(log => ({
          id: `AL-${log.id}`,
          time: log.created_at ? log.created_at.replace('T', ' ').slice(0, 19) : '',
          user: log.user_name || `User #${log.user_id}`,
          action: (log.action || '').replace(/_/g, ' '),
          reference: `${log.table_affected || 'General'} #${log.record_id || ''}`,
          status: 'Recorded',
          severity: 'Info',
          warehouse: 'Main Warehouse',
          details: `Action ${log.action} on ${log.table_affected}`,
          changes: [],
        }));
        setAuditEvents(current => {
          const ids = new Set(mappedLogs.map(l => l.id));
          return [...mappedLogs, ...current.filter(l => !ids.has(l.id))];
        });
      }

      setSyncStatus('synced');
      setLastSyncTime(new Date());
    } catch (e) {
      console.warn('Sync failed:', e);
      setSyncStatus('error');
    }
  }

  useEffect(() => {
    if (!isBackendConnected || step === 'signin') return;
    const interval = setInterval(() => {
      syncBackendData();
    }, 10000);
    return () => clearInterval(interval);
  }, [isBackendConnected, step]);

  async function handleSignIn(credentials) {
    try {
      const res = await api.login(credentials.email, credentials.password);
      if (res && res.user) {
        if (res.user.role !== 'manager') {
          return {
            success: false,
            message: 'Akun ini terdaftar sebagai staf lapangan. Silakan gunakan aplikasi mobile SUSUNO untuk staf.',
          };
        }

        setManager({
          fullName: res.user.name,
          email: res.user.email,
          role: res.user.role,
          id: res.user.id,
        });
        setLoginEmail(credentials.email);
        setIsBackendConnected(true);
        logEvent({
          module: 'Authentication',
          action: 'Signed in',
          reference: 'API Session',
          details: `Manager ${res.user.name} signed in successfully via backend API`,
        });

        await syncBackendData();
        setStep('dashboard');
        return { success: true };
      }
      return { success: false, message: res?.message || 'Login gagal.' };
    } catch (err) {
      // Offline fallback for demo manager
      if (
        (credentials.email.toLowerCase() === 'naura@gmail.com' && credentials.password === 'Susuno123!') ||
        (credentials.email.toLowerCase() === 'manager@test.com' && credentials.password === 'Susuno123!')
      ) {
        setManager({
          fullName: credentials.email.includes('manager') ? 'Manager Utama' : 'Naura',
          email: credentials.email,
          role: 'manager',
        });
        setLoginEmail(credentials.email);
        setIsBackendConnected(false);
        setStep('dashboard');
        return { success: true };
      }

      return {
        success: false,
        message: err.message || 'The email or password is incorrect. Please try again.',
      };
    }
  }

  if (step === 'dashboard') {
    return (
      <Dashboard
        manager={manager}
        warehouse={warehouse}
        inventory={inventoryItems}
        onNavigate={navigatePage}
        onSignOut={signOut}
        isBackendConnected={isBackendConnected}
        syncStatus={syncStatus}
        onSync={syncBackendData}
      />
    );
  }

  if (step === 'reports') return <Reports manager={manager} warehouse={warehouse} items={inventoryItems} movements={movements} orders={poOrders} onNavigate={navigatePage} onSignOut={signOut} onAudit={auditExport('Reports')} onMovements={()=>{setReportSku(null);setReportReference(null);setReportOrigin('reports');setStep('movement-reports');}}/>;
  if (step === 'audit-trail') return <AuditTrail manager={manager} warehouse={warehouse} events={auditEvents} onNavigate={navigatePage} onSignOut={signOut} onAudit={auditExport('Audit Trail')} onOpenReference={openAuditReference}/>;

  if (step === 'purchase-orders') {
    return <PurchaseOrders initialOrderId={poRequest} manager={manager} warehouse={warehouse} orders={poOrders} inventory={inventoryItems} onDecide={decidePO} onCreate={createPO} racks={racks} shipments={shipments} onReceive={receivePO} onRevise={revisePO} onOpenInbound={openPOInbound} onMovements={reference=>{setReportOrigin(null);setReportSku(null);setReportReference(reference);setStep('movement-reports');}} onNavigate={navigatePage} onSignOut={signOut}/>;
  }

  if (step === 'ai-insight') {
    return <AIInsight manager={manager} warehouse={warehouse} items={inventoryItems} onReview={reviewInsight} onNavigate={navigatePage} onSignOut={signOut}/>;
  }

  if (step === 'outbound') {
    return <Outbound manager={manager} warehouse={warehouse} shipments={outboundShipments} inventory={inventoryItems} drafts={outboundDrafts} onSaveDraft={saveOutboundDraft} onAdvance={advanceOutbound} onShip={completeOutbound} onReportIssue={reportOutboundIssue} onResolveIssue={reviewOutboundIssue} onViewMovements={reference => {setReportOrigin(null);setReportSku(null);setReportReference(reference);setStep('movement-reports');}} onCreate={createOutbound} onStartPicking={startOutboundPicking} onNavigate={navigatePage} onSignOut={signOut} />;
  }

  if (step === 'inbound') {
    return <Inbound initialShipmentId={inboundRequest} purchaseOrders={poOrders} manager={manager} warehouse={warehouse} shipments={shipments} movements={movements} inventory={inventoryItems} racks={racks} receivingDrafts={receivingDrafts} onSaveDraft={saveReceivingDraft} onCompleteReceiving={completeReceiving} onResolveIssue={resolveIssue} onViewMovements={reference => {setReportOrigin(null);setReportSku(null); setReportReference(reference); setStep('movement-reports');}} onCreate={createInbound} onMarkArrived={markInboundArrived} onEditSchedule={editInboundSchedule} onNavigate={navigatePage} onSignOut={signOut} />;
  }
  if (step === 'inventory') {
    return <Inventory initialRequest={inventoryRequest} manager={manager} warehouse={warehouse} items={inventoryItems} movements={movements} onSave={saveProduct} onNavigate={navigatePage} onReport={sku => {setReportOrigin(null);setReportReference(null); setReportSku(sku); setStep('movement-reports');}} onSignOut={signOut} />;
  }
  if (step === 'movement-reports') {
    return <StockMovementReports reportOrigin={reportOrigin} key={`${reportSku || 'all'}-${reportReference || 'all'}`} reference={reportReference} manager={manager} warehouse={warehouse} items={inventoryItems} movements={movements} sku={reportSku} onBack={() => setStep(reportOrigin==='reports'?'reports':reportReference?.startsWith('OUT-') ? 'outbound' : reportReference ? 'inbound' : 'inventory')} onNavigate={navigatePage} onSignOut={signOut} />;
  }

  if (step === 'forgot') {
    return <ForgotPassword initialEmail={recoveryEmail} onSend={sendResetLink} onBack={backToSignIn} />;
  }
  if (step === 'reset-link-sent') {
    return <ResetLinkSent email={recoveryEmail} expiresAt={resetExpiresAt}
      onResend={() => setResetExpiresAt(Date.now() + 15 * 60 * 1000)}
      onOpenReset={() => { if (Date.now() < resetExpiresAt) setStep('reset-password'); }}
      onBack={backToSignIn} />;
  }
  if (step === 'reset-password') {
    return <ResetPassword expiresAt={resetExpiresAt} onUpdated={() => { setResetExpiresAt(0); setStep('password-updated'); }}
      onExpired={() => setStep('forgot')} />;
  }
  if (step === 'password-updated') {
    return <PasswordUpdated onSignIn={() => backToSignIn()} />;
  }

  if (step === 'signin') {
    return <SignIn initialEmail={loginEmail || manager?.email || ''} onCreateAccount={() => setStep('manager')}
      onForgotPassword={email => { setRecoveryEmail(email); setStep('forgot'); }} onSignIn={handleSignIn} />;
  }

  if (step === 'security') {
    return <SecuritySetup initialData={security} onBack={backToWarehouse} email={manager?.email ?? ''} onChangeEmail={changeEmail} manager={manager} warehouse={warehouse} onSignIn={() => {
      setSecurity(null);
      setLoginEmail(manager?.email ?? '');
      setStep('signin');
    }} />;
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
