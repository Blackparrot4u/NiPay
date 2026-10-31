import React, { useState } from 'react';
import {
  ArrowDownLeft,
  QrCode,
  Radio,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  Copy,
  Check
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UserReceive: React.FC = () => {
  const { wallet, receivePayment, navigateTo } = useOfflinePayment();

  const [copied, setCopied] = useState(false);
  const [incomingTransfer, setIncomingTransfer] = useState<{
    senderName: string;
    senderPhone: string;
    amount: number;
    matchingCode: string;
  } | null>(null);

  const [receivedSuccess, setReceivedSuccess] = useState<any>(null);

  const qrData = `NIPAY:RECEIVE:${wallet.phone}:${wallet.id}`;

  const copyQrData = () => {
    navigator.clipboard?.writeText(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const simulateIncomingPayment = () => {
    const code = Math.floor(10 + Math.random() * 90).toString();
    setIncomingTransfer({
      senderName: 'Pooja Sharma',
      senderPhone: '+91 97222 33445',
      amount: 250,
      matchingCode: code
    });
  };

  const handleAccept = async () => {
    if (!incomingTransfer) return;

    const res = await receivePayment({
      senderName: incomingTransfer.senderName,
      senderPhone: incomingTransfer.senderPhone,
      amount: incomingTransfer.amount,
      transportMethod: 'bluetooth'
    });

    if (res.success && res.payment) {
      setReceivedSuccess(res.payment);
      setIncomingTransfer(null);
    }
  };

  const handleRefuse = () => {
    setIncomingTransfer(null);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateTo('/user/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Wallet Hub
        </button>
        <div className="text-xs text-slate-500 font-medium">
          Receive Bucket: <b className="text-emerald-700 font-bold">{wallet.receiveBucketPoints} Pts</b>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Receive Offline Points</h2>
          <p className="text-xs text-slate-500 mt-1">
            Display this QR or hold phones together for NFC / Bluetooth direct peer transfer.
          </p>
        </div>

        {/* QR Code Graphic Display */}
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl inline-block mx-auto relative group">
          <div className="w-48 h-48 bg-white border-2 border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center shadow-xs">
            {/* SVG stylized QR pattern */}
            <svg className="w-40 h-40" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" fill="white" />
              <rect x="10" y="10" width="24" height="24" fill="#0f172a" rx="2" />
              <rect x="14" y="14" width="16" height="16" fill="white" />
              <rect x="18" y="18" width="8" height="8" fill="#0f172a" />

              <rect x="66" y="10" width="24" height="24" fill="#0f172a" rx="2" />
              <rect x="70" y="14" width="16" height="16" fill="white" />
              <rect x="74" y="18" width="8" height="8" fill="#0f172a" />

              <rect x="10" y="66" width="24" height="24" fill="#0f172a" rx="2" />
              <rect x="14" y="70" width="16" height="16" fill="white" />
              <rect x="18" y="74" width="8" height="8" fill="#0f172a" />

              <rect x="42" y="12" width="6" height="12" fill="#0f172a" />
              <rect x="52" y="12" width="6" height="6" fill="#0f172a" />
              <rect x="42" y="28" width="16" height="6" fill="#0f172a" />

              <rect x="12" y="42" width="6" height="16" fill="#0f172a" />
              <rect x="22" y="48" width="12" height="6" fill="#0f172a" />

              <rect x="42" y="42" width="16" height="16" fill="#2563eb" rx="3" />
              <circle cx="50" cy="50" r="4" fill="white" />

              <rect x="66" y="42" width="10" height="6" fill="#0f172a" />
              <rect x="82" y="42" width="8" height="16" fill="#0f172a" />
              <rect x="66" y="54" width="12" height="8" fill="#0f172a" />

              <rect x="42" y="66" width="8" height="24" fill="#0f172a" />
              <rect x="54" y="72" width="6" height="18" fill="#0f172a" />
              <rect x="66" y="66" width="24" height="6" fill="#0f172a" />
              <rect x="74" y="76" width="16" height="14" fill="#0f172a" />
            </svg>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-600">
            <span className="font-mono text-[11px]">{wallet.phone}</span>
            <button
              onClick={copyQrData}
              className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
              title="Copy receiver address"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Listening Status */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>NFC & Bluetooth Ready</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Receive Limit: Up to 10,000 Pts</span>
          </div>
        </div>

        {/* Incoming Transfer Modal / Alert */}
        {incomingTransfer && (
          <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-2xl text-left space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                Incoming Offline Payment Request
              </span>
              <span className="px-2 py-0.5 bg-white border border-blue-300 rounded font-mono text-xs font-bold text-blue-700">
                Code: {incomingTransfer.matchingCode}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">{incomingTransfer.senderName}</div>
                <div className="text-xs text-slate-500 font-mono">{incomingTransfer.senderPhone}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold text-emerald-700">
                  +{incomingTransfer.amount} Pts
                </div>
                <div className="text-[10px] text-slate-400">Cryptographically Signed</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" /> Accept Payment
              </button>
              <button
                onClick={handleRefuse}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <XCircle className="w-4 h-4 inline mr-1 text-slate-400" /> Refuse
              </button>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {receivedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-left text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Received +{receivedSuccess.amount} Points!
            </div>
            <p className="text-[11px] text-emerald-700">
              Transaction ID {receivedSuccess.id} added to Receive Bucket. Will settle on the central bank ledger when online.
            </p>
          </div>
        )}

        {/* Action to test incoming peer payment */}
        {!incomingTransfer && (
          <div className="pt-2">
            <button
              onClick={simulateIncomingPayment}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
            >
              Simulate Peer Scanning My Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
