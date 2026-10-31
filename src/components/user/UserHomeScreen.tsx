import React from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  ArrowRightLeft,
  Clock,
  Wifi,
  WifiOff,
  ShieldCheck,
  AlertTriangle,
  History,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { STRINGS } from '../../utils/i18n';

export const UserHomeScreen: React.FC = () => {
  const { wallet, navigateTo } = useOfflinePayment();
  const lang = wallet.preferredLanguage;
  const strings = STRINGS[lang];

  // Check if wallet should be blocked
  if (wallet.batteryLevel < 3 || wallet.isSelfLocked || wallet.offlineSuspended) {
    navigateTo('/user/blocked-state');
  }

  const sendPercent = Math.min(100, (wallet.sendBucketPoints / 2000) * 100);
  const receivePercent = Math.min(100, (wallet.receiveBucketPoints / 10000) * 100);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Network & Renewal Status Banner */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {wallet.isOnline ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
              <Wifi className="w-3.5 h-3.5" /> Online (Cloud)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
              <WifiOff className="w-3.5 h-3.5" /> Offline Mode (P2P)
            </span>
          )}
          <span className="text-slate-500">· Last synced: {wallet.lastSyncedAt}</span>
        </div>

        <div className="flex items-center gap-1 text-slate-600 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{wallet.daysUntilRenewal}d left (+{wallet.gracePeriodDays}d grace)</span>
        </div>
      </div>

      {/* Main Buckets Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Send Bucket (Max 2,000 points) */}
        <div className="space-y-1.5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Send Bucket / भेजने का बकेट
              </span>
              <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {wallet.sendBucketPoints.toLocaleString()} <span className="text-sm font-normal text-slate-500">pts</span>
              </div>
            </div>
            <button
              onClick={() => navigateTo('/user/topup')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Top-up</span>
            </button>
          </div>

          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${sendPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>20-char server-signed IDs loaded</span>
            <span>Max limit: 2,000 pts</span>
          </div>
        </div>

        {/* Receive Bucket (Max 10,000 points) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Receive Bucket / प्राप्त बकेट
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                {wallet.receiveBucketPoints.toLocaleString()} <span className="text-sm font-normal text-slate-500">pts</span>
              </div>
            </div>
            <button
              onClick={() => navigateTo('/user/move-money')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Move to Bank</span>
            </button>
          </div>

          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${receivePercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Held in device store awaiting cloud sync</span>
            <span>Max limit: 10,000 pts</span>
          </div>
        </div>
      </div>

      {/* Primary Pay & Receive Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigateTo('/user/pay-connect')}
          className="p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-sm text-left flex flex-col justify-between transition-colors group"
        >
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white mb-2 group-hover:scale-105 transition-transform">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm">Pay / भेजें</div>
            <p className="text-[11px] text-slate-300 mt-0.5">QR, NFC, or Bluetooth peer</p>
          </div>
        </button>

        <button
          onClick={() => navigateTo('/user/receive')}
          className="p-4 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl shadow-sm text-left flex flex-col justify-between transition-colors group"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 mb-2 group-hover:scale-105 transition-transform">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm">Receive / प्राप्त करें</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Show QR or NFC tap</p>
          </div>
        </button>
      </div>

      {/* Main Bank Account Info & Advices */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-600">
          <span>Main Bank Account Balance (Test):</span>
          <span className="font-mono font-bold text-slate-900 text-sm">₹{wallet.mainAccountBalance.toLocaleString()}</span>
        </div>
        <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
          <Info className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
          {strings.moveMoneyAdvice}
        </p>
      </div>

      {/* Quick Navigation Items */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <button
          onClick={() => navigateTo('/user/mine-inspector')}
          className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-center transition-colors"
        >
          <Layers className="w-4 h-4 mx-auto text-indigo-600 mb-1" />
          <span className="font-medium text-slate-700 block text-[11px]">Mine & IDs</span>
        </button>

        <button
          onClick={() => navigateTo('/user/history')}
          className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-center transition-colors"
        >
          <History className="w-4 h-4 mx-auto text-slate-600 mb-1" />
          <span className="font-medium text-slate-700 block text-[11px]">History</span>
        </button>

        <button
          onClick={() => navigateTo('/user/report-appeal')}
          className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-center transition-colors"
        >
          <AlertTriangle className="w-4 h-4 mx-auto text-amber-600 mb-1" />
          <span className="font-medium text-slate-700 block text-[11px]">Report / Help</span>
        </button>
      </div>

      {/* Trust Score & Integrity Marker */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-medium text-slate-700">Signed Trust Score:</span>
          <span className="font-mono font-bold text-slate-900">{wallet.trustScore}</span>
          <span className="text-[10px] text-slate-400 font-mono">(Range: 300–850)</span>
        </div>
        <button
          onClick={() => navigateTo('/user/settings')}
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          Settings →
        </button>
      </div>
    </div>
  );
};
