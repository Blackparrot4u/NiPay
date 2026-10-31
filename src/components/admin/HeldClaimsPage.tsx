import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, UserCheck, ShieldCheck, ArrowRight } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const HeldClaimsPage: React.FC = () => {
  const { heldClaims, decideHeldClaim } = useOfflinePayment();

  const [decisionNotes, setDecisionNotes] = useState('First report timestamp matched server sync ingress.');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-purple-600" />
          <span>Held Claims & Same-ID Conflict Resolution</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          When identical 20-character server IDs are presented by multiple offline claimants, first report wins by default. Administrators can audit proofs and trace to original point owner.
        </p>
      </div>

      <div className="space-y-4">
        {heldClaims.map(claim => (
          <div
            key={claim.id}
            className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 font-mono">Conflicting Point ID:</span>
                <div className="text-base font-bold font-mono text-purple-700">{claim.pointId}</div>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
                  {claim.status}
                </span>
                <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                  First reported: {claim.firstReportTimestamp}
                </span>
              </div>
            </div>

            {/* Claimants comparison table */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700">Claimants Competing for Settle:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {claim.claimants.map((c, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border space-y-1.5 text-xs ${
                      idx === 0 ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{c.userName}</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {idx === 0 ? 'First In Time' : 'Duplicate Claim'}
                      </span>
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">{c.userPhone}</div>
                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="text-slate-500">Trust Score:</span>
                      <span className="font-mono font-bold text-slate-900">{c.trustScore}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      Proof: {c.proofSignature}
                    </div>

                    {claim.status === 'HELD_FOR_REVIEW' && (
                      <button
                        onClick={() => decideHeldClaim(claim.id, c.userPhone, decisionNotes)}
                        className="w-full mt-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Award Settlement to {c.userName.split(' ')[0]}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {claim.status !== 'HELD_FOR_REVIEW' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                <span className="font-bold text-slate-900">Final Decision: </span>
                {claim.resolutionNotes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
