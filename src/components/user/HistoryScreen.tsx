import React, { useState } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Search, Filter, ShieldCheck, AlertCircle } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { PaymentStatus } from '../../types';

export const HistoryScreen: React.FC = () => {
  const { payments, navigateTo } = useOfflinePayment();

  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filtered = payments.filter(p => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus;
  });

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">PAID</span>;
      case 'pending':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800">PENDING SYNC</span>;
      case 'held':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">HELD (REVIEW)</span>;
      case 'refused':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800">REFUSED</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo('/user/home')}
            className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold text-slate-900">Payment History</h2>
        </div>
        <span className="text-xs font-mono text-slate-500">{filtered.length} entries</span>
      </div>

      {/* Filter Tabs matching mandated statuses: pending, paid, held, refused */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
        {['ALL', 'pending', 'paid', 'held', 'refused'].map(st => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterStatus === st
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {st === 'ALL' ? 'All' : st.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Payments List */}
      <div className="space-y-2">
        {filtered.map(p => {
          const isSent = p.direction === 'sent';
          return (
            <div
              key={p.id}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSent ? 'bg-slate-200 text-slate-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isSent ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{p.counterpartyName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{p.counterpartyPhone}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-mono font-bold text-sm ${isSent ? 'text-slate-900' : 'text-emerald-700'}`}>
                    {isSent ? '-' : '+'}₹{p.amount}
                  </div>
                  <div className="mt-0.5">{getStatusBadge(p.status)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-400 font-mono">
                <span>{p.timestamp} · Code: {p.matchingCode}</span>
                <span>{p.transportMethod.toUpperCase()}</span>
              </div>

              {p.heldReason && (
                <div className="p-2 bg-amber-50 rounded text-[11px] text-amber-800 font-medium">
                  Note: {p.heldReason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
