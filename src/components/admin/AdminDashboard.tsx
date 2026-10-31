import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Layers,
  Activity,
  FileCheck,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Building,
  RefreshCw,
  Search,
  Lock,
  UserCheck
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { api } from '../../services/api';

export const AdminDashboard: React.FC = () => {
  const {
    wallet,
    payments,
    heldClaims,
    securityEvents,
    resolveClaim,
    resolveSecurityEvent,
    refreshData
  } = useOfflinePayment();

  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'claims' | 'security' | 'appeals' | 'audit'>('overview');
  const [adminOverview, setAdminOverview] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    // Load admin statistics from backend
    api.getAdminOverview().then(res => {
      if (res && res.overview) {
        setAdminOverview(res.overview);
      }
    });

    api.getAuditLogs().then(res => {
      if (res && res.auditLogs) {
        setAuditLogs(res.auditLogs);
      }
    });
  }, [heldClaims, securityEvents]);

  const handleResolveClaim = async (claimId: string, decision: 'FIRST_CLAIMANT' | 'FORFEIT') => {
    setResolvingId(claimId);
    await resolveClaim(claimId, decision, resolutionNote || 'Adjudicated by Super Admin desk using hardware timestamps.');
    setResolvingId(null);
    setResolutionNote('');
    await refreshData();
  };

  const handleResolveSecurity = async (evtId: string) => {
    await resolveSecurityEvent(evtId);
    await refreshData();
  };

  const circulatingSend = wallet.sendBucketPoints + 84200;
  const circulatingReceive = wallet.receiveBucketPoints + 195400;

  return (
    <div className="space-y-6">
      {/* Admin Subheader & Navigation Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">
              NiPay Central Settlement & Risk Console
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              Super Admin Level
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographic ledger reconciliation, duplicate point landmines, and dispute resolution.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'ledger', label: 'Live Ledger' },
            { id: 'claims', label: `Held Claims (${heldClaims.filter(c => c.status === 'HELD_FOR_REVIEW').length})` },
            { id: 'security', label: `Tripwires (${securityEvents.filter(e => e.status === 'OPEN').length})` },
            { id: 'appeals', label: 'Appeals' },
            { id: 'audit', label: 'Audit Trail' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Circulating Points
              </span>
              <div className="text-2xl font-extrabold text-slate-900">
                {(adminOverview?.totalCirculatingPoints || circulatingSend + circulatingReceive).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 flex justify-between">
                <span>Send: {circulatingSend.toLocaleString()}</span>
                <span>Recv: {circulatingReceive.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Held Duplicate Claims
              </span>
              <div className="text-2xl font-extrabold text-rose-600">
                {heldClaims.filter(c => c.status === 'HELD_FOR_REVIEW').length}
              </div>
              <div className="text-[11px] text-slate-500">
                Collision landmines awaiting review
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Security Tripwires
              </span>
              <div className="text-2xl font-extrabold text-amber-600">
                {securityEvents.filter(e => e.status === 'OPEN').length}
              </div>
              <div className="text-[11px] text-slate-500">
                Active double-spend triggers
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Ledger Verification
              </span>
              <div className="text-2xl font-extrabold text-emerald-700">
                Balanced
              </div>
              <div className="text-[11px] text-emerald-600 font-medium">
                Reserve 100% 1:1 backed
              </div>
            </div>
          </div>

          {/* Central Settlement Node Status */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Settlement Engine Health & Month Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="text-slate-400 uppercase font-bold text-[10px]">Active Month Cycle</div>
                <div className="text-sm font-bold text-slate-900">2026-M10</div>
                <div className="text-slate-500 text-[11px]">Server public key: ed25519_pk_7b9c...</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="text-slate-400 uppercase font-bold text-[10px]">Enclave Grace Period</div>
                <div className="text-sm font-bold text-slate-900">38 Days</div>
                <div className="text-slate-500 text-[11px]">Permits safe offline transfers</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="text-slate-400 uppercase font-bold text-[10px]">Settlement Gateway</div>
                <div className="text-sm font-bold text-emerald-700">Online & Reconciled</div>
                <div className="text-slate-500 text-[11px]">Database latency: 1.8ms</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Live Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Real-Time Transaction Ledger</h3>
              <p className="text-xs text-slate-500">Live stream of incoming offline syncs and settlements.</p>
            </div>
            <button
              onClick={refreshData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Tx ID</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Counterparty</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{tx.id}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          tx.direction === 'sent'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {tx.direction}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {tx.counterpartyName} ({tx.counterpartyPhone})
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">{tx.amount} Pts</td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-700">{tx.matchingCode}</td>
                    <td className="py-3 px-3 uppercase text-slate-600">{tx.transportMethod}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{tx.timestamp}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          tx.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : tx.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Held Claims */}
      {activeTab === 'claims' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Held Conflicting Point Claims (Double-Spend Mitigation)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              When two offline phones claim the same Point ID, settlement is held until adjudicated.
            </p>
          </div>

          <div className="space-y-4">
            {heldClaims.map(claim => (
              <div key={claim.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{claim.id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      {claim.status}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    Flagged Point: <b className="text-slate-900">{claim.pointId}</b>
                  </span>
                </div>

                {/* Claimants comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {claim.claimants.map((c, idx) => (
                    <div
                      key={c.userPhone}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>Claimant {idx + 1}: {c.userName}</span>
                        <span className="text-blue-700 font-mono text-[11px]">Score {c.trustScore}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">Phone: {c.userPhone}</div>
                      <div className="text-[11px] text-slate-500">Reported: {c.reportedAt}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        Signature: {c.proofSignature}
                      </div>
                    </div>
                  ))}
                </div>

                {claim.resolutionNotes && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-xs text-blue-900 rounded-xl">
                    <b>Resolution Notes:</b> {claim.resolutionNotes}
                  </div>
                )}

                {claim.status === 'HELD_FOR_REVIEW' && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
                    <input
                      type="text"
                      placeholder="Add adjudication notes..."
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveClaim(claim.id, 'FIRST_CLAIMANT')}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Award to First Claimant
                      </button>
                      <button
                        onClick={() => handleResolveClaim(claim.id, 'FORFEIT')}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Forfeit to Reserve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Security Tripwires */}
      {activeTab === 'security' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Security Tripwires & Landmine Detections
            </h3>
            <p className="text-xs text-slate-500">
              Tripwire events automatically armed on 3-point mine integrity violations.
            </p>
          </div>

          <div className="space-y-3">
            {securityEvents.map(evt => (
              <div
                key={evt.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{evt.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        evt.severity === 'CRITICAL' || evt.severity === 'HIGH'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {evt.severity}
                    </span>
                    <span className="font-mono text-xs text-slate-500">Point {evt.pointId}</span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1">{evt.description}</p>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Device: {evt.deviceModel} · Reported: {evt.reportedAt}
                  </div>
                </div>

                <div>
                  {evt.status === 'OPEN' ? (
                    <button
                      onClick={() => handleResolveSecurity(evt.id)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Mark Resolved
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Resolved
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Appeals */}
      {activeTab === 'appeals' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">User Appeals & Cancellation Reports</h3>
          <p className="text-xs text-slate-500">
            Adjudicate user reports regarding battery shutdowns during offline transfers.
          </p>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between font-bold text-slate-900">
              <span>APP-101: Karan Mehra (+91 91234 56789)</span>
              <span className="text-amber-700">36h Remaining for Auto-Decide</span>
            </div>
            <p className="text-slate-600">
              Phone battery died during offline Bluetooth transfer, points debited from send bucket but receiver claims timeout.
            </p>
            <div className="text-[11px] text-slate-400">Attached: battery_log_dump.json, vendor_receipt.pdf</div>
            <div className="flex gap-2 pt-2">
              <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer">
                Approve & Credit Balance
              </button>
              <button className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer">
                Reject Appeal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Immutable System Audit Logs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Log ID</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{log.id}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{log.adminName}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-mono">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-blue-700">{log.action}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{log.targetId}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
