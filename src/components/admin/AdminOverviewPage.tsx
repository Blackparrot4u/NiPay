import React from 'react';
import {
  Coins,
  Activity,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  HeartPulse,
  TrendingUp,
  ArrowRight,
  Building2
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const AdminOverviewPage: React.FC = () => {
  const { payments, heldClaims, securityEvents, navigateTo } = useOfflinePayment();

  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const heldCount = heldClaims.filter(c => c.status === 'HELD_FOR_REVIEW').length;
  const openAlerts = securityEvents.filter(e => e.status === 'OPEN').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Admin Operations: System Overview</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time metrics on offline point allocation, settlement pipeline, and tripwire integrity.
        </p>
      </div>

      {/* 6 Core Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Money in slots */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Money in Slots</span>
          <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">₹14.8M</div>
          <span className="text-[10px] text-slate-400 font-mono">In bank reserve vault</span>
        </div>

        {/* Payments Today */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Payments Today</span>
          <div className="text-xl font-bold font-mono text-blue-600 tabular-nums">1,482</div>
          <span className="text-[10px] text-emerald-700 font-mono">+18% offline P2P volume</span>
        </div>

        {/* Pending Sync */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Pending Sync</span>
          <div className="text-xl font-bold font-mono text-amber-700 tabular-nums">{pendingCount + 142}</div>
          <span className="text-[10px] text-slate-400 font-mono">Awaiting phone ping</span>
        </div>

        {/* Held Claims */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Held Claims</span>
          <div className="text-xl font-bold font-mono text-purple-700 tabular-nums">{heldCount}</div>
          <span className="text-[10px] text-purple-600 font-mono">Same-ID conflict review</span>
        </div>

        {/* Active Alerts */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Active Alerts</span>
          <div className="text-xl font-bold font-mono text-rose-600 tabular-nums">{openAlerts}</div>
          <span className="text-[10px] text-rose-500 font-mono">Tripwires triggered</span>
        </div>

        {/* System Health */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">System Health</span>
          <div className="text-xl font-bold font-mono text-emerald-700 tabular-nums">99.98%</div>
          <span className="text-[10px] text-emerald-600 font-mono">Consensus nominal</span>
        </div>
      </div>

      {/* Quick Action Summary Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Held Conflicts Panel */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">Held Claims: Same-ID Conflicts</h2>
            </div>
            <button
              onClick={() => navigateTo('/admin/held-claims')}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              Resolve Claims ({heldCount}) →
            </button>
          </div>

          <div className="space-y-2">
            {heldClaims.map(claim => (
              <div key={claim.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-slate-900">{claim.pointId}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
                    {claim.claimants.length} Claimants
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">{claim.resolutionNotes}</p>
                <div className="text-[10px] text-slate-400 font-mono">
                  First reported: {claim.firstReportTimestamp}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Security Tripwires */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h2 className="text-sm font-bold text-slate-900">Security Tripwire Invocations</h2>
            </div>
            <button
              onClick={() => navigateTo('/admin/security-events')}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              View Tripwires ({openAlerts}) →
            </button>
          </div>

          <div className="space-y-2">
            {securityEvents.slice(0, 3).map(evt => (
              <div key={evt.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">{evt.type.toUpperCase()} TRIPWIRE</span>
                  <span className="font-mono text-[10px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">
                    {evt.severity}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">{evt.description}</p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Device: {evt.deviceModel} · Phone: {evt.userPhone}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
