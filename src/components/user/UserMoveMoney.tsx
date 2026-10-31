import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Building,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UserMoveMoney: React.FC = () => {
  const { wallet, sweepToBank, navigateTo } = useOfflinePayment();

  const [amount, setAmount] = useState<number>(wallet.receiveBucketPoints || 250);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (amount <= 0) {
      setErrorMsg('Please enter a valid amount to sweep.');
      return;
    }
    if (amount > wallet.receiveBucketPoints) {
      setErrorMsg(`Cannot sweep more than your current Receive Bucket balance (${wallet.receiveBucketPoints} Pts).`);
      return;
    }

    setBusy(true);
    try {
      const res = await sweepToBank(amount);
      if (res.success) {
        setSuccessMsg(`Successfully settled and transferred ₹${amount} directly to your primary bank account.`);
      } else {
        setErrorMsg(res.error || 'Failed to settle funds at bank.');
      }
    } catch {
      setErrorMsg('Error contacting bank settlement gateway.');
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
          Receive Bucket: <b className="text-emerald-700 font-bold">{wallet.receiveBucketPoints} Pts</b>
        </span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
            Move Money to Linked Bank Account
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sweep received peer-to-peer offline points directly into your underlying bank account balance.
          </p>
        </div>

        <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-900">Destination: {wallet.bankName || 'HDFC Bank'}</div>
            <div className="text-[11px] text-emerald-700 font-mono">A/C: **** 9042 · Instant RTGS / IMPS Credit</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Current Bank Balance</div>
            <div className="text-sm font-extrabold text-slate-900">₹{wallet.mainAccountBalance.toLocaleString()}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Points to Transfer to Bank
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max={wallet.receiveBucketPoints}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full text-2xl font-bold text-slate-900 px-4 py-3 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-4 top-4 text-xs font-bold text-slate-400">
                POINTS
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Available in Receive Bucket: {wallet.receiveBucketPoints} Pts</span>
              <button
                type="button"
                onClick={() => setAmount(wallet.receiveBucketPoints)}
                className="text-emerald-700 hover:underline font-semibold"
              >
                Sweep All ({wallet.receiveBucketPoints} Pts)
              </button>
            </div>
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
            disabled={busy || wallet.receiveBucketPoints <= 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Processing Bank Settlement...' : `Transfer ₹${amount || 0} to Bank Account`}
          </button>
        </form>
      </div>
    </div>
  );
};
