import React from 'react';
import { CheckCircle2, XCircle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const ResultScreen: React.FC = () => {
  const { wallet, navigateTo } = useOfflinePayment();

  const status = sessionStorage.getItem('last_result_status') || 'SUCCESS';
  const amount = Number(sessionStorage.getItem('last_result_amount') || '150');
  const recipient = sessionStorage.getItem('last_result_recipient') || 'Rajesh Fruit Stall (Test)';

  const isSuccess = status === 'SUCCESS';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 text-center animate-in zoom-in-95 duration-150">
      {isSuccess ? (
        <>
          {/* Success Icon */}
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border-2 border-emerald-600 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">Payment Transferred</h2>
            <p className="text-xs text-slate-500">
              Offline cryptographic IDs delivered to {recipient}.
            </p>
          </div>

          {/* Amount and New Balance */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="text-3xl font-mono font-bold text-slate-900">
              ₹{amount.toLocaleString()}
            </div>
            <div className="text-xs text-slate-600 pt-2 border-t border-slate-200/80 flex items-center justify-between">
              <span>New Send Bucket Balance:</span>
              <span className="font-mono font-bold text-slate-900">{wallet.sendBucketPoints} pts</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-[11px] text-blue-900 text-left flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Signed Handover ACK Recorded</span>
              When either device contacts the network, the central ledger reconciles this transfer automatically.
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Plain "Payment failed" with NO REASON SHOWN as per spec mandate */}
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 border-2 border-rose-600 flex items-center justify-center text-rose-600">
            <XCircle className="w-10 h-10" />
          </div>

          <div className="space-y-2 py-4">
            <h2 className="text-xl font-bold text-slate-900">Payment Failed</h2>
            <p className="text-xs text-slate-400">
              (Security invariant triggered. No reason disclosed to protect device credentials.)
            </p>
          </div>
        </>
      )}

      <button
        onClick={() => navigateTo('/user/home')}
        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
      >
        Return to Home
      </button>
    </div>
  );
};
