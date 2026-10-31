import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  Bluetooth,
  Wifi,
  QrCode,
  Radio,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  Fingerprint,
  RefreshCw,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

interface PeerDevice {
  name: string;
  phone: string;
  distance: string;
  kycVerified: boolean;
  isDanger: boolean;
}

const nearbyPeers: PeerDevice[] = [
  {
    name: 'Rajesh Fruit Stall',
    phone: '+91 98111 22334',
    distance: '0.8 meters',
    kycVerified: true,
    isDanger: false
  },
  {
    name: 'Pooja Sharma (Merchant)',
    phone: '+91 97222 33445',
    distance: '1.4 meters',
    kycVerified: true,
    isDanger: false
  },
  {
    name: 'Vikram Sengupta',
    phone: '+91 96333 44556',
    distance: '2.1 meters',
    kycVerified: true,
    isDanger: false
  },
  {
    name: 'Unknown Peer (Flagged Collusion)',
    phone: '+91 91999 88877',
    distance: '0.5 meters',
    kycVerified: false,
    isDanger: true
  }
];

export const UserPayConnect: React.FC = () => {
  const { wallet, sendPayment, navigateTo, playBeep } = useOfflinePayment();

  // Steps: 1: select method & peer, 2: enter amount & code verification, 3: progress & hold, 4: success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [transport, setTransport] = useState<'bluetooth' | 'hotspot' | 'nfc' | 'qr'>('bluetooth');
  const [selectedPeer, setSelectedPeer] = useState<PeerDevice | null>(null);
  const [amount, setAmount] = useState<number>(150);
  const [pin, setPin] = useState<string>('1234');
  const [matchingCode, setMatchingCode] = useState<string>('74');
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<any>(null);

  // Generate a random 2-digit matching code when selecting peer
  const handleSelectPeer = (peer: PeerDevice) => {
    setSelectedPeer(peer);
    const code = Math.floor(10 + Math.random() * 90).toString();
    setMatchingCode(code);
    setErrorMsg(null);
    setStep(2);
  };

  const handleStartPayment = async () => {
    if (!selectedPeer) return;
    if (amount <= 0) {
      setErrorMsg('Please enter a valid payment amount.');
      return;
    }
    if (amount > wallet.sendBucketPoints) {
      setErrorMsg(`Insufficient points in Send Bucket. Available: ${wallet.sendBucketPoints} Pts.`);
      return;
    }
    if (pin.length < 4) {
      setErrorMsg('Please enter your 4-digit security PIN.');
      return;
    }

    setErrorMsg(null);
    setStep(3);
    setProgress(15);

    // Simulated offline peer cryptographic handshake
    const timer1 = setTimeout(() => setProgress(45), 400);
    const timer2 = setTimeout(() => setProgress(80), 900);
    const timer3 = setTimeout(async () => {
      setProgress(100);
      try {
        const res = await sendPayment({
          recipientName: selectedPeer.name,
          recipientPhone: selectedPeer.phone,
          amount,
          transportMethod: transport
        });

        if (res.success && res.payment) {
          setTxResult(res.payment);
          setStep(4);
        } else {
          setErrorMsg(res.error || 'Payment failed during cryptographic handover.');
          setStep(2);
        }
      } catch {
        setErrorMsg('Transfer failed.');
        setStep(2);
      }
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateTo('/user/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Wallet Hub
        </button>
        <div className="text-xs text-slate-500 font-medium">
          Send Bucket: <b className="text-slate-900 font-bold">{wallet.sendBucketPoints} Pts</b>
        </div>
      </div>

      {/* Step 1: Select Transport & Peer */}
      {step === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Offline P2P Payment</h2>
            <p className="text-xs text-slate-500 mt-1">
              Select an offline wireless channel to detect nearby NiPay recipient devices.
            </p>
          </div>

          {/* Transport Method Selector */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth, desc: 'Enclave BLE' },
              { id: 'nfc', label: 'NFC Tap', icon: Radio, desc: 'Contactless' },
              { id: 'qr', label: 'QR Scan', icon: QrCode, desc: 'Visual Key' },
              { id: 'hotspot', label: 'Hotspot', icon: Wifi, desc: 'Direct Wi-Fi' }
            ].map(item => {
              const Icon = item.icon;
              const isSelected = transport === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTransport(item.id as any)}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mx-auto mb-1 ${
                      isSelected ? 'text-blue-600' : 'text-slate-500'
                    }`}
                  />
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Peer List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                Nearby Devices Found ({nearbyPeers.length})
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-500" /> Scanning
              </span>
            </div>

            <div className="space-y-2">
              {nearbyPeers.map(peer => (
                <div
                  key={peer.phone}
                  onClick={() => handleSelectPeer(peer)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    peer.isDanger
                      ? 'border-amber-200 hover:border-amber-400 bg-amber-50/20'
                      : 'border-slate-200 hover:border-blue-500 bg-white hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        peer.isDanger
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {peer.isDanger ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>{peer.name}</span>
                        {peer.kycVerified ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> KYC Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Unverified
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {peer.phone} · Signal range {peer.distance}
                      </div>
                    </div>
                  </div>

                  <button className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold">
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Payment Details, 2-Digit Matching Code, Security Warning */}
      {step === 2 && selectedPeer && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Verify & Authorize</h2>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Change Peer
            </button>
          </div>

          {/* DANGER WARNING GUARDRAIL (Clean English, No Hindi) */}
          {selectedPeer.isDanger && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                    Security Guardrail Alert
                  </h4>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    This person may be dangerous or flagged on the network. You may not receive
                    reimbursement or settlement for points transferred to flagged devices.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2-Digit Matching Security Code Box */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                Matching Verification Code
              </div>
              <div className="text-xs text-blue-700 mt-0.5">
                Ensure this 2-digit code matches the code on recipient's screen.
              </div>
            </div>
            <div className="px-4 py-2 bg-white border-2 border-blue-600 rounded-xl font-mono text-2xl font-extrabold text-blue-700 shadow-xs">
              {matchingCode}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Amount to Pay (Points)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max={wallet.sendBucketPoints}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full text-2xl font-bold text-slate-900 px-4 py-3 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-4 top-4 text-xs font-bold text-slate-400">
                PTS
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Spend Bucket Balance: {wallet.sendBucketPoints} Pts</span>
              <button
                type="button"
                onClick={() => setAmount(Math.min(500, wallet.sendBucketPoints))}
                className="text-blue-600 hover:underline font-medium"
              >
                Set 500 Pts
              </button>
            </div>
          </div>

          {/* Security PIN / Biometrics */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              Security PIN
            </label>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Enter 4-digit PIN (default: 1234)"
              className="w-full text-sm px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400">
              Cryptographically signed within phone hardware enclave.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={handleStartPayment}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Fingerprint className="w-4 h-4" />
            Authorize {amount} Points to {selectedPeer.name}
          </button>
        </div>
      )}

      {/* Step 3: Hold Until the Beep Progress State */}
      {step === 3 && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 border border-blue-200 mx-auto flex items-center justify-center animate-pulse">
            <Bluetooth className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-slate-900">Hold until the beep</h3>
            <p className="text-xs text-slate-500">
              Transferring cryptographically signed Ed25519 point tokens to peer device...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 max-w-sm mx-auto">
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs font-mono font-semibold text-slate-600">
              {progress}% Handshake Signed
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 max-w-xs mx-auto">
            Keep phones within 2 meters of each other.
          </div>
        </div>
      )}

      {/* Step 4: Success Result */}
      {step === 4 && txResult && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-extrabold text-slate-900">Payment Completed</h3>
            <p className="text-xs text-slate-500">
              {amount} points transferred securely to {selectedPeer?.name}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-sm mx-auto text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction ID:</span>
              <span className="font-mono font-bold text-slate-900">{txResult.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Matching Code:</span>
              <span className="font-mono font-bold text-blue-700">{matchingCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Channel:</span>
              <span className="uppercase font-semibold text-slate-800">{transport}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">New Send Bucket:</span>
              <span className="font-bold text-slate-900">{wallet.sendBucketPoints} Pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="text-emerald-700 font-bold uppercase">
                {txResult.status === 'paid' ? 'Settled on Cloud' : 'Queued (Offline Secure)'}
              </span>
            </div>
          </div>

          <div className="flex gap-3 max-w-sm mx-auto">
            <button
              onClick={() => {
                setStep(1);
                setSelectedPeer(null);
                setAmount(100);
              }}
              className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Make Another Payment
            </button>
            <button
              onClick={() => navigateTo('/user/home')}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
