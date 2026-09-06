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
  RefreshCw,
  Minus,
  Plus,
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

type LabelSize = 'small' | 'medium' | 'large';

const CODE128_PATTERNS = ["BaBbBb","BbBaBb","BbBbBa","AbAbBc","AbAcBb","AcAbBb","AbBbAc","AbBcAb","AcBbAb","BbAbAc","BbAcAb","BcAbAb","AaBbCb","AbBaCb","AbBbCa","AaCbBb","AbCaBb","AbCbBa","BbCbAa","BbAaCb","BbAbCa","BaCbAb","BbCaAb","CaBaCa","CaAbBb","CbAaBb","CbAbBa","CaBbAb","CbBaAb","CbBbAa","BaBaBc","BaBcBa","BcBaBa","AaAcBc","AcAaBc","AcAcBa","AaBcAc","AcBaAc","AcBcAa","BaAcAc","BcAaAc","BcAcAa","AaBaCc","AaBcCa","AcBaCa","AaCaBc","AaCcBa","AcCaBa","CaCaBa","BaAcCa","BcAaCa","BaCaAc","BaCcAa","BaCaCa","CaAaBc","CaAcBa","CcAaBa","CaBaAc","CaBcAa","CcBaAa","CaDaAa","BbAdAa","DcAaAa","AaAbBd","AaAdBb","AbAaBd","AbAdBa","AdAaBb","AdAbBa","AaBbAd","AaBdAb","AbBaAd","AbBdAa","AdBaAb","AdBbAa","BdAbAa","BbAaAd","DaCaAa","BdAaAb","AcDaAa","AaAbDb","AbAaDb","AbAbDa","AaDbAb","AbDaAb","AbDbAa","DaAbAb","DbAaAb","DbAbAa","BaBaDa","BaDaBa","DaBaBa","AaAaDc","AaAcDa","AcAaDa","AaDaAc","AaDcAa","DaAaAc","DaAcAa","AaCaDa","AaDaCa","CaAaDa","DaAaCa","BaAdAb","BaAbAd","BaAbCb","BcCaAaB"];

