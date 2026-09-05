import React, { useState } from 'react';
import { Store, Save, X, ShieldCheck, KeyRound, Lock, User, CheckCircle2, RotateCcw, Type, ImagePlus, Trash2 } from 'lucide-react';
import { BusinessProfile } from '../types';
import { soundEffects } from '../services/soundEffects';
import { storage } from '../services/storage';
import { POWERED_BY } from '../data/defaultData';

interface ShopProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessProfile;
  setBusiness: React.Dispatch<React.SetStateAction<BusinessProfile>>;
  soundEnabled: boolean;
  onOpenResetModal?: () => void;
}

export const ShopProfileModal: React.FC<ShopProfileModalProps> = ({
  isOpen,
  onClose,
  business,
  setBusiness,
  soundEnabled,
  onOpenResetModal,
}) => {
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(storage.getStoredCredentials().username);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: keyof BusinessProfile, value: any) => {
    setBusiness((prev) => ({ ...prev, [field]: value, poweredBy: POWERED_BY }));
  };

  const handleSave = () => {
    storage.saveBusinessProfile({ ...business, poweredBy: POWERED_BY });
    if (newPassword.trim()) {
      storage.saveStoredCredentials({
        username: currentUsername.trim() || 'brave',
        password: newPassword.trim(),
        name: business.name || 'Brave Admin',
        role: 'admin',
      });
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 2000);
    }
    if (soundEnabled) soundEffects.playBeep(880, 0.1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-slate-100">
                Store Profile
              </h2>
              <p className="text-xs text-slate-400">App name, shop details සහ Login සැකසුම්</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
          {/* Developer Credit - IMMUTABLE BADGE */}
          <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-200 block text-xs">{POWERED_BY}</span>
                <span className="text-[10px] text-cyan-300">පද්ධති නිර්මාණය &bull; වෙනස් කළ නොහැක (Protected)</span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              VERIFIED
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-cyan-500/30">
            <label className="text-[11px] font-semibold text-cyan-300 block mb-1">
              App Name / System Name
            </label>
            <input
              type="text"
              value={business.appName ?? business.name ?? ''}
              onChange={(e) => handleChange('appName', e.target.value)}
              placeholder="e.g. My POS System"
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-semibold"
            />
            <p className="text-[10px] text-slate-500 mt-1.5">This name is used for the app/header, login, Items, bill history and other app branding.</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-violet-500/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-[11px] font-semibold text-violet-300 block mb-1">
                  Bill Logo
                </label>
                <p className="text-[10px] text-slate-500">Upload a logo to show at the top of printed receipts.</p>
              </div>
              {business.logoDataUrl && (
                <img src={business.logoDataUrl} alt="Logo preview" className="w-14 h-14 object-contain rounded-xl bg-white p-1 border border-slate-700" />
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                {business.logoDataUrl ? 'Change Logo' : 'Add Logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      alert('Please choose a logo smaller than 1 MB.');
                      e.currentTarget.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        handleChange('logoDataUrl', reader.result);
                        handleChange('showLogo', true);
                      }
                    };
                    reader.readAsDataURL(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              {business.logoDataUrl && (
                <button type="button" onClick={() => { handleChange('logoDataUrl', ''); handleChange('showLogo', false); }} className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {business.logoDataUrl && (
              <label className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                <input type="checkbox" checked={business.showLogo !== false} onChange={(e) => handleChange('showLogo', e.target.checked)} />
                Show logo on receipt
              </label>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Business Name
            </label>
            <input
              type="text"
              value={business.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-semibold"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Secondary Name
            </label>
            <input
              type="text"
              value={business.sinhalaName}
              onChange={(e) => handleChange('sinhalaName', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Tagline / Subtitle
            </label>
            <input
              type="text"
              value={business.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Phone / Hotline
              </label>
              <input
                type="text"
                value={business.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Mobile
              </label>
              <input
                type="text"
                value={business.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Address
            </label>
            <input
              type="text"
              value={business.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Registration Number
              </label>
              <input
                type="text"
                value={business.taxOrRegNumber}
                onChange={(e) => handleChange('taxOrRegNumber', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={business.currencySymbol}
                onChange={(e) => handleChange('currencySymbol', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              අවසන් සුබපැතුම (Receipt Footer Message)
            </label>
            <input
              type="text"
              value={business.receiptFooter}
              onChange={(e) => handleChange('receiptFooter', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              QR Code Link (LankaQR / Payment URL)
            </label>
            <input
              type="text"
              value={business.qrCodeData}
              onChange={(e) => handleChange('qrCodeData', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* App Theme Setting (User Requested: Mobile App Theme) */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              ෆෝන් ඇප් එකේ Theme එක (Mobile App Theme)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { 
                  id: 'dark_modern', 
                  label: 'Dark Modern', 
                  desc: 'Slate & Cyan',
                  preview: 'bg-slate-950 border-cyan-500 text-cyan-400' 
                },
                { 
                  id: 'midnight_blue', 
                  label: 'Midnight Blue', 
                  desc: 'Deep Navy',
                  preview: 'bg-[#0b132b] border-blue-500 text-blue-400' 
                },
                { 
                  id: 'amoled_black', 
                  label: 'AMOLED Black', 
                  desc: 'Battery Saver',
                  preview: 'bg-black border-emerald-500 text-emerald-400' 
                },
                { 
                  id: 'clean_light', 
                  label: 'Clean Daylight', 
                  desc: 'High Contrast',
                  preview: 'bg-slate-200 border-slate-400 text-slate-900' 
                },
              ].map((thm) => (
                <button
                  key={thm.id}
                  type="button"
                  onClick={() => handleChange('appTheme', thm.id)}
                  className={`p-2.5 rounded-xl text-left border transition ${
                    (business.appTheme || 'dark_modern') === thm.id
                      ? 'border-cyan-400 ring-2 ring-cyan-500/40 font-bold bg-slate-800'
                      : 'border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <div className={`w-full h-4 rounded mb-1.5 border ${thm.preview}`} />
                  <div className="text-xs font-semibold text-white">{thm.label}</div>
                  <div className="text-[10px] text-slate-400">{thm.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              ජංගම දුරකථනයේ හෝ ටැබ්ලට් එකේ ඇප් එක භාවිතයේදී ඇසට පහසු සහ බැටරි ඉතිරි කරන තේමාව තෝරන්න.
            </p>
          </div>

          {/* Receipt Font Size Setting */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Receipt Font Size
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'small', label: 'Small (Small)', icon: 'A-' },
                { id: 'normal', label: 'Normal', icon: 'A' },
                { id: 'large', label: 'Large (Large)', icon: 'A+' },
                { id: 'xlarge', label: 'ඉතා Large (XL)', icon: 'A++' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleChange('receiptFontSize', opt.id)}
                  className={`p-2 rounded-xl text-center border transition ${
                    (business.receiptFontSize || 'normal') === opt.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-sm">{opt.icon}</div>
                  <div className="text-[9px] mt-0.5">{opt.label}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              මුද්‍රිත Controls receipt and screen text size.
            </p>
          </div>

          {/* Account Security / Password Change */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="flex items-center justify-between w-full text-left font-semibold text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Login Username & Password වෙනස් කිරීම</span>
              </span>
              <span className="text-cyan-400 text-xs">{showPasswordSection ? 'වසන්න' : 'සකසන්න'}</span>
            </button>

            {showPasswordSection && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Username</label>
                  <input
                    type="text"
                    value={currentUsername}
                    onChange={(e) => setCurrentUsername(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs"
                  />
                </div>
                {passwordSuccess && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Password updated successfully!</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RESET ALL DATA & SETTINGS BUTTON */}
          {onOpenResetModal && (
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenResetModal();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 text-red-200 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-red-500/20 text-red-400 rounded-xl">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-red-400 text-xs">
                      Reset All Data & Settings
                    </div>
                    <div className="text-[10px] text-red-300/80">
                      Reset all products, bills and settings
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg">
                  Reset
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <span className="text-[11px] text-slate-500 font-mono">
            {POWERED_BY}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>සුරකින්න (Save)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
