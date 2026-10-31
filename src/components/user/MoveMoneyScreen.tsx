import React, { useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Info, Check, AlertCircle } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const MoveMoneyScreen: React.FC = () => {
  const { wallet, moveReceivedToMain, navigateTo } = useOfflinePayment();

  const [amount, setAmount] = useState<number>(wallet.receiveBucketPoints || 500);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = moveReceivedToMain(amount);
    if (!res.success) {
      setError(res.error || 'Failed to move points.');
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigateTo('/user/home');
      }, 1200);
    }
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
        <h2 className="text-base font-bold text-slate-900">Move Money to Bank Account</h2>
      </div>

      {/* Prominent Advice as explicitly dictated by spec */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-xs text-blue-900">
        <div className="flex items-center gap-1.5 font-bold">
          <Info className="w-4 h-4 text-blue-600" />
          <span>Security Advice: Settle Received Points Early</span>
        </div>
        <p className="text-[11px] leading-relaxed text-blue-800">
          Always move points from your Receive Bucket to your main bank account when you have internet access. This permanently registers your ownership in the server ledger and protects your funds against counterparty double-claims or monthly cycle expiration.
        </p>
      </div>

      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Points in Receive Bucket:</span>
          <span className="font-mono font-bold text-emerald-700">{wallet.receiveBucketPoints} pts</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Main Bank Account (Test):</span>
          <span className="font-mono font-bold text-slate-900">₹{wallet.mainAccountBalance.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Internet Connection:</span>
          <span className={`font-mono font-bold ${wallet.isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
            {wallet.isOnline ? 'Online (Ready to Settle)' : 'Offline (Turn online in header to settle)'}
          </span>
        </div>
      </div>

      <form onSubmit={handleMove} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Points to Transfer to Bank Account</label>
          <input
            type="number"
            min="1"
            max={wallet.receiveBucketPoints}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Successfully moved to main bank account!</span>
          </div>
        )}

        <button
          type="submit"
          disabled={amount <= 0 || amount > wallet.receiveBucketPoints || success}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Move {amount} Points to Main Bank Balance</span>
        </button>
      </form>
    </div>
  );
};
