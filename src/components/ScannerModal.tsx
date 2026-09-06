import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertCircle, Scan, Keyboard, CheckCircle2 } from 'lucide-react';
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

/**
 * Nano-style simple scanner.
 * Uses the same lightweight html5-qrcode setup as the nano repository:
 * CODE_128, CODE_39, EAN_13 and QR_CODE, rear camera, 20fps and 350x150 scan box.
 * Intentionally avoids custom focus/zoom/torch/video constraints because those
 * extra MediaStream controls were causing device/browser compatibility errors.
 */
export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'QR / Barcode Scanner',
  subtitle = 'Place the code inside the frame',
  soundEnabled = true,
  appName = storage.getBusinessProfile().appName || storage.getBusinessProfile().name || 'POS',
}) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const startTimerRef = useRef<number | null>(null);
  const readerId = 'nano-scanner-reader';

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) {
      setIsScanning(false);
      return;
    }

    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      // Camera may already have stopped; ignore cleanup errors.
    }

    try {
      scanner.clear();
    } catch {
      // Ignore cleanup errors.
    }

    setIsScanning(false);
  };

  useEffect(() => {
    if (!isOpen) {
      void stopScanner();
      return;
    }

    let active = true;

    const startScanner = async () => {
      try {
        setErrorMessage(null);
        setLastScanned(null);
        handledRef.current = false;

        // Let the modal render before html5-qrcode looks for the container.
        await new Promise<void>((resolve) => {
          startTimerRef.current = window.setTimeout(resolve, 300);
        });

        if (!active) return;

        const reader = document.getElementById(readerId);
        if (!reader) throw new Error('Scanner area is not ready.');

        // Prevent an old scanner instance from fighting with the new one.
        await stopScanner();

        const scanner = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        });

        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 20,
            qrbox: { width: 350, height: 150 },
          },
          async (decodedText) => {
            const code = decodedText.trim();
            if (!code || handledRef.current || !active) return;

            handledRef.current = true;
            setLastScanned(code);

            if (soundEnabled) {
              soundEffects.playBeep(900, 0.1);
            }

            await stopScanner();
            if (!active) return;

            onScan(code);
            onClose();
          },
          () => {
            // Decode failures are normal while the camera is searching.
          },
        );

        if (active) setIsScanning(true);
        else await stopScanner();
      } catch (err: any) {
        console.warn('Nano-style scanner start error:', err);
        await stopScanner();
        if (!active) return;

        setErrorMessage(
          err?.message ||
            'Unable to start the camera. Please allow camera permission or enter the code manually.',
        );
      }
    };

    void startScanner();

    return () => {
      active = false;
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      void stopScanner();
    };
  }, [isOpen]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code || handledRef.current) return;

    handledRef.current = true;
    if (soundEnabled) soundEffects.playBeep(900, 0.1);

    await stopScanner();
    onScan(code);
    setManualCode('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <Scan className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void stopScanner();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
            aria-label="Close scanner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative h-[52vh] min-h-[300px] max-h-[520px] overflow-hidden bg-black">
          <div id={readerId} className="h-full w-full" />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[150px] w-[350px] max-w-[88%] rounded-2xl border-2 border-cyan-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]">
              <div className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-cyan-300" />
              <div className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-cyan-300" />
              <div className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-cyan-300" />
              <div className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-cyan-300" />
              <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-cyan-300/80" />
            </div>
          </div>

          {isScanning && !errorMessage && (
            <div className="pointer-events-none absolute bottom-3 inset-x-0 flex justify-center">
              <div className="rounded-full bg-black/65 px-3 py-1.5 text-[10px] text-white/80">
                Keep the barcode inside the box
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
              <AlertCircle className="mb-2 h-10 w-10 text-amber-400" />
              <p className="max-w-xs text-xs font-medium text-slate-200">{errorMessage}</p>
              <p className="mt-2 text-[11px] text-slate-400">Allow camera access and try again, or enter the code below.</p>
            </div>
          )}

          {lastScanned && (
            <div className="absolute left-3 right-3 top-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-slate-950">
              <CheckCircle2 className="h-4 w-4" />
              Scanned: {lastScanned}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 bg-slate-900 p-3">
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Keyboard className="h-3.5 w-3.5 text-cyan-400" />
              <span>Manual code / USB / Bluetooth scanner</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter barcode"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-100 outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-4 py-2.5 text-[10px] text-slate-500">
          <span>EAN-13 • Code 128 • Code 39 • QR</span>
          <span className="font-semibold text-slate-400">{appName}</span>
        </div>
      </div>
    </div>
  );
};
