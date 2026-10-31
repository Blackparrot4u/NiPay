import React, { useState } from 'react';
import { ArrowLeft, QrCode, Radio, Check, X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const ReceiveScreen: React.FC = () => {
  const { wallet, acceptIncomingPayment, refuseIncomingPayment, navigateTo } = useOfflinePayment();

  const [receiveMode, setReceiveMode] = useState<'QR' | 'NFC'>('QR');
  const [incomingState, setIncomingState] = useState<'LISTENING' | 'INCOMING_OFFER' | 'ACCEPTED' | 'REFUSED'>('LISTENING');
  const [offerAmount, setOfferAmount] = useState<number>(350);
  const senderName = 'Vikram Sengupta (Test)';

  const handleSimulateIncoming = () => {
    setIncomingState('INCOMING_OFFER');
  };

  const handleAccept = () => {
    acceptIncomingPayment(offerAmount, senderName);
    setIncomingState('ACCEPTED');
  };

  const handleRefuse = () => {
    refuseIncomingPayment(offerAmount, senderName);
    setIncomingState('REFUSED');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <button
          onClick={() => navigateTo('/user/home')}
          className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-bold text-slate-900">Receive Points Offline</h2>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs">
        <button
          onClick={() => setReceiveMode('QR')}
          className={`py-1.5 rounded-lg font-medium transition-all ${
            receiveMode === 'QR' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
          }`}
        >
          Show QR Code
        </button>
        <button
          onClick={() => setReceiveMode('NFC')}
          className={`py-1.5 rounded-lg font-medium transition-all ${
            receiveMode === 'NFC' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
          }`}
        >
          NFC Touch Beacon
        </button>
      </div>

      {incomingState === 'LISTENING' && (
        <div className="space-y-4 text-center py-2">
          {receiveMode === 'QR' ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl inline-block mx-auto">
              {/* Clean plain SVG QR code representation */}
              <svg className="w-44 h-44 mx-auto" viewBox="0 0 100 100" fill="none">
                <rect x="5" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                <rect x="10" y="10" width="16" height="16" rx="2" fill="white" />
                <rect x="13" y="13" width="10" height="10" rx="1" fill="#0F172A" />

                <rect x="69" y="5" width="26" height="26" rx="4" fill="#0F172A" />
                <rect x="74" y="10" width="16" height="16" rx="2" fill="white" />
                <rect x="77" y="13" width="10" height="10" rx="1" fill="#0F172A" />

                <rect x="5" y="69" width="26" height="26" rx="4" fill="#0F172A" />
                <rect x="10" y="74" width="16" height="16" rx="2" fill="white" />
                <rect x="13" y="77" width="10" height="10" rx="1" fill="#0F172A" />

                {/* Pattern dots */}
                <rect x="36" y="8" width="6" height="6" fill="#0F172A" />
                <rect x="46" y="8" width="6" height="6" fill="#0F172A" />
                <rect x="36" y="20" width="8" height="8" fill="#0F172A" />
                <rect x="50" y="20" width="6" height="6" fill="#0F172A" />
                <rect x="8" y="36" width="6" height="6" fill="#0F172A" />
                <rect x="20" y="36" width="6" height="6" fill="#0F172A" />
                <rect x="36" y="36" width="12" height="12" fill="#2563EB" />
                <rect x="52" y="36" width="8" height="8" fill="#0F172A" />
                <rect x="68" y="36" width="6" height="6" fill="#0F172A" />
                <rect x="36" y="52" width="6" height="6" fill="#0F172A" />
                <rect x="46" y="52" width="12" height="12" fill="#0F172A" />
                <rect x="64" y="52" width="8" height="8" fill="#0F172A" />
                <rect x="36" y="68" width="8" height="8" fill="#0F172A" />
                <rect x="48" y="68" width="8" height="8" fill="#0F172A" />
                <rect x="68" y="68" width="8" height="8" fill="#0F172A" />
              </svg>
              <div className="text-[11px] font-mono text-slate-500 mt-2">
                Wallet: {wallet.phone}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-100/70 flex items-center justify-center text-blue-600 animate-pulse">
                <Radio className="w-8 h-8" />
              </div>
              <span className="text-xs font-semibold text-slate-800 block">NFC Hardware Active</span>
              <p className="text-[11px] text-slate-500">Hold sender's phone to back of device</p>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center text-slate-600">
            <span>Receive Bucket Capacity:</span>
            <span className="font-mono font-bold text-slate-900">{wallet.receiveBucketPoints} / 10,000 pts</span>
          </div>

          <button
            onClick={handleSimulateIncoming}
            className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs rounded-xl transition-colors"
          >
            Simulate Peer Sending ₹350 via Bluetooth
          </button>
        </div>
      )}

      {/* Incoming Offer Alert with Accept or Refuse buttons */}
      {incomingState === 'INCOMING_OFFER' && (
        <div className="p-5 bg-slate-50 border-2 border-blue-600 rounded-2xl space-y-4 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-600 uppercase tracking-wider">Incoming Handover</span>
            <span className="font-mono text-slate-500">Matching Code: 43</span>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900">{senderName}</div>
            <div className="text-xs text-slate-500 font-mono">+91 96333 44556 · Verified KYC</div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-500">Offered Points:</span>
            <span className="font-mono text-2xl font-bold text-emerald-700">₹{offerAmount}</span>
          </div>

          <p className="text-[11px] text-slate-500">
            Offline checker verified server signature, monthly tower shape, and landmine patterns.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleRefuse}
              className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4 text-rose-600" />
              <span>Refuse Payment</span>
            </button>

            <button
              onClick={handleAccept}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Accept & Verify</span>
            </button>
          </div>
        </div>
      )}

      {incomingState === 'ACCEPTED' && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">Points Credited to Receive Bucket</h3>
            <p className="text-xs text-slate-600 font-mono">+₹{offerAmount} (New Bucket: {wallet.receiveBucketPoints} pts)</p>
          </div>
          <button
            onClick={() => navigateTo('/user/home')}
            className="w-full py-2.5 bg-slate-900 text-white font-semibold text-xs rounded-xl"
          >
            Done
          </button>
        </div>
      )}

      {incomingState === 'REFUSED' && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
          <h3 className="text-base font-bold text-slate-900">Payment Refused</h3>
          <p className="text-xs text-slate-600">Handshake aborted. No points were credited.</p>
          <button
            onClick={() => navigateTo('/user/home')}
            className="w-full py-2.5 bg-slate-900 text-white font-semibold text-xs rounded-xl"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};
