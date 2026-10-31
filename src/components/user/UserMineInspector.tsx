import React, { useState } from 'react';
import {
  Layers,
  ShieldCheck,
  Key,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  Info,
  Calendar
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UserMineInspector: React.FC = () => {
  const { wallet, navigateTo } = useOfflinePayment();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Group points by mine group
  const mineGroups: Record<string, typeof wallet.points> = {};
  wallet.points.forEach(pt => {
    const key = pt.mineGroup || 'Loose Points';
    if (!mineGroups[key]) mineGroups[key] = [];
    mineGroups[key].push(pt);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateTo('/user/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Wallet Hub
        </button>
        <span className="text-xs text-slate-500 font-mono">
          Total Hardware Enclave Points: <b className="text-slate-900">{wallet.points.length}</b>
        </span>
      </div>

      {/* Explainer Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-2xl shadow-md space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold">20-Character Cryptographic Points Architecture</h2>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed max-w-3xl">
          In NiPay, money stays safe in reserve banks. Phones carry authentic, 20-character cryptographic point IDs.
          Every single point ID is generated and signed <b>exclusively on the central bank server using Ed25519 cryptography</b>,
          never on a client smartphone. Points are organized into 3-point 'mines' for fast offline double-spend auditing.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="bg-white/10 p-3 rounded-xl border border-white/10">
            <div className="text-cyan-300 font-bold">Active Month Cycle</div>
            <div className="text-sm font-semibold mt-0.5">Cycle 2026-M10</div>
            <div className="text-[10px] text-slate-300">Renewed every 30 days</div>
          </div>
          <div className="bg-white/10 p-3 rounded-xl border border-white/10">
            <div className="text-emerald-300 font-bold">Enclave Grace Period</div>
            <div className="text-sm font-semibold mt-0.5">{wallet.gracePeriodDays} Days Grace</div>
            <div className="text-[10px] text-slate-300">Allows offline payments safely</div>
          </div>
          <div className="bg-white/10 p-3 rounded-xl border border-white/10">
            <div className="text-amber-300 font-bold">Renewal In</div>
            <div className="text-sm font-semibold mt-0.5">{wallet.daysUntilRenewal} Days Remaining</div>
            <div className="text-[10px] text-slate-300">Automatic renewal on sync</div>
          </div>
        </div>
      </div>

      {/* Point Store & Mine Clusters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Enclave ID Store & Mine Groups</h3>
            <p className="text-xs text-slate-500">
              Showing active points loaded in this device's Trusted Execution Environment (TEE).
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
            {Object.keys(mineGroups).length} Mine Groups
          </span>
        </div>

        <div className="space-y-3">
          {Object.entries(mineGroups).slice(0, 8).map(([groupName, groupPoints]) => {
            const isWhole = groupPoints.length === 3;
            return (
              <div
                key={groupName}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{groupName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isWhole
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isWhole ? 'Whole Mine (3/3 Pts)' : `Broken Mine (${groupPoints.length}/3 Pts)`}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Ed25519 Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {groupPoints.map(pt => (
                    <div
                      key={pt.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono shadow-2xs"
                    >
                      <div className="overflow-hidden">
                        <div className="font-bold text-slate-900 truncate">{pt.id}</div>
                        <div className="text-[9px] text-slate-400 truncate">
                          {pt.serverSignature}
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(pt.id)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 cursor-pointer shrink-0 ml-1"
                        title="Copy Point ID"
                      >
                        {copiedId === pt.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
