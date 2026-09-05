import React, { useState } from 'react';
import { 
  AlertTriangle, 
  RotateCcw, 
  X, 
  ShieldAlert, 
  Trash2, 
  PackageX, 
  Receipt, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export type ResetScope = 'all_wipe' | 'all_defaults' | 'invoices_only' | 'products_only' | 'current_bill';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: (scope: ResetScope) => void;
  lang?: 'si' | 'en';
  soundEnabled?: boolean;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
  lang = 'si',
  soundEnabled = true,
}) => {
  const [selectedScope, setSelectedScope] = useState<ResetScope>('all_wipe');
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const isSi = lang === 'si';

  const handleExecuteReset = (scope: ResetScope) => {
    setIsResetting(true);
    if (soundEnabled) soundEffects.playBeep(440, 0.15);
    setTimeout(() => {
      onConfirmReset(scope);
      setIsResetting(false);
      onClose();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-red-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-red-950/70 to-slate-900 border-b border-red-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white leading-snug">
                {isSi ? 'දත්ත & Settings Reset කිරීමේ මධ්‍යස්ථානය' : 'Reset & Clear Data Center'}
              </h3>
              <p className="text-xs text-red-300">
                {isSi ? 'ඔබට ඉවත් කිරීමට අවශ්‍ය දත්ත වර්ගය තෝරන්න' : 'Choose which data you wish to clear or reset'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reset Choices List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 text-xs">
          <p className="text-slate-300 font-semibold mb-1">
            {isSi ? 'Reset කිරීමට අවශ්‍ය ක්‍රමය තෝරන්න:' : 'Select reset action:'}
          </p>

          {/* Option 1: Full Wipe Clean Slate (User requested!) */}
          <div
            onClick={() => setSelectedScope('all_wipe')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
              selectedScope === 'all_wipe'
                ? 'bg-red-500/15 border-red-500 text-white'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="mt-0.5 p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-red-300">
                  {isSi ? 'සියලුම දත්ත සම්පූර්ණයෙන් මකා දමන්න (100% Clean Wipe)' : 'Wipe ALL Data (100% Clean Slate)'}
                </span>
                {selectedScope === 'all_wipe' && <CheckCircle2 className="w-4 h-4 text-red-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {isSi
                  ? 'සියලුම භාණ්ඩ, පෙර බිල්පත්, වත්මන් බිල සහ සැකසුම් මුළුමනින්ම ඉවත් කර 0 සිට පිරිසිදු කරයි.'
                  : 'Clears all products (empty 0 items), sales history, cart, and restores fresh empty app.'}
              </p>
            </div>
          </div>

          {/* Option 2: Clear Current Bill / Cart Only */}
          <div
            onClick={() => setSelectedScope('current_bill')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
              selectedScope === 'current_bill'
                ? 'bg-cyan-500/15 border-cyan-500 text-white'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="mt-0.5 p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-cyan-300">
                  {isSi ? 'වත්මන් බිල්පත පමණක් හිස් කරන්න (Clear Current Bill)' : 'Clear Current Bill Only'}
                </span>
                {selectedScope === 'current_bill' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {isSi
                  ? 'දැනට බිල්පතට ඇතුළත් කර ඇති සියලුම භාණ්ඩ, පාරිභෝගික තොරතුරු සහ වට්ටම් පමණක් 0 කරයි.'
                  : 'Empties the current cart and resets all items and fields for a new bill.'}
              </p>
            </div>
          </div>

          {/* Option 3: Clear Invoices History Only */}
          <div
            onClick={() => setSelectedScope('invoices_only')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
              selectedScope === 'invoices_only'
                ? 'bg-amber-500/15 border-amber-500 text-white'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="mt-0.5 p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-amber-300">
                  {isSi ? 'බිල්පත් ඉතිහාසය මකන්න (Clear Invoices History)' : 'Clear Invoices History'}
                </span>
                {selectedScope === 'invoices_only' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {isSi
                  ? 'මෙතෙක් නිකුත් කරන ලද සියලුම බිල්පත් ඉතිහාසය මකා දමයි. භාණ්ඩ ලැයිස්තුව එලෙසම පවතී.'
                  : 'Deletes all past saved sales invoices while keeping your products catalog intact.'}
              </p>
            </div>
          </div>

          {/* Option 4: Clear Products Catalog Only */}
          <div
            onClick={() => setSelectedScope('products_only')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
              selectedScope === 'products_only'
                ? 'bg-purple-500/15 border-purple-500 text-white'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="mt-0.5 p-2 rounded-xl bg-purple-500/20 text-purple-400 shrink-0">
              <PackageX className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-purple-300">
                  {isSi ? 'භාණ්ඩ ලැයිස්තුව හිස් කරන්න (Empty Products - 0 Items)' : 'Empty Products Catalog'}
                </span>
                {selectedScope === 'products_only' && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {isSi
                  ? 'සියලුම භාණ්ඩ ඉවත් කර හිස් ලැයිස්තුවක් බවට පත් කරයි (0 Items).'
                  : 'Removes all products from the catalog so you can add fresh products.'}
              </p>
            </div>
          </div>

          {/* Option 5: Restore Defaults */}
          <div
            onClick={() => setSelectedScope('all_defaults')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
              selectedScope === 'all_defaults'
                ? 'bg-blue-500/15 border-blue-500 text-white'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="mt-0.5 p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-blue-300">
                  {isSi ? 'මූලික Sample භාණ්ඩ 13 නැවත ගන්න (Restore Sample 13 Items)' : 'Restore Sample 13 Products'}
                </span>
                {selectedScope === 'all_defaults' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {isSi
                  ? 'මූලික Accessories & Repair අයිතම 13 නැවත පූරණය කරයි.'
                  : 'Restores default sample catalog of 13 mobile accessories & repairs.'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            disabled={isResetting}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            {isSi ? 'Cancel' : 'Cancel'}
          </button>
          <button
            id="btn-confirm-execute-reset"
            onClick={() => handleExecuteReset(selectedScope)}
            disabled={isResetting}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-900/40 transition active:scale-95"
          >
            <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isSi ? 'තේරූ දත්ත Reset කරන්න' : 'Confirm & Reset'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
