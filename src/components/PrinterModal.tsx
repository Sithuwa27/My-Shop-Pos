import React, { useState } from 'react';
import { 
  Printer, 
  Bluetooth, 
  CheckCircle2, 
  XCircle, 
  Scissors, 
  ChevronRight, 
  Sparkles, 
  AlertTriangle,
  Radio,
  RefreshCw,
  Sliders,
  DollarSign
} from 'lucide-react';
import { BluetoothDeviceState, BusinessProfile } from '../types';
import { bluetoothPrinter } from '../services/bluetoothPrinter';
import { buildTestPrintBytes, EscPosBuilder } from '../services/escpos';
import { soundEffects } from '../services/soundEffects';
import { t } from '../utils/translations';

interface PrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  btState: BluetoothDeviceState;
  business: BusinessProfile;
  setBusiness: React.Dispatch<React.SetStateAction<BusinessProfile>>;
  lang: 'si' | 'en';
  soundEnabled: boolean;
}

export const PrinterModal: React.FC<PrinterModalProps> = ({
  isOpen,
  onClose,
  btState,
  business,
  setBusiness,
  lang,
  soundEnabled,
}) => {
  const strings = t[lang];
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConnectReal = async () => {
    setIsBusy(true);
    setTestStatus(null);
    const res = await bluetoothPrinter.connect();
    setIsBusy(false);
    if (res.success && soundEnabled) {
      soundEffects.playBeep(880, 0.15);
    }
  };

  const handleDisconnect = () => {
    bluetoothPrinter.disconnect();
    if (soundEnabled) soundEffects.playBeep(400, 0.1);
  };

  const handleSimulate = () => {
    bluetoothPrinter.simulateConnect('POS-58 Bluetooth Thermal (Virtual)');
    if (soundEnabled) soundEffects.playBeep(880, 0.15);
  };

  const handleTestPrint = async () => {
    if (!btState.isConnected) {
      setTestStatus('Please connect the printer first.');
      return;
    }
    setIsBusy(true);
    setTestStatus('Test receipt is printing...');

    if (soundEnabled) soundEffects.playThermalPrintSound(1500);

    try {
      const bytes = buildTestPrintBytes(business);
      await bluetoothPrinter.printBytes(bytes);
      setTestStatus('Test print successful!');
      if (soundEnabled) soundEffects.playBeep(880, 0.2);
    } catch (err: any) {
      setTestStatus(err?.message || 'Test print failed');
    } finally {
      setIsBusy(false);
      setTimeout(() => setTestStatus(null), 3000);
    }
  };

  const handleFeedPaper = async () => {
    if (!btState.isConnected) return;
    if (soundEnabled) soundEffects.playThermalPrintSound(500);
    try {
      const esc = new EscPosBuilder().feed(4);
      await bluetoothPrinter.printBytes(esc.getUint8Array());
    } catch (err) {
      console.warn(err);
    }
  };

  const handleCutPaper = async () => {
    if (!btState.isConnected) return;
    if (soundEnabled) soundEffects.playBeep(600, 0.1);
    try {
      const esc = new EscPosBuilder().cutPaper();
      await bluetoothPrinter.printBytes(esc.getUint8Array());
    } catch (err) {
      console.warn(err);
    }
  };

  const handleKickDrawer = async () => {
    if (!btState.isConnected) return;
    if (soundEnabled) soundEffects.playDrawerKick();
    try {
      const esc = new EscPosBuilder().kickDrawer();
      await bluetoothPrinter.printBytes(esc.getUint8Array());
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-slate-100">
                {strings.printerSettings}
              </h2>
              <p className="text-xs text-slate-400">Bluetooth ESC/POS Thermal Printer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
          >
            &times;
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Bluetooth Connection Card */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Bluetooth Status</span>
              </span>

              {btState.isConnected ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-400 font-medium bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>විසන්ධිව ඇත</span>
                </span>
              )}
            </div>

            {btState.isConnected && (
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-200">{btState.deviceName}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{btState.deviceId || 'ESC/POS GATT'}</p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-semibold transition"
                >
                  Disconnect
                </button>
              </div>
            )}

            {/* Error Message */}
            {btState.error && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{btState.error}</span>
              </div>
            )}

            {/* Connect Buttons */}
            {!btState.isConnected && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleConnectReal}
                  disabled={isBusy}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition active:scale-[0.98]"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>{strings.connectPrinter}</span>
                </button>

                <button
                  onClick={handleSimulate}
                  className="py-2.5 px-3 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-2 border border-slate-600 transition"
                  title="Test without a physical printer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{strings.simulateConnect}</span>
                </button>
              </div>
            )}
          </div>

          {/* Diagnostic Controls */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>ප්‍රින්ටර් පරීක්ෂණ මෙවලම් (Diagnostics)</span>
            </h3>

            {testStatus && (
              <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] text-center">
                {testStatus}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={handleTestPrint}
                disabled={!btState.isConnected || isBusy}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700/80 disabled:opacity-40 border border-slate-700 text-slate-200 font-medium flex flex-col items-center gap-1.5 transition text-center"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span className="text-[11px]">Test Print</span>
              </button>

              <button
                onClick={handleFeedPaper}
                disabled={!btState.isConnected}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700/80 disabled:opacity-40 border border-slate-700 text-slate-200 font-medium flex flex-col items-center gap-1.5 transition text-center"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px]">Feed Paper</span>
              </button>

              <button
                onClick={handleCutPaper}
                disabled={!btState.isConnected}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700/80 disabled:opacity-40 border border-slate-700 text-slate-200 font-medium flex flex-col items-center gap-1.5 transition text-center"
              >
                <Scissors className="w-4 h-4 text-purple-400" />
                <span className="text-[11px]">Cut Paper</span>
              </button>

              <button
                onClick={handleKickDrawer}
                disabled={!btState.isConnected}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700/80 disabled:opacity-40 border border-slate-700 text-slate-200 font-medium flex flex-col items-center gap-1.5 transition text-center"
              >
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px]">Kick Drawer</span>
              </button>
            </div>
          </div>

          {/* Paper Width & Thermal Driver Options */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <h3 className="font-semibold text-slate-200">මුද්‍රණ පරාමිතීන් (Printer Specifications)</h3>

            {/* Paper Width */}
            <div className="space-y-1.5">
              <label className="text-slate-400 text-[11px] block">Paper Width:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBusiness({ ...business, paperWidth: '58mm' })}
                  className={`py-2 px-3 rounded-xl border text-center font-medium transition ${
                    business.paperWidth === '58mm'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  <p className="font-bold">58mm</p>
                  <p className="text-[10px] text-slate-500">POS-58 (384 dots)</p>
                </button>

                <button
                  type="button"
                  onClick={() => setBusiness({ ...business, paperWidth: '80mm' })}
                  className={`py-2 px-3 rounded-xl border text-center font-medium transition ${
                    business.paperWidth === '80mm'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  <p className="font-bold">80mm</p>
                  <p className="text-[10px] text-slate-500">POS-80 (576 dots)</p>
                </button>
              </div>
            </div>

            {/* Sinhala Raster Mode */}
            <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-200">Raster Print Mode (GS v 0)</p>
                <p className="text-[10px] text-slate-400">
                  Use this for clear raster printing.
                </p>
              </div>
              <input
                type="checkbox"
                checked={business.printSinhalaAsGraphic}
                onChange={(e) =>
                  setBusiness({ ...business, printSinhalaAsGraphic: e.target.checked })
                }
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            {/* QR Code on Receipt */}
            <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-200">Receipt QR Code (LankaQR / Link)</p>
                <p className="text-[10px] text-slate-400">Print a QR code for payment or verification.</p>
              </div>
              <input
                type="checkbox"
                checked={business.showQrCode}
                onChange={(e) => setBusiness({ ...business, showQrCode: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Guide */}
          <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-200 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5" />
              <span>How to connect the Bluetooth printer:</span>
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-300">
              <li>Turn on the thermal printer and enable Bluetooth.</li>
              <li>Pair the printer in Bluetooth Settings.</li>
              <li>Use the <strong>"Connect Printer"</strong> button and select the printer.</li>
              <li>You can print bills after connecting.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
