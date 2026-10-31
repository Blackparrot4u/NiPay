import React, { useState } from 'react';
import { FileText, Search, ShieldCheck, Lock } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const AuditLogPage: React.FC = () => {
  const { auditLogs } = useOfflinePayment();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = auditLogs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.targetId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-800" />
            <span>Unchangeable Administrative Audit Log</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Append-only tamper-evident log capturing every administrative decision, permit rotation, and claim resolution.
          </p>
        </div>

        <span className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 self-start">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>WORM Sealed (Write Once Read Many)</span>
        </span>
      </div>

      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search audit trail..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                <th className="py-2.5 px-4">Audit ID</th>
                <th className="py-2.5 px-4">Action Type</th>
                <th className="py-2.5 px-4">Admin Officer & Role</th>
                <th className="py-2.5 px-4">Target Entity</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors font-mono">
                  <td className="py-3 px-4 font-bold text-slate-900">{log.id}</td>
                  <td className="py-3 px-4 font-bold text-blue-700">{log.action}</td>
                  <td className="py-3 px-4 font-sans">
                    <div className="font-semibold text-slate-900">{log.adminName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{log.role}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-800">{log.targetId}</td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">{log.timestamp}</td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
