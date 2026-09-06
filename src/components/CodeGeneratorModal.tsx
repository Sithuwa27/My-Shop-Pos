import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Barcode,
  Check,
  Copy,
  Download,
  Printer,
  QrCode,
  X,
  Bluetooth,
  AlertCircle,
} from 'lucide-react';
import { BusinessProfile, BluetoothDeviceState } from '../types';
import { bluetoothPrinter } from '../services/bluetoothPrinter';
import { canvasToEscPosBytes } from '../services/receiptCanvas';
import { soundEffects } from '../services/soundEffects';

interface CodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: BusinessProfile;
  btState: BluetoothDeviceState;
  soundEnabled?: boolean;
}

type CodeType = 'qr' | 'barcode';

const CODE128_PATTERNS = ["BaBbBb","BbBaBb","BbBbBa","AbAbBc","AbAcBb","AcAbBb","AbBbAc","AbBcAb","AcBbAb","BbAbAc","BbAcAb","BcAbAb","AaBbCb","AbBaCb","AbBbCa","AaCbBb","AbCaBb","AbCbBa","BbCbAa","BbAaCb","BbAbCa","BaCbAb","BbCaAb","CaBaCa","CaAbBb","CbAaBb","CbAbBa","CaBbAb","CbBaAb","CbBbAa","BaBaBc","BaBcBa","BcBaBa","AaAcBc","AcAaBc","AcAcBa","AaBcAc","AcBaAc","AcBcAa","BaAcAc","BcAaAc","BcAcAa","AaBaCc","AaBcCa","AcBaCa","AaCaBc","AaCcBa","AcCaBa","CaCaBa","BaAcCa","BcAaCa","BaCaAc","BaCcAa","BaCaCa","CaAaBc","CaAcBa","CcAaBa","CaBaAc","CaBcAa","CcBaAa","CaDaAa","BbAdAa","DcAaAa","AaAbBd","AaAdBb","AbAaBd","AbAdBa","AdAaBb","AdAbBa","AaBbAd","AaBdAb","AbBaAd","AbBdAa","AdBaAb","AdBbAa","BdAbAa","BbAaAd","DaCaAa","BdAaAb","AcDaAa","AaAbDb","AbAaDb","AbAbDa","AaDbAb","AbDaAb","AbDbAa","DaAbAb","DbAaAb","DbAbAa","BaBaDa","BaDaBa","DaBaBa","AaAaDc","AaAcDa","AcAaDa","AaDaAc","AaDcAa","DaAaAc","DaAcAa","AaCaDa","AaDaCa","CaAaDa","DaAaCa","BaAdAb","BaAbAd","BaAbCb","BcCaAaB"];

const createBarcodeCanvas = (value: string, width: number, height = 220): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  const codes = [104]; // Code 128-B start
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) {
      throw new Error('Barcode supports printable ASCII characters only.');
    }
    codes.push(code - 32);
  }

  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  codes.push(checksum % 103);
  codes.push(106); // stop

  // Each pattern letter represents a width of 1..4 modules (A=1, B=2, C=3, D=4).
  const widthFor = (ch: string) => ch.toUpperCase() === 'A' ? 1 : ch.toUpperCase() === 'B' ? 2 : ch.toUpperCase() === 'C' ? 3 : 4;
  const moduleCount = codes.reduce((sum, code) => {
    return sum + [...CODE128_PATTERNS[code]].reduce((n, ch) => n + widthFor(ch), 0);
  }, 0);

  const quiet = 20;
  const moduleWidth = Math.max(1, Math.floor((width - quiet * 2) / (moduleCount + 20)));
  const actualWidth = (moduleCount + 20) * moduleWidth;
  const left = Math.max(0, Math.floor((width - actualWidth) / 2));
  const barTop = 12;
  const barHeight = 148;
  let x = left + quiet * moduleWidth;
  let black = true;

  ctx.fillStyle = '#000';
  for (const code of codes) {
    for (const ch of CODE128_PATTERNS[code]) {
      const w = widthFor(ch) * moduleWidth;
      if (black) ctx.fillRect(x, barTop, w, barHeight);
      x += w;
      black = !black;
    }
  }

  ctx.font = '18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(value, width / 2, 190);
  return canvas;
};

