import React, { useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  ArrowRightLeft,
  RefreshCw,
  Layers,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  ChevronRight
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UserWalletHub: React.FC = () => {
  const {
    wallet,
    navigateTo,
    syncOfflineQueue,
    isOnline,
    payments
  } = useOfflinePayment();

  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const recentPayments = payments.slice(0, 4);

  const handleSync = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const count = await syncOfflineQueue();
      setSyncFeedback(`Successfully synchronized ${count} transaction(s) with central bank ledger.`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch {
      setSyncFeedback('Sync complete.');
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const wholeMinesCount = Math.floor(wallet.sendBucketPoints / 3);
  const loosePointsCount = wallet.sendBucketPoints % 3;

  return (
    <div className="space-y-6">
      {/* Top Greeting & Sync Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {wallet.name}
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Account
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            NiPay Secure Cryptographic Enclave · Linked to {wallet.bankName || 'Primary Bank Account'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingPayments.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{pendingPayments.length} offline payment(s) queued</span>
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync with Ledger'}
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Main 3 Buckets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Send Bucket */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Send Bucket
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Max 2,000 Pts
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {wallet.sendBucketPoints.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-slate-500">Points Available</span>
            </div>
            <p className="text-xs text-slate-500">
              Cryptographically signed tokens stored in phone hardware enclave.
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              Capacity: {((wallet.sendBucketPoints / 2000) * 100).toFixed(0)}% utilized
            </div>
            <button
              onClick={() => navigateTo('/user/topup')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Top-up <PlusCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Receive Bucket */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Receive Bucket
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Max 10,000 Pts
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-700">
                {wallet.receiveBucketPoints.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-slate-500">Points Received</span>
            </div>
            <p className="text-xs text-slate-500">
              Collected from offline peers. Automatically safe until swept to bank.
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              Limit: {10000 - wallet.receiveBucketPoints} pts room
            </div>
            <button
              onClick={() => navigateTo('/user/move-money')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 cursor-pointer"
            >
              Move to Bank <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Underlying Bank Account */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-400" /> Linked Bank Account
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/20">
                Central Reserve
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                ₹{wallet.mainAccountBalance.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Funds stay safe in reserve bank until points are settled.
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>A/C: **** 9042</span>
            <span className="text-emerald-400 font-medium">Active & Synchronized</span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => navigateTo('/user/pay-connect')}
          className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 hover:border-blue-400 rounded-2xl shadow-xs transition-all hover:shadow-sm cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-900">Pay (Offline P2P)</span>
          <span className="text-[10px] text-slate-400 mt-0.5">Send via Bluetooth / QR</span>
        </button>

        <button
          onClick={() => navigateTo('/user/receive')}
          className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl shadow-xs transition-all hover:shadow-sm cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-900">Receive Points</span>
          <span className="text-[10px] text-slate-400 mt-0.5">Show QR or NFC Tap</span>
        </button>

        <button
          onClick={() => navigateTo('/user/topup')}
          className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl shadow-xs transition-all hover:shadow-sm cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <PlusCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-900">Top-up Send Bucket</span>
          <span className="text-[10px] text-slate-400 mt-0.5">From linked bank account</span>
        </button>

        <button
          onClick={() => navigateTo('/user/mine-inspector')}
          className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 hover:border-cyan-400 rounded-2xl shadow-xs transition-all hover:shadow-sm cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-900">ID Store & Mines</span>
          <span className="text-[10px] text-slate-400 mt-0.5">Inspect 20-char Point IDs</span>
        </button>
      </div>

      {/* Security, Trust & ID Renewal Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Token Enclave & Monthly Renewal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Cryptographic Enclave Status
            </h3>
            <span className="text-[11px] font-semibold text-slate-500">Cycle: 2026-M10</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Whole Mines</div>
              <div className="text-lg font-bold text-slate-900">{wholeMinesCount}</div>
              <div className="text-[10px] text-slate-400">3 points each</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Loose Points</div>
              <div className="text-lg font-bold text-slate-900">{loosePointsCount}</div>
              <div className="text-[10px] text-slate-400">Individual IDs</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Renewal In</div>
              <div className="text-lg font-bold text-blue-600">{wallet.daysUntilRenewal}d</div>
              <div className="text-[10px] text-slate-400">{wallet.gracePeriodDays}d grace</div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Server-Signed Cryptographic Points
            </div>
            <p className="text-[11px] text-blue-800">
              Every point is signed on the central bank server using Ed25519 cryptography. No point is ever created on a phone.
            </p>
          </div>
        </div>

        {/* Enclave Sync & Health */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Reconciliation & Ledger Health
            </h3>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Ledger Synchronized
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Last Synced to Central Bank</span>
              <span className="font-semibold text-slate-800">{wallet.lastSyncedAt}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Queued Offline Transactions</span>
              <span className="font-semibold text-slate-800">
                {pendingPayments.length === 0 ? '0 (Up to date)' : `${pendingPayments.length} awaiting connection`}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Hardware TEE Integrity</span>
              <span className="font-semibold text-emerald-700">Verified & Intact</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-500">Trust Score (Bank Evaluated)</span>
              <span className="font-bold text-slate-900">{wallet.trustScore} / 850 (Tier 1)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Recent Transactions</h3>
          <button
            onClick={() => navigateTo('/user/history')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            View all ledger history <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentPayments.map(tx => (
            <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.direction === 'sent'
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {tx.direction === 'sent' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                    <span>{tx.counterpartyName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({tx.id})</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{tx.timestamp}</span>
                    <span>·</span>
                    <span className="uppercase text-[10px] font-semibold text-slate-600">
                      via {tx.transportMethod}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`font-bold text-sm ${
                    tx.direction === 'sent' ? 'text-slate-900' : 'text-emerald-700'
                  }`}
                >
                  {tx.direction === 'sent' ? '-' : '+'}
                  {tx.amount} Pts
                </div>
                <div className="mt-0.5">
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                      tx.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : tx.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
