import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Type, 
  Layout, 
  FileText, 
  ShieldAlert, 
  QrCode, 
  RotateCcw,
  Sliders,
  AlignLeft,
  AlignCenter,
  Maximize2,
  Sparkles,
  Save
} from 'lucide-react';
import { BusinessProfile, ReceiptFontFamily, ReceiptFontSize, PaperWidth } from '../types';
import { soundEffects } from '../services/soundEffects';
import { storage } from '../services/storage';

interface ReceiptCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessProfile;
  setBusiness: (profile: BusinessProfile) => void;
  soundEnabled: boolean;
  onSuccessToast?: (msg: string) => void;
}

export const ReceiptCustomizerModal: React.FC<ReceiptCustomizerModalProps> = ({
  isOpen,
  onClose,
  business,
  setBusiness,
  soundEnabled,
  onSuccessToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'font' | 'header' | 'items' | 'footer'>('font');
  const [localProfile, setLocalProfile] = useState<BusinessProfile>(() => ({ ...business }));

  // Load a fresh snapshot only when the customizer opens.
  // Do not sync on every parent update; that used to overwrite pending changes.
  useEffect(() => {
    if (isOpen) {
      const stored = storage.getBusinessProfile();
      setLocalProfile({ ...business, ...stored });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = <K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) => {
    const updated = { ...localProfile, [key]: value };
    setLocalProfile(updated);
    // Keep changes local until the user taps Save & Apply.
    // This makes the Apply button reliable and prevents state races.
  };

  const handleSaveAndClose = () => {
    setBusiness(localProfile);
    storage.saveBusinessProfile(localProfile);
    if (soundEnabled) soundEffects.playSuccess();
    if (onSuccessToast) onSuccessToast('Receipt settings saved successfully!');
    onClose();
  };

  const currentScale = localProfile.receiptFontScale || (
    localProfile.receiptFontSize === 'small' ? 85 :
    localProfile.receiptFontSize === 'large' ? 120 :
    localProfile.receiptFontSize === 'xlarge' ? 135 :
    localProfile.receiptFontSize === 'xxlarge' ? 150 : 100
  );

  const applyScale = (newScale: number) => {
    const clamped = Math.max(70, Math.min(160, newScale));
    let sz: ReceiptFontSize = 'normal';
    if (clamped <= 85) sz = 'small';
    else if (clamped <= 105) sz = 'normal';
    else if (clamped <= 125) sz = 'large';
    else if (clamped <= 140) sz = 'xlarge';
    else sz = 'xxlarge';

    handleUpdate('receiptFontScale', clamped);
    handleUpdate('receiptFontSize', sz);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        id="receipt-customizer-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-cyan-900 via-slate-800 to-blue-900 px-5 py-3.5 flex items-center justify-between text-white border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Receipt Customization</h2>
              <p className="text-[11px] text-cyan-200">
                Font, Size & Complete Receipt Layout Customizer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation Pills */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-950/80 border-b border-slate-800 text-xs overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveSubTab('font')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
              activeSubTab === 'font'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Font & Size</span>
          </button>
          <button
            onClick={() => setActiveSubTab('header')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
              activeSubTab === 'header'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Header Info</span>
          </button>
          <button
            onClick={() => setActiveSubTab('items')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
              activeSubTab === 'items'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Items & Transactions</span>
          </button>
          <button
            onClick={() => setActiveSubTab('footer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition ${
              activeSubTab === 'footer'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Footer & Warranty</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: FONT & SIZE CUSTOMIZATION */}
          {activeSubTab === 'font' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Font Family Selector */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-2.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Type className="w-4 h-4 text-cyan-400" />
                  <span>බිල්පතේ අකුරු මෝස්තරය (Font Family):</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'monospace', label: 'Courier Mono', desc: 'සම්ප්‍රදායික Thermal' },
                    { id: 'sans', label: 'Modern Sans', desc: 'පැහැදිලි නවීන' },
                    { id: 'sinhala', label: 'Noto Sinhala', desc: 'සිංහල සඳහා විශේෂිත' },
                    { id: 'serif', label: 'Classic Serif', desc: 'සම්භාව්‍ය Serif' },
                    { id: 'ticket', label: 'Compact Ticket', desc: 'ඝනකම ටිකට්' },
                  ].map((f) => {
                    const isSelected = (localProfile.receiptFontFamily || 'monospace') === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          handleUpdate('receiptFontFamily', f.id as ReceiptFontFamily);
                          if (soundEnabled) soundEffects.playBeep(650, 0.05);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-500 text-white'
                            : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{f.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{f.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size & Scale Stepper / Slider */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-cyan-400" />
                    <span>අකුරු ප්‍රමාණය Largeනය (Font Size Scale):</span>
                  </label>
                  <span className="font-mono font-bold text-cyan-400 text-sm bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-700">
                    {currentScale}%
                  </span>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="75"
                  max="155"
                  step="5"
                  value={currentScale}
                  onChange={(e) => applyScale(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />

                {/* Quick Preset Buttons */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {[
                    { label: 'A- (80%)', scale: 80, name: 'Small' },
                    { label: 'A (100%)', scale: 100, name: 'Normal' },
                    { label: 'A+ (120%)', scale: 120, name: 'Large' },
                    { label: 'A++ (135%)', scale: 135, name: 'ඉතා Large' },
                    { label: 'MAX (150%)', scale: 150, name: 'Maximum' },
                  ].map((p) => (
                    <button
                      key={p.scale}
                      type="button"
                      onClick={() => {
                        applyScale(p.scale);
                        if (soundEnabled) soundEffects.playBeep(700, 0.04);
                      }}
                      className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition flex flex-col items-center border ${
                        currentScale === p.scale
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <span>{p.label}</span>
                      <span className="text-[9px] opacity-75">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paper Width & Alignment */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-slate-200 block">
                  Paper Width & Alignment:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate('paperWidth', '58mm')}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      localProfile.paperWidth === '58mm'
                        ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className="text-xs block">58mm (Thermal 2")</span>
                    <span className="text-[10px] text-slate-400">Mobile Bluetooth Pocket Printers</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate('paperWidth', '80mm')}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      localProfile.paperWidth === '80mm'
                        ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className="text-xs block">80mm (Thermal 3")</span>
                    <span className="text-[10px] text-slate-400">Desktop / Counter POS Printers</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-300">හිස්පත පෙළගැස්ම (Header Align):</span>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleUpdate('headerAlignment', 'center')}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
                        (localProfile.headerAlignment || 'center') === 'center'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                      <span>Center</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate('headerAlignment', 'left')}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
                        localProfile.headerAlignment === 'left'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                      <span>Left</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HEADER INFO CUSTOMIZATION */}
          {activeSubTab === 'header' && (
            <div className="space-y-3 animate-in fade-in">
              <p className="text-xs text-slate-400">
                රිසිට්පත මුදුනේ දිස්විය යුතු හෝ නොවිය යුතු තොරතුරු සක්‍රිය/අක්‍රිය කරන්න:
              </p>

              {[
                { key: 'showSinhalaName', label: 'Show secondary business name', defaultVal: true },
                { key: 'showTagline', label: 'Show tagline', defaultVal: true },
                { key: 'showAddress', label: 'Show address', defaultVal: true },
                { key: 'showPhone', label: 'Show phone', defaultVal: true },
                { key: 'showTaxNumber', label: 'Show registration number', defaultVal: true },
              ].map((item) => {
                const currentVal = (localProfile as any)[item.key] !== false;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700/80"
                  >
                    <span className="text-xs text-slate-200 font-medium">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdate(item.key as any, !currentVal)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        currentVal ? 'bg-cyan-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                          currentVal ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}

              {/* Editable Header Custom Slogan */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl space-y-1.5">
                <label className="text-xs text-slate-300 font-medium block">
                  Custom Header Greeting:
                </label>
                <input
                  type="text"
                  value={localProfile.receiptHeader || ''}
                  onChange={(e) => handleUpdate('receiptHeader', e.target.value)}
                  placeholder="උදා: වගකීමක් සහිත උසස් සේවාව!"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* TAB 3: ITEMS & TRANSACTION DETAILS */}
          {activeSubTab === 'items' && (
            <div className="space-y-3 animate-in fade-in">
              <p className="text-xs text-slate-400">
                Control which item and payment details appear on the bill:
              </p>

              {[
                { key: 'showDateTime', label: 'දිනය සහ වේලාව පෙන්වන්න (Date & Time)' },
                { key: 'showCashier', label: 'අයකැමි නම පෙන්වන්න (Cashier Name)' },
                { key: 'showCustomerInfo', label: 'පාරිභෝගික නම සහ දුරකථනය පෙන්වන්න' },
                { key: 'showItemUnitPrice', label: 'භාණ්ඩයේ ඒකක මිල @ පෙන්වන්න (Unit Price)' },
                { key: 'showItemSinhalaName', label: 'භාණ්ඩයේ සිංහල නම පෙන්වන්න (Sinhala Item Name)' },
                { key: 'showItemBarcode', label: 'භාණ්ඩයේ Barcode අංකය පෙන්වන්න' },
                { key: 'showDiscounts', label: 'වට්ටම් විස්තරය පෙන්වන්න (Discounts Line)' },
                { key: 'showTax', label: 'බදු / Service Charge පෙන්වන්න' },
                { key: 'showPaymentDetails', label: 'ගෙවූ මුදල සහ ඉතිරි මුදල පෙන්වන්න (Payment/Balance)' },
              ].map((item) => {
                const currentVal = (localProfile as any)[item.key] !== false;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700/80"
                  >
                    <span className="text-xs text-slate-200 font-medium">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdate(item.key as any, !currentVal)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        currentVal ? 'bg-cyan-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                          currentVal ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: FOOTER, POLICIES & QR CODE */}
          {activeSubTab === 'footer' && (
            <div className="space-y-3.5 animate-in fade-in">
              {/* Thank You Note */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl space-y-1.5">
                <label className="text-xs text-slate-300 font-medium block">
                  ස්තූති පාඨය (Receipt Footer Note):
                </label>
                <input
                  type="text"
                  value={localProfile.receiptFooter || ''}
                  onChange={(e) => handleUpdate('receiptFooter', e.target.value)}
                  placeholder="Thank You, Come Again! - ස්තූතියි නැවත එන්න!"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Warranty Policy Toggle & Text */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-200 font-medium">
                    වගකීම් කොන්දේසි සටහන පෙන්වන්න (Warranty Policy Note):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdate('showWarrantyPolicy', localProfile.showWarrantyPolicy === false)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      localProfile.showWarrantyPolicy !== false ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        localProfile.showWarrantyPolicy !== false ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {localProfile.showWarrantyPolicy !== false && (
                  <textarea
                    rows={2}
                    value={localProfile.warrantyPolicyText || ''}
                    onChange={(e) => handleUpdate('warrantyPolicyText', e.target.value)}
                    placeholder="උදා: දින 7ක් ඇතුළත බිල්පත සමඟ භාණ්ඩ මාරු කළ හැක. Warranty සේවාවන් සඳහා බිල්පත අනිවාර්ය වේ."
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                )}
              </div>

              {/* QR Code Toggle & Link */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-200 font-medium flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                    <span>LankaQR / Payment QR Code පෙන්වන්න</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdate('showQrCode', !localProfile.showQrCode)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      localProfile.showQrCode ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        localProfile.showQrCode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {localProfile.showQrCode && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      QR කේතයේ Link හෝ ගෙවීම් දත්ත (QR Payload URL):
                    </label>
                    <input
                      type="text"
                      value={localProfile.qrCodeData || ''}
                      onChange={(e) => handleUpdate('qrCodeData', e.target.value)}
                      placeholder="https://pay.lankaqr.gov.lk/..."
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              applyScale(100);
              handleUpdate('receiptFontFamily', 'monospace');
              handleUpdate('paperWidth', '58mm');
              handleUpdate('headerAlignment', 'center');
              if (soundEnabled) soundEffects.playBeep(450, 0.08);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>මූලික ආකෘතිය (Reset Layout)</span>
          </button>

          <button
            id="btn-save-receipt-customizer"
            type="button"
            onClick={handleSaveAndClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            <span>සැකසුම් සුරකින්න (Save & Apply)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
