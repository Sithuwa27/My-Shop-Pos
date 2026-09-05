import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  Calendar, 
  TrendingUp, 
  X,
  Eye,
  CheckCircle,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
import { BusinessProfile, Invoice } from '../types';
import { storage } from '../services/storage';
import { soundEffects } from '../services/soundEffects';

interface BillHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  onLoadInvoice: (inv: Invoice) => void;
  business: BusinessProfile;
  soundEnabled: boolean;
}

export const BillHistoryModal: React.FC<BillHistoryModalProps> = ({
  isOpen,
  onClose,
  invoices,
  setInvoices,
  onLoadInvoice,
  business,
  soundEnabled,
}) => {
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');

  if (!isOpen) return null;

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase().trim();
    const matchesQuery =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
      (inv.customerPhone && inv.customerPhone.includes(q));

    const matchesDate = !filterDate || inv.date === filterDate;
    return matchesQuery && matchesDate;
  });

  // Calculate totals and overall profit for filtered list
  const totalSales = filtered.reduce((sum, i) => sum + i.grandTotal, 0);
  const totalProfit = filtered.reduce((sum, i) => sum + (i.totalProfit || 0), 0);

  const handleDelete = (id: string) => {
    if (confirm('මෙම බිල්පත ඉතිහාසයෙන් ඉවත් කිරීමට අවශ්‍යද?')) {
      storage.deleteInvoice(id);
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      if (soundEnabled) soundEffects.playBeep(400, 0.08);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-slate-100">
                Bill History & Reports (Sales & Profit History)
              </h2>
              <p className="text-xs text-slate-400">Previous bills and profit calculations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Strip with Revenue and Profit */}
        <div className="bg-slate-800/60 px-4 sm:px-6 py-3 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-400 text-[11px] block">Bill Count:</span>
            <span className="font-bold text-sm text-cyan-300">{filtered.length} Invoices</span>
          </div>

          <div>
            <span className="text-slate-400 text-[11px] block">Total Revenue:</span>
            <span className="font-bold text-sm text-emerald-400 flex items-center gap-1 font-mono">
              <span>
                {business.currencySymbol} {totalSales.toFixed(2)}
              </span>
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-[11px] block">Total Profit:</span>
            <span className="font-bold text-sm text-cyan-300 flex items-center gap-1 font-mono">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                +{business.currencySymbol} {totalProfit.toFixed(2)}
              </span>
            </span>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search bill number or customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="text-[11px] text-cyan-400 hover:underline px-1"
            >
              Clear Date
            </button>
          )}
        </div>

        {/* Invoices List */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2 text-xs">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p>No bills found.</p>
            </div>
          ) : (
            filtered.map((inv) => (
              <div
                key={inv.id}
                className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-300">{inv.invoiceNumber}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 uppercase">
                      {inv.paymentMethod}
                    </span>
                    <span className="text-slate-500 text-[11px]">&bull; {inv.time}</span>
                  </div>

                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {inv.date} {inv.customerName ? `| Customer: ${inv.customerName}` : ''}
                  </p>

                  <p className="text-slate-400 text-[11px]">
                    Items {inv.items.length} &bull; {inv.items.map((i) => i.name).slice(0, 3).join(', ')}
                    {inv.items.length > 3 ? '...' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm sm:text-base text-emerald-400 block">
                      {business.currencySymbol} {inv.grandTotal.toFixed(2)}
                    </span>
                    {inv.totalProfit !== undefined && inv.totalProfit > 0 && (
                      <span className="text-[10px] text-cyan-400 font-mono font-semibold block">
                        Profit: +{business.currencySymbol} {inv.totalProfit.toFixed(0)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onLoadInvoice(inv);
                        onClose();
                        if (soundEnabled) soundEffects.playBeep(650, 0.08);
                      }}
                      className="p-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white transition flex items-center gap-1"
                      title="Load and Edit Bill"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Edit/View</span>
                    </button>

                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 transition"
                      title="Delete Invoice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <span className="text-[11px] text-slate-500">
            {business.appName || business.name} &bull; Powered By Sithum Kalhara
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
