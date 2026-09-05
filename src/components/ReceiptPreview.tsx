import React, { useEffect, useRef, useState } from 'react';
import { 
  Printer, 
  Download, 
  Share2, 
  Check, 
  Bluetooth, 
  AlertCircle,
  Eye,
  FileText,
  Languages,
  Type,
  MessageSquare,
  Sliders,
  ZoomIn,
  ZoomOut,
  Sparkles
} from 'lucide-react';
import QRCode from 'qrcode';
import { BusinessProfile, Invoice, BluetoothDeviceState, ReceiptFontSize, ReceiptFontFamily } from '../types';
import { renderReceiptToCanvas, canvasToEscPosBytes } from '../services/receiptCanvas';
import { bluetoothPrinter } from '../services/bluetoothPrinter';
import { buildTextReceiptBytes } from '../services/escpos';
import { soundEffects } from '../services/soundEffects';
import { t } from '../utils/translations';
import { POWERED_BY } from '../data/defaultData';
import { storage } from '../services/storage';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { ReceiptCustomizerModal } from './ReceiptCustomizerModal';

interface ReceiptPreviewProps {
  invoice: Invoice;
  setInvoice?: React.Dispatch<React.SetStateAction<Invoice>>;
  business: BusinessProfile;
  btState: BluetoothDeviceState;
  lang: 'si' | 'en';
  soundEnabled: boolean;
  onOpenPrinterModal: () => void;
  onPrintSuccess?: () => void;
  onUpdateBusiness?: (business: BusinessProfile) => void;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  invoice,
  setInvoice,
  business,
  btState,
  lang,
  soundEnabled,
  onOpenPrinterModal,
  onPrintSuccess,
  onUpdateBusiness,
}) => {
  const strings = t[lang];
  const [qrSrc, setQrSrc] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printProgress, setPrintProgress] = useState<number>(0);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState<boolean>(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active receipt language (defaults to invoice.receiptLanguage or business.receiptLanguage)
  const activeReceiptLang = 'en';
  const isReceiptEnglish = true;

  const toggleReceiptLanguage = (newLang: 'si' | 'en') => {
    if (setInvoice) {
      setInvoice((prev) => ({ ...prev, receiptLanguage: newLang }));
    }
    if (onUpdateBusiness) {
      onUpdateBusiness({ ...business, receiptLanguage: newLang });
    }
    if (soundEnabled) soundEffects.playBeep(800, 0.05);
  };

  const is58mm = business.paperWidth === '58mm';
  const receiptLineHeight = business.receiptLineSpacing === 'compact' ? 1.15 : business.receiptLineSpacing === 'spacious' ? 1.65 : 1.35;

  // Font family string
  const selectedFamily: ReceiptFontFamily = business.receiptFontFamily || 'monospace';
  const fontFamilyStyle = 
    selectedFamily === 'sans' ? "'Plus Jakarta Sans', 'Noto Sans Sinhala', sans-serif" :
    selectedFamily === 'sinhala' ? "'Noto Sans Sinhala', 'Plus Jakarta Sans', sans-serif" :
    selectedFamily === 'serif' ? "Georgia, 'Times New Roman', serif, 'Noto Sans Sinhala'" :
    selectedFamily === 'ticket' ? "'Courier Prime', monospace" :
    "'Courier Prime', monospace, 'Noto Sans Sinhala', sans-serif";

  // Current font scale percentage
  const currentScalePercent = business.receiptFontScale || (
    business.receiptFontSize === 'small' ? 85 :
    business.receiptFontSize === 'large' ? 120 :
    business.receiptFontSize === 'xlarge' ? 135 :
    business.receiptFontSize === 'xxlarge' ? 150 : 100
  );

  const changeFontScale = (delta: number) => {
    const newScale = Math.min(160, Math.max(75, currentScalePercent + delta));
    if (onUpdateBusiness) {
      onUpdateBusiness({
        ...business,
        receiptFontScale: newScale,
        receiptFontSize: newScale <= 85 ? 'small' : newScale <= 105 ? 'normal' : newScale <= 125 ? 'large' : 'xlarge'
      });
    }
    if (soundEnabled) soundEffects.playBeep(650 + newScale * 2, 0.04);
  };

  const setNamedFontSize = (sz: ReceiptFontSize) => {
    const scale = sz === 'small' ? 85 : sz === 'normal' ? 100 : sz === 'large' ? 120 : sz === 'xlarge' ? 135 : 150;
    if (onUpdateBusiness) {
      onUpdateBusiness({
        ...business,
        receiptFontSize: sz,
        receiptFontScale: scale,
      });
    }
    if (soundEnabled) soundEffects.playBeep(750, 0.04);
  };

  const setFontFamily = (family: ReceiptFontFamily) => {
    if (onUpdateBusiness) {
      onUpdateBusiness({
        ...business,
        receiptFontFamily: family,
      });
    }
    if (soundEnabled) soundEffects.playBeep(850, 0.04);
  };

  // Generate QR Code data URL for visual display
  useEffect(() => {
    if (business.showQrCode && business.qrCodeData) {
      QRCode.toDataURL(business.qrCodeData, {
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then(setQrSrc)
        .catch(() => setQrSrc(''));
    } else {
      setQrSrc('');
    }
  }, [business.showQrCode, business.qrCodeData]);

  // Generate invisible render canvas for ESC/POS bitmap printing
  useEffect(() => {
    renderReceiptToCanvas(invoice, business)
      .then((c) => {
        canvasRef.current = c;
      })
      .catch((err) => console.warn('Canvas render error:', err));
  }, [invoice, business, activeReceiptLang]);

  // Primary Print Action: Sends directly to Bluetooth Thermal Printer
  const handleBluetoothPrint = async () => {
    if (isPrinting) return;

    if (!btState.isConnected) {
      onOpenPrinterModal();
      return;
    }

    setIsPrinting(true);
    setPrintProgress(10);
    setPrintStatus(strings.printingInProgress);

    if (soundEnabled) {
      soundEffects.playThermalPrintSound(1800);
      if (business.openDrawer) {
        soundEffects.playDrawerKick();
      }
    }

    try {
      // Always load the latest business profile to ensure all saved settings (font size, scale, toggles) apply immediately
      const latestBusiness: BusinessProfile = {
        ...business,
        ...storage.getBusinessProfile(),
      };

      // Render fresh canvas using all customization settings
      const canvas = await renderReceiptToCanvas(invoice, latestBusiness);
      canvasRef.current = canvas;

      // Sliced raster printing guarantees 1:1 match with screen customizations,
      // prevents printer buffer overflow (no overlapping prints), and ensures full receipt prints!
      const printBytes = canvasToEscPosBytes(canvas, latestBusiness);

      setPrintProgress(20);

      // Send to Bluetooth thermal printer at accelerated speed
      await bluetoothPrinter.printBytes(printBytes, (percent) => {
        setPrintProgress(20 + Math.round(percent * 0.8));
      });

      setPrintProgress(100);
      setPrintStatus(strings.printSuccess);
      if (soundEnabled) soundEffects.playBeep(880, 0.2);

      if (onPrintSuccess) {
        onPrintSuccess();
      }

      setTimeout(() => {
        setIsPrinting(false);
        setPrintStatus(null);
        setPrintProgress(0);
      }, 2500);
    } catch (err: any) {
      console.error('Print failed:', err);
      setIsPrinting(false);
      setPrintStatus(err?.message || 'මුද්‍රණය අසාර්ථක විය');
      setTimeout(() => setPrintStatus(null), 4000);
    }
  };

  // Browser Print / System PDF Fallback
  const handleSystemPrint = () => {
    if (soundEnabled) soundEffects.playBeep(600, 0.1);
    window.print();
  };

  // Download receipt as PNG image (handy for sending to customer on WhatsApp)
  const handleDownloadImage = async () => {
    try {
      const canvas = await renderReceiptToCanvas(invoice, business);
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bill_${invoice.invoiceNumber}.png`;
      a.click();
      if (soundEnabled) soundEffects.playBeep(700, 0.1);
    } catch (e) {
      console.error(e);
    }
  };

  // Copy text receipt to clipboard
  const handleCopyText = () => {
    const lines = [
      business.name,
      !isReceiptEnglish && business.sinhalaName ? business.sinhalaName : '',
      business.address,
      `Tel: ${business.phone || business.mobile}`,
      '--------------------------------',
      `Invoice: ${invoice.invoiceNumber} | Date: ${invoice.date} ${invoice.time}`,
      `Customer: ${invoice.customerName || 'Cash Customer'}`,
      '--------------------------------',
      ...invoice.items.map(
        (i) => `${isReceiptEnglish ? i.name : i.sinhalaName || i.name} (${i.quantity} ${i.unit}) = ${business.currencySymbol} ${i.total.toFixed(2)}`
      ),
      '--------------------------------',
      `TOTAL: ${business.currencySymbol} ${invoice.grandTotal.toFixed(2)}`,
      `Paid (${invoice.paymentMethod}): ${business.currencySymbol} ${invoice.paidAmount.toFixed(2)}`,
      invoice.changeAmount > 0 ? `Change: ${business.currencySymbol} ${invoice.changeAmount.toFixed(2)}` : '',
      '--------------------------------',
      business.receiptFooter,
      `*** ${POWERED_BY} ***`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Action Bar Above Preview */}
      <div className="w-full max-w-sm flex flex-col gap-2 mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-300">{strings.previewPaper}</span>
            <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-700">
              {business.paperWidth}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleDownloadImage}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
              title="Download PNG image for WhatsApp"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">PNG</span>
            </button>
            <button
              onClick={() => setIsWhatsAppOpen(true)}
              className="p-1.5 rounded-md bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-800 transition text-xs flex items-center gap-1"
              title="Share via WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xs:inline text-[10px] font-bold">WhatsApp</span>
            </button>
            <button
              onClick={() => setIsCustomizerOpen(true)}
              className="p-1.5 rounded-md bg-indigo-900/60 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-800 transition text-xs flex items-center gap-1"
              title="Receipt Layout Customizer"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xs:inline text-[10px] font-bold">{isReceiptEnglish ? 'Customize' : 'සැකසුම්'}</span>
            </button>
            <button
              onClick={handleCopyText}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
              title="Copy receipt as text"
            >
              {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleSystemPrint}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
              title="Browser Print / PDF"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Receipt Controls: Language & Font Family & Font Scale */}
        <div className="space-y-1.5 bg-slate-800/80 border border-slate-700/80 p-2 rounded-xl text-xs">
          {/* Row 1: Language & Font Family */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">

            {/* Font Family Selector */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px] flex items-center gap-0.5">
                <Type className="w-3 h-3 text-indigo-400" />
                <span>Font:</span>
              </span>
              <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(['monospace', 'sans', 'sinhala', 'serif', 'ticket'] as const).map((fam) => (
                  <button
                    key={fam}
                    onClick={() => setFontFamily(fam)}
                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-semibold transition ${
                      selectedFamily === fam
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {fam === 'monospace' ? 'Mono' : fam === 'sans' ? 'Sans' : fam === 'sinhala' ? 'Sinhala' : fam === 'serif' ? 'Serif' : 'POS'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Font Size & Steppers */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[10px] flex items-center gap-1">
                <ZoomIn className="w-3 h-3 text-cyan-400" />
                <span>Size:</span>
                <span className="font-bold text-cyan-300 font-mono text-[11px]">{currentScalePercent}%</span>
              </span>
              <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                <button
                  onClick={() => changeFontScale(-5)}
                  className="w-6 h-5 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  title="Smaller font"
                >
                  -
                </button>
                <button
                  onClick={() => changeFontScale(5)}
                  className="w-6 h-5 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  title="Larger font"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {(['small', 'normal', 'large', 'xlarge'] as const).map((sz) => {
                const isCurrent = business.receiptFontSize === sz;
                const label = sz === 'small' ? 'A-' : sz === 'normal' ? 'A' : sz === 'large' ? 'A+' : 'A++';
                return (
                  <button
                    key={sz}
                    onClick={() => setNamedFontSize(sz)}
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition ${
                      isCurrent
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Status alert */}
      {printStatus && (
        <div className="w-full max-w-sm mb-3">
          <div
            className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 border ${
              printStatus === strings.printSuccess
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
            }`}
          >
            {printStatus === strings.printSuccess ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Printer className="w-4 h-4 text-cyan-400 animate-bounce shrink-0" />
            )}
            <div className="flex-1">
              <p>{printStatus}</p>
              {isPrinting && (
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-200"
                    style={{ width: `${printProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Realistic Thermal Receipt Paper Container */}
      <div
        id="printable-receipt"
        className={`thermal-paper relative transition-all duration-300 mx-auto rounded-t-sm rounded-b-sm ${
          is58mm ? 'w-full max-w-[340px] px-3.5 py-4' : 'w-full max-w-[420px] px-5 py-5'
        }`}
        style={{
          fontFamily: fontFamilyStyle,
          fontSize: `${currentScalePercent}%`,
          lineHeight: receiptLineHeight,
        }}
      >
        {/* Top Serrated Paper Edge */}
        <div className="receipt-tear-top absolute -top-2 left-0" />

        {/* Paper Content Header */}
        <div className={business.headerAlignment === 'left' ? 'text-left' : 'text-center'}>
          {business.logoDataUrl && business.showLogo !== false && (
            <img
              src={business.logoDataUrl}
              alt="Business logo"
              className="mx-auto mb-2 max-h-20 max-w-[42%] object-contain"
            />
          )}
          <h2 className="font-bold text-lg leading-tight tracking-tight text-black">
            {business.name}
          </h2>
          {!isReceiptEnglish && business.sinhalaName && business.showSinhalaName !== false && (
            <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-snug">
              {business.sinhalaName}
            </p>
          )}
          {business.tagline && business.showTagline !== false && (
            <p className="text-[11px] text-gray-600 mt-0.5">{business.tagline}</p>
          )}
          {business.address && business.showAddress !== false && (
            <p className="text-[11px] text-gray-700 leading-tight mt-0.5">{business.address}</p>
          )}
          {(business.phone || business.mobile) && business.showPhone !== false && (
            <p className="text-[11px] text-gray-700 mt-0.5">
              Tel: {business.phone || business.mobile}
            </p>
          )}
          {business.taxOrRegNumber && business.showTaxNumber !== false && (
            <p className="text-[10px] text-gray-500 mt-0.5">{business.taxOrRegNumber}</p>
          )}
          {business.receiptHeader && (
            <p className="text-[11px] font-bold text-gray-800 mt-0.5">{business.receiptHeader}</p>
          )}
        </div>

        {/* Double dashed separator */}
        <div className="border-t-2 border-dashed border-gray-900 my-2.5" />

        {/* Invoice Meta */}
        {(business.showDateTime !== false || business.showCashier !== false) && (
          <div className="text-[11px] text-gray-800 space-y-0.5">
            <div className="flex justify-between">
              <span className="font-semibold">
                {isReceiptEnglish ? 'Invoice:' : 'බිල්පත (Inv):'} {invoice.invoiceNumber}
              </span>
              {business.showDateTime !== false && <span>{invoice.date}</span>}
            </div>
            {business.showDateTime !== false && (
              <div className="flex justify-between text-gray-600">
                <span>{isReceiptEnglish ? 'Time:' : 'වේලාව (Time):'} {invoice.time}</span>
                {business.showCashier !== false && (
                  <span>{isReceiptEnglish ? 'Cashier:' : 'අයකැමි:'} {invoice.cashierName || 'Cashier 01'}</span>
                )}
              </div>
            )}
            {business.showDateTime === false && business.showCashier !== false && (
              <div className="flex justify-end text-gray-600"><span>{isReceiptEnglish ? 'Cashier:' : 'අයකැමි:'} {invoice.cashierName || 'Cashier 01'}</span></div>
            )}
          </div>
        )}

        {invoice.customerName && business.showCustomerInfo !== false && (
          <div className="flex justify-between pt-0.5 text-[11px] text-gray-800">
            <span className="font-medium text-gray-800">
              {isReceiptEnglish ? 'Customer:' : 'Customer:'} {invoice.customerName}
            </span>
            {invoice.customerPhone && (
              <span className="text-gray-600">{invoice.customerPhone}</span>
            )}
          </div>
        )}

        {/* Dashed separator */}
        <div className="border-t border-dashed border-gray-700 my-2" />

        {/* Items Table Header */}
        <div className="flex justify-between text-[11px] font-bold text-gray-900 pb-1">
          <span className="flex-1">{isReceiptEnglish ? 'ITEM' : 'භාණ්ඩය (ITEM)'}</span>
          <span className="w-16 text-center">{isReceiptEnglish ? 'QTY' : 'ප්‍රමාණය'}</span>
          <span className="w-20 text-right">{isReceiptEnglish ? 'AMOUNT' : 'මුදල'}</span>
        </div>
        <div className="border-t border-dashed border-gray-400 mb-2" />

        {/* Items List */}
        <div className="space-y-2 text-[11px] text-gray-900">
          {invoice.items.length === 0 ? (
            <p className="text-center text-gray-400 py-3 italic">{strings.emptyItems}</p>
          ) : (
            invoice.items.map((item, idx) => (
              <div key={item.id || idx} className="space-y-0.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold flex-1 min-w-0 pr-1 whitespace-normal break-words leading-snug">
                    {isReceiptEnglish
                      ? item.name
                      : item.sinhalaName && business.showItemSinhalaName !== false
                      ? `${item.sinhalaName} (${item.name})`
                      : item.name}
                  </span>
                  <span className="w-16 shrink-0 text-center text-gray-700">
                    {item.quantity} {item.unit}
                  </span>
                  <span className="w-20 text-right font-semibold">
                    {business.currencySymbol} {item.total.toFixed(2)}
                  </span>
                </div>
                {business.showItemBarcode !== false && item.barcode && (
                  <div className="text-[9px] text-gray-500 pl-2 tracking-wide">
                    Barcode: {item.barcode}
                  </div>
                )}
                {business.showItemUnitPrice !== false && (
                  <div className="text-[10px] text-gray-500 pl-2">
                    @ {business.currencySymbol} {item.price.toFixed(2)}
                    {item.discount > 0 && business.showDiscounts !== false && (
                      <span className="text-red-600 ml-1">
                        (-{item.discount}{item.discountType === 'percentage' ? '%' : ''} Off)
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Subtotal, Tax, Discounts */}
        <div className="space-y-1 text-[11px] text-gray-800">
          <div className="flex justify-between">
            <span>{isReceiptEnglish ? 'Subtotal:' : 'උප එකතුව (Subtotal):'}</span>
            <span>
              {business.currencySymbol} {invoice.subtotal.toFixed(2)}
            </span>
          </div>

          {invoice.discountTotal > 0 && business.showDiscounts !== false && (
            <div className="flex justify-between text-red-600">
              <span>{isReceiptEnglish ? 'Discount:' : 'මුළු වට්ටම (Discount):'}</span>
              <span>
                -{business.currencySymbol} {invoice.discountTotal.toFixed(2)}
              </span>
            </div>
          )}

          {invoice.taxAmount > 0 && business.showTax !== false && (
            <div className="flex justify-between text-gray-600">
              <span>{isReceiptEnglish ? `Tax (${invoice.taxRate}%):` : `බදු (Tax ${invoice.taxRate}%):`}</span>
              <span>
                {business.currencySymbol} {invoice.taxAmount.toFixed(2)}
              </span>
            </div>
          )}

          {invoice.serviceCharge > 0 && business.showTax !== false && (
            <div className="flex justify-between text-gray-600">
              <span>{isReceiptEnglish ? 'Service Charge:' : 'සේවා ගාස්තු (Service):'}</span>
              <span>
                {business.currencySymbol} {invoice.serviceCharge.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Double dashed separator before grand total */}
        <div className="border-t-2 border-dashed border-gray-900 my-2" />

        {/* Grand Total */}
        <div className="flex justify-between items-baseline text-base font-bold text-gray-950">
          <span>{isReceiptEnglish ? 'GRAND TOTAL:' : 'මුළු එකතුව:'}</span>
          <span>
            {business.currencySymbol} {invoice.grandTotal.toFixed(2)}
          </span>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Payment and Change */}
        {business.showPaymentDetails !== false && (
          <div className="text-[11px] text-gray-800 space-y-1">
            <div className="flex justify-between">
              <span className="capitalize">
                {isReceiptEnglish
                  ? `Payment (${invoice.paymentMethod}):`
                  : invoice.paymentMethod === 'cash'
                  ? 'මුදල් (Cash Given):'
                  : invoice.paymentMethod === 'card'
                  ? 'කාඩ්පත් (Card):'
                  : invoice.paymentMethod === 'transfer'
                  ? 'QR / බැංකු (Transfer):'
                  : 'ණය (Credit):'}
              </span>
              <span className="font-semibold">
                {business.currencySymbol} {invoice.paidAmount.toFixed(2)}
              </span>
            </div>

            {invoice.paidAmount > invoice.grandTotal ? (
              <div className="flex justify-between font-bold text-gray-950 text-xs">
                <span>Change:</span>
                <span>{business.currencySymbol} {(invoice.paidAmount - invoice.grandTotal).toFixed(2)}</span>
              </div>
            ) : invoice.grandTotal > invoice.paidAmount ? (
              <div className="flex justify-between font-bold text-gray-950 text-xs">
                <span>Balance Due:</span>
                <span>{business.currencySymbol} {(invoice.grandTotal - invoice.paidAmount).toFixed(2)}</span>
              </div>
            ) : null}
          </div>
        )}

        {invoice.notes && (
          <div className="mt-2 p-1.5 bg-gray-100 rounded text-[10px] text-gray-700 text-center italic">
            {invoice.notes}
          </div>
        )}

        {/* Warranty Policy */}
        {business.showWarrantyPolicy !== false && business.warrantyPolicyText && (
          <div className="mt-2 p-1.5 bg-amber-50/80 border border-amber-200/60 rounded text-[10px] text-gray-800 text-center font-medium">
            {business.warrantyPolicyText}
          </div>
        )}

        {/* QR Code Section */}
        {business.showQrCode && qrSrc && (
          <div className="mt-3 flex flex-col items-center justify-center">
            <img
              src={qrSrc}
              alt="Receipt QR Code"
              className="w-24 h-24 border border-gray-200 p-1"
            />
            <span className="text-[9px] text-gray-500 mt-0.5">
              LankaQR / Pay & Verify
            </span>
          </div>
        )}

        {/* Footer & Immutable Branding */}
        <div className="mt-3 pt-2 border-t border-dashed border-gray-600 text-center text-[10px] text-gray-800 space-y-0.5">
          {business.receiptFooter && <p className="font-bold">{business.receiptFooter}</p>}
          <p className="text-[9px] font-bold text-gray-900 tracking-wider">
            *** {POWERED_BY} ***
          </p>
        </div>

        {/* Bottom Serrated Paper Edge */}
        <div className="receipt-tear-bottom absolute -bottom-2 left-0" />
      </div>

      {/* Main Print CTA Button & WhatsApp Share */}
      <div className="w-full max-w-sm mt-4 space-y-2">
        {/* WhatsApp Sharing Button */}
        <button
          id="btn-whatsapp-share-bottom"
          onClick={() => {
            setIsWhatsAppOpen(true);
            if (soundEnabled) soundEffects.playBeep(700, 0.05);
          }}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition active:scale-[0.98]"
        >
          <MessageSquare className="w-4 h-4 text-white" />
          <span>{isReceiptEnglish ? 'Send Bill via WhatsApp' : 'බිල්පත WhatsApp මඟින් යවන්න'}</span>
        </button>

        <button
          id="btn-print-bluetooth"
          onClick={handleBluetoothPrint}
          disabled={isPrinting || invoice.items.length === 0}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] ${
            isPrinting
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : btState.isConnected
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-600/30'
          }`}
        >
          {isPrinting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{strings.printingInProgress}</span>
            </>
          ) : btState.isConnected ? (
            <>
              <Printer className="w-5 h-5" />
              <span>{strings.printInvoice}</span>
            </>
          ) : (
            <>
              <Bluetooth className="w-5 h-5" />
              <span>{strings.connectPrinter}</span>
            </>
          )}
        </button>

        {/* Sub-actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCustomizerOpen(true)}
            className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isReceiptEnglish ? 'Receipt Settings' : 'බිල්පත් සැකසුම්'}</span>
          </button>

          <button
            onClick={handleSystemPrint}
            className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>{strings.systemPrint}</span>
          </button>

          <button
            onClick={onOpenPrinterModal}
            className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5"
            title="Printer Diagnostics"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>{strings.testPrint}</span>
          </button>
        </div>

        {/* Bluetooth notice */}
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <p>{strings.sinhalaPrintModeNote}</p>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppShareModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        invoice={invoice}
        business={business}
        lang={lang}
        soundEnabled={soundEnabled}
      />

      {/* Customizer Modal */}
      {onUpdateBusiness && (
        <ReceiptCustomizerModal
          isOpen={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          business={business}
          setBusiness={onUpdateBusiness}
          soundEnabled={soundEnabled}
          onSuccessToast={(msg) => {
            if (soundEnabled) soundEffects.playSuccess();
          }}
        />
      )}
    </div>
  );
};
