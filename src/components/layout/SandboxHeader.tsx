import React from 'react';
import {
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothOff,
  Battery,
  BatteryWarning,
  Languages,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  TestTube2,
  RefreshCw
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { STRINGS } from '../../utils/i18n';

export const SandboxHeader: React.FC = () => {
  const {
    wallet,
    currentRole,
    setRole,
    isPhoneFrame,
    togglePhoneFrame,
    toggleOnline,
    toggleBluetooth,
    setBatteryLevel,
    setLanguage,
    navigateTo,
    alertBannerMessage,
    dismissBanner
  } = useOfflinePayment();

  const isHindi = wallet.preferredLanguage === 'hi';

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40">
      {/* Simulation alert banner */}
      {alertBannerMessage && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-medium">{alertBannerMessage}</span>
          </div>
          <button
            onClick={dismissBanner}
            className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Disclaimer bar */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-1.5 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">IDEA-STAGE PROTOTYPE:</span>
          <span>Simulated points & test data only. No real banking, Aadhaar, or PAN. Not approved by or affiliated with RBI, NPCI or any commercial bank.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo('/tests')}
            className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium flex items-center gap-1"
          >
            <TestTube2 className="w-3 h-3" />
            <span>Run 5 Security Tests</span>
          </button>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div
          onClick={() => navigateTo(currentRole === 'user' ? '/user/home' : '/admin/overview')}
          className="flex items-center gap-2 cursor-pointer select-none shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm tracking-tight">
            OP
          </div>
          <div>
            <div className="font-bold text-slate-900 text-base leading-tight tracking-tight">
              OfflinePay <span className="text-xs font-normal text-slate-500">Sandbox</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">20-Char Point Server Model</div>
          </div>
        </div>

        {/* Navigation / Role Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setRole('user')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              currentRole === 'user'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            User App (Android)
          </button>
          <button
            onClick={() => setRole('admin')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              currentRole === 'admin'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin Dashboard (Web)
          </button>
        </div>

        {/* Simulator Tools Controls */}
        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="Toggle English / Hindi language"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{isHindi ? 'हिंदी' : 'English'}</span>
          </button>

          {/* Network Switcher */}
          <button
            onClick={toggleOnline}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              wallet.isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title="Toggle device Online / Offline to test auto-sync"
          >
            {wallet.isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{wallet.isOnline ? 'Online' : 'Offline'}</span>
          </button>

          {/* Bluetooth Toggle */}
          <button
            onClick={toggleBluetooth}
            className={`p-1.5 rounded-md text-xs border transition-colors ${
              wallet.isBluetoothActive
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
            title="Toggle Bluetooth radio"
          >
            {wallet.isBluetoothActive ? <Bluetooth className="w-3.5 h-3.5" /> : <BluetoothOff className="w-3.5 h-3.5" />}
          </button>

          {/* Battery Level Simulator (Critical < 3% test) */}
          <button
            onClick={() => setBatteryLevel(wallet.batteryLevel < 3 ? 84 : 2)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
              wallet.batteryLevel < 3
                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="Click to toggle battery between 84% and 2% (Tests blocked state)"
          >
            {wallet.batteryLevel < 3 ? <BatteryWarning className="w-3.5 h-3.5 text-rose-600" /> : <Battery className="w-3.5 h-3.5" />}
            <span className="font-mono text-[11px]">{wallet.batteryLevel}%</span>
          </button>

          {/* Phone Frame Toggle (Android first) */}
          {currentRole === 'user' && (
            <button
              onClick={togglePhoneFrame}
              className={`p-1.5 rounded-md border transition-colors ${
                isPhoneFrame
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title="Toggle Android phone chassis preview"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
