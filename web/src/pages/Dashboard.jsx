import WarehouseHeader from '../components/WarehouseHeader.jsx';
import React, { useEffect, useRef, useState } from 'react';
import DashboardSidebar from '../components/DashboardSidebar.jsx';
import Icon from '../components/DashboardIcon.jsx';
import { stockStatus } from '../data/inventory.js';
import { metrics, stockItems, stockHistory } from '../data/dashboard.js';
import '../styles/dashboard.css';

function StockFlow({ period, onPeriodChange }) {
  const rows = period === '7' ? stockHistory.slice(-7) : stockHistory;
  const [selected, setSelected] = useState(null);
  const left = 48, right = 738, top = 32, bottom = 204;
  const point = (row, index, key) => [left + index * (right - left) / (rows.length - 1), bottom - row[key] / 1200 * (bottom - top)];
  const line = key => {
    const points = rows.map((row,index) => point(row,index,key));
    return points.reduce((path,current,index) => {
      if (!index) return `M${current.join(',')}`;
      const previous = points[index-1], before = points[Math.max(0,index-2)], after = points[Math.min(points.length-1,index+1)];
      const c1 = [previous[0]+(current[0]-before[0])/6, previous[1]+(current[1]-before[1])/6];
      const c2 = [current[0]-(after[0]-previous[0])/6, current[1]-(after[1]-previous[1])/6];
      return `${path} C${c1.join(',')} ${c2.join(',')} ${current.join(',')}`;
    }, '');
  };
  const area = key => `${line(key)} L${right},${bottom} L${left},${bottom} Z`;
  const peakIndex = rows.findIndex(row => row.outgoing === Math.max(...rows.map(item => item.outgoing)));
  const activeIndex = selected === null ? peakIndex : Math.min(selected, rows.length - 1);
  const active = rows[activeIndex];
  const [px,py] = point(active,activeIndex,'outgoing');
  return <section className="dashboard-card flow-card" aria-labelledby="stock-flow-title">
    <div className="card-heading"><div><h2 id="stock-flow-title">Stock Flow</h2><p>Total inventory movement (in units)</p></div><label><span className="sr-only">Stock flow period</span><select value={period} onChange={event => { setSelected(null); onPeriodChange(event.target.value); }}><option value="14">Last 14 days</option><option value="7">Last 7 days</option></select></label></div>
    <div className="flow-legend"><span><i className="in-dot" />In</span><span><i className="out-dot" />Out</span></div>
    <svg className="flow-chart" viewBox="0 0 780 240" role="img" aria-label={`Stock movement over ${rows.length} days. Latest incoming ${rows.at(-1).incoming}, outgoing ${rows.at(-1).outgoing} units.`}>
      <defs><linearGradient id="incoming-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dcebd9" stopOpacity=".8" /><stop offset="1" stopColor="#dcebd9" stopOpacity="0" /></linearGradient><linearGradient id="outgoing-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f3c5c1" stopOpacity=".9" /><stop offset="1" stopColor="#f3c5c1" stopOpacity="0" /></linearGradient></defs>
      {[0,300,600,900,1200].map(value => <g key={value}><line x1={left} x2={right} y1={bottom-value/1200*(bottom-top)} y2={bottom-value/1200*(bottom-top)} stroke="#e2e7dd" strokeDasharray="3 4" /><text x="25" y={bottom-value/1200*(bottom-top)+4} textAnchor="end" fill="#737b6c" fontSize="10">{value.toLocaleString('en-US')}</text></g>)}
      <path d={area('incoming')} fill="url(#incoming-area)" /><path d={area('outgoing')} fill="url(#outgoing-area)" />
      <path d={line('incoming')} fill="none" stroke="#5c732b" strokeWidth="2.3" strokeLinejoin="round" /><path d={line('outgoing')} fill="none" stroke="#8a5a5b" strokeWidth="2.3" strokeLinejoin="round" />
      <line x1={px} x2={px} y1={py} y2={bottom} stroke="#8a5a5b" strokeDasharray="4 4" /><circle cx={px} cy={py} r="5" fill="#8a5a5b" stroke="white" strokeWidth="2" />
      <g transform={`translate(${Math.max(50,Math.min(px-60,620))},${Math.max(0,py-60)})`}><rect width="120" height="40" rx="7" fill="#8a5a5b" /><text x="60" y="16" textAnchor="middle" fill="white" fontSize="10">{selected === null ? 'Stockout predicted' : `${active.day}: Out ${active.outgoing}`}</text><text x="60" y="29" textAnchor="middle" fill="white" fontSize="10">{selected === null ? 'in 4 days' : `In ${active.incoming} units`}</text></g>
      {rows.filter((_,index) => (index % Math.ceil(rows.length/6) === 0 && index < rows.length-2) || index === rows.length-1).map(row => <text key={row.day} x={point(row,rows.indexOf(row),'incoming')[0]} y="226" textAnchor="middle" fontSize="10" fill="#191d17">{row.day}, 2026</text>)}
      {['incoming','outgoing'].map((key,index) => <g key={key} transform={`translate(736,${point(rows.at(-1),rows.length-1,key)[1]-10})`}><rect width="40" height="21" rx="6" fill={index ? '#8a5a5b' : '#5c732b'} /><text x="20" y="14" fill="white" textAnchor="middle" fontSize="11">{rows.at(-1)[key]}</text></g>)}
    </svg>
    <div className="flow-day-controls" aria-label="Inspect daily stock flow">{rows.map((row,index) => <button key={row.day} aria-label={`Inspect ${row.day}`} title={`${row.day}: In ${row.incoming}, Out ${row.outgoing}`} onClick={() => setSelected(index)} aria-pressed={selected === index}>{index+1}</button>)}</div>
  </section>;
}

