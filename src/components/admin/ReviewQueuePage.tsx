import React from 'react';
import { Clock, ShieldCheck, Check, Ban, AlertCircle } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const ReviewQueuePage: React.FC = () => {
  const { reviewQueue, reviewQueueDecision } = useOfflinePayment();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          <span>Review Queue: Map Flags & User Reports</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          <strong className="text-slate-800">Rule Enforced:</strong> A flag only sends an incident to review, never freezes a wallet by itself. Human risk officers decide whether to clear or suspend.
        </p>
      </div>

      <div className="space-y-3">
        {reviewQueue.map(item => (
          <div
            key={item.id}
            className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 text-xs shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-slate-400 text-[11px] block">{item.id}</span>
                <span className="font-bold text-slate-900 text-sm">{item.userName}</span>
                <div className="text-slate-500 font-mono text-[11px] mt-0.5">{item.userPhone}</div>
              </div>

              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                item.status === 'IN_REVIEW'
                  ? 'bg-amber-100 text-amber-800'
                  : item.status === 'CLEARED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {item.status}
              </span>
            </div>

            <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
              {item.riskSummary}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
              <span className="text-slate-400 font-mono">Flagged: {item.flaggedAt} · Type: {item.type}</span>

              {item.status === 'IN_REVIEW' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewQueueDecision(item.id, 'CLEARED')}
                    className="px-3 py-1 bg-white hover:bg-slate-50 text-emerald-800 border border-emerald-300 font-medium rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Clear Flag</span>
                  </button>
                  <button
                    onClick={() => reviewQueueDecision(item.id, 'SUSPENDED')}
                    className="px-3 py-1 bg-white hover:bg-slate-50 text-rose-800 border border-rose-300 font-medium rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Suspend Offline Use</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
