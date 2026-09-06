import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Receipt, 
  Check, 
  PlusCircle, 
  History, 
  Package, 
  Store,
  Layers,
  FileCheck2
} from 'lucide-react';
import { BusinessProfile, Invoice, QuickProduct, BluetoothDeviceState, AuthUser, ResetScope, RepairJob, ReceiptItem } from './types';
import { storage } from './services/storage';
import { bluetoothPrinter } from './services/bluetoothPrinter';
import { soundEffects } from './services/soundEffects';
import { INITIAL_INVOICE, POWERED_BY } from './data/defaultData';
import { Header } from './components/Header';
import { BillEditor } from './components/BillEditor';
import { ReceiptPreview } from './components/ReceiptPreview';
import { PrinterModal } from './components/PrinterModal';
import { ShopProfileModal } from './components/ShopProfileModal';
import { BillHistoryModal } from './components/BillHistoryModal';
import { ProductsModal } from './components/ProductsModal';
import { LoginModal } from './components/LoginModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Dashboard } from './components/Dashboard';
import { RepairsModal } from './components/RepairsModal';
import { CustomerHistoryModal } from './components/CustomerHistoryModal';
import { CodeGeneratorModal } from './components/CodeGeneratorModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { t } from './utils/translations';

export default function App() {
  const [lang] = useState<'si' | 'en'>('en');
  const setLang = (_l: 'si' | 'en') => {};
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => storage.isSoundEnabled());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bill' | 'history' | 'products' | 'repairs' | 'profile' | 'printer'>('dashboard');
  const [repairs, setRepairs] = useState(() => storage.getRepairs());
  const [mobileViewMode, setMobileViewMode] = useState<'editor' | 'preview'>('editor');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => storage.getCurrentUser());

  // Keep the same account visible on phone and PC by pulling the latest Google Sheet data periodically.
  useEffect(() => {
    if (!currentUser) return;
    const refresh = async () => {
      const refreshed = storage.isGoogleSheetsConnected()
        ? await storage.refreshFromGoogleSheets()
        : await storage.refreshFromCloud();
      if (refreshed) {
        setBusiness({ ...storage.getBusinessProfile(), receiptLanguage: 'en' });
        setProducts(storage.getProducts());
        setInvoices(storage.getInvoices());
        setRepairs(storage.getRepairs());
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, [currentUser]);

  // Business & Inventory State
  const [business, setBusiness] = useState<BusinessProfile>(() => ({ ...storage.getBusinessProfile(), receiptLanguage: 'en' }));
  const [products, setProducts] = useState<QuickProduct[]>(() => storage.getProducts());
  const [invoices, setInvoices] = useState<Invoice[]>(() => storage.getInvoices());

  // Automatically save and broadcast business profile updates
  const updateBusinessProfile = (newBusiness: BusinessProfile) => {
    setBusiness(newBusiness);
    storage.saveBusinessProfile(newBusiness);
  };

  // PWA Install hook for direct trigger
  const { install: triggerPWAInstall } = usePWAInstall();

  // Active Current Invoice State
  const [invoice, setInvoice] = useState<Invoice>(() => {
    // Generate fresh invoice with sequential number
    const invNo = storage.getNextInvoiceNumber();
    return {
      ...INITIAL_INVOICE,
      id: `inv_${Date.now()}`,
      invoiceNumber: invNo,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      cashierName: currentUser ? currentUser.name : 'Cashier',
      createdAt: Date.now(),
    };
  });

  // Bluetooth Printer Connection State
  const [btState, setBtState] = useState<BluetoothDeviceState>(() => bluetoothPrinter.getState());

  // Modals state
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isProductsModalOpen, setIsProductsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isCustomerHistoryOpen, setIsCustomerHistoryOpen] = useState(false);
  const [isCodeGeneratorOpen, setIsCodeGeneratorOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to Bluetooth device changes
  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe((state) => {
      setBtState(state);
    });
    return unsubscribe;
  }, []);

  // Save changes to storage
  useEffect(() => {
    storage.saveLanguage(lang);
  }, [lang]);

  useEffect(() => {
    const name = business.appName?.trim() || business.name?.trim() || 'POS';
    document.title = name;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', name);

    // Keep the installable PWA name in sync with the user-selected app name.
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    const manifest = {
      name,
      short_name: name.slice(0, 20),
      start_url: '/',
      display: 'standalone',
      background_color: '#020617',
      theme_color: '#020617',
      icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }]
    };
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
    const previous = link.href;
    link.href = blobUrl;
    return () => {
      URL.revokeObjectURL(blobUrl);
      if (link) link.href = previous;
    };
  }, [business.appName, business.name]);

  useEffect(() => {
    storage.setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    storage.saveBusinessProfile(business);
  }, [business]);

  // Create a bill directly from a repair job.
  const handleCreateRepairBill = (repair: RepairJob) => {
    const invNo = storage.getNextInvoiceNumber();
    const balanceDue = Math.max(0, repair.estimate - repair.advance);
    const item: ReceiptItem = {
      id: `repair_bill_${Date.now()}`,
      name: `Repair Service - ${repair.device}`,
      sinhalaName: `Repair Service - ${repair.device}`,
      price: repair.estimate,
      costPrice: 0,
      quantity: 1,
      unit: 'job',
      discount: 0,
      discountType: 'fixed',
      total: repair.estimate,
      category: 'Repair',
    };
    setInvoice({
      ...INITIAL_INVOICE,
      id: `inv_${Date.now()}`,
      invoiceNumber: invNo,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      customerName: repair.customerName,
      customerPhone: repair.customerPhone,
      items: [item],
      subtotal: repair.estimate,
      discountTotal: 0,
      taxRate: 0,
      taxAmount: 0,
      serviceCharge: 0,
      grandTotal: repair.estimate,
      paidAmount: repair.advance,
      changeAmount: 0,
      paymentMethod: 'cash',
      notes: repair.notes || '',
      repairJobNumber: repair.jobNumber,
      repairDevice: repair.device,
      repairImei: repair.imei || '',
      repairIssue: repair.issue,
      repairDiagnosis: repair.diagnosis || '',
      repairEstimate: repair.estimate,
      repairAdvance: repair.advance,
      repairBalance: balanceDue,
      cashierName: currentUser ? currentUser.name : 'Cashier',
      receiptLanguage: 'en',
      totalCost: 0,
      totalProfit: repair.estimate,
      createdAt: Date.now(),
    });
    setActiveTab('bill');
    setMobileViewMode('editor');
    showToast('Repair bill created. Save or print it to record the bill.');
  };

  // Handle Tab navigation trigger
  const handleTabChange = (tab: 'dashboard' | 'bill' | 'history' | 'products' | 'repairs' | 'profile' | 'printer') => {
    if (tab === 'bill') {
      // New Bill is a true one-tap fresh bill action.
      handleResetInvoice();
      setActiveTab('bill');
      setMobileViewMode('editor');
      return;
    }
    setActiveTab(tab);
    if (tab === 'printer') setIsPrinterModalOpen(true);
    if (tab === 'repairs') setActiveTab('repairs');
    if (tab === 'dashboard') setMobileViewMode('editor');
    if (tab === 'profile') setIsProfileModalOpen(true);
    if (tab === 'history') setIsHistoryModalOpen(true);
    if (tab === 'products') setIsProductsModalOpen(true);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Save invoice manually and deduct stock
  const handleUpdateCustomerInvoice = (updatedInvoice: Invoice) => {
    storage.saveInvoice(updatedInvoice);
    setInvoices(storage.getInvoices());
  };

  const handleSaveInvoice = () => {
    if (invoice.items.length === 0) return;
    
    // Save invoice and update stock exactly once.
    // storage.saveInvoice() also handles edits/reprints idempotently.
    storage.saveInvoice(invoice);

    // Update reactive states
    setInvoices(storage.getInvoices());
    setProducts(storage.getProducts());

    showToast('Bill saved successfully.');
    if (soundEnabled) soundEffects.playBeep(880, 0.1);
  };

  // Reset to fresh blank invoice for next customer
  const handleResetInvoice = () => {
    const invNo = storage.getNextInvoiceNumber();
    setInvoice({
      id: `inv_${Date.now()}`,
      invoiceNumber: invNo,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      customerName: '',
      customerPhone: '',
      items: [],
      subtotal: 0,
      discountTotal: 0,
      taxRate: 0,
      taxAmount: 0,
      serviceCharge: 0,
      grandTotal: 0,
      paidAmount: 0,
      changeAmount: 0,
      paymentMethod: 'cash',
      notes: '',
      cashierName: currentUser ? currentUser.name : 'Cashier',
      receiptLanguage: lang,
      totalCost: 0,
      totalProfit: 0,
      createdAt: Date.now(),
    });
    setMobileViewMode('editor');
    showToast('New bill ready.');
    if (soundEnabled) soundEffects.playBeep(520, 0.1);
  };

  // Granular Reset function (User Requested: රීසෙට් බටන් එකෙන් ඔක්කොම ක්ලියර් වෙන්නෙ නෑ / සියලුම දත්ත & Settings reset)
  const handleScopedReset = (scope: ResetScope) => {
    if (scope === 'all_wipe') {
      storage.resetAllData(true);
      setProducts([]);
      setInvoices([]);
      storage.clearAllRepairs();
      setRepairs([]);
      setBusiness(storage.getBusinessProfile());
      handleResetInvoice();
      showToast('සියලුම භාණ්ඩ, පෙර බිල්පත් සහ සැකසුම් 100% සම්පූර්ණයෙන්ම Wipe විය (0 Items)!');
    } else if (scope === 'all_defaults') {
      storage.resetAllData();
      setProducts(storage.getProducts());
      setInvoices(storage.getInvoices());
      setRepairs(storage.getRepairs());
      setBusiness(storage.getBusinessProfile());
      handleResetInvoice();
      showToast('මූලික Sample භාණ්ඩ 13 & Settings සාර්ථකව ප්‍රතිස්ථාපනය විය!');
    } else if (scope === 'invoices_only') {
      storage.clearAllInvoices();
      setInvoices([]);
      showToast('බිල්පත් ඉතිහාසය (Invoices History) සම්පූර්ණයෙන් මකා දමන ලදී!');
    } else if (scope === 'products_only') {
      storage.clearAllProducts();
      setProducts([]);
      showToast('භාණ්ඩ ලැයිස්තුව සම්පූර්ණයෙන්ම හිස් කරන ලදී (0 Items)!');
    } else if (scope === 'current_bill') {
      handleResetInvoice();
      showToast('වත්මන් බිල්පත (Current Bill) සාර්ථකව ක්ලියර් කරන ලදී!');
    }
    if (soundEnabled) soundEffects.playSuccess();
  };

  // Load an existing invoice from history to reprint or edit
  const handleLoadInvoice = (inv: Invoice) => {
    setInvoice(inv);
    setActiveTab('bill');
    setMobileViewMode('editor');
    showToast(`Bill ${inv.invoiceNumber} loaded.`);
  };

  // After print success
  const handlePrintSuccess = () => {
    storage.saveInvoice(invoice);
    setInvoices(storage.getInvoices());
    setProducts(storage.getProducts());
    showToast('Print completed and bill saved.');
  };

  const handleLogout = () => {
    storage.logout();
    setCurrentUser(null);
    showToast('පද්ධතියෙන් ඉවත් විය (Logged Out)');
  };

  const handleExportBackup = () => {
    const payload = storage.exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brave-pos-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported successfully.');
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      storage.importBackup(payload);
      setBusiness({ ...storage.getBusinessProfile(), receiptLanguage: 'en' });
      setProducts(storage.getProducts());
      setInvoices(storage.getInvoices());
      setRepairs(storage.getRepairs());
      handleResetInvoice();
      showToast('Backup restored successfully.');
    } catch (e) {
      console.error(e);
      showToast('Invalid backup file.');
    }
  };

  const strings = t[lang];

  const currentTheme = business.appTheme || 'dark_modern';
  const themeClass =
    currentTheme === 'clean_light'
      ? 'bg-slate-100 text-slate-900 selection:bg-cyan-600 selection:text-white'
      : currentTheme === 'midnight_blue'
      ? 'bg-[#0a0f1d] text-slate-100 selection:bg-blue-500 selection:text-white'
      : currentTheme === 'amoled_black'
      ? 'bg-black text-slate-100 selection:bg-emerald-500 selection:text-white'
      : 'bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white';

  return (
    <div className={`min-h-screen ${themeClass} flex flex-col font-sinhala transition-colors duration-300`}>
      {/* Login Modal (Locked until authenticated) */}
      <LoginModal
        isOpen={!currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setBusiness({ ...storage.getBusinessProfile(), receiptLanguage: 'en' });
          setProducts(storage.getProducts());
          setInvoices(storage.getInvoices());
          setRepairs(storage.getRepairs());
          setInvoice((prev) => ({ ...prev, cashierName: user.name }));
          showToast(`ආයුබෝවන්, ${user.name}! Cloud data loaded.`);
        }}
        soundEnabled={soundEnabled}
      />

      {/* Top Header */}
      <Header
        lang={lang}
        setLang={setLang}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        btState={btState}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenPrinterModal={() => setIsPrinterModalOpen(true)}
        onOpenCodeGenerator={() => setIsCodeGeneratorOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        appName={business.appName || business.name}
      />

      {/* Toast alert banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="px-4 py-2 rounded-full bg-cyan-500 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-2 border border-cyan-300">
            <Check className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main mobile-first workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 pb-24 lg:pb-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            business={business}
            invoices={invoices}
            products={products}
            repairs={repairs}
            lang={lang}
            onNewBill={() => { handleResetInvoice(); setActiveTab('bill'); setMobileViewMode('editor'); }}
            onProducts={() => setIsProductsModalOpen(true)}
            onHistory={() => setIsHistoryModalOpen(true)}
            onRepairs={() => setActiveTab('repairs')}
          />
        )}

        {activeTab === 'bill' && (
          <>
            <div className="lg:hidden mb-4 flex items-center p-1 bg-slate-900 rounded-2xl border border-slate-800">
              <button onClick={() => setMobileViewMode('editor')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${mobileViewMode==='editor'?'bg-cyan-500 text-slate-950':'text-slate-400'}`}><Receipt className="w-4 h-4 inline mr-1"/>{strings.newBill}</button>
              <button onClick={() => setMobileViewMode('preview')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${mobileViewMode==='preview'?'bg-cyan-500 text-slate-950':'text-slate-400'}`}><Printer className="w-4 h-4 inline mr-1"/>{strings.previewPaper}</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className={`lg:col-span-7 ${mobileViewMode === 'preview' ? 'hidden lg:block' : 'block'}`}>
                <BillEditor invoice={invoice} setInvoice={setInvoice} business={business} products={products} lang={lang} soundEnabled={soundEnabled} onSaveInvoice={handleSaveInvoice} onResetInvoice={handleResetInvoice}/>
              </div>
              <div className={`lg:col-span-5 lg:sticky lg:top-24 ${mobileViewMode === 'editor' ? 'hidden lg:block' : 'block'}`}>
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-2xl">
                  <ReceiptPreview invoice={invoice} setInvoice={setInvoice} business={business} btState={btState} lang={lang} soundEnabled={soundEnabled} onOpenPrinterModal={() => setIsPrinterModalOpen(true)} onPrintSuccess={handlePrintSuccess} onUpdateBusiness={updateBusinessProfile}/>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Mobile Ergonomic Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        mobileViewMode={mobileViewMode}
        setMobileViewMode={setMobileViewMode}
        onTabChange={handleTabChange}
        itemsCount={invoice.items.length}
        grandTotal={invoice.grandTotal}
        currencySymbol={business.currencySymbol}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        onOpenInstallPrompt={triggerPWAInstall}
        onOpenCustomerHistory={() => setIsCustomerHistoryOpen(true)}
        onOpenCodeGenerator={() => setIsCodeGeneratorOpen(true)}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        lang={lang}
        setLang={setLang}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        business={business}
        onUpdateBusiness={updateBusinessProfile}
      />

      {/* Modals */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => {
          setIsPrinterModalOpen(false);
          setActiveTab('dashboard');
        }}
        btState={btState}
        business={business}
        setBusiness={updateBusinessProfile}
        lang={lang}
        soundEnabled={soundEnabled}
      />

      <ShopProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setActiveTab('dashboard');
        }}
        business={business}
        setBusiness={updateBusinessProfile}
        soundEnabled={soundEnabled}
        onOpenResetModal={() => setIsResetModalOpen(true)}
      />

      <BillHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setActiveTab('bill');
        }}
        invoices={invoices}
        setInvoices={setInvoices}
        onLoadInvoice={handleLoadInvoice}
        business={business}
        soundEnabled={soundEnabled}
      />

      <ProductsModal
        isOpen={isProductsModalOpen}
        onClose={() => {
          setIsProductsModalOpen(false);
          setActiveTab('dashboard');
          // Refresh products in BillEditor
          setProducts(storage.getProducts());
        }}
        products={products}
        setProducts={setProducts}
        business={business}
        soundEnabled={soundEnabled}
      />

      <CustomerHistoryModal isOpen={isCustomerHistoryOpen} onClose={() => setIsCustomerHistoryOpen(false)} invoices={invoices} repairs={repairs} business={business} onOpenInvoice={(inv) => { setIsCustomerHistoryOpen(false); handleLoadInvoice(inv); }} onUpdateInvoice={handleUpdateCustomerInvoice}/>

      <CodeGeneratorModal isOpen={isCodeGeneratorOpen} onClose={() => setIsCodeGeneratorOpen(false)} business={business} btState={btState} soundEnabled={soundEnabled} />

      <RepairsModal isOpen={activeTab === 'repairs'} onClose={() => setActiveTab('dashboard')} business={business} repairs={repairs} setRepairs={setRepairs} lang="en" onToast={showToast} onCreateBill={handleCreateRepairBill}/>

      {/* Reset Confirmation Modal (Factory Reset All Data & Settings) */}
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirmReset={handleScopedReset}
        lang={lang}
        soundEnabled={soundEnabled}
      />
    </div>
  );
}