export const CodeGeneratorModal: React.FC<CodeGeneratorModalProps> = ({
  isOpen,
  onClose,
  business,
  btState,
  soundEnabled = true,
}) => {
  const [codeType, setCodeType] = useState<CodeType>('barcode');
  const [value, setValue] = useState('');
  const [generatedValue, setGeneratedValue] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const width = business.paperWidth === '58mm' ? 384 : 576;

  useEffect(() => {
    if (!isOpen) return;
    setStatus(null);
    setGeneratedValue('');
    setPreviewUrl('');
    canvasRef.current = null;
  }, [isOpen]);

  const generate = async () => {
    const raw = value.trim();
    if (!raw) {
      setStatus('Enter text, number, URL or product code first.');
      return;
    }

    try {
      setStatus(null);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = codeType === 'qr' ? 430 : 230;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not supported.');

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (codeType === 'qr') {
        const qr = await QRCode.toDataURL(raw, {
          width: 320,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('QR generation failed.'));
          img.src = qr;
        });
        ctx.drawImage(img, (width - 320) / 2, 18, 320, 320);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(raw.slice(0, 42), width / 2, 375);
      } else {
        const barcodeCanvas = await createBarcodeCanvas(raw, width, 220);
        ctx.drawImage(barcodeCanvas, 0, 0, width, 220);
      }

      canvasRef.current = canvas;
      setGeneratedValue(raw);
      setPreviewUrl(canvas.toDataURL('image/png'));
      if (soundEnabled) soundEffects.playBeep(850, 0.08);
    } catch (err: any) {
      setStatus(err?.message || 'Could not generate the code.');
      canvasRef.current = null;
      setPreviewUrl('');
    }
  };

  const printBluetooth = async () => {
    if (!canvasRef.current) {
      setStatus('Generate the code before printing.');
      return;
    }
    if (!btState.isConnected) {
      setStatus('Bluetooth printer is not connected. Connect it from Printer Settings.');
      return;
    }

    setIsPrinting(true);
    setStatus('Printing...');
    try {
      const printBusiness = { ...business, openDrawer: false };
      const bytes = canvasToEscPosBytes(canvasRef.current, printBusiness);
      await bluetoothPrinter.printBytes(bytes);
      setStatus('Printed successfully.');
      if (soundEnabled) soundEffects.playBeep(900, 0.18);
    } catch (err: any) {
      setStatus(err?.message || 'Bluetooth printing failed.');
    } finally {
      setIsPrinting(false);
    }
  };

  const printSystem = () => {
    if (!previewUrl) {
      setStatus('Generate the code before printing.');
      return;
    }
    window.print();
  };

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `${codeType === 'qr' ? 'QR' : 'Barcode'}_${generatedValue.slice(0, 24)}.png`;
    a.click();
    if (soundEnabled) soundEffects.playBeep(700, 0.08);
  };

  const copyValue = async () => {
    if (!generatedValue) return;
    try {
      await navigator.clipboard.writeText(generatedValue);
      setStatus('Code value copied.');
    } catch {
      setStatus('Copy failed.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-5">
        <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                {codeType === 'qr' ? <QrCode className="h-5 w-5" /> : <Barcode className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-base font-black text-white">QR / Barcode Generator</h3>
                <p className="text-[11px] text-slate-400">Generate a code separately and print it as a label.</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.05fr]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCodeType('barcode')}
                  className={`rounded-2xl border p-3 text-left ${codeType === 'barcode' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
                >
                  <Barcode className="mb-1 h-5 w-5" />
                  <div className="text-xs font-black">Barcode</div>
                  <div className="text-[10px] opacity-70">CODE 128</div>
                </button>
                <button
                  onClick={() => setCodeType('qr')}
                  className={`rounded-2xl border p-3 text-left ${codeType === 'qr' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
                >
                  <QrCode className="mb-1 h-5 w-5" />
                  <div className="text-xs font-black">QR Code</div>
                  <div className="text-[10px] opacity-70">Text / URL / ID</div>
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-400">
                  {codeType === 'qr' ? 'QR content' : 'Barcode value'}
                </label>
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void generate();
                  }}
                  rows={codeType === 'qr' ? 5 : 2}
                  placeholder={codeType === 'qr' ? 'https://example.com/product/123' : '890123456001'}
                  className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-mono text-white outline-none focus:border-cyan-500"
                />
              </div>

              <button onClick={() => void generate()} className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-xs font-black text-white hover:bg-cyan-500">
                Generate {codeType === 'qr' ? 'QR Code' : 'Barcode'}
              </button>

              {status && (
                <div className="flex items-start gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-3 text-[11px] text-slate-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                  <span>{status}</span>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preview</span>
                {generatedValue && (
                  <button onClick={() => void copyValue()} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                )}
              </div>
              <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
                {previewUrl ? (
                  <img src={previewUrl} alt={codeType === 'qr' ? 'Generated QR code' : 'Generated barcode'} className="max-h-[390px] w-full object-contain" />
                ) : (
                  <div className="text-center text-xs text-slate-400">
                    <QrCode className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    Generate a code to preview it here.
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button disabled={!previewUrl || isPrinting} onClick={() => void printBluetooth()} className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 py-2.5 text-[10px] font-black text-white disabled:opacity-40">
                  <Bluetooth className="h-4 w-4" /> Bluetooth
                </button>
                <button disabled={!previewUrl} onClick={printSystem} className="flex items-center justify-center gap-1 rounded-xl bg-slate-800 px-2 py-2.5 text-[10px] font-black text-white disabled:opacity-40">
                  <Printer className="h-4 w-4" /> System Print
                </button>
                <button disabled={!previewUrl} onClick={download} className="flex items-center justify-center gap-1 rounded-xl bg-slate-800 px-2 py-2.5 text-[10px] font-black text-white disabled:opacity-40">
                  <Download className="h-4 w-4" /> PNG
                </button>
              </div>
              {btState.isConnected && (
                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-emerald-400">
                  <Check className="h-3 w-3" /> {btState.deviceName || 'Bluetooth printer connected'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div id="barcode-print-sheet" className="hidden" style={{ '--code-paper-width': business.paperWidth } as React.CSSProperties}>
        {previewUrl && <img src={previewUrl} alt="" />}
      </div>
    </>
  );
};
