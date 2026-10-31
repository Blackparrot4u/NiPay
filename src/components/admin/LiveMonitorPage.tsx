import React, { useState } from 'react';
import { Activity, Search, Filter, ShieldCheck, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const LiveMonitorPage: React.FC = () => {
  const { payments } = useOfflinePayment();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterTransport, setFilterTransport] = useState('ALL');

  const filtered = payments.filter(p => {
    const matchSearch =
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.counterpartyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.counterpartyPhone.includes(searchTerm);
    const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
    const matchTransport = filterTransport === 'ALL' || p.transportMethod === filterTransport;
    return matchSearch && matchStatus && matchTransport;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <span>Live Sync & Settlement Monitor</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Streaming ledger feed of incoming phone pings, offline ID receipts, and settlement vouchers.
          </p>
        </div>

        <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 self-start">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sync Gateway Active</span>
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by ID, party name, or phone..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Settlement Statuses</option>
              <option value="paid">PAID (Settled on Server)</option>
              <option value="pending">PENDING (Offline on Device)</option>
              <option value="held">HELD (Claim Collision Review)</option>
              <option value="refused">REFUSED (Danger or Aborted)</option>
            </select>
          </div>

          <div>
            <select
              value={filterTransport}
              onChange={e => setFilterTransport(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            >
              <option value="ALL">All P2P Channels</option>
              <option value="bluetooth">Bluetooth BLE</option>
              <option value="hotspot">Local Hotspot</option>
              <option value="nfc">NFC Touch</option>
              <option value="qr">Optical QR</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stream Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                <th className="py-2.5 px-4">Transaction ID</th>
                <th className="py-2.5 px-4">Counterparty & Phone</th>
                <th className="py-2.5 px-4">Channel</th>
                <th className="py-2.5 px-4 text-right">Points / Amount</th>
                <th className="py-2.5 px-4">2-Digit Code</th>
                <th className="py-2.5 px-4">Settlement Status</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.id}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{p.counterpartyName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{p.counterpartyPhone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700">
                      {p.transportMethod.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{p.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 font-bold">{p.matchingCode}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      p.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : p.status === 'held'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{p.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
