import React, { useState, useEffect } from 'react';
import { ArrowLeft, Lock, Fingerprint, Radio, Volume2, ShieldCheck, Check } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { STRINGS } from '../../utils/i18n';

export const PayConfirmScreen: React.FC = () => {
  const { wallet, confirmPaymentHandover, navigateTo } = useOfflinePayment();
  const strings = STRINGS[wallet.preferredLanguage];

  const amount = Number(sessionStorage.getItem('pending_pay_amount') || '150');
  const recipient = sessionStorage.getItem('pending_pay_recipient') || 'Rajesh Fruit Stall (Test)';

  const [pin, setPin] = useState('1234');
  const [useBiometric, setUseBiometric] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartHandover = () => {
    setIsTransmitting(true);
    setProgress(10);
  };

  useEffect(() => {
    if (!isTransmitting) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          // Confirm payment handover, which plays the real audio beep!
          const txId = `TXN-${Math.floor(1000 + Math.random() * 9000)}`;
          confirmPaymentHandover(txId);

          sessionStorage.setItem('last_result_status', 'SUCCESS');
          sessionStorage.setItem('last_result_amount', amount.toString());
          sessionStorage.setItem('last_result_recipient', recipient);

          setTimeout(() => {
            navigateTo('/user/result');
          }, 300);
          return 100;
        }
        return prev + 25;
      });
    }, 350);

    return () => clearInterval(timer);
  }, [isTransmitting, amount, recipient, confirmPaymentHandover, navigateTo]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <button
          onClick={() => navigateTo('/user/pay-details')}
          disabled={isTransmitting}
          className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-bold text-slate-900">Pay: Confirm & Authorize Handover</h2>
      </div>

      {/* Summary card */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-center">
        <span className="text-xs text-slate-500">Transmitting to {recipient}</span>
        <div className="text-3xl font-mono font-bold text-slate-900">₹{amount}</div>
        <div className="text-[11px] text-slate-500 font-mono">
          Packing 20-character server-signed point IDs from Send Bucket
        </div>
      </div>

      {/* Handover transmission state */}
      {isTransmitting ? (
        <div className="py-6 space-y-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 border-2 border-blue-600 flex items-center justify-center text-blue-600 animate-pulse">
            <Radio className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            {/* The mandated "Hold until the beep" message */}
            <div className="text-sm font-bold text-slate-900 flex items-center justify-center gap-1.5">
              <Volume2 className="w-4 h-4 text-blue-600 animate-bounce" />
              <span>{strings.holdUntilBeep}</span>
            </div>
            <p className="text-xs text-slate-500">
              Exchanging device-signed vouchers and receiving cryptographic ACK over Bluetooth.
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[11px] font-mono text-slate-400">{progress}% Encrypted Packet Transferred</div>
        </div>
      ) : (
        /* PIN or Biometric selection */
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setUseBiometric(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                !useBiometric ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Enter PIN
            </button>
            <button
              type="button"
              onClick={() => setUseBiometric(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                useBiometric ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Biometrics / Fingerprint
            </button>
          </div>

          {useBiometric ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
              <Fingerprint className="w-12 h-12 text-slate-800 mx-auto animate-pulse" />
              <span className="text-xs font-semibold text-slate-700 block">Touch fingerprint sensor</span>
              <span className="text-[11px] text-slate-400">Play Integrity / Hardware Key Attestation active</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-slate-700">Enter 4-Digit Wallet PIN</label>
                <span className="text-slate-400 font-mono text-[11px]">Demo: 1234</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleStartHandover}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
          >
            Authorize & Start Handover
          </button>
        </div>
      )}
    </div>
  );
};
