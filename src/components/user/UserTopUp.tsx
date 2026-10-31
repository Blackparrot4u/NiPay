import React, { useState } from 'react';
import {
  PlusCircle,
  Building,
  KeyRound,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UserTopUp: React.FC = () => {
  const { wallet, topUpSendBucket, navigateTo } = useOfflinePayment();

  const [amount, setAmount] = useState<number>(300);
  const [pin, setPin] = useState<string>('1234');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const maxAddable = Math.max(0, 2000 - wallet.sendBucketPoints);
  const fee = 1; // ₹1 maintenance fee line
  const totalDeduction = (Number(amount) || 0) + fee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (amount <= 0) {
      setErrorMsg('Please enter a valid top-up amount.');
      return;
    }
    if (amount > maxAddable) {
      setErrorMsg(`Send bucket maximum limit is 2,000 points. You can add up to ${maxAddable} points.`);
      return;
    }
    if (wallet.mainAccountBalance < totalDeduction) {
      setErrorMsg(`Insufficient balance in bank account. Requires ₹${totalDeduction} including ₹1 platform fee.`);
      return;
    }
    if (pin.length < 4) {
      setErrorMsg('Please enter your 4-digit security PIN.');
      return;
    }

    setBusy(true);
    try {
      const res = await topUpSendBucket(amount, pin);
      if (res.success) {
        setSuccessMsg(`Successfully added ${amount} points to Send Bucket. ₹1 platform maintenance fee applied.`);
      } else {
        setErrorMsg(res.error || 'Top-up failed. Could not contact settlement node.');
      }
    } catch {
      setErrorMsg('Network error while requesting server-signed points.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateTo('/user/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Wallet Hub
        </button>
        <span className="text-xs text-slate-500">
          Capacity remaining: <b className="text-blue-700 font-bold">{maxAddable} Pts</b>
        </span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            Top-up Send Bucket
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Load server-signed cryptographic points into your phone's hardware enclave directly from your linked bank account.
          </p>
        </div>

        {/* Bank Account Source Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">{wallet.bankName || 'Primary Reserve Bank'}</div>
              <div className="text-[11px] text-slate-500 font-mono">A/C: **** 9042 · Central Ledger Reserve</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Available Balance</div>
            <div className="text-sm font-extrabold text-slate-900">₹{wallet.mainAccountBalance.toLocaleString()}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Points to Load (Max 2,000 Capacity)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max={maxAddable}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full text-2xl font-bold text-slate-900 px-4 py-3 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-4 top-4 text-xs font-bold text-slate-400">
                POINTS
              </span>
            </div>
            <div className="flex gap-2">
              {[100, 250, 500, 1000].map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setAmount(Math.min(val, maxAddable))}
                  className="px-2.5 py-1 text-xs border border-slate-200 hover:border-blue-400 rounded-lg text-slate-600 hover:text-blue-700 cursor-pointer"
                >
                  +{val} Pts
                </button>
              ))}
            </div>
          </div>

          {/* Breakdown fee breakdown line */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Points Requested:</span>
              <span className="font-semibold">{amount || 0} Pts (₹{amount || 0})</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-slate-400" /> Platform Maintenance Fee:
              </span>
              <span className="font-semibold text-slate-800">₹{fee}.00</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
              <span>Total Bank Account Deduction:</span>
              <span className="text-blue-700">₹{totalDeduction.toLocaleString()}</span>
            </div>
          </div>

          {/* PIN confirmation */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" /> Security PIN
            </label>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Enter PIN (1234)"
              className="w-full text-sm px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || maxAddable <= 0}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Minting Server-Signed Points...' : `Confirm & Top-up ${amount} Points`}
          </button>
        </form>
      </div>
    </div>
  );
};
