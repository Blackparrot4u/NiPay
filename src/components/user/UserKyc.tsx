import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Building,
  KeyRound,
  FileCheck,
  CheckCircle2,
  ArrowLeft,
  Smartphone,
  Cpu
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UserKyc: React.FC = () => {
  const { wallet, navigateTo } = useOfflinePayment();
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateTo('/user/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Wallet Hub
        </button>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Identity Verified (Level 2)
        </span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            KYC & Cryptographic Identity
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Authenticated identity profiles ensure high network trust scores and enable up to 10,000 points receive limits.
          </p>
        </div>

        {/* Identity Details Card */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Full Legal Name</span>
              <div className="text-sm font-bold text-slate-900">{wallet.name}</div>
              <div className="text-[11px] text-emerald-700 font-medium">Matched with National Identity</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Mobile Number</span>
              <div className="text-sm font-bold text-slate-900 font-mono">{wallet.phone}</div>
              <div className="text-[11px] text-emerald-700 font-medium">Device Hardware Key Bound</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">National ID (Aadhaar)</span>
              <div className="text-sm font-bold text-slate-900 font-mono">{wallet.aadhaarNumber}</div>
              <div className="text-[11px] text-emerald-700 font-medium">Cryptographically Tokenized</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Tax Identification (PAN)</span>
              <div className="text-sm font-bold text-slate-900 font-mono">{wallet.panNumber}</div>
              <div className="text-[11px] text-emerald-700 font-medium">Active & Verified</div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Residential Address</span>
            <div className="text-xs font-semibold text-slate-800">{wallet.address}</div>
          </div>
        </div>

        {/* Linked Reserve Bank Account */}
        <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-700" />
              <span className="text-xs font-bold text-blue-900">Linked Reserve Bank Account</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Active For Auto-Settlement
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <div>
              <div className="font-semibold text-slate-800">{wallet.bankName || 'HDFC Bank'}</div>
              <div className="text-slate-500 font-mono text-[11px]">A/C Number: **** **** 9042 · IFSC: HDFC0001824</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">Reserve Balance</div>
              <div className="font-bold text-slate-900 text-sm">₹{wallet.mainAccountBalance.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Hardware Security Enclave */}
        <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold">Hardware Security Enclave (TEE)</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-emerald-300">
              Ed25519 HW-Key Active
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All private signing keys and monotonic offline transaction counters are isolated in your device's
            secure hardware enclave. Point handover signatures cannot be extracted or duplicated.
          </p>
        </div>
      </div>
    </div>
  );
};
