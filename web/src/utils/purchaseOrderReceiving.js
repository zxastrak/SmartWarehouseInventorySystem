import {receiveShipment} from './receiving.js';
import {rackMatches} from '../data/receiving.js';
import {poToday} from './purchaseOrders.js';
export function poReceivingTotals(order){const required=order.products.reduce((sum,row)=>sum+row.quantity,0),received=order.products.reduce((sum,row)=>sum+(Number(row.received)||0),0);return {required,received,remaining:required-received,percent:required?received/required*100:0};}
export const poReceiptDate=date=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(date));
export function poReceiptDraft(order){return {quantities:Object.fromEntries(order.products.map(row=>[row.code,''])),conditions:{},racks:{},date:'',notes:'',evidence:[]};}
export function recordPOReceipt(order,receipt,shipmentId){
 if(!order||order.receipts?.some(row=>row.shipmentId===shipmentId))return order;
 const products=order.products.map(item=>({...item,received:Math.min(item.quantity,(Number(item.received)||0)+(receipt.stockChanges.find(row=>row.sku===item.code)?.accepted||0))}));
 const updated={...order,products,receiptQuantitiesUnknown:false,receipts:[...(order.receipts||[]),{id:`REC-${shipmentId}`,shipmentId,date:receipt.completedAt,receivedDate:receipt.receivedDate||poReceiptDate(receipt.completedAt),user:receipt.user,units:receipt.stockChanges.reduce((sum,row)=>sum+row.accepted,0),notes:receipt.notes,stockChanges:receipt.stockChanges,dispositions:receipt.dispositions}]};
 updated.status=poReceivingTotals(updated).remaining===0?'Received':'Partially Received';return updated;
}
export function receivePurchaseOrder({order,draft,shipments,inventory,movements,racks,user,date}){
 if(!order||!['In Transit','Partially Received'].includes(order.status)||order.receiptQuantitiesUnknown)return {error:'Only a delivered In Transit or known partial order can be received here.'};
 if(shipments.some(row=>row.po===order.id&&!row.receivingCompleted&&row.status!=='Received'))return {error:'An active Inbound shipment already manages this PO. Open that shipment to receive it.'};
 if(!validDate(draft.date)||draft.date>poToday()||draft.date<order.created)return {error:'Enter a valid received date between the order creation date and today.'};
 const remaining=order.products.filter(item=>item.quantity>(Number(item.received)||0));if(!remaining.length)return {error:'This order has already been fully received.'};
 const rows=[],allocations={};let delivered=0;
 for(const item of remaining){const value=draft.quantities[item.code],quantity=value===''||value==null?0:Number(value),outstanding=item.quantity-(Number(item.received)||0);
  if(!Number.isSafeInteger(quantity)||quantity<0||quantity>outstanding)return {error:`${item.name}: receive a whole quantity from 0 to ${outstanding}.`};
  const condition=draft.conditions[item.code];if(quantity>0&&!['Good condition','Damaged','Wrong item'].includes(condition))return {error:`${item.name}: choose a condition.`};
  if(quantity>0&&condition!=='Good condition'&&!draft.notes.trim())return {error:'Describe damaged or wrong items in receiving notes.'};
  const existing=inventory.find(row=>row.sku===item.code),category=existing?.category||'General',accepted=condition==='Good condition'?quantity:0;
  if(accepted>0&&!racks.some(row=>row.id===draft.racks[item.code]&&rackMatches(category,row)))return {error:`${item.name}: select an available rack in the correct zone.`};
  rows.push({sku:item.code,name:item.name,category,ordered:outstanding,received:quantity,damaged:condition==='Damaged'?quantity:0,rejected:condition==='Wrong item'?quantity:0});
  allocations[item.code]=accepted?[{id:`po-${item.code}`,rack:draft.racks[item.code],quantity:accepted}]:[];delivered+=quantity;
 }
 if(!delivered)return {error:'Enter at least one delivered quantity.'};
 const id=`INB-${Math.max(2048,...shipments.map(row=>Number(row.id.replace('INB-',''))||0))+1}`,shipment={id,po:order.id,supplier:order.supplier,status:'Arrived',date:draft.date,time:'00:00',items:remaining.length,units:remaining.reduce((sum,row)=>sum+row.quantity-(Number(row.received)||0),0),staff:user,warehouse:order.deliverTo?.split(' · ')[0]||'Main Warehouse',products:remaining.map(item=>({...item,quantity:item.quantity-(Number(item.received)||0)})),source:'Purchase Orders'};
 const result=receiveShipment({shipment,draft:{rows,allocations,notes:draft.notes,evidence:draft.evidence||[],receivedDate:draft.date},inventory,movements,racks,user,date,allowZeroAccepted:true});if(result.error)return result;
 return {...result,order:recordPOReceipt(order,result.shipment.receipt,id)};
}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T00:00:00Z').getTime())&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function revisePurchaseOrder(order,values,user,date){
 if(!order||!['Overdue','Approved','In Transit'].includes(order.status))return {error:'This order cannot revise its delivery plan.'};
 if(!validDate(values.expected)||values.expected<poToday())return {error:'Enter a valid revised arrival date today or later.'};
 if(!values.notes?.trim())return {error:'Enter the supplier update or reason for this revision.'};
 if(values.inTransit&&!values.carrier?.trim())return {error:'Enter the carrier for a confirmed shipment in transit.'};
 return {order:{...order,originalExpected:order.originalExpected||order.expected,expected:values.expected,status:values.inTransit?'In Transit':'Approved',deliveryRevision:{user,date,notes:values.notes.trim(),confirmedInTransit:Boolean(values.inTransit)},delivery:values.inTransit?{tracking:values.tracking?.trim()||'',carrier:values.carrier.trim(),sentAt:date,isDemo:false}:null}};
}
