import React, { useState } from 'react';
import {
  AlertTriangle,
  FileText,
  Upload,
  CheckCircle2,
  ArrowLeft,
  ShieldAlert,
  BatteryLow,
  Smartphone
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UserDisputes: React.FC = () => {
  const { wallet, submitAppeal, navigateTo } = useOfflinePayment();

  const [disputeType, setDisputeType] = useState<'battery_death' | 'lost_device' | 'unsettled_peer'>('battery_death');
  const [reason, setReason] = useState('');
  const [documentName, setDocumentName] = useState('hardware_enclave_dump.json');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setBusy(true);
    try {
      const ok = await submitAppeal(reason, documentName);
      if (ok) {
        setSubmitted(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateTo('/user/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Wallet Hub
        </button>
        <span className="text-xs text-slate-500">
          Super Admin Resolution Desk: <b className="text-emerald-700">Online</b>
        </span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Disputes, Incident & Cancellation Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            File an official report for battery interruption, phone loss, or conflicting transaction IDs.
          </p>
        </div>

        {submitted ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-emerald-900 text-base">Appeal Successfully Filed</h3>
            <p className="text-xs text-emerald-800 max-w-md mx-auto">
              Your incident report has been registered on the Central Settlement Ledger. A resolution
              decision will be rendered within 48 hours based on hardware cryptographic proofs.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setReason('');
              }}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold"
            >
              File Another Report
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dispute Type selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Incident Category
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'battery_death', label: 'Battery Death During P2P', icon: BatteryLow },
                  { id: 'lost_device', label: 'Lost / Decommissioned Phone', icon: Smartphone },
                  { id: 'unsettled_peer', label: 'Peer Collusion / Double-Spend', icon: ShieldAlert }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = disputeType === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setDisputeType(item.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 text-blue-900 shadow-2xs font-semibold'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1 text-blue-600" />
                      <div className="text-xs">{item.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explanation */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Detailed Explanation & Circumstances
              </label>
              <textarea
                rows={4}
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Describe what occurred (e.g., Device shut down at 2% battery during Bluetooth handshake while sending 150 points to vendor...)"
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            {/* Document attachment placeholder */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Attached Hardware Proof / Log Document
              </label>
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-mono flex-1 truncate">{documentName}</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                  Auto-Enclave Dump
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !reason.trim()}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Submitting to Central Settlement Desk...' : 'Submit Incident Appeal'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