const createBarcodeCanvas = (value: string, width: number, height: number, barHeight: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const codes = [104];
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error('Barcode supports printable ASCII characters only.');
    codes.push(code - 32);
  }
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  codes.push(checksum % 103);
  codes.push(106);

  const widthFor = (ch: string) => ch.toUpperCase() === 'A' ? 1 : ch.toUpperCase() === 'B' ? 2 : ch.toUpperCase() === 'C' ? 3 : 4;
  const moduleCount = codes.reduce((sum, code) => sum + [...CODE128_PATTERNS[code]].reduce((n, ch) => n + widthFor(ch), 0), 0);
  const quietModules = 10;
  const moduleWidth = Math.max(1, Math.floor(canvas.width / (moduleCount + quietModules * 2)));
  const actualWidth = (moduleCount + quietModules * 2) * moduleWidth;
  const left = Math.max(0, Math.floor((canvas.width - actualWidth) / 2));
  const barTop = 8;
  let x = left + quietModules * moduleWidth;
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
  ctx.font = `${Math.max(12, Math.round(canvas.width / 22))}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(value, canvas.width / 2, Math.min(canvas.height - 8, barTop + barHeight + 28));
  return canvas;
};

const randomCode = (type: CodeType) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  const suffix = Array.from(bytes, b => chars[b % chars.length]).join('');
  return type === 'barcode' ? `ACC-${suffix}` : `https://shop.local/item/${suffix}`;
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
  const [quantity, setQuantity] = useState(1);
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [twoAcross, setTwoAcross] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const paperWidth = business.paperWidth === '58mm' ? 384 : 576;
  const columns = business.paperWidth === '80mm' && twoAcross ? 2 : 1;
  const labelWidth = Math.floor(paperWidth / columns);
  const sizeScale = labelSize === 'small' ? 0.68 : labelSize === 'large' ? 0.94 : 0.82;

  useEffect(() => {
    if (!isOpen) return;
    setStatus(null);
    setGeneratedValue('');
    setPreviewUrl('');
    canvasRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (business.paperWidth === '58mm') setTwoAcross(false);
  }, [business.paperWidth]);

  const buildSingleLabel = async (raw: string): Promise<HTMLCanvasElement> => {
    const qrSize = Math.max(120, Math.round(labelWidth * sizeScale));
    const barcodeWidth = Math.max(120, Math.round(labelWidth * sizeScale));
    const codeHeight = codeType === 'qr'
      ? Math.round(qrSize + 48)
      : Math.round(28 + 112 * (labelSize === 'small' ? 0.75 : labelSize === 'large' ? 1.2 : 1));
    const canvas = document.createElement('canvas');
    canvas.width = labelWidth;
    canvas.height = codeHeight + 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (codeType === 'qr') {
      const qr = await QRCode.toDataURL(raw, {
        width: qrSize,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('QR generation failed.'));
        img.src = qr;
      });
      const x = Math.floor((canvas.width - qrSize) / 2);
      ctx.drawImage(img, x, 8, qrSize, qrSize);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.max(12, Math.round(labelWidth / 23))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(raw.slice(0, 34), canvas.width / 2, qrSize + 30);
    } else {
      const barHeight = Math.round(112 * (labelSize === 'small' ? 0.75 : labelSize === 'large' ? 1.2 : 1));
      const barcodeCanvas = createBarcodeCanvas(raw, barcodeWidth, codeHeight, barHeight);
      ctx.drawImage(barcodeCanvas, Math.floor((canvas.width - barcodeWidth) / 2), 0, barcodeWidth, codeHeight);
    }
    return canvas;
  };

  const buildPrintSheet = async (raw: string): Promise<HTMLCanvasElement> => {
    const single = await buildSingleLabel(raw);
    const rows = Math.ceil(quantity / columns);
    const gap = columns === 2 ? 2 : 0;
    const sheet = document.createElement('canvas');
    sheet.width = paperWidth;
    sheet.height = single.height * rows + Math.max(0, rows - 1) * gap;
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    for (let i = 0; i < quantity; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      ctx.drawImage(single, col * labelWidth, row * (single.height + gap));
    }
    return sheet;
  };

  const generate = async () => {
    const raw = value.trim();
    if (!raw) {
      setStatus('Enter a value or use Random Code.');
      return;
    }
    try {
      setStatus(null);
      const sheet = await buildPrintSheet(raw);
      canvasRef.current = sheet;
      setGeneratedValue(raw);
      setPreviewUrl(sheet.toDataURL('image/png'));
      if (soundEnabled) soundEffects.playBeep(850, 0.08);
    } catch (err: any) {
      setStatus(err?.message || 'Could not generate the code.');
      canvasRef.current = null;
      setPreviewUrl('');
    }
  };

  const generateRandom = () => {
    const next = randomCode(codeType);
    setValue(next);
    setStatus('Random code generated. Press Generate to preview it.');
  };

  const changeType = (type: CodeType) => {
    setCodeType(type);
    setValue('');
    setGeneratedValue('');
    setPreviewUrl('');
    canvasRef.current = null;
    setStatus(null);
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
    setStatus(`Printing ${quantity} ${codeType === 'qr' ? 'QR' : 'barcode'} label${quantity > 1 ? 's' : ''}...`);
    try {
      const printBusiness = { ...business, openDrawer: false };
      const bytes = canvasToEscPosBytes(canvasRef.current, printBusiness);
      await bluetoothPrinter.printBytes(bytes);
      setStatus(`Printed ${quantity} label${quantity > 1 ? 's' : ''} successfully.`);
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
    a.download = `${codeType === 'qr' ? 'QR' : 'Barcode'}_${generatedValue.slice(0, 24)}_${quantity}x.png`;
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
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 p-2 sm:p-5">
        <div className="mx-auto my-2 w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                {codeType === 'qr' ? <QrCode className="h-5 w-5" /> : <Barcode className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-base font-black text-white">QR / Barcode Generator</h3>
                <p className="text-[11px] text-slate-400">Create labels, choose size, copies and print.</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[1fr_1.05fr]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => changeType('barcode')} className={`rounded-2xl border p-3 text-left ${codeType === 'barcode' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                  <Barcode className="mb-1 h-5 w-5" />
                  <div className="text-xs font-black">Barcode</div>
                  <div className="text-[10px] opacity-70">CODE 128</div>
                </button>
                <button onClick={() => changeType('qr')} className={`rounded-2xl border p-3 text-left ${codeType === 'qr' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                  <QrCode className="mb-1 h-5 w-5" />
                  <div className="text-xs font-black">QR Code</div>
                  <div className="text-[10px] opacity-70">Text / URL / ID</div>
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-400">{codeType === 'qr' ? 'QR content' : 'Barcode value'}</label>
                <textarea value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void generate(); }} rows={codeType === 'qr' ? 4 : 2} placeholder={codeType === 'qr' ? 'https://example.com/product/123' : '890123456001'} className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-mono text-white outline-none focus:border-cyan-500" />
              </div>

              <button onClick={generateRandom} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-700 bg-cyan-500/10 px-4 py-3 text-xs font-black text-cyan-300 hover:bg-cyan-500/20">
                <RefreshCw className="h-4 w-4" /> Generate Random {codeType === 'qr' ? 'QR Value' : 'Barcode Value'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-800 p-3">
                  <label className="mb-2 block text-[11px] font-bold text-slate-400">Copies / Quantity</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700 text-white"><Minus className="h-4 w-4" /></button>
                    <input type="number" min={1} max={100} value={quantity} onChange={e => setQuantity(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 text-center text-sm font-black text-white outline-none" />
                    <button onClick={() => setQuantity(q => Math.min(100, q + 1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700 text-white"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-800 p-3">
                  <label className="mb-2 block text-[11px] font-bold text-slate-400">Label Size</label>
                  <select value={labelSize} onChange={e => setLabelSize(e.target.value as LabelSize)} className="h-10 w-full rounded-xl border border-slate-600 bg-slate-950 px-2 text-xs font-bold text-white outline-none">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              {business.paperWidth === '80mm' && (
                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-700 bg-slate-800 p-3">
                  <div>
                    <div className="text-xs font-black text-white">80mm: 2 labels across</div>
                    <div className="text-[10px] text-slate-400">Print two QR/barcodes side-by-side on the roll.</div>
                  </div>
                  <input type="checkbox" checked={twoAcross} onChange={e => setTwoAcross(e.target.checked)} className="h-5 w-5 accent-cyan-500" />
                </label>
              )}

              <button onClick={() => void generate()} className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-xs font-black text-white hover:bg-cyan-500">
                Generate {codeType === 'qr' ? 'QR Code' : 'Barcode'} × {quantity}
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preview · {business.paperWidth} · {columns} across · {quantity} copies</span>
                {generatedValue && <button onClick={() => void copyValue()} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-300"><Copy className="h-3 w-3" /> Copy</button>}
              </div>
              <div className="flex max-h-[58vh] min-h-[280px] items-start justify-center overflow-auto rounded-2xl bg-white p-2">
                {previewUrl ? <img src={previewUrl} alt={codeType === 'qr' ? 'Generated QR code labels' : 'Generated barcode labels'} className="h-auto w-full object-contain" /> : <div className="my-auto py-24 text-center text-xs text-slate-400"><QrCode className="mx-auto mb-2 h-10 w-10 opacity-30" />Generate a code to preview it here.</div>}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button disabled={!previewUrl || isPrinting} onClick={() => void printBluetooth()} className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 py-2.5 text-[10px] font-black text-white disabled:opacity-40"><Bluetooth className="h-4 w-4" /> Bluetooth</button>
                <button disabled={!previewUrl} onClick={printSystem} className="flex items-center justify-center gap-1 rounded-xl bg-slate-800 px-2 py-2.5 text-[10px] font-black text-white disabled:opacity-40"><Printer className="h-4 w-4" /> System Print</button>
                <button disabled={!previewUrl} onClick={download} className="flex items-center justify-center gap-1 rounded-xl bg-slate-800 px-2 py-2.5 text-[10px] font-black text-white disabled:opacity-40"><Download className="h-4 w-4" /> PNG</button>
              </div>
              {btState.isConnected && <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-emerald-400"><Check className="h-3 w-3" /> {btState.deviceName || 'Bluetooth printer connected'}</div>}
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
