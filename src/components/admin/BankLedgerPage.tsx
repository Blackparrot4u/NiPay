import React from 'react';
import { Building2, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const BankLedgerPage: React.FC = () => {
  const { bankLedger } = useOfflinePayment();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <span>Inter-Bank Settlement Ledger (Who Owes Whom)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Atomic net-settlement clearing between participating test member banks for redeemed offline points.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                <th className="py-2.5 px-4">Batch ID</th>
                <th className="py-2.5 px-4">Debtor Member Bank (Issuer)</th>
                <th className="py-2.5 px-4">Creditor Member Bank (Acquirer)</th>
                <th className="py-2.5 px-4 text-right">Settled Points</th>
                <th className="py-2.5 px-4 text-right">Net Rupee Value (₹)</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Clearing Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {bankLedger.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{entry.settlementBatch}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{entry.debtorBank}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{entry.creditorBank}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">
                    {entry.totalPoints.toLocaleString()} pts
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{entry.amountRupees.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      entry.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{entry.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
