import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  Share2, 
  Phone, 
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { BusinessProfile, Invoice } from '../types';
import { createWhatsAppShareUrl, normalizeWhatsAppNumber } from '../utils/whatsapp';
import { soundEffects } from '../services/soundEffects';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  business: BusinessProfile;
  soundEnabled: boolean;
  onSuccessToast?: (msg: string) => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  invoice,
  business,
  soundEnabled,
  onSuccessToast,
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>(invoice.customerPhone || '');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const { url, text, cleanNumber } = createWhatsAppShareUrl(invoice, business, phoneNumber);

  const handleOpenWhatsApp = () => {
    if (soundEnabled) soundEffects.playBeep(880, 0.1);
    window.open(url, '_blank', 'noopener,noreferrer');
    if (onSuccessToast) {
      onSuccessToast(
        cleanNumber
          ? `WhatsApp sent to +${cleanNumber}  successfully.`
          : 'Bill sent via WhatsApp.'
      );
    }
    onClose();
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (soundEnabled) soundEffects.playSuccess();
      if (onSuccessToast) onSuccessToast('Bill details copied to clipboard.');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${business.name} - Invoice #${invoice.invoiceNumber}`,
          text: text,
        });
        if (soundEnabled) soundEffects.playSuccess();
        onClose();
      } catch {
        // Share was cancelled or dismissed
      }
    } else {
      handleCopyText();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        id="whatsapp-share-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/30 flex items-center justify-center border border-emerald-400/40 text-emerald-200">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Send Bill via WhatsApp</h2>
              <p className="text-xs text-emerald-200">
                Invoice #{invoice.invoiceNumber} &bull; {business.currencySymbol} {invoice.grandTotal.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-emerald-100 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Phone input */}
          <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-2xl space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Customer WhatsApp Number:</span>
              </span>
              {cleanNumber && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  + {cleanNumber}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="tel"
                placeholder="e.g. 0771234567 or 94771234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-emerald-300 font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              * Enter a number to open the WhatsApp chat directly.
            </p>
          </div>

          {/* WhatsApp Message Preview Bubble */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">
              Message Preview:
            </label>
            <div className="bg-[#0b141a] border border-[#222d34] rounded-2xl p-3.5 max-h-56 overflow-y-auto font-mono text-xs text-[#d1d7db] whitespace-pre-wrap leading-relaxed shadow-inner">
              {text}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
          {/* Primary Send Button */}
          <button
            id="btn-open-whatsapp"
            onClick={handleOpenWhatsApp}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            <span>Open WhatsApp (Send)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </button>

          {/* Secondary Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyText}
              className="flex-1 sm:flex-none py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 transition"
              title="Copy formatted message"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="flex-1 sm:flex-none py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 transition"
                title="Share using native phone menu"
              >
                <Share2 className="w-4 h-4 text-cyan-400" />
                <span>Share</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
