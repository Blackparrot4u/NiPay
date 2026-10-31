import React, { useState } from 'react';
import { Smartphone, AlertTriangle, ShieldCheck, ArrowRight, Check } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { STRINGS } from '../../utils/i18n';

export const LoginLockScreen: React.FC = () => {
  const { wallet, fileCancellationReport, navigateTo } = useOfflinePayment();
  const strings = STRINGS[wallet.preferredLanguage];

  const [reason, setReason] = useState('Lost previous device / Switched phones');
  const [success, setSuccess] = useState(false);

  const handleCancelReport = (e: React.FormEvent) => {
    e.preventDefault();
    fileCancellationReport(reason);
    setSuccess(true);
    setTimeout(() => {
      navigateTo('/user/home');
    }, 1200);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border-2 border-amber-600 flex items-center justify-center text-amber-600">
          <Smartphone className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">{strings.alreadyActiveTitle}</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">{strings.alreadyActiveDesc}</p>
        </div>
      </div>

      {/* Balance Summary in Previous Device */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
        <div className="font-semibold text-slate-800">Current Balance Summary on Ledger:</div>
        <div className="flex justify-between text-slate-600">
          <span>Main Bank Account:</span>
          <span className="font-mono font-bold text-slate-900">₹{wallet.mainAccountBalance.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Send Bucket Points:</span>
          <span className="font-mono font-bold text-blue-600">{wallet.sendBucketPoints} pts</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Receive Bucket Points:</span>
          <span className="font-mono font-bold text-emerald-700">{wallet.receiveBucketPoints} pts</span>
        </div>
      </div>

      {/* File Cancellation Report Form */}
      <form onSubmit={handleCancelReport} className="space-y-3">
        <div className="space-y-1 text-left">
          <label className="text-xs font-semibold text-slate-700">Cancellation Reason / कारण</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none"
          >
            <option value="Lost previous device / Switched phones">Lost previous device / Switched phones</option>
            <option value="Device reset / Factory wipe">Device reset / Factory wipe</option>
            <option value="Suspected unauthorized access">Suspected unauthorized access</option>
          </select>
        </div>

        {success ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Previous session invalidated. Device bound!</span>
          </div>
        ) : (
          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>{strings.fileCancelBtn}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
};
