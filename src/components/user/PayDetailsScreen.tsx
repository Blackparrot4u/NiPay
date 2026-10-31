import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const PayDetailsScreen: React.FC = () => {
  const { wallet, navigateTo } = useOfflinePayment();

  const [amount, setAmount] = useState<number>(150);
  const recipientName = 'Rajesh Fruit Stall (Test)';
  const recipientPhone = '+91 98111 22334';
  const matchingCode = '74';

  const isAmountValid = amount > 0 && amount <= wallet.sendBucketPoints;

  const handleContinue = () => {
    sessionStorage.setItem('pending_pay_amount', amount.toString());
    sessionStorage.setItem('pending_pay_recipient', recipientName);
    sessionStorage.setItem('pending_pay_phone', recipientPhone);
    sessionStorage.setItem('pending_pay_code', matchingCode);
    navigateTo('/user/pay-confirm');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <button
          onClick={() => navigateTo('/user/pay-connect')}
          className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-bold text-slate-900">Pay: Enter Amount</h2>
      </div>

      {/* Recipient Details & KYC Tag */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Recipient:</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>KYC Verified Tag</span>
          </span>
        </div>
        <div className="font-bold text-slate-900 text-sm">{recipientName}</div>
        <div className="text-xs text-slate-500 font-mono">{recipientPhone}</div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
          <span className="text-slate-500">Matched Pairing Code:</span>
          <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
            {matchingCode}
          </span>
        </div>
      </div>

      {/* Amount input */}
      <div className="space-y-2 text-center p-4 bg-white border border-slate-200 rounded-xl">
        <span className="text-xs text-slate-500 font-medium">Points to Handover (1 pt = ₹1 test)</span>
        <div className="flex items-center justify-center gap-1">
          <span className="text-3xl font-mono font-bold text-slate-900">₹</span>
          <input
            type="number"
            min="1"
            max={wallet.sendBucketPoints}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            className="w-36 text-3xl font-mono font-bold text-center text-slate-900 focus:outline-none border-b-2 border-slate-300 focus:border-slate-900 pb-1"
          />
        </div>

        {/* Quick amounts */}
        <div className="flex justify-center gap-2 pt-2">
          {[50, 100, 150, 300, 500].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => setAmount(val)}
              className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors ${
                amount === val
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              ₹{val}
            </button>
          ))}
        </div>
      </div>

      {/* Send Bucket remaining check */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
        <div className="flex justify-between text-slate-600">
          <span>Available in Send Bucket:</span>
          <span className="font-mono font-bold text-slate-900">{wallet.sendBucketPoints} pts</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Remaining after transfer:</span>
          <span className="font-mono font-bold text-blue-600">
            {Math.max(0, wallet.sendBucketPoints - amount)} pts
          </span>
        </div>
      </div>

      {/* Optional Warning Banner if limit or rules trigger */}
      {amount > 1000 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
          <span>Notice: Large offline transfer. Recipient must sync online to move into bank account.</span>
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={!isAmountValid}
        className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        <span>Continue to Confirmation & Biometrics</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
