import React from 'react';
import { ArrowRight, BarChart3, ClipboardList, Package, Plus, Receipt, Wrench, AlertTriangle, TrendingUp } from 'lucide-react';
import { BusinessProfile, Invoice, QuickProduct, RepairJob } from '../types';

interface Props { business: BusinessProfile; invoices: Invoice[]; products: QuickProduct[]; repairs: RepairJob[]; lang: 'si'|'en'; onNewBill: ()=>void; onProducts: ()=>void; onHistory: ()=>void; onRepairs: ()=>void; }
export const Dashboard: React.FC<Props> = ({business,invoices,products,repairs,lang,onNewBill,onProducts,onHistory,onRepairs}) => {
  const si=false; const today=new Date().toISOString().slice(0,10);
  const todayBills=invoices.filter(i=>i.date===today); const sales=todayBills.reduce((n,i)=>n+i.grandTotal,0);
  const low=products.filter(p=>(p.stockQuantity||0)<=(p.minStockLevel||0));
  const openRepairs=repairs.filter(r=>!['delivered','cancelled'].includes(r.status)).length;
  const money=(n:number)=>`${business.currencySymbol} ${n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const cards=[
    {label:si?'අද විකුණුම්':'Today Sales',value:money(sales),icon:TrendingUp},
    {label:si?'අද බිල්':'Today Bills',value:String(todayBills.length),icon:Receipt},
    {label:si?'භාණ්ඩ':'Products',value:String(products.length),icon:Package},
    {label:si?'අලුත්වැඩියා':'Open Repairs',value:String(openRepairs),icon:Wrench},
  ];
  return <div className="space-y-4 pb-4">
    <section className="rounded-3xl p-5 bg-gradient-to-br from-cyan-500/20 via-slate-900 to-blue-600/10 border border-cyan-500/20 shadow-xl">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-cyan-300 font-semibold">{si?'සුභ පැතුම්':'Welcome'}</p><h2 className="text-2xl font-black mt-1">{business.name}</h2><p className="text-xs text-slate-400 mt-1">{business.tagline}</p></div><BarChart3 className="w-7 h-7 text-cyan-400"/></div>
      <button onClick={onNewBill} className="mt-5 w-full min-h-14 rounded-2xl bg-cyan-500 text-slate-950 font-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-[.98]"><Plus className="w-5 h-5"/>{si?'නව බිල්පතක්':'Create New Bill'}</button>
    </section>
    <div className="grid grid-cols-2 gap-3">{cards.map(({label,value,icon:Icon})=><div key={label} className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4"><Icon className="w-5 h-5 text-cyan-400"/><p className="text-[11px] text-slate-500 mt-3">{label}</p><p className="text-lg font-black mt-0.5 truncate">{value}</p></div>)}</div>
    {low.length>0 && <button onClick={onProducts} className="w-full rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-left flex items-center gap-3"><AlertTriangle className="w-6 h-6 text-amber-400"/><div className="flex-1"><p className="font-bold">{si?'අඩු Stock':'Low Stock Alert'}</p><p className="text-xs text-slate-400">{low.length} {si?'භාණ්ඩ නැවත පිරවිය යුතුයි':'items need restocking'}</p></div><ArrowRight className="w-4 h-4 text-slate-500"/></button>}
    <section className="grid grid-cols-2 gap-3"><button onClick={onHistory} className="rounded-2xl p-4 bg-slate-900 border border-slate-800 text-left"><ClipboardList className="w-5 h-5 text-cyan-400"/><p className="font-bold mt-3">{si?'බිල් ඉතිහාසය':'Bill History'}</p><p className="text-xs text-slate-500 mt-1">{invoices.length} records</p></button><button onClick={onRepairs} className="rounded-2xl p-4 bg-slate-900 border border-slate-800 text-left"><Wrench className="w-5 h-5 text-violet-400"/><p className="font-bold mt-3">{si?'Repair Jobs':'Repair Jobs'}</p><p className="text-xs text-slate-500 mt-1">{openRepairs} open</p></button></section>
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><div className="flex items-center justify-between"><h3 className="font-bold">{si?'අලුත්ම බිල්':'Recent Bills'}</h3><button onClick={onHistory} className="text-xs text-cyan-400">{si?'All':'View all'}</button></div>{todayBills.slice(0,4).map(i=><div key={i.id} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0"><div><p className="text-sm font-semibold">{i.invoiceNumber}</p><p className="text-[10px] text-slate-500">{i.customerName || (si?'Walk-in':'Walk-in Customer')}</p></div><span className="font-bold text-sm">{money(i.grandTotal)}</span></div>)}{todayBills.length===0&&<p className="text-xs text-slate-500 py-5 text-center">{si?'අද තව බිල් නැහැ':'No bills today yet'}</p>}</section>
  </div>
};
