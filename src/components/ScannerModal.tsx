import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { AlertCircle, Barcode, CheckCircle2, Keyboard, QrCode, Scan, X } from 'lucide-react';
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

type ScanMode = 'barcode' | 'qr';

type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  focusMode?: string[];
};

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'QR / Barcode Scanner',
  subtitle = 'Keep the code inside the frame and hold the phone steady',
  soundEnabled = true,
  appName = storage.getBusinessProfile().appName || storage.getBusinessProfile().name || 'POS',
}) => {
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('barcode');
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(1);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanHandledRef = useRef(false);
  const stoppingRef = useRef(false);
  const html5QrCodeId = 'qr-reader-container';

  const stopScanner = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    const scanner = scannerRef.current;
    scannerRef.current = null;

    try {
      if (scanner?.isScanning) await scanner.stop();
      try {
        scanner?.clear();
      } catch {
        // The scanner DOM may already have been removed during modal cleanup.
      }
    } catch {
      // Ignore camera cleanup errors.
    } finally {
      videoRef.current = null;
      setIsScanning(false);
      stoppingRef.current = false;
    }
  };

  const tuneCamera = async () => {
    const video = document.querySelector(`#${html5QrCodeId} video`) as HTMLVideoElement | null;
    videoRef.current = video;

    const stream = video?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;

    try {
      const capabilities = track.getCapabilities?.() as CameraCapabilities | undefined;
      const advanced: MediaTrackConstraintSet[] = [];

      if (capabilities?.focusMode?.includes?.('continuous')) {
        advanced.push({ focusMode: 'continuous' } as MediaTrackConstraintSet);
      }

      if (capabilities?.zoom) {
        const safeZoom = Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, zoom));
        advanced.push({ zoom: safeZoom } as MediaTrackConstraintSet);
      }

      if (capabilities?.torch) {
        advanced.push({ torch: torchOn } as MediaTrackConstraintSet);
      }

      if (advanced.length) await track.applyConstraints({ advanced });
    } catch {
      // Focus/zoom/torch are optional and vary by device/browser.
    }
  };

  useEffect(() => {
    if (!isOpen) {
      void stopScanner();
      return;
    }

    let isMounted = true;

    const handleDecoded = async (decodedText: string) => {
      const code = decodedText.trim();
      if (!code || scanHandledRef.current) return;

      scanHandledRef.current = true;
      setLastScanned(code);
      if (soundEnabled) soundEffects.playBeep(900, 0.1);

      await stopScanner();
      if (!isMounted) return;

      onScan(code);
      onClose();
    };

    const startScanner = async () => {
      try {
        setErrorMessage(null);
        setLastScanned(null);
        scanHandledRef.current = false;
        setTorchOn(false);
        setZoom(1);

        // Wait until the modal and scanner container are present in the DOM.
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        if (!isMounted) return;

        const scanner = new Html5Qrcode(html5QrCodeId, {
          // POS work is normally barcode-heavy, so decode only the formats needed
          // for the selected mode. This reduces decoder work and improves speed.
          formatsToSupport:
            scanMode === 'barcode'
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
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });

        scannerRef.current = scanner;

        const config = {
          // A moderate FPS is faster overall on many phones because decoding
          // does not compete as aggressively with autofocus and camera preview.
          fps: scanMode === 'barcode' ? 18 : 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            if (scanMode === 'barcode') {
              const width = Math.floor(Math.min(viewfinderWidth * 0.92, 560));
              const height = Math.floor(Math.min(viewfinderHeight * 0.34, 180));
              return { width, height };
            }

            const size = Math.floor(
              Math.min(viewfinderWidth * 0.72, viewfinderHeight * 0.68, 360)
            );
            return { width: size, height: size };
          },
          disableFlip: false,
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            // 720p is a reliable mobile sweet spot: enough barcode detail with
            // less autofocus/CPU delay than forcing 1080p on every device.
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, max: 30 },
          } as MediaTrackConstraints,
        };

        try {
          await scanner.start(
            { facingMode: { ideal: 'environment' } },
            config,
            handleDecoded,
            () => {
              // Decode failures on individual frames are normal.
            }
          );
        } catch {
          // Fallback for browsers/PWAs that do not reliably honor facingMode.
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras.length) {
            throw new Error('No camera found. Please allow camera permission.');
          }

          const rearCamera = cameras.find((camera) =>
            /back|rear|environment|world/i.test(camera.label || '')
          );
          const cameraId = rearCamera?.id || cameras[cameras.length - 1].id;

          await scanner.start(cameraId, config, handleDecoded, () => {
            // Keep scanning silently.
          });
        }

        if (!isMounted) {
          await stopScanner();
          return;
        }

        setIsScanning(true);
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        await tuneCamera();
      } catch (err: unknown) {
        console.warn('Camera scanner start error:', err);
        const message = err instanceof Error ? err.message : '';
        setErrorMessage(
          message || 'Unable to start the camera. Check camera permission or enter the code below.'
        );
        setIsScanning(false);
      }
    };

    void startScanner();

    return () => {
      isMounted = false;
      void stopScanner();
    };
  }, [isOpen, scanMode]);

  useEffect(() => {
    if (!isOpen || !isScanning) return;
    const timer = window.setTimeout(() => {
      void tuneCamera();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [torchOn, zoom, isOpen, isScanning]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    scanHandledRef.current = true;
    if (soundEnabled) soundEffects.playBeep(900, 0.1);

    const code = manualCode.trim();
    void stopScanner();
    onScan(code);
    setManualCode('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[94vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
              <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void stopScanner();
              onClose();
            }}
            className="w-8 h-8 shrink-0 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pt-3 bg-slate-900">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (scanMode !== 'barcode') {
                  void stopScanner();
                  setScanMode('barcode');
                }
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition ${
                scanMode === 'barcode'
                  ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300 shadow-sm'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Barcode className="w-4 h-4" /> Barcode (Fast)
            </button>
            <button
              type="button"
              onClick={() => {
                if (scanMode !== 'qr') {
                  void stopScanner();
                  setScanMode('qr');
                }
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition ${
                scanMode === 'qr'
                  ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300 shadow-sm'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4" /> QR
            </button>
          </div>
        </div>

        <div className="relative bg-black h-[42vh] min-h-[260px] max-h-[410px] flex items-center justify-center overflow-hidden shrink-0 mt-3">
          <div id={html5QrCodeId} className="w-full h-full" />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/30" />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3">
            <div
              className={`${
                scanMode === 'barcode'
                  ? 'w-[92%] h-[34%] max-w-[560px] max-h-[180px]'
                  : 'w-[72%] aspect-square max-w-[360px]'
              } border border-cyan-300/70 rounded-2xl relative shadow-[0_0_0_999px_rgba(0,0,0,0.20)]`}
            >
              <div className="absolute -top-px -left-px w-7 h-7 border-t-[3px] border-l-[3px] border-cyan-300 rounded-tl-xl" />
              <div className="absolute -top-px -right-px w-7 h-7 border-t-[3px] border-r-[3px] border-cyan-300 rounded-tr-xl" />
              <div className="absolute -bottom-px -left-px w-7 h-7 border-b-[3px] border-l-[3px] border-cyan-300 rounded-bl-xl" />
              <div className="absolute -bottom-px -right-px w-7 h-7 border-b-[3px] border-r-[3px] border-cyan-300 rounded-br-xl" />
              <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_10px_rgba(103,232,249,0.9)] animate-pulse" />
            </div>
          </div>

          {isScanning && (
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTorchOn((value) => !value)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold backdrop-blur-md border transition ${
                  torchOn
                    ? 'bg-amber-300 text-slate-950 border-amber-200'
                    : 'bg-slate-950/70 text-white border-white/20'
                }`}
                title="Toggle flashlight"
              >
                {torchOn ? '🔦 ON' : '🔦 Light'}
              </button>

              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="px-2 py-1.5 rounded-xl bg-slate-950/70 text-white text-[10px] font-bold border border-white/20 backdrop-blur-md outline-none"
                aria-label="Camera zoom"
              >
                <option value={1}>1×</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2×</option>
              </select>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 inset-x-3 flex justify-center">
            <div className="px-3 py-1.5 rounded-full bg-slate-950/65 border border-white/10 backdrop-blur text-[10px] text-slate-200">
              {scanMode === 'barcode'
                ? 'Align the full barcode horizontally inside the frame'
                : 'Keep the full QR code inside the square'}
            </div>
          </div>

          {errorMessage && (
            <div className="absolute inset-0 z-20 bg-slate-950/95 p-5 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-xs text-slate-200 font-medium max-w-xs">{errorMessage}</p>
              <p className="text-[11px] text-cyan-300 mt-2">
                Check camera permission, or use the manual code field below.
              </p>
            </div>
          )}

          {lastScanned && (
            <div className="absolute top-3 left-3 right-3 z-30 bg-emerald-400/95 text-slate-950 px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span className="truncate">Scanned: {lastScanned}</span>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Manual code / USB / Bluetooth scanner</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 890123456001"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs transition"
              >
                Add Code
              </button>
            </div>
          </form>
        </div>

        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between gap-3 text-[10px] text-slate-500">
          <span className="truncate">
            {scanMode === 'barcode' ? 'EAN • UPC • Code 128 • Code 39 • ITF' : 'QR Code'}
          </span>
          <span className="font-semibold text-slate-400 shrink-0">{appName}</span>
        </div>
      </div>
    </div>
  );
};
