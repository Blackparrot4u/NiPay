import React, { useState } from 'react';
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ArrowLeft,
  X,
  ShieldCheck
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { PaymentRecord } from '../../types';

export const UserHistory: React.FC = () => {
  const { payments, navigateTo } = useOfflinePayment();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'received' | 'pending' | 'held'>('all');
  const [selectedTx, setSelectedTx] = useState<PaymentRecord | null>(null);

  const filtered = payments.filter(tx => {
    const matchesSearch =
      tx.counterpartyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.counterpartyPhone.includes(searchTerm);

    if (!matchesSearch) return false;

    if (filterStatus === 'sent') return tx.direction === 'sent';
    if (filterStatus === 'received') return tx.direction === 'received';
    if (filterStatus === 'pending') return tx.status === 'pending';
    if (filterStatus === 'held') return tx.status === 'held';
    return true;
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
        <span className="text-xs text-slate-500">
          Total Transactions: <b className="text-slate-900">{payments.length}</b>
        </span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Transaction History & Ledger Receipts
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete cryptographic audit trail of all peer-to-peer and bank settled transactions.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, phone or Transaction ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto">
            {(['all', 'sent', 'received', 'pending', 'held'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize font-semibold cursor-pointer ${
                  filterStatus === tab
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No transactions matching the criteria.
            </div>
          ) : (
            filtered.map(tx => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.direction === 'sent'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {tx.direction === 'sent' ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                      <span>{tx.counterpartyName}</span>
                      <span className="font-mono text-[10px] text-slate-400">({tx.id})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{tx.timestamp}</span>
                      <span>·</span>
                      <span className="uppercase text-[10px] font-semibold text-slate-600">
                        {tx.transportMethod}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        Code: {tx.matchingCode}
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
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        tx.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : tx.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {tx.status === 'paid' ? 'Settled' : tx.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Cryptographic Payment Proof
              </h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono font-bold text-slate-900">{selectedTx.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold text-slate-900">{selectedTx.amount} Points (₹{selectedTx.amount})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Direction</span>
                <span className="capitalize font-semibold text-slate-800">{selectedTx.direction}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Counterparty</span>
                <span className="font-semibold text-slate-900">{selectedTx.counterpartyName} ({selectedTx.counterpartyPhone})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">2-Digit Code</span>
                <span className="font-mono font-bold text-blue-700">{selectedTx.matchingCode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Channel</span>
                <span className="uppercase font-semibold text-slate-800">{selectedTx.transportMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Timestamp</span>
                <span className="font-mono text-slate-700">{selectedTx.timestamp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Settlement Status</span>
                <span className="uppercase font-bold text-emerald-700">{selectedTx.status}</span>
              </div>

              {selectedTx.heldReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  <div className="font-bold">Hold Reason:</div>
                  <div>{selectedTx.heldReason}</div>
                </div>
              )}

              {selectedTx.pointIds && selectedTx.pointIds.length > 0 && (
                <div className="pt-2">
                  <div className="text-slate-500 font-semibold mb-1">Attached Server Point IDs:</div>
                  <div className="p-2 bg-slate-50 rounded-lg font-mono text-[11px] text-slate-700 space-y-1">
                    {selectedTx.pointIds.map((pid, idx) => (
                      <div key={idx} className="truncate">
                        • {pid}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedTx(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
