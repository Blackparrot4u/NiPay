import React, { useState } from 'react';
import { ArrowLeft, Languages, Lock, Fingerprint, Shield, Smartphone, Check } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const SettingsScreen: React.FC = () => {
  const { wallet, setLanguage, navigateTo } = useOfflinePayment();

  const [hasInsuranceAddon, setHasInsuranceAddon] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleToggleInsurance = () => {
    setHasInsuranceAddon(!hasInsuranceAddon);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <button
          onClick={() => navigateTo('/user/home')}
          className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-bold text-slate-900">Wallet Settings & Security</h2>
      </div>

      <div className="space-y-4 text-xs">
        {/* Language selector */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <Languages className="w-4 h-4 text-blue-600" />
            <span>Application Language / भाषा</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLanguage('en')}
              className={`p-2 rounded-lg border font-medium transition-colors ${
                wallet.preferredLanguage === 'en'
                  ? 'bg-slate-900 text-white border-slate-900 font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('hi')}
              className={`p-2 rounded-lg border font-medium transition-colors ${
                wallet.preferredLanguage === 'hi'
                  ? 'bg-slate-900 text-white border-slate-900 font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              हिंदी (Hindi)
            </button>
          </div>
        </div>

        {/* PIN and Biometrics */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Fingerprint className="w-4 h-4 text-indigo-600" />
              <span>Biometric Handover Authorization</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              ENROLLED
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Backed by hardware Play Integrity (Android) / App Attest (iOS).
          </p>
        </div>

        {/* Device Info */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <Smartphone className="w-4 h-4 text-slate-700" />
            <span>Hardware Enclave Attestation</span>
          </div>
          <div className="flex justify-between text-slate-600 font-mono text-[11px]">
            <span>Model:</span>
            <span className="text-slate-900">Pixel 8 Pro (Simulated)</span>
          </div>
          <div className="flex justify-between text-slate-600 font-mono text-[11px]">
            <span>Control Key Status:</span>
            <span className="text-emerald-700">Hardware Sealed (Never Leaves Phone)</span>
          </div>
          <div className="flex justify-between text-slate-600 font-mono text-[11px]">
            <span>Integrity Verdict:</span>
            <span className="text-emerald-700">MEETS_DEVICE_INTEGRITY</span>
          </div>
        </div>

        {/* Mandated One-time insurance add-on */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-indigo-900">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>One-Time Offline Loss Insurance Add-on</span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-900">₹15</span>
          </div>
          <p className="text-[11px] text-indigo-800 leading-relaxed">
            Optional protection policy covering up to 2,000 points against physical hardware destruction before online synchronization.
          </p>

          <button
            onClick={handleToggleInsurance}
            className={`w-full py-2 rounded-lg font-semibold text-xs border transition-colors ${
              hasInsuranceAddon
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-indigo-900 border-indigo-300 hover:bg-indigo-100'
            }`}
          >
            {hasInsuranceAddon ? 'Policy Active (Covered)' : 'Add Insurance Protection (₹15 test)'}
          </button>
        </div>

        {saveSuccess && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-[11px] flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Settings updated.</span>
          </div>
        )}
      </div>
    </div>
  );
};
