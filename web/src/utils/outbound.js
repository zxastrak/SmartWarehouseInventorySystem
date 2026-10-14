import {outboundTypes} from '../data/outbound.js';
export function validateOutboundDetails(draft) {
  const type=outboundTypes.find(row=>row.name===draft.type);
  if(!type) return 'Choose an outbound type.';
  if(!type.destinations.includes(draft.destination)) return 'Choose a destination for this outbound type.';
  const validDate=/^\d{4}-\d{2}-\d{2}$/.test(draft.date) && !Number.isNaN(Date.parse(draft.date)) && new Date(draft.date).toISOString().slice(0,10)===draft.date;
  if(!validDate || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) return 'Choose a valid ship date and time.';
  if(!['Normal','High','Urgent'].includes(draft.priority)) return 'Choose a priority.';
  return '';
}
export function validateOutboundItems(products,inventory) {
  if(!products?.length) return 'Add at least one product.';
  const seen=new Set();
  for(const row of products) {
    const item=inventory.find(value=>value.sku===row.sku);
    if(!item || seen.has(row.sku)) return 'A selected product is unavailable or duplicated.';
    seen.add(row.sku);
    if(!Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity)<=0) return `Enter a whole quantity greater than zero for ${item.name}.`;
    if(Number(row.quantity)>item.current) return `${item.name}: quantity exceeds available stock (${item.current}).`;
  }
  return '';
}
export function createOutboundRecord({draft,shipments,inventory,user,date}) {
  const error=validateOutboundDetails(draft)||validateOutboundItems(draft.products,inventory);
  if(error) return {error};
  const number=Math.max(3051,...shipments.map(row=>Number(row.id.replace('OUT-',''))||0))+1;
  const type=outboundTypes.find(row=>row.name===draft.type);
  const reference=draft.reference.trim() || `${type.prefix}-${String(number).padStart(5,'0')}`;
  if(shipments.some(row=>row.reference.toLowerCase()===reference.toLowerCase())) return {error:'This request reference already has an outbound shipment.'};
  const products=draft.products.map(row=>{const item=inventory.find(value=>value.sku===row.sku);return {sku:item.sku,name:item.name,rack:item.rack,quantity:Number(row.quantity),availableAtCreation:item.current};});
  return {shipment:{id:`OUT-${number}`,type:draft.type,destination:draft.destination,reference,date:draft.date,time:draft.time,priority:draft.priority,notes:draft.notes.trim(),products,items:products.length,units:products.reduce((sum,row)=>sum+row.quantity,0),status:'Scheduled',staff:user,createdAt:date}};
}
export function downloadOutboundList(rows) {
  const keys=['id','reference','type','destination','date','time','items','units','status','staff'];
  const escape=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
  const csv='\uFEFF'+[keys,...rows.map(row=>keys.map(key=>row[key]))].map(row=>row.map(escape).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='susuno-outbound-list.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
