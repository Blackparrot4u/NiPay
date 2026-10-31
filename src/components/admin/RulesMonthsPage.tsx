import React, { useState } from 'react';
import { Calendar, RefreshCw, ShieldCheck, Lock, AlertTriangle, Check } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const RulesMonthsPage: React.FC = () => {
  const { monthRules, rotateMonthRules } = useOfflinePayment();

  const [confirmRotateModal, setConfirmRotateModal] = useState(false);

  const handleConfirmRotate = () => {
    rotateMonthRules();
    setConfirmRotateModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span>Rules and Monthly Rotations</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Server cryptographic rule service issuing signed monthly tower templates, grace periods, and bad-ID blacklists.
          </p>
        </div>

        <button
          onClick={() => setConfirmRotateModal(true)}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Rotate to Next Month Cycle</span>
        </button>
      </div>

      {/* Rules status card */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-400 font-mono">Current Rules Cycle:</span>
            <div className="text-lg font-bold font-mono text-slate-900">{monthRules.monthId}</div>
          </div>
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-800">
            {monthRules.status}
          </span>
        </div>

        {/* Rule parameters grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-slate-500 block">Grace Period Length:</span>
            <div className="text-base font-bold font-mono text-slate-900">{monthRules.gracePeriodDays} Days</div>
            <span className="text-[11px] text-slate-400">Spec mandate: 35–40 days</span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-slate-500 block">Region Bucket Limits:</span>
            <div className="text-base font-bold font-mono text-slate-900">
              Send: {monthRules.regionMaxSendLimit} / Rcv: {monthRules.regionMaxReceiveLimit}
            </div>
            <span className="text-[11px] text-slate-400">Enforced by device TEE</span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-slate-500 block">Bad-ID Revocation Notices:</span>
            <div className="text-base font-bold font-mono text-rose-700">{monthRules.badIdCount} Flagged IDs</div>
            <span className="text-[11px] text-slate-400">Distributed phone-to-phone</span>
          </div>
        </div>

        {/* Secret Protection Notice */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Server Signing Key & Monthly Seed Security (Rule 1 Enforced)</span>
          </div>
          <div className="font-mono text-[11px] text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Public Signature Digest:</span>
              <span className="text-slate-900 font-bold">{monthRules.serverSignatureDigest}</span>
            </div>
            <div className="flex justify-between">
              <span>Master Private Key:</span>
              <span className="text-emerald-700 font-semibold">[PROTECTED: IN ENCLAVE / NEVER DISPLAYED]</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmRotateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Rotate Monthly Rules Cycle?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Rotating to cycle <span className="font-mono font-bold text-slate-900">2026-M11</span> will publish newly signed monthly tower templates. Previous cycle points enter the 38-day grace period.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmRotateModal(false)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRotate}
                className="flex-1 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Monthly Rotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