export default function Dashboard({ manager, warehouse, onSignOut, onNavigate, inventory }) {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('14');
  const [navOpen, setNavOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const searchRef = useRef(null);
  const dialogRef = useRef(null);
  const firstName = manager?.fullName?.trim().split(/\s+/)[0] || 'Naura';
  const warehouseName = warehouse?.warehouseName || 'Main Warehouse';
  const liveStockItems = stockItems.map(item => { const product=inventory?.find(product => product.sku===({1111:"WH-3382",2222:"WH-7621",3333:"WH-1209",4444:"WH-4450"})[item.code]); return product ? {...item, name:product.name, current:product.current, reorder:product.reorder, rack:product.rack, status:stockStatus(product)} : item; }).filter(item => item.current < item.reorder);
  const filtered = liveStockItems.filter(item => `${item.code} ${item.name} ${item.rack}`.toLowerCase().includes(search.toLowerCase().trim()));
  useEffect(() => { if (dialog && !dialogRef.current.open) dialogRef.current.showModal(); }, [dialog]);
  function preview(title, description = 'This page will be connected after its design is implemented.') { if(title==='View Reports'){onNavigate?.('reports');return;}setDialog({ title, description }); }
  function navigate(label) { if (label === 'Reports' || label === 'Audit Trail') onNavigate?.(label === 'Reports'?'reports':'audit-trail');
    else if (label === 'Purchase Orders') onNavigate?.('purchase-orders');
    else if (label === 'AI Insight') onNavigate?.('ai-insight');
    else if (label === 'Inventory' || label === 'Inbound' || label === 'Outbound') onNavigate?.(label.toLowerCase());
    else if (label !== 'Dashboard') preview(label); }
  const date = new Intl.DateTimeFormat('en-US',{ weekday:'long', year:'numeric', month:'long', day:'numeric' }).format(new Date());
  return <div className="dashboard-layout">
    <DashboardSidebar warehouseName={warehouseName} onNavigate={navigate} open={navOpen} onClose={() => setNavOpen(false)} />
    <div className="dashboard-main">
      <WarehouseHeader manager={manager} search={search} onSearch={setSearch} searchRef={searchRef} onMenu={() => setNavOpen(true)} onSignOut={onSignOut} onAlerts={() => preview('Inventory alerts', 'Wireless Scanner, Safety Helmet and Pallet Jack need restocking.')} onViewProfile={() => preview('Manager profile', `Manager: ${manager?.fullName || firstName}. Warehouse: ${warehouseName}.`)} />
      <main className="dashboard-content">
        <div className="dashboard-intro"><div><p>GOOD MORNING</p><h1>Here’s what’s happening<br />in your warehouse</h1></div><div className="dashboard-date"><p>{date}</p><p>{warehouseName}</p></div></div>
        <div className="dashboard-columns">
          <div className="dashboard-left-column">
            <section className="dashboard-metrics" aria-label="Stock summary">{metrics.map(metric => <div key={metric.label} className={`metric-card metric-${metric.tone}`}><Icon name={metric.icon} size={38} /><div><h2>{metric.label}</h2><strong>{metric.value}</strong><p><span>▲ {metric.trend}</span> vs. last month</p></div></div>)}</section>
            <StockFlow period={period} onPeriodChange={setPeriod} />
            <section className="dashboard-card low-stock-card" aria-labelledby="low-stock-title"><div className="card-heading"><h2 id="low-stock-title">Low Stock Items</h2><button className="dashboard-link" onClick={() => onNavigate?.('inventory')} >View all <Icon name="arrow" size={20} /></button></div><div className="stock-table-wrap"><table><thead><tr>{['Code','Product Name','Rack','Current','Reorder Level','Days Left','Status','Action'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map(item => <tr key={item.code}><td>{item.code}</td><td>{item.name}</td><td>{item.rack}</td><td className={item.current<10 ? 'critical-text' : ''}>{item.current}</td><td>{item.reorder}</td><td className={item.days<5 ? 'critical-text' : ''}>{item.days}</td><td><span className={`stock-status status-${item.status.toLowerCase()}`}>{item.status}</span></td><td><button className="dashboard-link" onClick={() => preview(`Review ${item.name}`,`Code ${item.code} · Rack ${item.rack} · Current ${item.current} · Reorder level ${item.reorder} · ${item.days} days left. Sample data.`)}>Review</button></td></tr>)}{!filtered.length && <tr><td colSpan="8" className="empty-stock">No sample items match “{search}”.</td></tr>}</tbody></table></div></section>
          </div>
          <div className="dashboard-right-column">
            <section className="dashboard-card action-card"><div className="card-heading"><h2>Action Required <span className="action-count">3</span></h2><button className="dashboard-link" onClick={() => preview('All actions','Demo: approval requests, predicted stockout, and restock review.')} >View all <Icon name="arrow" size={20} /></button></div>{[
              ['box','3 items require approval','New purchase requests pending review','rose'],
              ['warning','Stockout predicted in 4 days','S12345 • Wireless Scanner','rose'],
              ['refresh','Review restock','12 items below reorder point','green'],
            ].map(([icon,title,description,tone]) => <button key={title} className={`action-row action-${tone}`} onClick={() => preview(title,`${description}. This is a demo alert.`)}><Icon name={icon} size={34} /><span><strong>{title}</strong><small>{description}</small></span><Icon name="chevron" size={18} /></button>)}</section>
            <section className="dashboard-card capacity-card"><h2>Warehouse Capacity</h2><div className="capacity-value"><progress value="3420" max="5000" aria-label="Warehouse capacity used" /><strong>68%</strong></div><div className="capacity-details"><span><i className="in-dot" />Used <strong>3,420</strong></span><span><i className="available-dot" />Available <strong>1,580</strong></span><span>Total <strong>5,000</strong></span></div></section>
            <section className="dashboard-card quick-card"><h2>Quick Actions</h2><div className="quick-grid">{[['box','New Purchase Request','Request new stock','primary'],['transfer','Transfer Stock','Move between racks','green'],['report','View Reports','Inventory & movement','neutral'],['chart','Scan Item','Add or update stock','neutral']].map(([icon,title,description,tone]) => <button key={title} className={`quick-action quick-${tone}`} onClick={() => preview(title)}><Icon name={icon} size={34} /><span><strong>{title}</strong><small>{description}</small></span><Icon name="chevron" size={16} /></button>)}</div></section>
          </div>
        </div>
        <p className="dashboard-demo">Frontend demo · Stock, alerts, capacity and predictions are sample data.</p>
      </main>
    </div>
    <dialog ref={dialogRef} className="dashboard-dialog" onCancel={() => setDialog(null)} onClose={() => setDialog(null)} aria-labelledby="dashboard-dialog-title">{dialog && <><h2 id="dashboard-dialog-title">{dialog.title}</h2><p>{dialog.description}</p><button className="continue-button" onClick={() => { dialogRef.current.close(); setDialog(null); }}>Close</button></>}</dialog>
  </div>;
}
