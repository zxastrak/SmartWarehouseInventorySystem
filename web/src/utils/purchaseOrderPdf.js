import {poMoney,poTotal,poDate} from './purchaseOrders.js';
const ascii=value=>String(value??'Not recorded').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim();
const escape=value=>ascii(value).replace(/([\\()])/g,'\\$1');
const wrap=(value,size)=>{const words=ascii(value).split(' '),lines=[''];for(let word of words){while(word.length>size){if(lines.at(-1))lines.push('');lines[lines.length-1]=word.slice(0,size);word=word.slice(size);lines.push('');}const tail=lines.at(-1);if((tail+' '+word).trim().length>size)lines.push(word);else lines[lines.length-1]=(tail+' '+word).trim();}return lines.filter(Boolean);};
export function purchaseOrderPdf(order){
 const grouped=[[]];let used=0;for(const item of order.products){const lines=wrap(item.name+' - '+item.code,35),height=Math.max(32,lines.length*12+12);if(used+height>340){grouped.push([]);used=0;}grouped.at(-1).push({item,lines,height});used+=height;}
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'],pageIds=[];
 for(const [index,rows] of grouped.entries()){
  let stream='';const text=(x,y,value,size=10,bold=false)=>{stream+=`BT /${bold?'FB':'FR'} ${size} Tf 0.10 0.12 0.09 rg ${x} ${y} Td (${escape(value)}) Tj ET\n`;};
  const rule=y=>{stream+=`0.85 0.89 0.83 RG 0.6 w 45 ${y} m 550 ${y} l S\n`;};
  text(45,790,'PURCHASE ORDER',22,true);text(45,767,order.id,12);rule(749);
  text(45,728,'SUPPLIER',9);wrap(order.supplier,42).forEach((line,i)=>text(45,711-i*12,line,11,true));
  text(310,728,'DELIVER TO',9);wrap(order.deliverTo||'Main Warehouse',40).forEach((line,i)=>text(310,711-i*12,line,11,true));
  text(45,659,'ORDER DATE',9);text(45,642,poDate(order.created));text(210,659,'EXPECTED DELIVERY',9);text(210,642,poDate(order.expected));text(410,659,'PAYMENT',9);text(410,642,order.terms||'Not recorded');
  rule(617);text(45,596,'Item',10,true);text(310,596,'Qty',10,true);text(350,596,'Unit Price',10,true);text(460,596,'Subtotal',10,true);rule(582);let y=561;
  for(const {item,lines,height}of rows){lines.forEach((line,i)=>text(45,y-i*12,line,9));text(310,y,item.quantity,9);text(350,y,item.unitPrice==null?'Not provided':poMoney(item.unitPrice,order.currency),9);text(460,y,item.unitPrice==null?'Not provided':poMoney(item.unitPrice*item.quantity,order.currency),9,true);y-=height;rule(y+10);}
  if(index===grouped.length-1){text(350,y-14,'TOTAL',10,true);text(450,y-14,poMoney(poTotal(order),order.currency),11,true);}
  text(45,142,'APPROVED PURCHASE ORDER - FRONTEND DEMO',10,true);text(45,122,'Status: '+order.status+' | Approver: '+(order.decision?.user||'Warehouse Manager'),9);text(45,106,'Original prices unavailable where marked. '+(order.sampleItems?'Item breakdown is sample data.':''),8);text(45,74,'SUSUNO - No supplier transmission is performed by this download.',8);text(480,50,`Page ${index+1}/${grouped.length}`,9);
  const contentId=objects.length+1;objects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`);const pageId=objects.length+1;objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /FR 3 0 R /FB 4 0 R >> >> /Contents ${contentId} 0 R >>`);pageIds.push(pageId);
 }
 objects[1]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`;
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(new TextEncoder().encode(pdf).length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const start=new TextEncoder().encode(pdf).length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return new Uint8Array(new TextEncoder().encode(pdf));
}
export function downloadPoPdf(order){const url=URL.createObjectURL(new Blob([purchaseOrderPdf(order)],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download=`susuno-${order.id}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

