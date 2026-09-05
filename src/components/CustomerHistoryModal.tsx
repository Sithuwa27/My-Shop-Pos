import React, { useMemo, useState } from 'react';
import { Search, X, UserRound, Wrench, ShoppingBag, Receipt, Phone, CalendarDays } from 'lucide-react';
import { BusinessProfile, Invoice, RepairJob } from '../types';

interface Props {
  isOpen: boolean;
  onOpenInvoice?: (invoice: Invoice) => void;
  onClose: () => void;
  invoices: Invoice[];
  repairs: RepairJob[];
  business: BusinessProfile;
  onUpdateInvoice?: (invoice: Invoice) => void;
}

export const CustomerHistoryModal: React.FC<Props> = ({ isOpen, onClose, invoices, repairs, business, onOpenInvoice, onUpdateInvoice }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ name: string; phone?: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
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
  // Customer account summary: total billed, amount already collected, and outstanding debt.
  // For cash overpayments, only the bill total counts as collected (change is not debt).
  const totalBilled = customerInvoices.reduce((sum, i) => sum + Math.max(0, Number(i.grandTotal) || 0), 0);
  const totalPaid = customerInvoices.reduce((sum, i) => {
    const total = Math.max(0, Number(i.grandTotal) || 0);
    const paid = Math.max(0, Number(i.paidAmount) || 0);
    return sum + Math.min(total, paid);
  }, 0);
  const totalDue = Math.max(0, totalBilled - totalPaid);
  const outstandingBills = customerInvoices
    .map(i => ({ ...i, due: Math.max(0, (Number(i.grandTotal) || 0) - Math.min(Number(i.grandTotal) || 0, Number(i.paidAmount) || 0)) }))
    .filter(i => i.due > 0)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const recordCustomerPayment = () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setPaymentError('ගෙවන මුදල ඇතුළත් කරන්න.'); return; }
    if (!onUpdateInvoice) return;
    let remaining = amount;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    outstandingBills.forEach((bill) => {
      if (remaining <= 0) return;
      const add = Math.min(remaining, bill.due);
      if (add <= 0) return;
      const updatedPaid = (Number(bill.paidAmount) || 0) + add;
      const payment = { id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, amount: add, date, time };
      onUpdateInvoice({ ...bill, paidAmount: updatedPaid, changeAmount: Math.max(0, updatedPaid - bill.grandTotal), paymentHistory: [...(bill.paymentHistory || []), payment] });
      remaining -= add;
    });
    setPaymentAmount('');
    setPaymentError(remaining > 0 ? `නය සියල්ල ගෙවා ඇත. ඉතිරි ${money(remaining)} වැඩිපුර මුදලක් ලෙස ඉතිරි වී නැහැ.` : '');
  };

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
        <section className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="account-stat"><span>මුළු බිල් ගාන</span><b>{money(totalBilled)}</b></div>
          <div className="account-stat paid"><span>අරන් තියන ගාන</span><b>{money(totalPaid)}</b></div>
          <div className="account-stat due"><span>ගන්න තියන නය</span><b>{money(totalDue)}</b></div>
        </section>
        <section className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="font-black flex items-center gap-2"><Receipt className="w-4 h-4 text-cyan-400"/>Bill History & නය</h3>
          <div className="mt-3 rounded-xl border border-cyan-500/20 bg-slate-950 p-3">
            <p className="text-xs text-slate-400 mb-2">නය ගෙවීමක් ඇතුළත් කළාම පැරණි නය තියෙන බිල් වලට මුලින්ම අඩු වෙනවා.</p>
            <div className="flex gap-2">
              <input type="number" min="0" step="0.01" value={paymentAmount} onChange={e=>{setPaymentAmount(e.target.value);setPaymentError('')}} placeholder="ගෙවන මුදල" className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-cyan-500"/>
              <button onClick={recordCustomerPayment} className="rounded-xl bg-cyan-500 text-slate-950 px-4 py-2 text-sm font-black">නය බේරන්න</button>
            </div>
            {paymentError && <p className="text-[11px] text-emerald-400 mt-2">{paymentError}</p>}
          </div>
          <div className="mt-3 space-y-2">
            {customerInvoices.length===0 ? <p className="text-xs text-slate-500 py-5">No bills found.</p> : customerInvoices.slice().sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).map(inv=>{
              const due=Math.max(0,(Number(inv.grandTotal)||0)-Math.min(Number(inv.grandTotal)||0,Number(inv.paidAmount)||0));
              const payments=(inv.paymentHistory||[]);
              return <div key={inv.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="flex justify-between gap-3"><div><p className="font-bold text-sm">{inv.invoiceNumber}</p><p className="text-[11px] text-slate-500 flex items-center gap-1"><CalendarDays className="w-3 h-3"/>{inv.date} {inv.time}</p></div><b className={due>0?'text-red-300':'text-emerald-300'}>{due>0?`නය ${money(due)}`:'නය බේරලා'}</b></div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]"><span>Bill<br/><b>{money(inv.grandTotal)}</b></span><span>Paid<br/><b>{money(Math.min(Number(inv.grandTotal)||0,Number(inv.paidAmount)||0))}</b></span><span>Balance<br/><b>{money(due)}</b></span></div>
                {payments.length>0 && <div className="mt-2 pt-2 border-t border-slate-800"><p className="text-[10px] text-slate-500 mb-1">ගෙවීම්</p>{payments.map(p=><p key={p.id} className="text-[10px] text-slate-400 flex justify-between"><span>{p.date} {p.time}</span><span className="text-emerald-300">+ {money(p.amount)}</span></p>)}</div>}
              </div>
            })}
          </div>
        </section>
        <section className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-4"><h3 className="font-black flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-cyan-400"/>Purchased Items</h3>{purchased.length===0?<p className="text-xs text-slate-500 py-5">No purchased items found.</p>:<div className="mt-2">{purchased.map((item,idx)=><div key={`${item.invoiceNumber}-${item.id}-${idx}`} className="py-3 border-b border-slate-800 last:border-0 flex justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-sm break-words">{item.name}</p><p className="text-[10px] text-slate-500">Bill {item.invoiceNumber} • {item.date} • Qty {item.quantity}</p></div><b className="text-sm whitespace-nowrap">{money(item.total)}</b></div>)}</div>}</section>
        <section className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-4"><h3 className="font-black flex items-center gap-2"><Wrench className="w-4 h-4 text-violet-400"/>Repair History</h3>{customerRepairs.length===0?<p className="text-xs text-slate-500 py-5">No repair jobs found.</p>:<div className="mt-2">{customerRepairs.map(r=><div key={r.id} className="py-3 border-b border-slate-800 last:border-0"><div className="flex justify-between gap-3"><div><p className="font-semibold text-sm">{r.jobNumber} • {r.device}</p><p className="text-xs text-slate-400 mt-1">{r.issue}</p></div><span className="text-[10px] px-2 py-1 rounded-full bg-violet-500/10 text-violet-300 h-fit">{r.status}</span></div><p className="text-xs text-slate-500 mt-2">Estimate {money(r.estimate)} • Advance {money(r.advance)} • Balance {money(Math.max(0,r.estimate-r.advance))}</p></div>)}</div>}</section>
      </>}
    </div>
    <style>{`.stat{background:rgb(15 23 42);border:1px solid rgb(30 41 59);border-radius:1rem;padding:.75rem;display:flex;flex-direction:column;align-items:center;gap:.2rem}.stat svg{width:17px;height:17px;color:#22d3ee}.stat b{font-size:1.1rem}.stat span{font-size:9px;color:#64748b}.account-stat{background:rgb(15 23 42);border:1px solid rgb(51 65 85);border-radius:1rem;padding:.8rem}.account-stat span{display:block;font-size:10px;color:#94a3b8;margin-bottom:.3rem}.account-stat b{font-size:1rem;color:#f8fafc}.account-stat.paid{border-color:rgba(34,197,94,.25)}.account-stat.paid b{color:#86efac}.account-stat.due{border-color:rgba(239,68,68,.3)}.account-stat.due b{color:#fca5a5}`}</style>
  </div>;
};
