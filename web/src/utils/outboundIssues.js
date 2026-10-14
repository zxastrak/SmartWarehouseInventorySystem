import {newFulfillmentDraft} from './outboundFulfillment.js';
import {validateOutboundItems} from './outbound.js';
export function issueAvailability(shipment, inventory) {
 return (shipment.products||[]).map(row=>{const item=inventory.find(item=>item.sku===row.sku);const available=Math.max(0,Math.floor(Number(item?.current)||0));return {...row,available,shortage:Math.max(0,row.quantity-available)};});
}
export function resolveOutboundIssue({shipment,shipments,inventory,draft,values,user,date}) {
 if(!shipment||shipment.status!=='Issue'||!shipment.pickIssue||shipment.dispatch)return {error:'Only an active outbound issue can be reviewed.'};
 if(!['alternate','partial','hold'].includes(values.resolution))return {error:'Choose a resolution.'};
 if(!values.note?.trim())return {error:'Enter a review note.'};
 const history={resolution:values.resolution,note:values.note.trim(),user,date};
 if(values.resolution==='hold')return {shipment:{...shipment,pickIssue:{...shipment.pickIssue,onHold:true},issueReviews:[...(shipment.issueReviews||[]),history]},onHold:true};
 if(!shipment.products?.length)return {error:'This sample shipment has no item details. It can only be placed on hold.'};
 let products=shipment.products.map(row=>({...row})),backorder=null;
 if(values.resolution==='alternate') {
  const row=products.find(row=>row.sku===values.sku),rack=values.rack?.trim().toUpperCase();
  if(!row)return {error:'Choose the product to pick from an alternate rack.'};
  if(!rack||rack===row.rack.toUpperCase()||rack.length>40)return {error:'Enter a different rack label (maximum 40 characters).'};
  if(values.confirmed!==true)return {error:'Confirm that the product and quantity were checked at the alternate rack.'};
  const error=validateOutboundItems(products,inventory);if(error)return {error:`${error} Update verified total stock through Inventory before continuing; choosing a rack cannot add stock.`};
  history.sku=row.sku;history.originalRack=row.rack;history.alternateRack=rack;
  const originalQty=shipment.pickIssue.sku===row.sku&&Number.isSafeInteger(shipment.pickIssue.availableAtReport)?Math.min(row.quantity,Math.max(0,shipment.pickIssue.availableAtReport)):0;
  row.pickLocations=[...(originalQty?[{rack:row.rack,quantity:originalQty}]:[]),{rack,quantity:row.quantity-originalQty}].filter(location=>location.quantity>0);
  if(!originalQty)row.rack=rack;
 } else {
  const availability=issueAvailability(shipment,inventory),remaining=availability.filter(row=>row.shortage>0).map(row=>({sku:row.sku,name:row.name,rack:row.rack,quantity:row.shortage}));
  products=availability.filter(row=>row.available>0).map(row=>({sku:row.sku,name:row.name,rack:row.rack,quantity:Math.min(row.quantity,row.available)}));
  if(!remaining.length)return {error:'There is no current stock shortage. Review the issue and use a verified alternate rack, or keep the shipment on hold.'};
  if(!products.length)return {error:'No stock is available to fulfil this order. Place it on hold.'};
  const max=Math.max(3051,...shipments.map(row=>Number(row.id.replace('OUT-',''))||0)),id=`OUT-${max+1}`;
  backorder={...shipment,id,reference:`BO-${max+1}`,status:'Scheduled',products:remaining,items:remaining.length,units:remaining.reduce((sum,row)=>sum+row.quantity,0),pickIssue:null,issueReviews:[],dispatch:undefined,parentOutboundId:shipment.id,originalReference:shipment.reference,notes:`Backorder for ${shipment.id}: ${values.note.trim()}`,createdAt:date,createdBy:user};
  delete backorder.backorderId;delete backorder.originalProducts;
  history.backorderId=id;
 }
 const updated={...shipment,status:'Picking',products,items:products.length,units:products.reduce((sum,row)=>sum+row.quantity,0),pickIssue:null,originalProducts:shipment.originalProducts||shipment.products.map(row=>({...row})),backorderId:backorder?.id||shipment.backorderId,issueReviews:[...(shipment.issueReviews||[]),history]};
 const nextDraft=newFulfillmentDraft(updated);
 for(const row of products)nextDraft.picked[row.sku]=Math.max(0,Math.min(row.quantity,Math.floor(Number(draft?.picked?.[row.sku])||0)));
 nextDraft.savedAt=date;
 return {shipment:updated,draft:nextDraft,backorder};
}
