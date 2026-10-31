import React, { useState } from 'react';
import {
  ArrowLeft,
  QrCode,
  Radio,
  Bluetooth,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Wifi
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { STRINGS } from '../../utils/i18n';

interface PeerDevice {
  id: string;
  name: string;
  phone: string;
  kycVerified: boolean;
  type: 'bluetooth' | 'hotspot';
  distance: string;
  securityCode: string;
}

export const PayConnectScreen: React.FC = () => {
  const { wallet, navigateTo } = useOfflinePayment();
  const strings = STRINGS[wallet.preferredLanguage];

  const [connectMethod, setConnectMethod] = useState<'NEARBY' | 'QR' | 'NFC'>('NEARBY');
  const [selectedPeer, setSelectedPeer] = useState<PeerDevice | null>(null);

  const mockPeers: PeerDevice[] = [
    {
      id: 'dev_1',
      name: 'Rajesh Fruit Stall (Test)',
      phone: '+91 98111 22334',
      kycVerified: true,
      type: 'bluetooth',
      distance: '0.8 meters',
      securityCode: '74'
    },
    {
      id: 'dev_2',
      name: 'Pooja Sharma (Test)',
      phone: '+91 97222 33445',
      kycVerified: true,
      type: 'bluetooth',
      distance: '1.4 meters',
      securityCode: '19'
    },
    {
      id: 'dev_3',
      name: 'Untrusted Peer Hotspot (Test Flagged)',
      phone: '+91 95444 00000',
      kycVerified: false,
      type: 'hotspot',
      distance: '2.5 meters',
      securityCode: '88'
    }
  ];

  const handleSelectPeer = (peer: PeerDevice) => {
    setSelectedPeer(peer);
  };

  const handleProceed = () => {
    if (!selectedPeer) return;
    if (selectedPeer.name.includes('Untrusted')) {
      // Directs to mandated Danger Warning screen!
      navigateTo('/user/danger-warning');
    } else {
      navigateTo('/user/pay-details');
    }
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
        <h2 className="text-base font-bold text-slate-900">Pay: Connect Peer Device</h2>
      </div>

      {/* Method tabs */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs">
        <button
          type="button"
          onClick={() => setConnectMethod('NEARBY')}
          className={`py-2 px-2 rounded-lg font-medium transition-all ${
            connectMethod === 'NEARBY' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Nearby BLE / Hotspot
        </button>
        <button
          type="button"
          onClick={() => setConnectMethod('QR')}
          className={`py-2 px-2 rounded-lg font-medium transition-all ${
            connectMethod === 'QR' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Scan QR Code
        </button>
        <button
          type="button"
          onClick={() => setConnectMethod('NFC')}
          className={`py-2 px-2 rounded-lg font-medium transition-all ${
            connectMethod === 'NFC' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          NFC Touch Tap
        </button>
      </div>

      {connectMethod === 'NEARBY' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Discovered Nearby Devices (No Internet Required):</span>
            <span className="font-mono text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Broadcasting
            </span>
          </div>

          {/* List of nearby devices */}
          <div className="space-y-2">
            {mockPeers.map(peer => {
              const isSelected = selectedPeer?.id === peer.id;
              return (
                <div
                  key={peer.id}
                  onClick={() => handleSelectPeer(peer)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-600 text-slate-900 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      {peer.type === 'bluetooth' ? <Bluetooth className="w-5 h-5 text-blue-600" /> : <Wifi className="w-5 h-5 text-indigo-600" />}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>{peer.name}</span>
                        {peer.kycVerified && (
                          <span className="text-[10px] text-emerald-700 font-mono">· KYC Verified</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {peer.phone} · {peer.distance}
                      </div>
                    </div>
                  </div>

                  {/* Mandated Matching 2-digit code on both screens */}
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-sans">Pairing Code</div>
                    <div className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {peer.securityCode}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2-digit confirmation note */}
          {selectedPeer && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <span className="text-slate-500">{strings.matchingCodeNotice}</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono font-bold text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-300">
                  {selectedPeer.securityCode}
                </span>
                <p className="text-[11px] text-slate-500">
                  Make sure this number matches on recipient's screen before transmitting 20-character IDs.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleProceed}
            disabled={!selectedPeer}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Proceed to Payment Details</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {connectMethod === 'QR' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-48 h-48 mx-auto bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-500">
            <QrCode className="w-12 h-12 text-slate-400 mb-2" />
            <span className="text-xs font-medium">Scanning for Peer QR...</span>
            <span className="text-[10px] text-slate-400 mt-1">Camera active in TEE sandbox</span>
          </div>
          <button
            onClick={() => {
              setSelectedPeer(mockPeers[0]);
              setConnectMethod('NEARBY');
            }}
            className="text-xs text-blue-600 font-medium underline"
          >
            Simulate instant QR handshake with Rajesh Fruit Stall
          </button>
        </div>
      )}

      {connectMethod === 'NFC' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 animate-pulse">
            <Radio className="w-10 h-10" />
          </div>
          <div className="text-xs text-slate-600">
            <span className="font-semibold block text-slate-800">Tap devices back-to-back</span>
            NFC Secure Element will exchange matching 2-digit key and start Bluetooth ID packet transfer.
          </div>
          <button
            onClick={() => {
              setSelectedPeer(mockPeers[0]);
              setConnectMethod('NEARBY');
            }}
            className="text-xs text-blue-600 font-medium underline"
          >
            Simulate NFC physical touch with Rajesh Fruit Stall
          </button>
        </div>
      )}
    </div>
  );
};
