import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Filter, XCircle } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { TripwireType } from '../../types';

export const SecurityEventsPage: React.FC = () => {
  const { securityEvents, resolveSecurityEvent } = useOfflinePayment();

  const [filterType, setFilterType] = useState<string>('ALL');

  const tripwireTypes: TripwireType[] = [
    'forged',
    'landmine',
    'tower',
    'code_check',
    'restore',
    'control_key_leak',
    'root'
  ];

  const filtered = securityEvents.filter(e => {
    if (filterType === 'ALL') return true;
    return e.type === filterType;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <span>Security Tripwire Events Log</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Mandated tripwire classifications: Forged signatures, Landmine pattern breaks, Monthly tower expiry, Play Integrity code check, Restore attempts, Control key leakage, and Root/Jailbreak.
        </p>
      </div>

      {/* Filter Tabs matching mandated tripwire types */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
            filterType === 'ALL' ? 'bg-slate-900 text-white font-semibold' : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          All ({securityEvents.length})
        </button>
        {tripwireTypes.map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] whitespace-nowrap transition-colors ${
              filterType === t
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filtered.map(evt => {
          const isOpen = evt.status === 'OPEN';
          return (
            <div
              key={evt.id}
              className={`p-4 bg-white border rounded-xl space-y-2 text-xs shadow-sm transition-all ${
                isOpen ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    evt.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {evt.severity}
                  </span>
                  <span className="font-bold text-slate-900 text-sm font-mono">
                    [{evt.type.toUpperCase()}]
                  </span>
                  <span className="font-mono text-slate-400 text-[11px]">({evt.id})</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    isOpen ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {evt.status}
                  </span>
                  {isOpen ? (
                    <button
                      onClick={() => resolveSecurityEvent(evt.id)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-medium text-xs transition-colors"
                    >
                      Close Tripwire
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Investigated
                    </span>
                  )}
                </div>
              </div>

              <p className="text-slate-700 text-xs">{evt.description}</p>

              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                <span>Device: {evt.deviceModel} · User: {evt.userPhone}</span>
                <span>Timestamp: {evt.reportedAt}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
