import React from 'react';
import { GitPullRequest, Clock, FileText, Check, X } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const AppealsPage: React.FC = () => {
  const { appeals, decideAppeal } = useOfflinePayment();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <GitPullRequest className="w-5 h-5 text-indigo-600" />
          <span>User Appeals & Compliance Adjudication</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Review user-submitted documents and make determinations before the mandatory decision deadline expires.
        </p>
      </div>

      <div className="space-y-4">
        {appeals.map(appeal => (
          <div
            key={appeal.id}
            className="p-5 bg-white border border-slate-200 rounded-xl space-y-3.5 text-xs shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div>
                <span className="font-mono text-slate-400 text-[11px] block">{appeal.id}</span>
                <span className="font-bold text-slate-900 text-sm">{appeal.userName}</span>
                <span className="text-slate-500 font-mono text-[11px] block">{appeal.userPhone}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded font-mono text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{appeal.deadlineHoursRemaining} Hours Remaining</span>
                </span>
                <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  appeal.status === 'PENDING_DECISION'
                    ? 'bg-slate-100 text-slate-800'
                    : appeal.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {appeal.status}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-slate-700">Appeal Rationale:</span>
              <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                {appeal.reason}
              </p>
            </div>

            {/* Documents attached */}
            <div className="space-y-1">
              <span className="font-semibold text-slate-700">Uploaded Supporting Documents:</span>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {appeal.documents.map((doc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-[11px]"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>{doc}</span>
                  </span>
                ))}
              </div>
            </div>

            {appeal.status === 'PENDING_DECISION' && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => decideAppeal(appeal.id, false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-rose-800 border border-rose-300 rounded-lg font-medium text-xs transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject Appeal</span>
                </button>
                <button
                  onClick={() => decideAppeal(appeal.id, true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-xs transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Approve & Clear Flag</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
