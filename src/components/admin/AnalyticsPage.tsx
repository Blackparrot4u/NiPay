import React from 'react';
import { BarChart3, Clock, AlertTriangle, ShieldCheck, PieChart } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <span>Operational Analytics & Loss Allocation</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Metrics on P2P transaction volume, failure root causes, average synchronization delay, and loss allocation breakdown.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-slate-500 block">Avg Sync Delay:</span>
          <div className="text-xl font-bold font-mono text-slate-900">4.2 Hours</div>
          <span className="text-[10px] text-emerald-700">92% synced within 24h</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-slate-500 block">Offline Failure Rate:</span>
          <div className="text-xl font-bold font-mono text-slate-900">0.42%</div>
          <span className="text-[10px] text-slate-400">Mostly battery cutoff</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-slate-500 block">Total Disputed Losses:</span>
          <div className="text-xl font-bold font-mono text-rose-700">₹3,400</div>
          <span className="text-[10px] text-slate-400">100% absorbed by pool</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-slate-500 block">Active Month Rules:</span>
          <div className="text-xl font-bold font-mono text-blue-600">2026-M10</div>
          <span className="text-[10px] text-slate-400">Grace period active</span>
        </div>
      </div>

      {/* Failures by Reason & Losses Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failures by Reason */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Payment Failures by Root Cause</h2>
          <div className="space-y-3">
            {[
              { reason: 'Bluetooth packet loss / distance exceeded', percent: 48, count: '142 events' },
              { reason: '2-digit pairing code mismatch by user', percent: 24, count: '71 events' },
              { reason: 'Battery dropped below 3% threshold', percent: 16, count: '48 events' },
              { reason: 'Tripwire trigger (invalid signature/old month)', percent: 12, count: '36 events' }
            ].map((f, i) => (
              <div key={i} className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>{f.reason}</span>
                  <span className="font-mono font-bold">{f.percent}% ({f.count})</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-900 h-full rounded-full"
                    style={{ width: `${f.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Losses by Who Bears Them */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Losses by Who Bears Them</h2>
          <div className="space-y-3">
            {[
              { entity: 'Pool Insurance Fund (₹15 Add-on Pool)', share: '65%', amount: '₹2,210', desc: 'Hardware loss & force majeure' },
              { entity: 'Issuer Bank Reserve Slot', share: '25%', amount: '₹850', desc: 'Resolved disputed claims' },
              { entity: 'User Deductible (Non-appealable)', share: '10%', amount: '₹340', desc: 'Gross negligence / expired past grace' }
            ].map((l, i) => (
              <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{l.entity}</span>
                  <span className="font-mono">{l.amount} ({l.share})</span>
                </div>
                <p className="text-slate-500 text-[11px]">{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
