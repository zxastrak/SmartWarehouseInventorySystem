export const outboundTypes = [
  {name:'Warehouse transfer', caption:'Move stock to another branch', label:'Destination warehouse', destinations:['Branch Warehouse East','Branch Warehouse West'], prefix:'TR'},
  {name:'Customer order', caption:'Fulfil a sales order', label:'Customer destination', destinations:['PT Cipta Teknologi','Nusantara Retail','PT Mitra Karya','Sentra Elektronik'], prefix:'SO'},
  {name:'Internal request', caption:'Supply an internal unit', label:'Internal destination', destinations:['Production Floor A','Maintenance Unit','Operations Office'], prefix:'IR'},
];
export const outboundStatuses = ['Scheduled','Picking','Packing','Ready to Ship','Shipped','Issue'];
const first = [
  ['OUT-3051','SO-22018','PT Cipta Teknologi','Customer order','2026-09-18','10:30',4,96,'Picking','Naura'],
  ['OUT-3050','SO-22017','Nusantara Retail','Customer order','2026-09-18','11:45',3,52,'Ready to Ship','Raka'],
  ['OUT-3049','TR-00942','Branch Warehouse East','Warehouse transfer','2026-09-18','14:00',5,140,'Scheduled','Dimas'],
  ['OUT-3048','SO-22015','PT Mitra Karya','Customer order','2026-09-15','16:20',2,18,'Issue','Naura'],
  ['OUT-3047','SO-22014','Sentra Elektronik','Customer order','2026-09-15','13:10',6,175,'Shipped','Raka'],
  ['OUT-3046','IR-00128','Production Floor A','Internal request','2026-09-15','09:30',3,64,'Packing','Dimas'],
];
export const outboundSeed = first.map(([id,reference,destination,type,date,time,items,units,status,staff]) => ({id,reference,destination,type,date,time,items,units,status,staff,priority:'Normal',notes:'',products:null}));
for(let i=0;i<12;i++) {
  const source=outboundSeed[i%6];
  outboundSeed.push({...source,id:`OUT-${3045-i}`,reference:`DEMO-${3045-i}`,date:'2026-09-14',items:2,units:20,staff:['Naura','Raka','Dimas'][i%3]});
}
export function outboundDate(date) {
  const value=new Date(`${date}T00:00:00+07:00`);
  return Number.isNaN(value.getTime()) ? 'Not provided' : new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'Asia/Jakarta'}).format(value);
}

// The SVG item rows total 140 units; all screens use that same total.
const pickingExample=outboundSeed.find(row=>row.id==='OUT-3051');
pickingExample.products=[
 {sku:'WH-3382',name:'Wireless Scanner',rack:'A-12',quantity:40},
 {sku:'WH-7621',name:'Safety Helmet',rack:'B-04',quantity:50},
 {sku:'WH-1209',name:'LED Work Light',rack:'C-07',quantity:30},
 {sku:'WH-6108',name:'Extension Cord',rack:'C-02',quantity:20},
];
pickingExample.units=pickingExample.products.reduce((sum,row)=>sum+row.quantity,0);

// This list-only SVG does not specify the packed SKU details.
// Explicit sample data makes OUT-3050 usable without claiming a real packing record.
const readyExample=outboundSeed.find(row=>row.id==='OUT-3050');
readyExample.products=[
 {sku:'WH-7621',name:'Safety Helmet',rack:'B-04',quantity:10},
 {sku:'WH-1209',name:'LED Work Light',rack:'C-07',quantity:20},
 {sku:'WH-6108',name:'Extension Cord',rack:'C-02',quantity:22},
];
readyExample.items=readyExample.products.length;
readyExample.units=readyExample.products.reduce((sum,row)=>sum+row.quantity,0);
readyExample.packingIsDemo=true;
export const readyToShipDraftSeed={
 [readyExample.id]:{
  stage:'ready',
  picked:Object.fromEntries(readyExample.products.map(row=>[row.sku,row.quantity])),
  boxes:Object.fromEntries(readyExample.products.map((row,i)=>[row.sku,`Box ${i+1}`])),
  verified:Object.fromEntries(readyExample.products.map(row=>[row.sku,true])),
  secured:true,labels:true,weights:{},carrier:'',plate:'',driver:'',tracking:'',savedAt:null,
 }
};

// Scheduled detail SVG has 4 products totaling 140, rather than 5 items.
const scheduledExample=outboundSeed.find(row=>row.id==='OUT-3049');
scheduledExample.products=pickingExample.products.map(row=>({...row}));
scheduledExample.items=scheduledExample.products.length;
scheduledExample.units=scheduledExample.products.reduce((sum,row)=>sum+row.quantity,0);

// SVG specifies Pallet Jack 10; the second item (8 units) is sample data.
const issueExample=outboundSeed.find(row=>row.id==='OUT-3048');
issueExample.products=[{sku:'WH-4450',name:'Pallet Jack',rack:'A-03',quantity:10},{sku:'WH-7621',name:'Safety Helmet',rack:'B-04',quantity:8}];
issueExample.issueItemsAreDemo=true;
issueExample.pickIssue={type:'Insufficient stock during picking',sku:'WH-4450',availableAtReport:8,user:'Naura',reportedAt:'2026-09-15T15:48:00+07:00',notes:''};

// Part 6: the selected list row is OUT-3047, not OUT-3051 shown in the success mockup.
// Historical metadata follows that row. Carrier/driver/tracking are design sample data.
// No item/stock snapshots or completion time are supplied; opening it does not post stock.
const shippedExample=outboundSeed.find(row=>row.id==='OUT-3047');
shippedExample.dispatch={isHistoricalSample:true,completedAt:null,user:shippedExample.staff,carrier:'Nusantara Logistics',driver:'Arif',plate:'B 9123 KLM',tracking:'NSL-409821',trackingIsDemo:false,units:shippedExample.units,packages:[],stockChanges:[]};

// Part 7: list data has 3 products / 64 units; copied packing rows sum to 140.
// Use explicit demo picking quantities consistent with the list and available total stock.
const packingExample=outboundSeed.find(row=>row.id==='OUT-3046');
packingExample.products=[
 {sku:'WH-3382',name:'Wireless Scanner',rack:'A-12',quantity:8},
 {sku:'WH-7621',name:'Safety Helmet',rack:'B-04',quantity:24},
 {sku:'WH-1209',name:'LED Work Light',rack:'C-07',quantity:32},
];
packingExample.items=packingExample.products.length;
packingExample.units=packingExample.products.reduce((sum,row)=>sum+row.quantity,0);
packingExample.pickingIsDemo=true;
export const packingDraftSeed={
 [packingExample.id]:{stage:'pack',picked:Object.fromEntries(packingExample.products.map(row=>[row.sku,row.quantity])),boxes:{},verified:{},secured:false,labels:false,weights:{},carrier:'',plate:'',driver:'',tracking:'',savedAt:null}
};
