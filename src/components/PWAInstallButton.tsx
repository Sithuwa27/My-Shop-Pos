import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'mobile-banner' | 'menu-item' | 'compact';
  lang?: 'si' | 'en';
  appName?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  lang = 'si',
  appName = 'POS',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already installed as PWA in standalone mode, hide unless in menu
  if (isInstalled && variant !== 'menu-item') {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const res = await install();
      if (res) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const isSi = false;

  // Render guide modal
  const renderGuide = () => {
    if (!showGuideModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
          <button
            onClick={() => setShowGuideModal(false)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {isSi ? 'දුරකථනයට ඇප් එක Install කරගන්න' : 'Install App on Your Phone'}
              </h3>
              <p className="text-xs text-slate-400">
                {isSi ? 'Play Store අවශ්‍ය නොවේ - Instant PWA App' : 'No Store needed - Direct Native-like PWA'}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            {/* Android instructions */}
            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <div className="font-semibold text-cyan-400 flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Android / Chrome:
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isSi ? (
                  <>
                    1. Chrome බ්‍රව්සරයේ ඉහළ දකුණු කෙළවරේ ඇති <strong>තිත් 3 (Menu ⋮)</strong> ඔබන්න.<br />
                    2. <strong>"Install app"</strong> හෝ <strong>"Add to Home screen"</strong> තෝරන්න.<br />
                    3. ඔබේ දුරකථනයේ හෝම් ස්ක්‍රීන් එකට POS ඇප් එක ක්ෂණිකව එකතු වේ.
                  </>
                ) : (
                  <>
                    1. Tap the <strong>three dots (⋮)</strong> menu in Google Chrome.<br />
                    2. Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.<br />
                    3. The app will be installed directly on your device home screen.
                  </>
                )}
              </p>
            </div>

            {/* iOS instructions */}
            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <div className="font-semibold text-emerald-400 flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                iPhone / iPad (Safari):
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isSi ? (
                  <>
                    1. Safari බ්‍රව්සරයේ පහළ ඇති <strong>Share (බෙදාගැනීමේ)</strong> අයිකනය <Share2 className="inline w-3.5 h-3.5 text-emerald-400" /> ඔබන්න.<br />
                    2. පහළට ගොස් <strong>"Add to Home Screen" <PlusSquare className="inline w-3.5 h-3.5 text-emerald-400" /></strong> තෝරන්න.<br />
                    3. ඉහළ දකුණේ <strong>"Add"</strong> ඔබන්න.
                  </>
                ) : (
                  <>
                    1. Tap the <strong>Share</strong> button <Share2 className="inline w-3.5 h-3.5 text-emerald-400" /> in Safari.<br />
                    2. Scroll down and tap <strong>"Add to Home Screen" <PlusSquare className="inline w-3.5 h-3.5 text-emerald-400" /></strong>.<br />
                    3. Tap <strong>"Add"</strong> on top right.
                  </>
                )}
              </p>
            </div>

            {/* Offline and feature note */}
            <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isSi
                  ? 'Install කළ පසු Data නොමැතිව (Offline) වුවද බිල්පත් සහ Barcode ස්කෑනරය ක්‍රියාත්මක වේ.'
                  : 'Works offline after install with fast Bluetooth printer & barcode scanner support.'}
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            {isInstallable && (
              <button
                onClick={install}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isSi ? 'දැන් Install කරන්න' : 'Install Now'}
              </button>
            )}
            <button
              onClick={() => setShowGuideModal(false)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm transition font-medium"
            >
              {isSi ? 'තේරුණා (Close)' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleAction}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-cyan-600/90 to-blue-600/90 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow transition active:scale-95"
          title={isSi ? 'ෆෝන් එකට Install කරන්න' : 'Install App'}
        >
          <Smartphone className="w-3.5 h-3.5 animate-pulse" />
          <span className="hidden sm:inline">{isSi ? 'ඇප් එක Install' : 'Install App'}</span>
          <span className="sm:hidden">Install</span>
        </button>
        {renderGuide()}
      </>
    );
  }

  if (variant === 'menu-item') {
    return (
      <>
        <button
          onClick={handleAction}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition text-sm font-medium"
        >
          <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white">
              {isSi ? 'ෆෝන් එකට Install කරගන්න (PWA)' : 'Install Mobile App (PWA)'}
            </div>
            <div className="text-xs text-slate-400">
              {isInstalled
                ? (isSi ? 'යෙදුම දැනටමත් Install කර ඇත' : 'App is already installed')
                : (isSi ? 'Home Screen එකට එකතු කරන්න' : 'Add to home screen')}
            </div>
          </div>
          <Download className="w-4 h-4 text-cyan-400" />
        </button>
        {renderGuide()}
      </>
    );
  }

  if (variant === 'mobile-banner') {
    return (
      <>
        <div className="flex items-center justify-between gap-3 p-2.5 bg-gradient-to-r from-cyan-950/80 via-blue-950/80 to-slate-900 border border-cyan-800/40 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">
                {isSi ? `${appName} ෆෝන් එකට ගන්න` : `Install ${appName} App`}
              </div>
              <div className="text-slate-400 text-[11px]">
                {isSi ? 'Home Screen එකෙන් එක ක්ලික් එකෙන් විවෘත කරන්න' : 'Instant launch from Home screen'}
              </div>
            </div>
          </div>
          <button
            onClick={handleAction}
            className="shrink-0 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition active:scale-95 shadow"
          >
            {isSi ? 'Install' : 'Install'}
          </button>
        </div>
        {renderGuide()}
      </>
    );
  }

  // Header variant default
  return (
    <>
      <button
        onClick={handleAction}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{isSi ? 'ඇප් එක Install කරන්න' : 'Install App'}</span>
      </button>
      {renderGuide()}
    </>
  );
};
