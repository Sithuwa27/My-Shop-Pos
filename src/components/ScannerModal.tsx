import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, Scan, Keyboard, CheckCircle2, Barcode, QrCode } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';
import { storage } from '../services/storage';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
  soundEnabled?: boolean;
  appName?: string;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'QR / Barcode Scanner',
  subtitle = 'Point the camera at the QR code or barcode',
  soundEnabled = true,
  appName = storage.getBusinessProfile().appName || storage.getBusinessProfile().name || 'POS',
}) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'barcode' | 'qr'>('barcode');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanHandledRef = useRef(false);
  const html5QrCodeId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        setErrorMessage(null);
        setLastScanned(null);
        scanHandledRef.current = false;

        // Wait for the modal DOM to mount before creating the scanner.
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!isMounted) return;

        const scanner = new Html5Qrcode(html5QrCodeId, {
          // Barcode is the primary POS workflow. Keeping QR out of the
          // default decoder makes EAN/UPC/Code128 detection faster and more
          // reliable. QR can still be selected with the mode button below.
          formatsToSupport: scanMode === 'barcode'
            ? [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.ITF,
              ]
            : [Html5QrcodeSupportedFormats.QR_CODE],
          // Chrome/Android can use the native BarcodeDetector when available,
          // which makes QR/barcode detection noticeably faster.
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });

        scannerRef.current = scanner;
        setIsScanning(true);

        // Do not use a small square crop: EAN/UPC/Code128 barcodes are often
        // wide, while QR codes are square. A function lets html5-qrcode choose
        // a safe scan area for both types on phone screens.
        const config = {
          // Barcode-first scanning: a wider crop matches EAN/UPC/Code128 labels
          // and avoids wasting decode work on the unused parts of the camera frame.
          fps: scanMode === 'barcode' ? 24 : 18,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            if (scanMode === 'barcode') {
              const width = Math.floor(Math.min(viewfinderWidth * 0.92, 560));
              const height = Math.floor(Math.min(viewfinderHeight * 0.30, 170));
              return { width, height };
            }
            const size = Math.floor(Math.min(viewfinderWidth * 0.72, viewfinderHeight * 0.58, 360));
            return { width: size, height: size };
          },
          aspectRatio: 1.7777778,
          disableFlip: false,
          // 1280x720 is usually a better mobile scanning sweet spot than 1080p:
          // enough detail for retail barcodes while reducing autofocus/CPU lag.
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
            advanced: [{ focusMode: 'continuous' }, { zoom: 1.0 }],
          } as MediaTrackConstraints,
        };

        // Prefer the environment/rear camera. The config also requests HD video
        // and continuous autofocus where the device/browser supports it.
        try {
          await scanner.start(
            { facingMode: { ideal: 'environment' } },
            config,
          async (decodedText) => {
            const code = decodedText.trim();
            if (!code || scanHandledRef.current) return;
            scanHandledRef.current = true;

            setLastScanned(code);
            if (soundEnabled) soundEffects.playBeep(900, 0.1);

            // Stop the camera first, then deliver the result. This avoids the
            // callback firing repeatedly while the item is being added.
            await stopScanner();
            if (!isMounted) return;
            onScan(code);
            onClose();
          },
          () => {
            // Per-frame decode failures are normal; keep scanning silently.
          }
        );
        } catch (environmentError) {
          // Fallback for browsers that do not accept exact facingMode.
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras.length) throw new Error('No camera found. Please allow camera permission.');
          const rearCamera = cameras.find((camera) => /back|rear|environment|world/i.test(camera.label || ''));
          const cameraId = rearCamera?.id || cameras[cameras.length - 1].id;
          await scanner.start(cameraId, config, async (decodedText) => {
            const code = decodedText.trim();
            if (!code || scanHandledRef.current) return;
            scanHandledRef.current = true;
            setLastScanned(code);
            if (soundEnabled) soundEffects.playBeep(900, 0.1);
            await stopScanner();
            if (!isMounted) return;
            onScan(code);
            onClose();
          }, () => {});
        }
      } catch (err: any) {
        console.warn('Camera scanner start error:', err);
        setErrorMessage(
          err?.message ||
            'Unable to start the camera. Check camera permission or enter the code below.'
        );
        setIsScanning(false);
      }
    };
    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen, scanMode]);

  const stopScanner = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
      scannerRef.current = null;
      setIsScanning(false);
    } catch (e) {
      // Ignore cleanup error
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    scanHandledRef.current = true;
    if (soundEnabled) soundEffects.playBeep(900, 0.1);
    const code = manualCode.trim();
    stopScanner();
    onScan(code);
    setManualCode('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[94vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
              <p className="text-[11px] text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scan mode: barcode is the fast/default POS mode */}
        <div className="px-3 pt-3 bg-slate-900">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { stopScanner(); setScanMode('barcode'); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition ${scanMode === 'barcode' ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
              <Barcode className="w-4 h-4" /> Barcode (Fast)
            </button>
            <button
              type="button"
              onClick={() => { stopScanner(); setScanMode('qr'); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition ${scanMode === 'qr' ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
              <QrCode className="w-4 h-4" /> QR
            </button>
          </div>
        </div>

        {/* Video Scanner Area */}
        <div className="relative bg-black h-[42vh] min-h-[260px] max-h-[400px] flex items-center justify-center overflow-hidden shrink-0">
          <div id={html5QrCodeId} className="w-full h-full" />

          {/* Scanner Overlay Sight Guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className={`${scanMode === 'barcode' ? 'w-[92%] h-[30%] max-w-[560px]' : 'w-[72%] h-[58%] max-w-[360px]'} border-2 border-dashed border-cyan-400/80 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />

              {/* Laser animation bar */}
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-bounce top-1/2 -translate-y-1/2 shadow-lg shadow-cyan-400/50" />
            </div>
          </div>

          {/* Error fallback display */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-950/90 p-5 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-xs text-slate-200 font-medium max-w-xs">{errorMessage}</p>
              <p className="text-[11px] text-cyan-300 mt-2">Use the Manual Code field below if camera scanning is unavailable.</p>
            </div>
          )}

          {lastScanned && (
            <div className="absolute top-3 inset-x-3 bg-emerald-500/90 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Scanned: {lastScanned}</span>
            </div>
          )}
        </div>

        {/* Manual Barcode Entry Fallback (or for hardware barcode scanners) */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Enter a code or use a USB/Bluetooth scanner:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                placeholder="e.g. 890123456001"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs transition"
              >
                Add Code
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
          <span>QR, EAN-13, EAN-8, Code 128, UPC</span>
          <span className="font-semibold text-slate-400">{appName}</span>
        </div>
      </div>
    </div>
  );
};
