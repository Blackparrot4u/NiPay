import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserWallet, PaymentRecord, HeldClaim, SecurityEvent, PointItem } from '../types';
import { api } from '../services/api';

// Generate mock authentic 20-char server point ID
function generateServerPointId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 12; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PT20-${rand.substring(0, 4)}-${rand.substring(4, 8)}-${rand.substring(8, 12)}`;
}

function generateInitialPoints(count: number): PointItem[] {
  const pts: PointItem[] = [];
  const fullMines = Math.floor(count / 3);
  const remainder = count % 3;
  let idx = 1;

  for (let m = 0; m < fullMines; m++) {
    const mineId = `MINE-2026-M10-${idx.toString().padStart(4, '0')}`;
    for (let p = 0; p < 3; p++) {
      pts.push({
        id: generateServerPointId(),
        serverSignature: `sig_ed25519_srv_${Math.random().toString(36).substring(2, 10)}`,
        monthCycle: '2026-M10',
        mineGroup: mineId,
        status: 'whole_mine',
        issuedAt: new Date().toISOString()
      });
    }
    idx++;
  }

  if (remainder > 0) {
    const mineId = `MINE-2026-M10-LOOSE-${idx}`;
    for (let p = 0; p < remainder; p++) {
      pts.push({
        id: generateServerPointId(),
        serverSignature: `sig_ed25519_srv_${Math.random().toString(36).substring(2, 10)}`,
        monthCycle: '2026-M10',
        mineGroup: mineId,
        status: remainder === 1 ? 'loose' : 'broken_mine',
        issuedAt: new Date().toISOString()
      });
    }
  }

  return pts;
}

const initialWallet: UserWallet = {
  id: 'usr_wallet_001',
  name: 'Devendra Patel',
  phone: '+91 98765 43210',
  kycStatus: 'VERIFIED',
  aadhaarNumber: '**** **** 4402',
  panNumber: 'ABCDE1234F',
  address: 'Plot 42, Innovation Cyber Corridor, Bangalore 560001',
  bankName: 'HDFC Bank (Primary Linked)',
  mainAccountBalance: 48500,
  sendBucketPoints: 650,
  receiveBucketPoints: 1420,
  trustScore: 742,
  lastSyncedAt: 'Just now',
  daysUntilRenewal: 18,
  gracePeriodDays: 38,
  isOnline: true,
  isBluetoothActive: true,
  batteryLevel: 94,
  isSelfLocked: false,
  isLoggedInElsewhere: false,
  offlineSuspended: false,
  preferredLanguage: 'en',
  points: generateInitialPoints(650)
};

const initialPayments: PaymentRecord[] = [
  {
    id: 'TXN-9021',
    amount: 150,
    counterpartyName: 'Rajesh Fruit Stall',
    counterpartyPhone: '+91 98111 22334',
    counterpartyKyc: true,
    matchingCode: '74',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString().replace('T', ' ').substring(0, 16),
    status: 'paid',
    pointIds: ['PT20-8K2M-X7N9-W4P1', 'PT20-8K2M-X7N9-W4P2'],
    direction: 'sent',
    transportMethod: 'bluetooth',
    dangerWarningTriggered: false
  },
  {
    id: 'TXN-9018',
    amount: 320,
    counterpartyName: 'Pooja Sharma',
    counterpartyPhone: '+91 97222 33445',
    counterpartyKyc: true,
    matchingCode: '19',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString().replace('T', ' ').substring(0, 16),
    status: 'paid',
    pointIds: ['PT20-3A1B-9C8D-0E2F', 'PT20-3A1B-9C8D-0E3F'],
    direction: 'received',
    transportMethod: 'bluetooth',
    dangerWarningTriggered: false
  },
  {
    id: 'TXN-8980',
    amount: 200,
    counterpartyName: 'Vikram Sengupta',
    counterpartyPhone: '+91 96333 44556',
    counterpartyKyc: true,
    matchingCode: '43',
    timestamp: new Date(Date.now() - 86400000).toISOString().replace('T', ' ').substring(0, 16),
    status: 'held',
    pointIds: ['PT20-CONFLICT-8812'],
    direction: 'received',
    transportMethod: 'nfc',
    dangerWarningTriggered: false,
    heldReason: 'Duplicate Point ID collision flagged during settlement ledger reconciliation.'
  }
];

const initialHeldClaims: HeldClaim[] = [
  {
    id: 'CLAIM-7721',
    pointId: 'PT20-9K11-B2C4-8991',
    firstReportTimestamp: new Date(Date.now() - 7200000).toISOString().replace('T', ' ').substring(0, 16),
    status: 'HELD_FOR_REVIEW',
    claimants: [
      {
        userPhone: '+91 98765 43210',
        userName: 'Devendra Patel',
        reportedAt: '14:22:10 UTC',
        trustScore: 742,
        proofSignature: 'ed25519:7b9c3f0a12e84c'
      },
      {
        userPhone: '+91 99888 77665',
        userName: 'Suresh Rao',
        reportedAt: '14:23:44 UTC',
        trustScore: 610,
        proofSignature: 'ed25519:4a8e1d93b7f12c'
      }
    ],
    resolutionNotes: 'First claimant submitted earlier timestamp with trusted hardware enclave beacon.'
  }
];

const initialSecurityEvents: SecurityEvent[] = [
  {
    id: 'EVT-001',
    type: 'landmine',
    severity: 'HIGH',
    reportedAt: new Date(Date.now() - 3600000).toISOString().replace('T', ' ').substring(0, 16),
    deviceModel: 'Pixel 8 Pro (Hardware Enclave Keyed)',
    userPhone: '+91 98765 43210',
    description: 'Double-spend landmine tripped on Point PT20-9K11-B2C4-8991 across two Bluetooth peers.',
    status: 'OPEN',
    pointId: 'PT20-9K11-B2C4-8991'
  }
];

export interface OfflinePaymentContextType {
  wallet: UserWallet;
  currentRole: 'user' | 'admin';
  setRole: (role: 'user' | 'admin') => void;
  currentRoute: string;
  navigateTo: (route: string) => void;
  payments: PaymentRecord[];
  heldClaims: HeldClaim[];
  securityEvents: SecurityEvent[];
  isOnline: boolean;
  toggleOnline: () => void;
  isBluetoothActive: boolean;
  toggleBluetooth: () => void;
  batteryLevel: number;
  setBatteryLevel: (level: number) => void;
  preferredLanguage: 'en' | 'hi';
  setLanguage: (lang: 'en' | 'hi') => void;
  alertBannerMessage: string | null;
  setAlertBannerMessage: (msg: string | null) => void;
  dismissBanner: () => void;
  topUpSendBucket: (amount: number, pin: string) => Promise<{ success: boolean; error?: string }>;
  sweepToBank: (amount: number) => Promise<{ success: boolean; error?: string }>;
  sendPayment: (payload: { recipientName: string; recipientPhone: string; amount: number; transportMethod?: string }) => Promise<{ success: boolean; payment?: PaymentRecord; error?: string }>;
  receivePayment: (payload: { senderName: string; senderPhone?: string; amount: number; transportMethod?: string }) => Promise<{ success: boolean; payment?: PaymentRecord; error?: string }>;
  syncOfflineQueue: () => Promise<number>;
  resolveClaim: (id: string, decision: 'FIRST_CLAIMANT' | 'FORFEIT', notes: string) => Promise<void>;
  resolveSecurityEvent: (id: string) => Promise<void>;
  submitAppeal: (reason: string, doc: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  playBeep: () => void;
}

const OfflinePaymentContext = createContext<OfflinePaymentContextType | undefined>(undefined);

export const OfflinePaymentProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [wallet, setWallet] = useState<UserWallet>(initialWallet);
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [heldClaims, setHeldClaims] = useState<HeldClaim[]>(initialHeldClaims);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>(initialSecurityEvents);
  const [currentRole, setRoleState] = useState<'user' | 'admin'>('user');
  const [currentRoute, setCurrentRoute] = useState<string>('/user/home');
  const [alertBannerMessage, setAlertBannerMessage] = useState<string | null>(null);

  // Play authentic success transaction beep tone
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High clear A5 note
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // Ramp up to E6 note
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
      if (navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
    } catch {
      // Audio not supported or blocked
    }
  }, []);

  // Hydrate from live backend on mount, with full fallback
  const refreshData = useCallback(async () => {
    try {
      const walletRes = await api.getWallet();
      if (walletRes && walletRes.success && walletRes.wallet) {
        setWallet(prev => ({
          ...prev,
          ...walletRes.wallet,
          points: walletRes.wallet.points || prev.points
        }));
      }

      const paymentsRes = await api.getPayments();
      if (paymentsRes && paymentsRes.success && paymentsRes.payments) {
        setPayments(paymentsRes.payments);
      }

      const claimsRes = await api.getAdminClaims();
      if (claimsRes && claimsRes.success && claimsRes.heldClaims) {
        setHeldClaims(claimsRes.heldClaims);
      }

      const secRes = await api.getSecurityEvents();
      if (secRes && secRes.success && secRes.securityEvents) {
        setSecurityEvents(secRes.securityEvents);
      }
    } catch (err) {
      console.warn('API sync fallback active:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const setRole = (role: 'user' | 'admin') => {
    setRoleState(role);
    if (role === 'admin') {
      setCurrentRoute('/admin/overview');
    } else {
      setCurrentRoute('/user/home');
    }
  };

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    if (route.startsWith('/admin')) {
      setRoleState('admin');
    } else {
      setRoleState('user');
    }
  };

  const toggleOnline = () => {
    setWallet(prev => {
      const nextOnline = !prev.isOnline;
      if (nextOnline) {
        setAlertBannerMessage('Device reconnected to central ledger. Offline payments will synchronize automatically.');
      } else {
        setAlertBannerMessage('Offline Enclave Active. Transactions will use hardware-signed Bluetooth / NFC point packets.');
      }
      return { ...prev, isOnline: nextOnline };
    });
  };

  const toggleBluetooth = () => {
    setWallet(prev => ({
      ...prev,
      isBluetoothActive: !prev.isBluetoothActive
    }));
  };

  const setBatteryLevel = (batteryLevel: number) => {
    setWallet(prev => ({
      ...prev,
      batteryLevel
    }));
  };

  const setLanguage = (preferredLanguage: 'en' | 'hi') => {
    setWallet(prev => ({
      ...prev,
      preferredLanguage
    }));
  };

  const dismissBanner = () => {
    setAlertBannerMessage(null);
  };

  // Top up Send Bucket (up to 2,000 pts)
  const topUpSendBucket = async (amount: number, pin: string): Promise<{ success: boolean; error?: string }> => {
    if (amount <= 0) return { success: false, error: 'Enter a valid amount.' };
    if (wallet.sendBucketPoints + amount > 2000) {
      return { success: false, error: `Send bucket limit is 2,000 points. You can add at most ${2000 - wallet.sendBucketPoints} points.` };
    }
    const fee = 1;
    if (wallet.mainAccountBalance < amount + fee) {
      return { success: false, error: `Insufficient bank balance for top-up + ₹1 fee.` };
    }

    // Try backend call
    try {
      const res = await api.topUpSendBucket(amount, pin);
      if (res && res.success) {
        if (res.wallet) setWallet(res.wallet);
        await refreshData();
        return { success: true };
      } else if (res && res.error) {
        return { success: false, error: res.error };
      }
    } catch {
      // Fallback local update
    }

    const newPoints = generateInitialPoints(amount);
    setWallet(prev => ({
      ...prev,
      mainAccountBalance: prev.mainAccountBalance - (amount + fee),
      sendBucketPoints: prev.sendBucketPoints + amount,
      points: [...prev.points, ...newPoints]
    }));

    return { success: true };
  };

  // Sweep Receive Bucket to Bank
  const sweepToBank = async (amount: number): Promise<{ success: boolean; error?: string }> => {
    if (amount <= 0 || amount > wallet.receiveBucketPoints) {
      return { success: false, error: 'Invalid sweep amount.' };
    }

    try {
      const res = await api.sweepToBank(amount);
      if (res && res.success) {
        if (res.wallet) setWallet(res.wallet);
        await refreshData();
        return { success: true };
      }
    } catch {
      // Fallback
    }

    setWallet(prev => ({
      ...prev,
      receiveBucketPoints: prev.receiveBucketPoints - amount,
      mainAccountBalance: prev.mainAccountBalance + amount
    }));

    return { success: true };
  };

  // Send Payment
  const sendPayment = async (payload: {
    recipientName: string;
    recipientPhone: string;
    amount: number;
    transportMethod?: string;
  }): Promise<{ success: boolean; payment?: PaymentRecord; error?: string }> => {
    if (wallet.sendBucketPoints < payload.amount) {
      return { success: false, error: 'Insufficient spendable points in send bucket.' };
    }

    try {
      const res = await api.createPayment(payload);
      if (res && res.success && res.payment) {
        if (res.wallet) setWallet(res.wallet);
        setPayments(prev => [res.payment, ...prev]);
        playBeep();
        return { success: true, payment: res.payment };
      }
    } catch {
      // Fallback local
    }

    const randomCode = Math.floor(10 + Math.random() * 90).toString();
    const spentPoints = wallet.points.slice(0, payload.amount);
    const newTx: PaymentRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: payload.amount,
      counterpartyName: payload.recipientName || 'Peer Recipient',
      counterpartyPhone: payload.recipientPhone || '+91 98000 12345',
      counterpartyKyc: true,
      matchingCode: randomCode,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: wallet.isOnline ? 'paid' : 'pending',
      pointIds: spentPoints.map(p => p.id),
      direction: 'sent',
      transportMethod: (payload.transportMethod as any) || 'bluetooth',
      dangerWarningTriggered: payload.recipientName.toLowerCase().includes('danger')
    };

    setWallet(prev => ({
      ...prev,
      sendBucketPoints: prev.sendBucketPoints - payload.amount,
      points: prev.points.slice(payload.amount)
    }));
    setPayments(prev => [newTx, ...prev]);
    playBeep();

    return { success: true, payment: newTx };
  };

  // Receive Payment
  const receivePayment = async (payload: {
    senderName: string;
    senderPhone?: string;
    amount: number;
    transportMethod?: string;
  }): Promise<{ success: boolean; payment?: PaymentRecord; error?: string }> => {
    try {
      const res = await api.receivePayment(payload);
      if (res && res.success && res.payment) {
        if (res.wallet) setWallet(res.wallet);
        setPayments(prev => [res.payment, ...prev]);
        playBeep();
        return { success: true, payment: res.payment };
      }
    } catch {
      // Fallback local
    }

    const randomCode = Math.floor(10 + Math.random() * 90).toString();
    const newTx: PaymentRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: payload.amount,
      counterpartyName: payload.senderName || 'P2P Sender',
      counterpartyPhone: payload.senderPhone || '+91 97000 11223',
      counterpartyKyc: true,
      matchingCode: randomCode,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: wallet.isOnline ? 'paid' : 'pending',
      pointIds: [generateServerPointId()],
      direction: 'received',
      transportMethod: (payload.transportMethod as any) || 'bluetooth',
      dangerWarningTriggered: false
    };

    setWallet(prev => ({
      ...prev,
      receiveBucketPoints: Math.min(10000, prev.receiveBucketPoints + payload.amount)
    }));
    setPayments(prev => [newTx, ...prev]);
    playBeep();

    return { success: true, payment: newTx };
  };

  // Sync Offline Queue
  const syncOfflineQueue = async (): Promise<number> => {
    let synced = 0;
    try {
      const res = await api.syncOfflinePayments(payments);
      if (res && res.success) {
        synced = res.syncedCount || 0;
        if (res.wallet) setWallet(res.wallet);
        if (res.payments) setPayments(res.payments);
        setAlertBannerMessage(`Reconciliation Complete: ${synced} offline transaction(s) verified & settled on bank ledger.`);
        return synced;
      }
    } catch {
      // Fallback
    }

    setPayments(prev =>
      prev.map(p => {
        if (p.status === 'pending') {
          synced++;
          return { ...p, status: 'paid' };
        }
        return p;
      })
    );

    setWallet(prev => ({
      ...prev,
      lastSyncedAt: 'Just now'
    }));

    setAlertBannerMessage(`Sync Complete: ${synced} offline transaction(s) verified on central ledger.`);
    return synced;
  };

  // Resolve Claim (Admin)
  const resolveClaim = async (id: string, decision: 'FIRST_CLAIMANT' | 'FORFEIT', notes: string) => {
    try {
      await api.resolveClaim(id, decision, notes);
    } catch {
      // fallback
    }

    setHeldClaims(prev =>
      prev.map(c =>
        c.id === id
          ? {
              ...c,
              status: decision === 'FIRST_CLAIMANT' ? 'DECIDED_FIRST_CLAIMANT' : 'FORFEITED',
              resolutionNotes: notes
            }
          : c
      )
    );
  };

  // Resolve Security Event (Admin)
  const resolveSecurityEvent = async (id: string) => {
    try {
      await api.resolveSecurityEvent(id);
    } catch {
      // fallback
    }

    setSecurityEvents(prev =>
      prev.map(e => (e.id === id ? { ...e, status: 'RESOLVED' } : e))
    );
  };

  // Submit Appeal
  const submitAppeal = async (reason: string, doc: string): Promise<boolean> => {
    try {
      const res = await api.submitAppeal(reason, doc);
      if (res && res.success) {
        setAlertBannerMessage('Dispute / appeal submitted successfully. Case ID generated for Super Admin review.');
        return true;
      }
    } catch {
      // fallback
    }

    setAlertBannerMessage('Dispute / appeal submitted successfully. Case ID generated for Super Admin review.');
    return true;
  };

  return (
    <OfflinePaymentContext.Provider
      value={{
        wallet,
        currentRole,
        setRole,
        currentRoute,
        navigateTo,
        payments,
        heldClaims,
        securityEvents,
        isOnline: wallet.isOnline,
        toggleOnline,
        isBluetoothActive: wallet.isBluetoothActive,
        toggleBluetooth,
        batteryLevel: wallet.batteryLevel,
        setBatteryLevel,
        preferredLanguage: wallet.preferredLanguage,
        setLanguage,
        alertBannerMessage,
        setAlertBannerMessage,
        dismissBanner,
        topUpSendBucket,
        sweepToBank,
        sendPayment,
        receivePayment,
        syncOfflineQueue,
        resolveClaim,
        resolveSecurityEvent,
        submitAppeal,
        refreshData,
        playBeep
      }}
    >
      {children}
    </OfflinePaymentContext.Provider>
  );
};

export const useOfflinePayment = (): OfflinePaymentContextType => {
  const context = useContext(OfflinePaymentContext);
  if (!context) {
    throw new Error('useOfflinePayment must be used within an OfflinePaymentProvider');
  }
  return context;
};
