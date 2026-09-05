import React, { useMemo, useState } from 'react';
import { Search, X, UserRound, Wrench, ShoppingBag, Receipt, Phone } from 'lucide-react';
import { BusinessProfile, Invoice, RepairJob } from '../types';

interface Props {
  isOpen: boolean;
  onOpenInvoice?: (invoice: Invoice) => void;
  onClose: () => void;
  invoices: Invoice[];
  repairs: RepairJob[];
  business: BusinessProfile;
}

export const CustomerHistoryModal: React.FC<Props> = ({ isOpen, onClose, invoices, repairs, business, onOpenInvoice }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ name: string; phone?: string } | null>(null);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const found = new Map<string, { name: string; phone?: string }>();
    invoices.forEach((i) => {
      const text = `${i.invoiceNumber} ${i.customerName || ''} ${i.customerPhone || ''}`.toLowerCase();
      if (text.includes(q) && i.customerName) found.set(i.customerName.toLowerCase(), { name: i.customerName, phone: i.customerPhone });
    });
    repairs.forEach((r) => {
      const text = `${r.jobNumber} ${r.customerName} ${r.customerPhone} ${r.device}`.toLowerCase();
      if (text.includes(q)) found.set(r.customerName.toLowerCase(), { name: r.customerName, phone: r.customerPhone });
    });
    return Array.from(found.values()).slice(0, 12);
  }, [query, invoices, repairs]);

  const exactBills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return invoices.filter(i => String(i.invoiceNumber || '').toLowerCase() === q);
  }, [query, invoices]);

  const customer = selected;
  const customerInvoices = customer ? invoices.filter(i =>
    i.customerName?.trim().toLowerCase() === customer.name.trim().toLowerCase() ||
    (!!customer.phone && i.customerPhone === customer.phone)
  ) : [];
  const customerRepairs = customer ? repairs.filter(r =>
    r.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase() ||
    (!!customer.phone && r.customerPhone === customer.phone)
  ) : [];
  const purchased = customerInvoices.flatMap(i => i.items.map(item => ({ ...item, invoiceNumber: i.invoiceNumber, date: i.date })));
  const money = (n: number) => `${business.currencySymbol} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (!isOpen) return null;

  return <div className="fixed inset-0 z-[70] bg-slate-950/95 backdrop-blur-sm overflow-y-auto">
    <div className="max-w-3xl mx-auto min-h-full p-3 sm:p-6">
      <div className="sticky top-0 z-10 bg-slate-950/95 py-2 flex items-center justify-between">
        <div><h2 className="text-xl font-black flex items-center gap-2"><UserRound className="w-5 h-5 text-cyan-400"/>Customer History</h2><p className="text-xs text-slate-500">Search by customer name or bill number</p></div>
        <button onClick={onClose} className="p-2 rounded-xl bg-slate-900"><X/></button>
      </div>
      <div className="relative mt-3">
        <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500"/>
        <input autoFocus value={query} onChange={e=>{setQuery(e.target.value);setSelected(null)}} placeholder="Customer name or bill number" className="w-full rounded-2xl bg-slate-900 border border-slate-800 pl-10 pr-4 py-3.5 text-sm outline-none focus:border-cyan-500"/>
      </div>
      {!customer && exactBills.length > 0 && <div className="mt-2 space-y-2">{exactBills.map(inv => <div key={inv.id} className="rounded-xl bg-slate-900 border border-cyan-500/20 p-3 flex items-center justify-between gap-3"><div><b>{inv.invoiceNumber}</b><span className="block text-xs text-slate-500">{inv.customerName || 'Walk-in Customer'} • {inv.date}</span></div><button onClick={()=>onOpenInvoice?.(inv)} className="text-cyan-400 text-xs font-bold">Open Bill</button></div>)}</div>}
      {!customer && query && matches.length > 0 && <div className="mt-2 space-y-2">{matches.map(m=><button key={`${m.name}-${m.phone}`} onClick={()=>setSelected(m)} className="w-full text-left rounded-xl bg-slate-900 border border-slate-800 p-3 flex items-center justify-between"><span><b>{m.name}</b><span className="block text-xs text-slate-500">{m.phone || 'No phone number'}</span></span><span className="text-cyan-400 text-xs font-bold">View History</span></button>)}</div>}
      {!customer && query && matches.length === 0 && <p className="text-center text-slate-500 text-sm py-12">No matching customer or bill found.</p>}
      {customer && <>
        <div className="mt-4 rounded-2xl bg-slate-900 border border-cyan-500/20 p-4 flex items-center justify-between"><div><p className="text-lg font-black">{customer.name}</p>{customer.phone&&<p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Phone className="w-3 h-3"/>{customer.phone}</p>}</div><button onClick={()=>setSelected(null)} className="text-xs text-cyan-400 font-bold">Change</button></div>
        <div className="grid grid-cols-3 gap-2 mt-3"><div className="stat"><ShoppingBag/><b>{purchased.length}</b><span>Items</span></div><div className="stat"><Wrench/><b>{customerRepairs.length}</b><span>Repairs</span></div><div className="stat"><Receipt/><b>{customerInvoices.length}</b><span>Bills</span></div></div>
        <section className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-4"><h3 className="font-black flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-cyan-400"/>Purchased Items</h3>{purchased.length===0?<p className="text-xs text-slate-500 py-5">No purchased items found.</p>:<div className="mt-2">{purchased.map((item,idx)=><div key={`${item.invoiceNumber}-${item.id}-${idx}`} className="py-3 border-b border-slate-800 last:border-0 flex justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-sm break-words">{item.name}</p><p className="text-[10px] text-slate-500">Bill {item.invoiceNumber} • {item.date} • Qty {item.quantity}</p></div><b className="text-sm whitespace-nowrap">{money(item.total)}</b></div>)}</div>}</section>
        <section className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-4"><h3 className="font-black flex items-center gap-2"><Wrench className="w-4 h-4 text-violet-400"/>Repair History</h3>{customerRepairs.length===0?<p className="text-xs text-slate-500 py-5">No repair jobs found.</p>:<div className="mt-2">{customerRepairs.map(r=><div key={r.id} className="py-3 border-b border-slate-800 last:border-0"><div className="flex justify-between gap-3"><div><p className="font-semibold text-sm">{r.jobNumber} • {r.device}</p><p className="text-xs text-slate-400 mt-1">{r.issue}</p></div><span className="text-[10px] px-2 py-1 rounded-full bg-violet-500/10 text-violet-300 h-fit">{r.status}</span></div><p className="text-xs text-slate-500 mt-2">Estimate {money(r.estimate)} • Advance {money(r.advance)} • Balance {money(Math.max(0,r.estimate-r.advance))}</p></div>)}</div>}</section>
      </>}
    </div>
    <style>{`.stat{background:rgb(15 23 42);border:1px solid rgb(30 41 59);border-radius:1rem;padding:.75rem;display:flex;flex-direction:column;align-items:center;gap:.2rem}.stat svg{width:17px;height:17px;color:#22d3ee}.stat b{font-size:1.1rem}.stat span{font-size:9px;color:#64748b}`}</style>
  </div>;
};
