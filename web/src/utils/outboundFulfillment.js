import {validateOutboundItems} from './outbound.js';
const whole=value=>value!==''&&Number.isSafeInteger(Number(value))&&Number(value)>=0;
export function newFulfillmentDraft(shipment){return {stage:'pick',picked:Object.fromEntries(shipment.products.map(row=>[row.sku,0])),boxes:{},verified:{},secured:false,labels:false,weights:{},carrier:'',plate:'',driver:'',tracking:'',savedAt:null};}
export function fulfillmentTotals(shipment,draft){
 const products=shipment.products||[];
 const required=products.reduce((sum,row)=>sum+Number(row.quantity),0);
 const picked=products.reduce((sum,row)=>sum+(Number(draft.picked[row.sku])||0),0);
 const verified=products.reduce((sum,row)=>sum+(draft.verified[row.sku]&&draft.boxes[row.sku]?Number(row.quantity):0),0);
 const packages=[...new Set(products.map(row=>draft.boxes[row.sku]).filter(Boolean))].sort().map(box=>({box,units:products.filter(row=>draft.boxes[row.sku]===box).reduce((sum,row)=>sum+Number(row.quantity),0),weight:draft.weights[box]??''}));
 return {required,picked,verified,packages};
}
export function validatePicked(shipment,draft,inventory){
 const error=validateOutboundItems(shipment.products,inventory);if(error)return error;
 for(const row of shipment.products){if(!whole(draft.picked[row.sku])||Number(draft.picked[row.sku])!==Number(row.quantity))return `${row.name}: pick exactly ${row.quantity} units before packing.`;}
 return '';
}
export function validatePacked(shipment,draft,inventory){
 const error=validatePicked(shipment,draft,inventory);if(error)return error;
 const boxes=Array.from({length:shipment.products.length},(_,i)=>`Box ${i+1}`);
 for(const row of shipment.products){if(!boxes.includes(draft.boxes[row.sku])||draft.verified[row.sku]!==true)return `${row.name}: choose a package and verify its contents.`;}
 if(draft.secured!==true||draft.labels!==true)return 'Confirm packaging secured and labels printed before shipping.';
 return '';
}
export function validateShipping(draft){
 if(!draft.carrier?.trim()||!draft.plate?.trim()||!draft.driver?.trim())return 'Enter carrier, vehicle / plate, and driver name.';
 for(const weight of Object.values(draft.weights||{})){if(weight!==''&&(!Number.isFinite(Number(weight))||Number(weight)<=0))return 'Package weights must be greater than zero or left blank.';}
 return '';
}
export function shipOutbound({shipment,draft,inventory,movements,user,date}){
 if(!shipment||shipment.status!=='Ready to Ship'||shipment.dispatch)return {error:'Only a verified Ready to Ship order can be dispatched once.'};
 if(shipment.pickIssue)return {error:'Resolve the reported pick issue before shipping.'};
 const error=validatePacked(shipment,draft,inventory)||validateShipping(draft);if(error)return {error};
 const totals=fulfillmentTotals(shipment,draft),stockChanges=[];
 const updated=inventory.map(item=>({...item})),nextMovements=[...movements];
 for(const row of shipment.products){
  const item=updated.find(item=>item.sku===row.sku),before=item.current,quantity=Number(row.quantity);item.current-=quantity;item.updated=date;
  const snapshot={sku:row.sku,name:item.name,rack:row.pickLocations?row.pickLocations.map(location=>`${location.rack} (${location.quantity})`).join(' + '):row.rack,before,quantity,after:item.current,box:draft.boxes[row.sku]};stockChanges.push(snapshot);
  nextMovements.push({id:`dispatch-${shipment.id}-${row.sku}`,sku:row.sku,date,type:'Outbound shipped',reference:shipment.id,before,change:-quantity,after:item.current,rack:snapshot.rack,user,reason:`Dispatched ${shipment.reference} to ${shipment.destination}`,warehouse:item.warehouse});
 }
 const tracking=draft.tracking.trim()||`DEMO-${shipment.id}`;
 const dispatch={completedAt:date,user,carrier:draft.carrier.trim(),plate:draft.plate.trim(),driver:draft.driver.trim(),tracking,trackingIsDemo:!draft.tracking.trim(),packages:totals.packages.map(row=>({...row,weight:row.weight===''?null:Number(row.weight)})),stockChanges,units:totals.required};
 return {inventory:updated,movements:nextMovements,shipment:{...shipment,status:'Shipped',dispatch},draft:{...draft,stage:'completed',savedAt:date}};
}
export function downloadDispatchNote(shipment){
 if(!shipment.dispatch)return;
 const d=shipment.dispatch;
 const quote=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const columns=['Outbound ID','Reference','Destination','Shipped at','Carrier','Plate','Driver','Tracking','Tracking source','SKU','Product','Package','Quantity','Stock before','Stock after','Weight kg','Record source','Product types'];
 const rows=d.stockChanges.map(row=>[shipment.id,shipment.reference,shipment.destination,d.completedAt,d.carrier,d.plate,d.driver,d.tracking,d.trackingIsDemo?'Demo reference':'Manually entered',row.sku,row.name,row.box,row.quantity,row.before??'Not recorded',row.after??'Not recorded',d.packages.find(p=>p.box===row.box)?.weight??'Not recorded','Frontend dispatch',shipment.items]);
 if(d.isHistoricalSample&&!rows.length)rows.push([shipment.id,shipment.reference,shipment.destination,d.completedAt||'Not recorded',d.carrier,d.plate,d.driver,d.tracking,'Design sample','Not provided','Not provided','Not provided',d.units,'Not recorded','Not recorded','Not recorded','Historical sample',shipment.items]);
 const csv='\uFEFF'+[columns,...rows].map(row=>row.map(quote).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`susuno-dispatch-${shipment.id}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
