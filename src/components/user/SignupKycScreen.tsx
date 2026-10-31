import React, { useState } from 'react';
import { Shield, Camera, Check, AlertCircle, ArrowRight, Lock } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const SignupKycScreen: React.FC = () => {
  const { navigateTo } = useOfflinePayment();

  const [phone, setPhone] = useState('+91 98765 43210 (Test Phone)');
  const [otp, setOtp] = useState('8842');
  const [aadhaar, setAadhaar] = useState('TEST-AADHAAR-8819-4402');
  const [pan, setPan] = useState('TEST-PAN-ABCDE1234F');
  const [address, setAddress] = useState('Plot 42, Sandbox Tech Corridor, Test City, 560001');
  const [selfieTaken, setSelfieTaken] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => {
      navigateTo('/user/home');
    }, 1200);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
          KYC
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Sign Up & KYC (Test Sandbox)</h2>
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
            TEST DATA ONLY — NOT REAL BANK/GOVERNMENT DATA
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        {/* Phone & OTP */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <label className="font-semibold text-slate-700">Phone Number (Test)</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Test OTP</label>
            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 text-center focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Dummy Aadhaar and PAN */}
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Test Aadhaar ID (Simulated Mock)</label>
          <input
            type="text"
            value={aadhaar}
            onChange={e => setAadhaar(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Test PAN (Simulated Mock)</label>
          <input
            type="text"
            value={pan}
            onChange={e => setPan(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Residential Address</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none"
            required
          />
        </div>

        {/* Selfie or Biometric Setup */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-800 block">Biometric / Liveness Selfie</span>
              <span className="text-[10px] text-emerald-700 font-mono">Attestation Passed (Hardware TEE)</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            Captured
          </span>
        </div>

        {/* Mandated Terms: "No account renting" */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={e => setAgreeTerms(e.target.checked)}
              className="mt-0.5 rounded border-amber-300"
              required
            />
            <span className="text-[11px] text-amber-950 font-medium">
              I agree to Sandbox Terms & Conditions. Specifically: <strong className="text-amber-900">Strictly no account renting, mule wallets, or delegation of cryptographic control keys</strong>. Any account rental immediately revokes offline limits and flags the hardware enclave.
            </span>
          </label>
        </div>

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>KYC Verified in Sandbox! Initializing Send Bucket...</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!agreeTerms || success}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <span>Complete Registration & Launch Wallet</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
