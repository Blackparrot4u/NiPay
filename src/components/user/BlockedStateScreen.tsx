import React, { useState } from 'react';
import { BatteryWarning, Clock, Lock, Upload, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { STRINGS } from '../../utils/i18n';

export const BlockedStateScreen: React.FC = () => {
  const { wallet, setBatteryLevel, unlockWallet, navigateTo } = useOfflinePayment();
  const strings = STRINGS[wallet.preferredLanguage];

  const [uploadedDoc, setUploadedDoc] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const isBatteryLow = wallet.batteryLevel < 3;
  const isExpired = wallet.daysUntilRenewal <= 0;
  const isSelfLocked = wallet.isSelfLocked || wallet.offlineSuspended;

  const handleSimulateCharge = () => {
    setBatteryLevel(84);
    navigateTo('/user/home');
  };

  const handleUploadDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedDoc(e.target.files[0].name);
      setUploadSuccess(true);
      setTimeout(() => {
        unlockWallet();
        navigateTo('/user/home');
      }, 1500);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 text-center animate-in fade-in duration-200">
      {/* Battery low state */}
      {isBatteryLow && (
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border-2 border-rose-600 flex items-center justify-center text-rose-600">
            <BatteryWarning className="w-10 h-10 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{strings.batteryLowTitle}</h2>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">{strings.batteryLowDesc}</p>
          </div>
          <button
            onClick={handleSimulateCharge}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Simulate Charger Connected (Resume 84%)
          </button>
        </div>
      )}

      {/* Wallet Expired State */}
      {!isBatteryLow && isExpired && (
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border-2 border-amber-600 flex items-center justify-center text-amber-600">
            <Clock className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{strings.walletExpiredTitle}</h2>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">{strings.walletExpiredDesc}</p>
          </div>
          <button
            onClick={() => navigateTo('/user/home')}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Connect Online & Refresh Rules
          </button>
        </div>
      )}

      {/* App needs attention (Self-lock / Support) */}
      {!isBatteryLow && !isExpired && isSelfLocked && (
        <div className="space-y-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{strings.selfLockTitle}</h2>
              <p className="text-xs text-slate-500">{strings.selfLockDesc}</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
            <span className="font-semibold text-slate-800 block">Verification Document Upload (Online):</span>
            <label className="block p-4 border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl bg-white text-center cursor-pointer transition-colors">
              <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <span className="text-xs text-slate-700 block">Click to upload identity document scan</span>
              <span className="text-[10px] text-slate-400">PDF, JPG, PNG (Test Sandbox ID)</span>
              <input type="file" onChange={handleUploadDoc} className="hidden" />
            </label>
            {uploadedDoc && (
              <div className="text-emerald-700 text-xs font-medium flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>Uploaded: {uploadedDoc}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                unlockWallet();
                navigateTo('/user/home');
              }}
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Simulate Support Clearance & Unlock
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
