import React, { useState } from 'react';
import { Users, Search, Ban, CheckCircle2, ShieldAlert, FileText, AlertCircle } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UsersWalletsPage: React.FC = () => {
  const { wallet, suspendUserOffline } = useOfflinePayment();

  const [searchTerm, setSearchTerm] = useState('');
  const [suspendReason, setSuspendReason] = useState('Anomalous burst of un-anchored offline handovers');
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  // Mock list of test users
  const mockUsers = [
    {
      id: wallet.id,
      name: wallet.name,
      phone: wallet.phone,
      kyc: wallet.kycStatus,
      sendBucket: wallet.sendBucketPoints,
      receiveBucket: wallet.receiveBucketPoints,
      trustScore: wallet.trustScore,
      device: 'Pixel 8 Pro (Hardware TEE)',
      offlineSuspended: wallet.offlineSuspended
    },
    {
      id: 'usr_wallet_002',
      name: 'Rajesh Fruit Stall (Test)',
      phone: '+91 98111 22334',
      kyc: 'VERIFIED',
      sendBucket: 1200,
      receiveBucket: 4800,
      trustScore: 780,
      device: 'Galaxy S24 (Knox Enclave)',
      offlineSuspended: false
    },
    {
      id: 'usr_wallet_003',
      name: 'Pooja Sharma (Test)',
      phone: '+91 97222 33445',
      kyc: 'VERIFIED',
      sendBucket: 800,
      receiveBucket: 1950,
      trustScore: 710,
      device: 'OnePlus 12 (TEE Enclave)',
      offlineSuspended: false
    },
    {
      id: 'usr_wallet_004',
      name: 'Rohan Mehta (Flagged Test Node)',
      phone: '+91 95444 00000',
      kyc: 'REJECTED',
      sendBucket: 0,
      receiveBucket: 0,
      trustScore: 340,
      device: 'Rooted Emulator (Bypassed Attest)',
      offlineSuspended: true
    }
  ];

  const filtered = mockUsers.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone.includes(searchTerm)
  );

  const handleToggleSuspend = (phone: string) => {
    suspendUserOffline(phone, suspendReason);
    setShowSuspendModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users and Wallets Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit test user KYC attestations, send/receive bucket allocations, trust scores, and hardware sessions.
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by user or phone..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                <th className="py-2.5 px-4">User & Contact</th>
                <th className="py-2.5 px-4">KYC Status</th>
                <th className="py-2.5 px-4 text-right">Send Bucket</th>
                <th className="py-2.5 px-4 text-right">Receive Bucket</th>
                <th className="py-2.5 px-4 text-center">Trust Score (300-850)</th>
                <th className="py-2.5 px-4">Hardware Attestation</th>
                <th className="py-2.5 px-4 text-right">Offline Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.phone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      u.kyc === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {u.kyc}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {u.sendBucket} / 2,000 pts
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                    {u.receiveBucket} / 10,000 pts
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold">
                    <span className={u.trustScore > 700 ? 'text-emerald-700' : u.trustScore > 500 ? 'text-amber-700' : 'text-rose-700'}>
                      {u.trustScore}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {u.device}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleToggleSuspend(u.phone)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        u.offlineSuspended
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {u.offlineSuspended ? 'Resume Offline' : 'Suspend Offline'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
