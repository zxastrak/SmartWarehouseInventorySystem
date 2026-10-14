export const poTotal=order=>order.products.every(item=>Number.isFinite(item.unitPrice))?order.products.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0):Number(order.total)||0;
export const poMoney=(value,currency='IDR')=>new Intl.NumberFormat(currency==='IDR'?'id-ID':'en-US',{style:'currency',currency,maximumFractionDigits:0}).format(value);
export const poDate=date=>date?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(date+'T00:00:00+07:00')):'Not recorded';
export const poToday=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date());
export function decidePurchaseOrder(order,status,user,date){
 if(!order||order.status!=='Pending'||!['Approved','Rejected'].includes(status))return {error:'Only Pending orders can be approved or rejected once.'};
 return {order:{...order,status,approved:status==='Approved'?poToday():null,decision:{status,user,date}}};
}
export function createPurchaseOrder({values,orders,inventory,user,date}){
 if(!values.supplier?.trim())return {error:'Choose a supplier.'};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(values.expected)||Number.isNaN(new Date(values.expected+'T00:00:00Z').getTime())||new Date(values.expected+'T00:00:00Z').toISOString().slice(0,10)!==values.expected||values.expected<poToday())return {error:'Enter a valid expected date today or later.'};
 if(!values.products?.length)return {error:'Add at least one product.'};
 const seen=new Set(),products=[];
 for(const row of values.products){const item=inventory.find(item=>item.sku===row.code);if(!item||seen.has(row.code))return {error:'Choose existing, unique products.'};seen.add(row.code);const quantity=Number(row.quantity),unitPrice=Number(row.unitPrice);if(!Number.isSafeInteger(quantity)||quantity<=0||row.quantity===''||!Number.isSafeInteger(unitPrice)||unitPrice<=0||row.unitPrice==='')return {error:'Quantity and unit price must be positive whole numbers.'};if(!Number.isSafeInteger(quantity*unitPrice))return {error:'Order amount is too large.'};products.push({name:item.name,code:item.sku,quantity,unitPrice,received:0});}
 const total=products.reduce((sum,row)=>sum+row.quantity*row.unitPrice,0);if(!Number.isSafeInteger(total))return {error:'Order amount is too large.'};
 let sequence=1,id;const prefix=`PO-${poToday().replaceAll('-','')}-`;do{id=prefix+String(sequence++).padStart(3,'0');}while(orders.some(order=>order.id===id));
 return {order:{id,supplier:values.supplier.trim(),created:poToday(),expected:values.expected,status:'Pending',products,total,currency:'IDR',terms:values.terms?.trim()||'Net 30',reference:values.reference?.trim()||'',notes:values.notes?.trim()||'',requestedBy:user,deliverTo:values.deliverTo||'Main Warehouse'}};
}
export function downloadPurchaseOrder(order){
 const quote=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const columns=['PO','Supplier','Status','Expected','Currency','Product','SKU','Quantity','Unit price','Subtotal','Order total','Item data source'];
 const rows=order.products.map(item=>[order.id,order.supplier,order.status,order.expected,order.currency,item.name,item.code,item.quantity,item.unitPrice??'Not provided',item.unitPrice==null?'Not provided':item.quantity*item.unitPrice,poTotal(order),order.sampleItems?'Sample item breakdown':'Frontend order record']);
 const url=URL.createObjectURL(new Blob(['\uFEFF'+[columns,...rows].map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`susuno-${order.id}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
