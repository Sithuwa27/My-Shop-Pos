import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  User, 
  Phone, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Receipt, 
  RotateCcw, 
  Save,
  Tag,
  DollarSign,
  Camera,
  Edit3,
  Check,
  TrendingUp,
  AlertTriangle,
  Headphones,
  Wrench,
  Scan
} from 'lucide-react';
import { BusinessProfile, Invoice, PaymentMethod, QuickProduct, ReceiptItem, ProductCategory } from '../types';
import { t } from '../utils/translations';
import { soundEffects } from '../services/soundEffects';
import { ScannerModal } from './ScannerModal';

interface BillEditorProps {
  invoice: Invoice;
  setInvoice: React.Dispatch<React.SetStateAction<Invoice>>;
  business: BusinessProfile;
  products: QuickProduct[];
  lang: 'si' | 'en';
  soundEnabled: boolean;
  onSaveInvoice: () => void;
  onResetInvoice: () => void;
}

export const BillEditor: React.FC<BillEditorProps> = ({
  invoice,
  setInvoice,
  business,
  products,
  lang,
  soundEnabled,
  onSaveInvoice,
  onResetInvoice,
}) => {
  const strings = t[lang];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [showCustomerFields, setShowCustomerFields] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Editing inline item modal or inline state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editQty, setEditQty] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editDiscount, setEditDiscount] = useState<string>('');

  // Custom Item Inline Add State
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customCost, setCustomCost] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customCategory, setCustomCategory] = useState<ProductCategory>('Accessories');

  // Filtered products for quick-add grid
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.sinhalaName.toLowerCase().includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query));
    return matchesCat && matchesSearch;
  });

  // Calculate totals helper including Profit
  const recalculateInvoice = (
    items: ReceiptItem[],
    paymentMethod = invoice.paymentMethod,
    paidAmount = invoice.paidAmount
  ) => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalLineDiscounts = items.reduce((sum, item) => {
      const lineBeforeDiscount = item.price * item.quantity;
      return sum + (lineBeforeDiscount - item.total);
    }, 0);

    const afterDiscount = subtotal - totalLineDiscounts;
    const taxAmount = invoice.taxRate > 0 ? (afterDiscount * invoice.taxRate) / 100 : 0;
    const grandTotal = Math.round(afterDiscount + taxAmount + invoice.serviceCharge);
    const changeAmount = Math.max(0, paidAmount - grandTotal);

    // Calculate total cost and total profit
    const totalCost = items.reduce((sum, item) => {
      const itemCost = item.costPrice || 0;
      return sum + itemCost * item.quantity;
    }, 0);
    const totalProfit = Math.max(0, grandTotal - totalCost);

    setInvoice((prev) => ({
      ...prev,
      items,
      subtotal,
      discountTotal: totalLineDiscounts,
      taxAmount,
      grandTotal,
      changeAmount,
      paidAmount,
      paymentMethod,
      totalCost,
      totalProfit,
    }));
  };

  // Add product from catalog
  const handleAddProduct = (p: QuickProduct) => {
    if (soundEnabled) soundEffects.playBeep(650, 0.08);

    const existingIndex = invoice.items.findIndex(
      (item) => item.name === p.name || (p.barcode && item.barcode === p.barcode)
    );
    let updatedItems: ReceiptItem[];

    if (existingIndex >= 0) {
      updatedItems = invoice.items.map((item, idx) => {
        if (idx === existingIndex) {
          const newQty = item.quantity + 1;
          const lineTotal = calculateItemTotal(item.price, newQty, item.discount, item.discountType);
          return { ...item, quantity: newQty, total: lineTotal };
        }
        return item;
      });
    } else {
      const newItem: ReceiptItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: p.name,
        sinhalaName: p.sinhalaName,
        price: p.price,
        costPrice: p.costPrice || 0,
        quantity: 1,
        unit: p.unit || (p.category === 'Repair' ? 'job' : 'pcs'),
        discount: 0,
        discountType: 'percentage',
        total: p.price,
        category: p.category,
        barcode: p.barcode,
      };
      updatedItems = [...invoice.items, newItem];
    }

    const newSubtotal = updatedItems.reduce((acc, i) => acc + i.total, 0);
    const newPaid = invoice.paymentMethod === 'cash' ? Math.max(invoice.paidAmount, newSubtotal) : newSubtotal;

    recalculateInvoice(updatedItems, invoice.paymentMethod, newPaid);
  };

  // Handle scanned barcode from camera
  const handleBarcodeScanned = (barcodeString: string) => {
    const rawCode = barcodeString.trim();
    if (!rawCode) return;

    // QR scanners can return a plain barcode, URL, JSON, or text payload.
    // Try to extract the actual product code from common QR formats first.
    let candidateCodes = [rawCode];
    try {
      const parsed = JSON.parse(rawCode);
      const values = [parsed?.barcode, parsed?.code, parsed?.sku, parsed?.id].filter(Boolean);
      candidateCodes = [...candidateCodes, ...values.map(String)];
    } catch {
      // Plain text / URL QR code. Keep the original payload as a fallback.
    }

    try {
      const url = new URL(rawCode);
      const params = ['barcode', 'code', 'sku', 'id']
        .map((key) => url.searchParams.get(key))
        .filter(Boolean) as string[];
      candidateCodes = [...candidateCodes, ...params];
      const lastPart = url.pathname.split('/').filter(Boolean).pop();
      if (lastPart) candidateCodes.push(lastPart);
    } catch {
      // Not a URL.
    }

    const normalizeCode = (value: string) =>
      String(value).trim().toLowerCase().replace(/\s+/g, '');

    const normalized = [...new Set(
      candidateCodes.map((c) => normalizeCode(c)).filter(Boolean)
    )];

    const foundProduct = products.find((p) => {
      const productValues = [p.barcode, p.id, p.name, p.sinhalaName]
        .filter(Boolean)
        .map((v) => normalizeCode(String(v)));

      // Exact code/name match first. Also accept a QR payload that contains
      // the product barcode (common with simple QR label generators).
      return normalized.some((code) =>
        productValues.includes(code) ||
        (p.barcode && code.includes(normalizeCode(String(p.barcode))))
      );
    });

    if (foundProduct) {
      handleAddProduct(foundProduct);
      if (soundEnabled) soundEffects.playBeep(880, 0.15);
      return;
    }

    // Unknown QR/barcode: add it immediately to the bill and open the edit row
    // so the cashier can enter the item name and price without leaving the bill.
    const newItem: ReceiptItem = {
      id: `scanned_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Scanned Item (${rawCode.slice(0, 28)})`,
      price: 0,
      costPrice: 0,
      quantity: 1,
      unit: 'pcs',
      discount: 0,
      discountType: 'percentage',
      total: 0,
      barcode: rawCode,
      category: 'Accessories',
    };
    const updated = [...invoice.items, newItem];
    recalculateInvoice(updated);
    handleStartEditItem(newItem);
    if (soundEnabled) soundEffects.playBeep(760, 0.12);
  };

  // Add custom item on the fly (Accessories or Repair)
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customPrice) return;

    if (soundEnabled) soundEffects.playBeep(700, 0.1);

    const price = parseFloat(customPrice) || 0;
    const cost = parseFloat(customCost) || 0;
    const qty = parseFloat(customQty) || 1;

    const newItem: ReceiptItem = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      price,
      costPrice: cost,
      quantity: qty,
      unit: customCategory === 'Repair' ? 'job' : 'pcs',
      discount: 0,
      discountType: 'percentage',
      total: price * qty,
      category: customCategory,
    };

    const updated = [...invoice.items, newItem];
    const newSubtotal = updated.reduce((acc, i) => acc + i.total, 0);
    const newPaid = Math.max(invoice.paidAmount, newSubtotal);

    recalculateInvoice(updated, invoice.paymentMethod, newPaid);

    setCustomName('');
    setCustomPrice('');
    setCustomCost('');
    setCustomQty('1');
  };

  // Update item quantity
  const handleUpdateQty = (idx: number, delta: number) => {
    if (soundEnabled) soundEffects.playBeep(550, 0.05);

    const updated = invoice.items
      .map((item, i) => {
        if (i === idx) {
          const newQty = Math.max(0, item.quantity + delta);
          if (newQty === 0) return null;
          const total = calculateItemTotal(item.price, newQty, item.discount, item.discountType);
          return { ...item, quantity: newQty, total };
        }
        return item;
      })
      .filter(Boolean) as ReceiptItem[];

    recalculateInvoice(updated);
  };

  // Delete item row
  const handleDeleteItem = (idx: number) => {
    if (soundEnabled) soundEffects.playBeep(400, 0.08);
    const updated = invoice.items.filter((_, i) => i !== idx);
    recalculateInvoice(updated);
  };

  // Start editing line item
  const handleStartEditItem = (item: ReceiptItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditQty(String(item.quantity));
    setEditDiscount(String(item.discount || 0));
  };

  // Save inline edited item
  const handleSaveEditedItem = (id: string) => {
    const updated = invoice.items.map((item) => {
      if (item.id === id) {
        const newPrice = parseFloat(editPrice) || item.price;
        const newQty = parseFloat(editQty) || item.quantity;
        const newDisc = parseFloat(editDiscount) || 0;
        const newTotal = calculateItemTotal(newPrice, newQty, newDisc, item.discountType);
        return {
          ...item,
          name: editName.trim() || item.name,
          price: newPrice,
          quantity: newQty,
          discount: newDisc,
          total: newTotal,
        };
      }
      return item;
    });

    recalculateInvoice(updated);
    setEditingItemId(null);
    if (soundEnabled) soundEffects.playBeep(750, 0.08);
  };

  // Quick cash amount preset handler
  const handleQuickCash = (amount: number) => {
    if (soundEnabled) soundEffects.playBeep(800, 0.08);
    setInvoice((prev) => ({
      ...prev,
      paidAmount: amount,
      changeAmount: Math.max(0, amount - prev.grandTotal),
    }));
  };

  function calculateItemTotal(
    price: number,
    qty: number,
    disc: number,
    discType: 'percentage' | 'fixed'
  ): number {
    const gross = price * qty;
    if (!disc || disc <= 0) return gross;
    if (discType === 'percentage') {
      return Math.max(0, gross - (gross * disc) / 100);
    }
    return Math.max(0, gross - disc);
  }

  return (
    <div className="space-y-4">
      {/* Top Invoice Header Bar with Invoice No, Date, Actions */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{strings.invoiceNumber}:</span>
              <input
                type="text"
                value={invoice.invoiceNumber}
                onChange={(e) => setInvoice({ ...invoice, invoiceNumber: e.target.value })}
                className="font-mono font-bold text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-cyan-300 w-36 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              <span>{invoice.date}</span> &bull; <span>{invoice.time}</span>
            </div>
          </div>
        </div>

        {/* Scan Barcode / Clear / Save Actions */}
        <div className="flex items-center gap-2">
          {/* Primary Scan Barcode Button */}
          <button
            id="btn-scan-barcode-bill"
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/30"
            title="Scan QR or Barcode with Camera"
          >
            <Camera className="w-4 h-4" />
            <span>{strings.scanBarcode}</span>
          </button>

          <button
            onClick={onResetInvoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            title="Reset bill for next customer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>{strings.clearBill}</span>
          </button>

          <button
            onClick={onSaveInvoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
            title="Save to history"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{strings.saveInvoice}</span>
          </button>
        </div>
      </div>

      {/* Customer Info Toggle */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-3">
        <button
          type="button"
          onClick={() => setShowCustomerFields(!showCustomerFields)}
          className="w-full flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {invoice.customerName
                ? `Customer: ${invoice.customerName} (${invoice.customerPhone || 'N/A'})`
                : `${strings.customer} Information (Customer Name & Phone)`}
            </span>
          </span>
          <span className="text-cyan-400 text-xs">{showCustomerFields ? 'Hide' : 'Edit'}</span>
        </button>

        {showCustomerFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-slate-700">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{strings.customer}</label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={invoice.customerName || ''}
                  onChange={(e) => setInvoice({ ...invoice, customerName: e.target.value })}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{strings.customerPhone}</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="tel"
                  placeholder="07X-XXXXXXX"
                  value={invoice.customerPhone || ''}
                  onChange={(e) => setInvoice({ ...invoice, customerPhone: e.target.value })}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Catalog / Preset Products Grid (Accessories & Repair Only) */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-xs sm:text-sm text-slate-100">{strings.productsCatalog}</h3>
            <span className="text-[11px] text-slate-400">(Click to add)</span>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder={strings.searchProducts}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Category Filter Pills: All, Accessories, Repair ONLY */}
        <div className="flex items-center gap-2 pb-0.5">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`text-xs px-3 py-1 rounded-xl font-semibold transition ${
              selectedCategory === 'All'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCategory('Accessories')}
            className={`text-xs px-3 py-1 rounded-xl font-semibold transition flex items-center gap-1 ${
              selectedCategory === 'Accessories'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Accessories</span>
          </button>
          <button
            onClick={() => setSelectedCategory('Repair')}
            className={`text-xs px-3 py-1 rounded-xl font-semibold transition flex items-center gap-1 ${
              selectedCategory === 'Repair'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Repair</span>
          </button>
        </div>

        {/* Products Quick Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
          {filteredProducts.map((prod) => {
            const isLow = (prod.stockQuantity ?? 0) <= (prod.minStockLevel ?? 3);
            return (
              <button
                key={prod.id}
                onClick={() => handleAddProduct(prod)}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-cyan-950/40 border border-slate-700/80 hover:border-cyan-500/50 text-left transition active:scale-[0.97] group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                        prod.category === 'Repair'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}
                    >
                      {prod.category}
                    </span>
                    {isLow && (
                      <span className="text-[9px] text-red-400 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>{prod.stockQuantity}</span>
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-xs text-slate-200 group-hover:text-cyan-300 truncate">
                    {prod.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{prod.name}</p>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-400">
                    {business.currencySymbol} {prod.price}
                  </span>
                  <span className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 flex items-center justify-center text-xs transition">
                    +
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual / Custom Item Quick Add Row */}
      <form
        onSubmit={handleAddCustomItem}
        className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-3 flex flex-wrap items-center gap-2"
      >
        <div className="w-28">
          <select
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value as ProductCategory)}
            className="w-full px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="Accessories">Accessories</option>
            <option value="Repair">Repair</option>
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <input
            type="text"
            placeholder="Item / Service Name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="w-20">
          <input
            type="number"
            placeholder="Cost"
            value={customCost}
            onChange={(e) => setCustomCost(e.target.value)}
            className="w-full px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-amber-300 font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            title="Cost / Buying Price"
          />
        </div>
        <div className="w-24">
          <input
            type="number"
            placeholder="Price"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-mono font-semibold placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            title="Selling Price"
          />
        </div>
        <div className="w-14">
          <input
            type="number"
            placeholder="Qty"
            value={customQty}
            min="1"
            onChange={(e) => setCustomQty(e.target.value)}
            className="w-full px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 text-center font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button
          type="submit"
          disabled={!customName.trim() || !customPrice}
          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>

      {/* Current Items in Cart Table with EDIT capabilities */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm text-slate-200 flex items-center gap-2">
            <span>Bill Items</span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">
              {invoice.items.length}
            </span>
          </h3>

          {invoice.items.length > 0 && (
            <button
              onClick={() => recalculateInvoice([])}
              className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {invoice.items.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-700/60 rounded-xl">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p>{strings.emptyItems}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/60 max-h-72 overflow-y-auto pr-1">
            {invoice.items.map((item, idx) => {
              const isEditing = editingItemId === item.id;

              return (
                <div key={item.id || idx} className="py-2.5">
                  {isEditing ? (
                    // Inline Edit Form for Item
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-300">Edit Line Item</span>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Price</label>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-emerald-400 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Qty</label>
                          <input
                            type="number"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-100 font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-slate-400">Discount (%):</label>
                          <input
                            type="number"
                            value={editDiscount}
                            onChange={(e) => setEditDiscount(e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs text-amber-400 font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveEditedItem(item.id)}
                          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Regular Display Row
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-xs text-slate-200 truncate">
                            {item.name}
                          </p>
                          {item.category && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded ${
                                item.category === 'Repair'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              {item.category}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {business.currencySymbol} {item.price} &times; {item.quantity} {item.unit}
                          {item.discount > 0 && (
                            <span className="text-amber-400 ml-1.5">
                              (-{item.discount}% off)
                            </span>
                          )}
                          {item.costPrice && item.costPrice > 0 ? (
                            <span className="text-slate-500 ml-2">
                              (Profit: +{business.currencySymbol} {((item.price - item.costPrice) * item.quantity).toFixed(0)})
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {/* Qty Stepper */}
                      <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-700">
                        <button
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Decrease"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-mono text-xs font-bold text-cyan-300">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Increase"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="w-20 text-right font-mono font-bold text-xs text-emerald-400">
                        {business.currencySymbol} {item.total.toFixed(2)}
                      </div>

                      {/* Edit button */}
                      <button
                        onClick={() => handleStartEditItem(item)}
                        className="p-1.5 text-slate-400 hover:text-cyan-400 transition"
                        title="Edit Item details or price"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Remove item */}
                      <button
                        onClick={() => handleDeleteItem(idx)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bill Calculation & Payment Method & Profit Display */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
        {/* Subtotal, Grand Total, Profit */}
        <div className="space-y-1.5 border-b border-slate-700 pb-3 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>{strings.subtotal}:</span>
            <span className="font-mono">
              {business.currencySymbol} {invoice.subtotal.toFixed(2)}
            </span>
          </div>

          {invoice.discountTotal > 0 && (
            <div className="flex justify-between text-red-400">
              <span>{strings.discount}:</span>
              <span className="font-mono">
                -{business.currencySymbol} {invoice.discountTotal.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-2 text-slate-100">
            <span className="font-bold text-sm sm:text-base">{strings.grandTotal}:</span>
            <span className="font-mono font-bold text-lg sm:text-xl text-emerald-400">
              {business.currencySymbol} {invoice.grandTotal.toFixed(2)}
            </span>
          </div>

          {/* Explicit Profit Display */}
          {(invoice.totalProfit !== undefined && invoice.totalProfit > 0) && (
            <div className="flex justify-between items-center pt-1 text-cyan-300 bg-cyan-950/30 px-2.5 py-1 rounded-lg border border-cyan-500/30">
              <span className="font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>{strings.totalProfit}:</span>
              </span>
              <span className="font-mono font-bold text-xs text-cyan-300">
                +{business.currencySymbol} {invoice.totalProfit.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            {strings.paymentMethod}
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'cash', label: strings.cash, icon: Banknote },
              { id: 'card', label: strings.card, icon: CreditCard },
              { id: 'transfer', label: strings.transfer, icon: QrCode },
              { id: 'credit', label: strings.credit, icon: DollarSign },
            ].map((method) => {
              const Icon = method.icon;
              const isSelected = invoice.paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    if (soundEnabled) soundEffects.playBeep(600, 0.05);
                    const newPaid = method.id !== 'cash' ? invoice.grandTotal : invoice.paidAmount;
                    recalculateInvoice(invoice.items, method.id as PaymentMethod, newPaid);
                  }}
                  className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 text-[11px] ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="truncate w-full">{method.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cash Tendered & Change Return */}
        {invoice.paymentMethod === 'cash' && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  {strings.cashTendered} ({business.currencySymbol})
                </label>
                <input
                  type="number"
                  value={invoice.paidAmount || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    recalculateInvoice(invoice.items, 'cash', val);
                  }}
                  className="w-full font-mono font-bold text-sm px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  {strings.changeReturn} ({business.currencySymbol})
                </label>
                <div className="font-mono font-bold text-sm px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-cyan-300">
                  {business.currencySymbol} {invoice.changeAmount.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Quick Cash Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 mr-1">Quick Cash:</span>
              {[
                { label: 'Exact', val: invoice.grandTotal },
                { label: '500', val: 500 },
                { label: '1,000', val: 1000 },
                { label: '2,000', val: 2000 },
                { label: '5,000', val: 5000 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleQuickCash(preset.val)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Optional Notes / Warranty / IMEI */}
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">{strings.notes}</label>
          <input
            type="text"
            placeholder="e.g. 6 Months Warranty / IMEI: 8645... / Battery Replacement"
            value={invoice.notes || ''}
            onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
            className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Barcode / QR Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Add Item by QR / Barcode"
        subtitle="Point the camera at the barcode or QR code"
        soundEnabled={soundEnabled}
      />
    </div>
  );
};
