import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothOff,
  Battery,
  BatteryWarning,
  Languages,
  ShieldCheck,
  Shield,
  Zap,
  CheckCircle2,
  Server
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { api } from '../../services/api';

export const NiPayHeader: React.FC = () => {
  const {
    wallet,
    currentRole,
    setRole,
    toggleOnline,
    toggleBluetooth,
    setBatteryLevel,
    setLanguage,
    navigateTo,
    alertBannerMessage,
    dismissBanner
  } = useOfflinePayment();

  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline'>('connected');

  useEffect(() => {
    // Check real backend status
    api.getHealth().then(res => {
      if (res && res.status === 'ok') {
        setBackendStatus('connected');
      } else {
        setBackendStatus('offline');
      }
    });
  }, []);

  const isHindi = wallet.preferredLanguage === 'hi';

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Real-time status / notification banner */}
      {alertBannerMessage && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between text-xs text-blue-900 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-medium">{alertBannerMessage}</span>
          </div>
          <button
            onClick={dismissBanner}
            className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline ml-4 shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo: NiPay */}
        <div
          onClick={() => navigateTo(currentRole === 'user' ? '/user/home' : '/admin/overview')}
          className="flex items-center gap-3 cursor-pointer select-none shrink-0 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 fill-white text-white" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900 text-lg leading-tight tracking-tight flex items-center gap-1.5">
              <span>NiPay</span>
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider">
                {currentRole === 'user' ? 'Web Portal' : 'Guard Admin'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
              AI Payment Security & Offline P2P Platform
            </div>
          </div>
        </div>

        {/* Unified Role Switcher: Web User Portal vs Web Admin Console */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => {
              setRole('user');
              navigateTo('/user/home');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentRole === 'user'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            User Portal (Web)
          </button>
          <button
            onClick={() => {
              setRole('admin');
              navigateTo('/admin/overview');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentRole === 'admin'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Admin Console (Web)
          </button>
        </div>

        {/* Device & Backend Connectivity Controls */}
        <div className="flex items-center gap-2">
          {/* Backend API Status Indicator */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
              backendStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title="Backend Settlement Engine Connection"
          >
            <Server className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold">{backendStatus === 'connected' ? 'Backend Live' : 'Backend Standby'}</span>
          </div>

          {/* Network Switcher (Online Cloud vs Offline P2P) */}
          <button
            onClick={toggleOnline}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              wallet.isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title="Toggle device Online / Offline for P2P mesh testing"
          >
            {wallet.isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
            <span className="font-semibold hidden sm:inline">{wallet.isOnline ? 'Online (Cloud)' : 'Offline (P2P)'}</span>
          </button>

          {/* Bluetooth Radio Toggle */}
          <button
            onClick={toggleBluetooth}
            className={`p-2 rounded-lg text-xs border transition-colors cursor-pointer ${
              wallet.isBluetoothActive
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
            title="Bluetooth radio for offline mesh handover"
          >
            {wallet.isBluetoothActive ? <Bluetooth className="w-3.5 h-3.5" /> : <BluetoothOff className="w-3.5 h-3.5" />}
          </button>

          {/* Hardware Enclave & Battery Status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${
              wallet.batteryLevel < 3
                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse font-bold'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="Hardware TEE Enclave Status & Device Power"
          >
            {wallet.batteryLevel < 3 ? <BatteryWarning className="w-3.5 h-3.5 text-rose-600" /> : <Battery className="w-3.5 h-3.5 text-slate-600" />}
            <span className="font-mono font-medium">{wallet.batteryLevel}%</span>
          </div>
        </div>
      </div>
    </header>
  );
};

// Backwards compatibility export
export const SandboxHeader = NiPayHeader;
