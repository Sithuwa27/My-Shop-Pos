import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Search, 
  X, 
  Camera, 
  AlertTriangle, 
  TrendingUp, 
  Edit3, 
  Check, 
  Scan,
  Layers,
  Wrench,
  Headphones
} from 'lucide-react';
import { QuickProduct, BusinessProfile, ProductCategory } from '../types';
import { storage } from '../services/storage';
import { soundEffects } from '../services/soundEffects';
import { ScannerModal } from './ScannerModal';

interface ProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: QuickProduct[];
  setProducts: React.Dispatch<React.SetStateAction<QuickProduct[]>>;
  business: BusinessProfile;
  soundEnabled: boolean;
}

export const ProductsModal: React.FC<ProductsModalProps> = ({
  isOpen,
  onClose,
  products,
  setProducts,
  business,
  soundEnabled,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory | 'low_stock'>('All');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [sinhalaName, setSinhalaName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Accessories');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [minStockLevel, setMinStockLevel] = useState('4');
  const [barcode, setBarcode] = useState('');
  const [unit, setUnit] = useState('pcs');

  if (!isOpen) return null;

  // Live profit calculation for form
  const sellingNum = parseFloat(price) || 0;
  const costNum = parseFloat(costPrice) || 0;
  const unitProfit = Math.max(0, sellingNum - costNum);
  const profitMargin = sellingNum > 0 ? ((unitProfit / sellingNum) * 100).toFixed(1) : '0';

  const resetForm = () => {
    setName('');
    setCostPrice('');
    setPrice('');
    setCategory('Accessories');
    setStockQuantity('10');
    setMinStockLevel('4');
    setBarcode('');
    setUnit('pcs');
    setEditingProductId(null);
  };

  const handleStartEdit = (p: QuickProduct) => {
    setEditingProductId(p.id);
    setName(p.name);
    setSinhalaName(p.sinhalaName || '');
    setCostPrice(String(p.costPrice || 0));
    setPrice(String(p.price || 0));
    setCategory(p.category || 'Accessories');
    setStockQuantity(String(p.stockQuantity ?? 10));
    setMinStockLevel(String(p.minStockLevel ?? 4));
    setBarcode(p.barcode || '');
    setUnit(p.unit || (p.category === 'Repair' ? 'job' : 'pcs'));
    if (soundEnabled) soundEffects.playBeep(650, 0.05);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    const parsedPrice = parseFloat(price) || 0;
    const parsedCost = parseFloat(costPrice) || 0;
    const parsedStock = parseInt(stockQuantity, 10) || 0;
    const parsedMinStock = parseInt(minStockLevel, 10) || 3;

    if (editingProductId) {
      // Update existing
      const updated = products.map((p) => {
        if (p.id === editingProductId) {
          return {
            ...p,
            name: name.trim(),
            sinhalaName: sinhalaName.trim() || name.trim(),
            price: parsedPrice,
            costPrice: parsedCost,
            category,
            stockQuantity: parsedStock,
            minStockLevel: parsedMinStock,
            barcode: barcode.trim() || undefined,
            unit: unit.trim() || (category === 'Repair' ? 'job' : 'pcs'),
          };
        }
        return p;
      });
      setProducts(updated);
      storage.saveProducts(updated);
    } else {
      // Add new
      const newProd: QuickProduct = {
        id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: name.trim(),
        sinhalaName: sinhalaName.trim() || name.trim(),
        price: parsedPrice,
        costPrice: parsedCost,
        category,
        stockQuantity: parsedStock,
        minStockLevel: parsedMinStock,
        barcode: barcode.trim() || undefined,
        unit: unit.trim() || (category === 'Repair' ? 'job' : 'pcs'),
      };
      const updated = [newProd, ...products];
      setProducts(updated);
      storage.saveProducts(updated);
    }

    if (soundEnabled) soundEffects.playBeep(880, 0.1);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this item?')) {
      const updated = products.filter((p) => p.id !== id);
      setProducts(updated);
      storage.saveProducts(updated);
      if (soundEnabled) soundEffects.playBeep(400, 0.08);
      if (editingProductId === id) resetForm();
    }
  };

  const handleScanBarcode = (scannedCode: string) => {
    setBarcode(scannedCode);
  };

  // Filtered products
  const filtered = products.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sinhalaName.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));

    if (!matchesQuery) return false;

    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'low_stock') {
      return (p.stockQuantity ?? 0) <= (p.minStockLevel ?? 3);
    }
    return p.category === selectedCategory;
  });

  // Low stock count
  const lowStockCount = products.filter(
    (p) => (p.stockQuantity ?? 0) <= (p.minStockLevel ?? 3)
  ).length;

  // Inventory value & profit calculations
  const totalStockCount = products.reduce((acc, p) => acc + (p.stockQuantity || 0), 0);
  const totalStockCost = products.reduce((acc, p) => acc + (p.costPrice || 0) * (p.stockQuantity || 0), 0);
  const totalExpectedSales = products.reduce((acc, p) => acc + (p.price || 0) * (p.stockQuantity || 0), 0);
  const totalExpectedProfit = totalExpectedSales - totalStockCost;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[92vh] min-h-0">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                  <span>Items & Inventory</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-normal">
                    Accessories & Repairs Only
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Manage items, prices, stock and barcodes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIsScannerOpen(true)} className="px-3 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold flex items-center gap-1.5"><Camera className="w-4 h-4" />Scan Barcode</button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 text-xs font-bold flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Exit
              </button>
            </div>
            <button
              onClick={onClose}
              className="hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="bg-slate-800/60 px-4 py-2.5 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">Total Items:</span>
              <span className="font-bold text-slate-200 text-sm">{products.length} Items</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Total Units:</span>
              <span className="font-bold text-cyan-300 text-sm">{totalStockCount} Units</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Expected Profit:</span>
              <span className="font-bold text-emerald-400 text-sm flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{business.currencySymbol} {totalExpectedProfit.toLocaleString()}</span>
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Low Stock Alerts:</span>
              <span className={`font-bold text-sm flex items-center gap-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {lowStockCount > 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{lowStockCount} Items Low</span>
              </span>
            </div>
          </div>

          {/* Scrollable content: on mobile the form + filters + item list must all scroll together */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Form (Add or Edit) */}
          <form
            onSubmit={handleSaveProduct}
            className="p-4 bg-slate-800/80 border-b border-slate-800 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                {editingProductId ? <Edit3 className="w-3.5 h-3.5 text-cyan-400" /> : <Plus className="w-3.5 h-3.5 text-cyan-400" />}
                <span>{editingProductId ? 'Edit Product' : 'Add New Item / Service'}</span>
              </span>

              {editingProductId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <label className="text-[10px] text-slate-400 block mb-0.5">Category</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('Accessories');
                      if (unit === 'job') setUnit('pcs');
                    }}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                      category === 'Accessories'
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 border border-slate-700 text-slate-400'
                    }`}
                  >
                    <Headphones className="w-3 h-3" />
                    <span>Accessories</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('Repair');
                      if (unit === 'pcs') setUnit('job');
                    }}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                      category === 'Repair'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 border border-slate-700 text-slate-400'
                    }`}
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Repair</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">English Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 20W Fast Charger"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* Cost Price */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5 font-medium text-amber-300">
                  Cost Price *
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Selling Price */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5 font-medium text-emerald-400">
                  Selling Price *
                </label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Live Profit Display Pill */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">
                  Profit / Margin
                </label>
                <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono font-semibold flex items-center justify-between">
                  <span>+{business.currencySymbol} {unitProfit.toFixed(0)}</span>
                  <span className="text-[10px] text-slate-400">({profitMargin}%)</span>
                </div>
              </div>

              {/* Stock Quantity */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">
                  Stock Qty
                </label>
                <input
                  type="number"
                  placeholder="10"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-center focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Min Alert Level */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">
                  Min Alert Level
                </label>
                <input
                  type="number"
                  placeholder="4"
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Barcode & Scan Camera Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-400 block mb-0.5">
                  Barcode / QR Code
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Scan or type (e.g. 890123456001)"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 hover:text-white font-medium flex items-center gap-1.5 transition"
                    title="Camera Barcode Scanner"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!name.trim() || !price}
                  className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-1.5 transition shadow-md shadow-cyan-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingProductId ? 'Update' : 'Add Item'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Filter Bar & Search */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('All')}
                className={`text-xs px-3 py-1 rounded-xl font-medium transition ${
                  selectedCategory === 'All'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                All ({products.length})
              </button>
              <button
                onClick={() => setSelectedCategory('Accessories')}
                className={`text-xs px-3 py-1 rounded-xl font-medium transition flex items-center gap-1 ${
                  selectedCategory === 'Accessories'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Headphones className="w-3 h-3" />
                <span>Accessories ({products.filter((p) => p.category === 'Accessories').length})</span>
              </button>
              <button
                onClick={() => setSelectedCategory('Repair')}
                className={`text-xs px-3 py-1 rounded-xl font-medium transition flex items-center gap-1 ${
                  selectedCategory === 'Repair'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Wrench className="w-3 h-3" />
                <span>Repairs ({products.filter((p) => p.category === 'Repair').length})</span>
              </button>
              <button
                onClick={() => setSelectedCategory('low_stock')}
                className={`text-xs px-3 py-1 rounded-xl font-medium transition flex items-center gap-1 ${
                  selectedCategory === 'low_stock'
                    ? 'bg-red-500 text-white font-bold'
                    : 'bg-slate-800 text-amber-400 hover:text-amber-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Low Stock ({lowStockCount})</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Products Table */}
          <div className="p-3 divide-y divide-slate-800/80 text-xs">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p>No products found.</p>
              </div>
            ) : (
              filtered.map((prod) => {
                const isLow = (prod.stockQuantity ?? 0) <= (prod.minStockLevel ?? 3);
                const profit = (prod.price || 0) - (prod.costPrice || 0);

                return (
                  <div
                    key={prod.id}
                    className={`py-2.5 px-2 rounded-xl transition flex flex-wrap items-center justify-between gap-3 ${
                      editingProductId === prod.id ? 'bg-cyan-950/40 border border-cyan-500/40' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Name, Category, Barcode */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">
                          {prod.name}
                        </span>
                        {false && prod.sinhalaName && prod.name !== prod.sinhalaName && (
                          <span className="text-slate-400 text-[11px]">({prod.name})</span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            prod.category === 'Repair'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {prod.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        {prod.barcode && (
                          <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 text-[10px]">
                            Code: {prod.barcode}
                          </span>
                        )}
                        <span>Unit: {prod.unit}</span>
                      </div>
                    </div>

                    {/* Stock Alert Pill */}
                    <div className="text-center min-w-[90px]">
                      <span className="text-[10px] text-slate-400 block">Stock:</span>
                      <span
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          isLow
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isLow && <AlertTriangle className="w-3 h-3" />}
                        <span>{prod.stockQuantity} {prod.unit}</span>
                      </span>
                    </div>

                    {/* Buying Price & Selling Price & Profit */}
                    <div className="text-right min-w-[140px] font-mono">
                      <div className="text-[11px] text-slate-400">
                        Cost: <span className="text-amber-300 font-semibold">{business.currencySymbol} {prod.costPrice}</span>
                      </div>
                      <div className="text-xs text-slate-200">
                        Selling: <span className="text-emerald-400 font-bold">{business.currencySymbol} {prod.price}</span>
                      </div>
                      <div className="text-[11px] font-bold text-cyan-400">
                        Profit: +{business.currencySymbol} {profit.toFixed(0)}
                      </div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(prod)}
                        className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] font-semibold"
                        title="Edit Item"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(prod.id)}
                        className="px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition flex items-center gap-1 text-[11px] font-semibold"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 z-10 p-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center gap-3">
            <span className="text-[11px] text-slate-400">
              <span>{business.appName || business.name} &bull; {products.length} items</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition flex items-center gap-1.5 shrink-0"
            >
              <X className="w-4 h-4" />
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanBarcode}
        title="Camera Barcode Scanner"
        subtitle="Scan item Barcode or QR Code"
        soundEnabled={soundEnabled}
        appName={business.appName || business.name}
      />
    </>
  );
};
