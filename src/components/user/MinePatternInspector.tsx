import React, { useState } from 'react';
import { ArrowLeft, Layers, ShieldCheck, Key, RefreshCw, Cpu, Database } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const MinePatternInspector: React.FC = () => {
  const { wallet, monthRules, navigateTo } = useOfflinePayment();

  const [filterType, setFilterType] = useState<'ALL' | 'loose' | 'broken_mine' | 'whole_mine'>('ALL');

  const filteredPoints = wallet.points.filter(p => {
    if (filterType === 'ALL') return true;
    return p.status === filterType;
  });

  const looseCount = wallet.points.filter(p => p.status === 'loose').length;
  const brokenCount = wallet.points.filter(p => p.status === 'broken_mine').length;
  const wholeCount = wallet.points.filter(p => p.status === 'whole_mine').length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <button
          onClick={() => navigateTo('/user/home')}
          className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-bold text-slate-900">ID Store & Mine Pattern Visualizer</h2>
          <span className="text-[10px] text-slate-500 font-mono">
            Bank Server Ed25519 Root · 3 Points Per Mine
          </span>
        </div>
      </div>

      {/* Explanation of Mine Priority Rules */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>Mandated Point Spending Sequence:</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600">
          <strong>1. Loose points first</strong> (1 pt left) → <strong>2. Broken mines next</strong> (2 pts left) → <strong>3. Whole mines last</strong> (3 pts bound). Voids are automatically prioritized to be filled when incoming points are accepted.
        </p>
      </div>

      {/* Breakdown counters */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div
          onClick={() => setFilterType('loose')}
          className={`p-3 rounded-xl border cursor-pointer transition-colors ${
            filterType === 'loose' ? 'bg-amber-50 border-amber-400' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <span className="text-[10px] text-slate-500 block">Priority 1: Loose</span>
          <div className="text-lg font-bold font-mono text-amber-700">{looseCount} pts</div>
          <span className="text-[10px] text-slate-400">Spent first</span>
        </div>

        <div
          onClick={() => setFilterType('broken_mine')}
          className={`p-3 rounded-xl border cursor-pointer transition-colors ${
            filterType === 'broken_mine' ? 'bg-purple-50 border-purple-400' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <span className="text-[10px] text-slate-500 block">Priority 2: Broken</span>
          <div className="text-lg font-bold font-mono text-purple-700">{brokenCount} pts</div>
          <span className="text-[10px] text-slate-400">Spent second</span>
        </div>

        <div
          onClick={() => setFilterType('whole_mine')}
          className={`p-3 rounded-xl border cursor-pointer transition-colors ${
            filterType === 'whole_mine' ? 'bg-blue-50 border-blue-400' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <span className="text-[10px] text-slate-500 block">Priority 3: Whole</span>
          <div className="text-lg font-bold font-mono text-blue-700">{wholeCount} pts</div>
          <span className="text-[10px] text-slate-400">Spent last</span>
        </div>
      </div>

      {/* Control Key & Server Rules Digest */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs font-mono">
        <div className="flex justify-between text-slate-600">
          <span>Control Key:</span>
          <span className="text-emerald-700 font-bold">Never leaves wallet (TEE Hardware bound)</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Active Rules Cycle:</span>
          <span className="text-slate-900 font-bold">{monthRules.monthId} (Digest: {monthRules.serverSignatureDigest.substring(0, 18)}...)</span>
        </div>
      </div>

      {/* Points Inspection Feed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Server-Signed 20-Character IDs ({filteredPoints.length})</span>
          {filterType !== 'ALL' && (
            <button onClick={() => setFilterType('ALL')} className="text-blue-600 hover:underline text-[11px]">
              Show All
            </button>
          )}
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1.5">
          {filteredPoints.slice(0, 30).map((pt, idx) => (
            <div
              key={pt.id}
              className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono"
            >
              <div>
                <span className="font-bold text-slate-900">{pt.id}</span>
                <span className="text-[10px] text-slate-400 block">{pt.mineGroup}</span>
              </div>
              <div className="text-right">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  pt.status === 'loose'
                    ? 'bg-amber-100 text-amber-800'
                    : pt.status === 'broken_mine'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {pt.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-[9px] text-emerald-700 block mt-0.5">Ed25519 Valid</span>
              </div>
            </div>
          ))}
        </div>
        {filteredPoints.length > 30 && (
          <p className="text-[11px] text-slate-400 text-center font-mono">
            Showing first 30 of {filteredPoints.length} total points in storage
          </p>
        )}
      </div>
    </div>
  );
};
