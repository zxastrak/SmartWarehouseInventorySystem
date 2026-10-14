export const insightUsageAssumptions={'WH-3382':3,'WH-7621':5,'WH-1209':5};
const kinds={'WH-3382':'restock','WH-7621':'location','WH-1209':'reorder'};
export function buildInventoryInsights(items){
 const products=items.map(item=>{const dailyUsage=insightUsageAssumptions[item.sku]||null,daysLeft=dailyUsage?Math.ceil(item.current/dailyUsage):item.current===0?0:null;return {...item,dailyUsage,daysLeft,gap:Math.max(0,item.reorder-item.current),kind:kinds[item.sku]||'restock'};});
 const featured=Object.keys(insightUsageAssumptions);
 const atRisk=products.filter(item=>item.current<item.reorder||(item.daysLeft!==null&&item.daysLeft<=14)).sort((a,b)=>{const ai=featured.indexOf(a.sku),bi=featured.indexOf(b.sku);if(ai!==-1||bi!==-1)return (ai===-1?999:ai)-(bi===-1?999:bi);return a.current-b.current||a.name.localeCompare(b.name);});
 const modeled=products.filter(item=>item.dailyUsage);
 const forecast=Array.from({length:15},(_,day)=>{const stockouts=modeled.filter(item=>item.current-item.dailyUsage*day<=0).length;return {day,stockouts,percent:modeled.length?stockouts/modeled.length*100:0};});
 return {atRisk,modeled,forecast,critical:atRisk.filter(item=>item.current===0||(item.daysLeft!==null&&item.daysLeft<=4)).length,actions:atRisk.length};
}
export const insightActionLabels={restock:'Review restock',location:'Review location',reorder:'Review reorder'};
