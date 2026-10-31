import React, { useState } from 'react';
import { ArrowLeft, Check, AlertCircle, Info, Lock } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const TopupScreen: React.FC = () => {
  const { wallet, topUpSendBucket, navigateTo } = useOfflinePayment();

  const [amount, setAmount] = useState<number>(500);
  const [pin, setPin] = useState<string>('1234');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const availableCeiling = Math.max(0, 2000 - wallet.sendBucketPoints);

  const handleTopup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = topUpSendBucket(amount, pin);
    if (!res.success) {
      setError(res.error || 'Top-up failed.');
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
        <h2 className="text-base font-bold text-slate-900">Top-up Send Bucket (Online)</h2>
      </div>

      {/* Balances overview */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Main Bank Account:</span>
          <span className="font-mono font-bold text-slate-900">₹{wallet.mainAccountBalance.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Current Send Bucket:</span>
          <span className="font-mono font-bold text-slate-900">{wallet.sendBucketPoints} / 2,000 pts</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Max Can Add Now:</span>
          <span className="font-mono font-bold text-blue-600">+{availableCeiling} pts</span>
        </div>
      </div>

      <form onSubmit={handleTopup} className="space-y-4">
        {/* Amount Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Top-up Amount (Points)</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              max={availableCeiling}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              required
            />
          </div>

          {/* Quick preset buttons */}
          <div className="flex gap-2 pt-1">
            {[100, 250, 500, 1000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors ${
                  amount === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {val} pts
              </button>
            ))}
          </div>
        </div>

        {/* Mandated Fee Breakdown */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
          <div className="flex justify-between font-medium">
            <span>Points to issue:</span>
            <span className="font-mono">{amount} pts</span>
          </div>
          <div className="flex justify-between font-medium text-amber-800">
            <span>Platform service fee:</span>
            <span className="font-mono">₹1.00 (Fixed)</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t border-amber-200 text-slate-900">
            <span>Total bank debit:</span>
            <span className="font-mono">₹{(amount + 1).toLocaleString()}</span>
          </div>
        </div>

        {/* PIN Confirmation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-700">Confirm with 4-Digit Wallet PIN</label>
            <span className="text-[11px] text-slate-400 font-mono">Demo PIN: 1234</span>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-600"
              required
            />
          </div>
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
            <span>Points minted and signed by server. Added to send bucket!</span>
          </div>
        )}

        <button
          type="submit"
          disabled={amount <= 0 || amount > availableCeiling || success}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
        >
          {success ? 'Success!' : `Confirm Top-up (+${amount} pts)`}
        </button>
      </form>
    </div>
  );
};
