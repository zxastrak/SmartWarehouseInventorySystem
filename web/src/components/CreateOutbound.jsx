import React,{useState} from 'react';
import {outboundTypes,outboundDate} from '../data/outbound.js';
import {validateOutboundDetails,validateOutboundItems} from '../utils/outbound.js';
export default function CreateOutbound({inventory,stage,onStage,onCancel,onCreate}) {
  const [draft,setDraft]=useState({type:'',destination:'',date:'',time:'',reference:'',priority:'Normal',notes:''});
  const [quantities,setQuantities]=useState({}),[selected,setSelected]=useState([]),[query,setQuery]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const type=outboundTypes.find(row=>row.name===draft.type);
  const products=selected.map(sku=>({...inventory.find(row=>row.sku===sku),sku,quantity:Number(quantities[sku])}));
  const units=products.reduce((sum,row)=>sum+(Number.isFinite(row.quantity)?row.quantity:0),0);
  const ordered=[...inventory].sort((a,b)=>{
    const featured=['WH-3382','WH-7621','WH-1209','WH-6108'];
    const rank=sku=>featured.includes(sku)?featured.indexOf(sku):4;
    return rank(a.sku)-rank(b.sku);
  });
  const filtered=ordered.filter(row=>`${row.name} ${row.sku} ${row.rack}`.toLowerCase().includes(query.toLowerCase()));
  function change(key,value) {setDraft(current=>({...current,[key]:value}));setError('');}
  function next() {const message=stage===0?validateOutboundDetails(draft):validateOutboundItems(products,inventory);setError(message);if(!message){onStage(stage+1);window.scrollTo(0,0);}}
  function toggle(item) {
    if(selected.includes(item.sku)) {setSelected(current=>current.filter(sku=>sku!==item.sku));setError('');return;}
    const row={sku:item.sku,quantity:Number(quantities[item.sku])};
    const message=validateOutboundItems([row],inventory);setError(message);if(!message)setSelected(current=>[...current,item.sku]);
  }
  function create() {
    if(busy)return;
    const message=validateOutboundDetails(draft)||validateOutboundItems(products,inventory);
    if(message){setError(message);return;}
    setBusy(true);
    const result=onCreate({...draft,products});
    if(result?.error){setError(result.error);setBusy(false);}
  }
  return <>
    <ol className="outbound-steps dashboard-card">{['Order details','Add items','Review','Created'].map((label,index)=><li key={label} className={index<=stage?'reached':''} aria-current={stage===index?'step':undefined}><span>{index<stage?'✓':index+1}</span><strong>{label}</strong></li>)}</ol>
    {stage===0?<div className="outbound-form-grid"><section className="dashboard-card outbound-panel"><h2>Order information</h2><fieldset className="outbound-type-field"><legend>Outbound type *</legend><div className="outbound-types">{outboundTypes.map(row=><label key={row.name} className={draft.type===row.name?'selected-type':''}><input type="radio" name="outbound-type" value={row.name} checked={draft.type===row.name} onChange={()=>{setDraft(current=>({...current,type:row.name,destination:''}));setError('');}} /><strong>{row.name}</strong><span>{row.caption}</span></label>)}</div></fieldset>
    <div className="outbound-fields"><label>{type?.label||'Destination'} *<select aria-label="Outbound destination" value={draft.destination} disabled={!type} onChange={e=>change('destination',e.target.value)}><option value="">Choose destination</option>{type?.destinations.map(value=><option key={value}>{value}</option>)}</select></label><label>Requested ship date *<input aria-label="Requested ship date" type="datetime-local" value={draft.date?`${draft.date}T${draft.time}`:''} onChange={e=>{const [date='',time='']=e.target.value.split('T');setDraft(current=>({...current,date,time}));setError('');}} /></label><label>Request reference<input aria-label="Request reference" placeholder="Enter request reference" value={draft.reference} maxLength={80} onChange={e=>change('reference',e.target.value)} /></label><label>Priority<select value={draft.priority} onChange={e=>change('priority',e.target.value)}>{['Normal','High','Urgent'].map(value=><option key={value}>{value}</option>)}</select></label><label className="outbound-wide">Notes<textarea placeholder="Add handling or delivery instructions..." value={draft.notes} maxLength={2000} onChange={e=>change('notes',e.target.value)} /></label></div></section>
    <aside className="dashboard-card outbound-panel outbound-side"><h2>Before continuing</h2><div className="outbound-info"><strong>Required information</strong><p>{draft.type?'✓':'○'} Outbound type</p><p>{draft.destination?'✓':'○'} Destination</p><p>{draft.date&&draft.time?'✓':'○'} Ship date</p></div><p className="outbound-muted">Inventory is not deducted until the shipment is confirmed.</p><button className="inbound-primary" onClick={next}>Continue to Add Items</button></aside></div>
    :stage===1?<div className="outbound-form-grid"><section className="dashboard-card outbound-panel"><h2>Select inventory</h2><input className="outbound-item-search" aria-label="Search outbound inventory" placeholder="⌕ Search product, SKU, or rack..." value={query} onChange={e=>setQuery(e.target.value)} /><div className="inbound-table-wrap outbound-items-table"><table><thead><tr><th>Product</th><th>Available</th><th>Quantity</th><th>Action</th></tr></thead><tbody>{filtered.map(item=><tr key={item.sku}><td><strong>{item.name}</strong><small>{item.sku} · Rack {item.rack}</small></td><td>{item.current}</td><td><input type="number" min="1" max={item.current} step="1" aria-label={`Quantity ${item.sku}`} value={quantities[item.sku]??''} placeholder="0" onChange={e=>{setQuantities(current=>({...current,[item.sku]:e.target.value}));setError('');}} /></td><td><button className="dashboard-link" disabled={item.current<=0} aria-pressed={selected.includes(item.sku)} aria-label={`${selected.includes(item.sku)?'Remove':'Add'} ${item.sku}`} onClick={()=>toggle(item)}>{selected.includes(item.sku)?'Added ✓':item.current<=0?'No stock':'Add +'}</button></td></tr>)}{!filtered.length&&<tr><td colSpan="4">No matching products.</td></tr>}</tbody></table></div></section><aside className="dashboard-card outbound-panel outbound-side"><h2>Order summary</h2><dl className="outbound-summary-rows"><div><dt>Selected products</dt><dd>{selected.length}</dd></div><div><dt>Total units</dt><dd>{units}</dd></div><div><dt>Destination</dt><dd>{draft.destination}</dd></div></dl><div className="outbound-side-actions"><button className="inbound-secondary" onClick={()=>{onStage(0);setError('');}}>Back</button><button className="inbound-primary" disabled={!selected.length} onClick={next}>Review Outbound</button></div></aside></div>
    :<section className="dashboard-card outbound-panel outbound-review"><h2>Outbound summary</h2><dl className="outbound-review-summary">{[['Type',draft.type],['Destination',draft.destination],['Reference',draft.reference||'Automatically generated'],['Ship date',`${outboundDate(draft.date)} · ${draft.time}`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h2>Items</h2><div className="inbound-table-wrap"><table><thead><tr><th>Product</th><th>Rack</th><th>Available</th><th>Quantity</th></tr></thead><tbody>{products.map(row=><tr key={row.sku}><td><strong>{row.name}</strong></td><td>{row.rack}</td><td>{row.current}</td><td>{row.quantity}</td></tr>)}</tbody></table></div>{draft.notes&&<p className="outbound-muted">Notes: {draft.notes}</p>}<div className="inbound-form-actions"><button className="inbound-secondary" onClick={()=>{onStage(1);setError('');}}>Back</button><button className="inbound-primary" disabled={busy} onClick={create}>{busy?'Creating...':'Create Outbound'}</button></div></section>}
    {error&&<p role="alert" className="field-error outbound-error">{error}</p>}
    <button className="dashboard-link outbound-back" onClick={stage===0?onCancel:()=>{onStage(stage-1);setError('');}}>‹ {stage===0?'Back to Outbound':'Back'}</button>
  </>;
}
