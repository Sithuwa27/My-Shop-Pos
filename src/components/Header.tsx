import React from 'react';
import { 
  Printer, 
  Bluetooth, 
  BluetoothConnected, 
  History, 
  Package, 
  Store, 
  Volume2, 
  VolumeX, 
  ExternalLink,
  PlusCircle,
  LogOut,
  User,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { BluetoothDeviceState, AuthUser } from '../types';
import { t } from '../utils/translations';
import { POWERED_BY } from '../data/defaultData';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  lang: 'si' | 'en';
  setLang: (l: 'si' | 'en') => void;
  soundEnabled: boolean;
  setSoundEnabled: (s: boolean) => void;
  btState: BluetoothDeviceState;
  activeTab: 'dashboard' | 'bill' | 'history' | 'products' | 'repairs' | 'profile' | 'printer';
  setActiveTab: (tab: 'dashboard' | 'bill' | 'history' | 'products' | 'repairs' | 'profile' | 'printer') => void;
  onOpenPrinterModal: () => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
  appName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  soundEnabled,
  setSoundEnabled,
  btState,
  activeTab,
  setActiveTab,
  onOpenPrinterModal,
  currentUser,
  onLogout,
  appName = 'POS',
}) => {
  const strings = t[lang];

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-bold text-sm sm:text-lg leading-none tracking-tight">
                {appName}
              </h1>
              {/* IMMUTABLE BRANDING BADGE */}
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-cyan-950/90 text-cyan-300 border border-cyan-500/40">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>{POWERED_BY}</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight mt-0.5 hidden xs:block">
              {strings.appSubtitle} &bull; Accessories & Repairs
            </p>
          </div>
        </div>

        {/* Status and Action controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* PWA Install Button (Compact on header) */}
          <PWAInstallButton variant="compact" lang={lang} appName={appName} />

          {/* Bluetooth Status Pill */}
          <button
            id="bt-status-pill-btn"
            onClick={onOpenPrinterModal}
            className={`flex items-center gap-1.5 text-xs font-medium px-2 sm:px-2.5 py-1.5 rounded-full border transition-all ${
              btState.isConnected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
            }`}
            title={btState.isConnected ? 'Connected to printer' : 'Click to connect Bluetooth printer'}
          >
            {btState.isConnected ? (
              <>
                <BluetoothConnected className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                <span className="max-w-[80px] sm:max-w-[130px] truncate">
                  {btState.deviceName || strings.bluetoothConnected}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
              </>
            ) : (
              <>
                <Bluetooth className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">{strings.connectPrinter}</span>
                <span className="sm:hidden">Print</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              </>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={soundEnabled ? 'Sound effects enabled' : 'Sound effects muted'}
            aria-label="Toggle sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Logged in user & Logout */}
          {currentUser && (
            <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/80">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] text-slate-300 font-medium hidden md:inline truncate max-w-[80px]">
                {currentUser.username}
              </span>
              <button
                onClick={onLogout}
                className="p-1 text-slate-400 hover:text-red-400 transition"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* New Tab Helper */}
          <a
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition hidden md:inline-flex"
            title="Open app in full tab for direct Bluetooth pairing"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Navigation tabs - visible on medium & desktop screens, phone has ergonomic bottom nav */}
      <nav className="hidden lg:flex max-w-7xl mx-auto px-3 sm:px-6 items-center gap-1 overflow-x-auto scrollbar-none py-1 border-t border-slate-800/80 text-xs">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-medium whitespace-nowrap transition ${activeTab === 'dashboard' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}>
          <Smartphone className="w-3.5 h-3.5" /><span>Home</span>
        </button>
        <button
          onClick={() => setActiveTab('bill')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-medium whitespace-nowrap transition ${
            activeTab === 'bill'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>{strings.newBill}</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-medium whitespace-nowrap transition ${
            activeTab === 'history'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{strings.billHistory}</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-medium whitespace-nowrap transition ${
            activeTab === 'products'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>{strings.productsCatalog}</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-medium whitespace-nowrap transition ${
            activeTab === 'profile'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>{strings.shopProfile}</span>
        </button>

        <button
          onClick={() => setActiveTab('printer')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-medium whitespace-nowrap transition ${
            activeTab === 'printer'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{strings.printerSettings}</span>
        </button>
      </nav>
    </header>
  );
};
