import React, { useState } from 'react';
import { Lock, User, KeyRound, ShieldCheck, AlertCircle, Check, Sparkles } from 'lucide-react';
import { storage } from '../services/storage';
import { soundEffects } from '../services/soundEffects';
import { AuthUser } from '../types';
import { POWERED_BY } from '../data/defaultData';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: AuthUser) => void;
  soundEnabled: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onLoginSuccess,
  soundEnabled,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const appName = storage.getBusinessProfile().appName || storage.getBusinessProfile().name || 'POS';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setLoading(true);
    const user = await storage.loginCloud(username, password);
    setLoading(false);
    if (user) {
      if (soundEnabled) soundEffects.playBeep(880, 0.15);
      onLoginSuccess(user);
    } else {
      if (soundEnabled) soundEffects.playBeep(300, 0.2);
      setError('Invalid username or password.');
    }
  };

  const handleQuickFill = () => {
    setUsername('brave');
    setPassword('brave123');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Branding Banner */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950/50 border-b border-slate-800 text-center relative overflow-hidden">
          {/* Subtle glow circle */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20 mb-3">
            <Lock className="w-7 h-7" />
          </div>

          <h2 className="font-bold text-xl text-white tracking-tight">{appName}</h2>
          <p className="text-xs text-cyan-300 font-medium mt-0.5">
            Smart POS & Inventory System
          </p>

          {/* Immutable Powered By Sithum Kalhara Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[11px] font-semibold text-cyan-200 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>{POWERED_BY}</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-center mb-2">
            <h3 className="font-bold text-sm text-slate-100">Sign In</h3>
            <p className="text-[11px] text-slate-400">Enter your username and password</p>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                autoFocus
                placeholder="Username (e.g. brave)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            <Lock className="w-4 h-4" />
            <span>{loading ? 'Connecting...' : 'ලොග් වන්න (Login)'}</span>
          </button>

          {/* Quick Credential Helper Note */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Default: <strong className="text-cyan-300">brave</strong> / <strong className="text-cyan-300">brave123</strong>
            </span>
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-cyan-400 hover:underline font-medium text-[11px]"
            >
              Remember credentials
            </button>
          </div>
        </form>

        {/* Locked Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-[10px] text-slate-500 font-mono">
          {appName} &bull; {POWERED_BY}
        </div>
      </div>
    </div>
  );
};
