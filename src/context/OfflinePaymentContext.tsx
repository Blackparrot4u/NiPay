import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserWallet,
  PaymentRecord,
  SecurityEvent,
  HeldClaim,
  ReviewItem,
  AppealCase,
  MonthRules,
  BankLedgerEntry,
  AuditAction
} from '../types';
import {
  INITIAL_WALLET,
  INITIAL_PAYMENTS,
  INITIAL_SECURITY_EVENTS,
  INITIAL_HELD_CLAIMS,
  INITIAL_REVIEW_QUEUE,
  INITIAL_APPEALS,
  INITIAL_MONTH_RULES,
  INITIAL_BANK_LEDGER,
  INITIAL_AUDIT_LOGS
} from '../data/mockData';
import {
  generatePointBatch,
  spendPointsWithMinePattern,
  generateServerPointId
} from '../utils/pointEngine';
import { playPaymentBeep } from '../utils/audioBeep';

interface OfflinePaymentContextType {
  wallet: UserWallet;
  payments: PaymentRecord[];
  securityEvents: SecurityEvent[];
  heldClaims: HeldClaim[];
  reviewQueue: ReviewItem[];
  appeals: AppealCase[];
  monthRules: MonthRules;
  bankLedger: BankLedgerEntry[];
  auditLogs: AuditAction[];

  // App mode & navigation
  currentRole: 'user' | 'admin';
  currentRoute: string;
  isPhoneFrame: boolean;
  alertBannerMessage: string | null;

  // Actions
  setRole: (role: 'user' | 'admin') => void;
  navigateTo: (route: string) => void;
  togglePhoneFrame: () => void;
  toggleOnline: () => void;
  toggleBluetooth: () => void;
  setBatteryLevel: (level: number) => void;
  setLanguage: (lang: 'en' | 'hi') => void;
  dismissBanner: () => void;

  // User Actions
  topUpSendBucket: (amount: number, pin: string) => { success: boolean; error?: string };
  moveReceivedToMain: (amount: number) => { success: boolean; error?: string };
  initiatePayment: (recipientName: string, recipientPhone: string, amount: number) => PaymentRecord;
  confirmPaymentHandover: (paymentId: string) => boolean;
  acceptIncomingPayment: (amount: number, senderName: string) => PaymentRecord;
  refuseIncomingPayment: (amount: number, senderName: string) => PaymentRecord;
  fileCancellationReport: (reason: string) => void;
  fileUserAppeal: (reason: string, docName: string) => void;
  selfLockWallet: () => void;
  unlockWallet: () => void;

  // Admin Actions
  decideHeldClaim: (claimId: string, claimantPhone: string, notes: string) => void;
  resolveSecurityEvent: (eventId: string) => void;
  suspendUserOffline: (phone: string, reason: string) => void;
  rotateMonthRules: () => void;
  reviewQueueDecision: (itemId: string, decision: 'CLEARED' | 'SUSPENDED') => void;
  decideAppeal: (appealId: string, approved: boolean) => void;
}

const OfflinePaymentContext = createContext<OfflinePaymentContextType | undefined>(undefined);

export const OfflinePaymentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<UserWallet>(INITIAL_WALLET);
  const [payments, setPayments] = useState<PaymentRecord[]>(INITIAL_PAYMENTS);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>(INITIAL_SECURITY_EVENTS);
  const [heldClaims, setHeldClaims] = useState<HeldClaim[]>(INITIAL_HELD_CLAIMS);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>(INITIAL_REVIEW_QUEUE);
  const [appeals, setAppeals] = useState<AppealCase[]>(INITIAL_APPEALS);
  const [monthRules, setMonthRules] = useState<MonthRules>(INITIAL_MONTH_RULES);
  const [bankLedger, setBankLedger] = useState<BankLedgerEntry[]>(INITIAL_BANK_LEDGER);
  const [auditLogs, setAuditLogs] = useState<AuditAction[]>(INITIAL_AUDIT_LOGS);

  const [currentRole, setCurrentRole] = useState<'user' | 'admin'>('user');
  const [currentRoute, setCurrentRoute] = useState<string>('/user/home');
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true); // Android first per spec
  const [alertBannerMessage, setAlertBannerMessage] = useState<string | null>(null);

  // Auto-sync when coming online
  const toggleOnline = () => {
    setWallet(prev => {
      const nextOnline = !prev.isOnline;
      if (nextOnline) {
        // Trigger auto-sync
        const pendingCount = payments.filter(p => p.status === 'pending').length;
        setAlertBannerMessage(`Internet detected: Auto-synced ${pendingCount} pending offline payments to server ledger.`);

        // Settle pending payments
        setPayments(current => current.map(p => (p.status === 'pending' ? { ...p, status: 'paid' } : p)));

        // Record audit
        const newAudit: AuditAction = {
          id: `AUD-${Date.now().toString().slice(-4)}`,
          adminName: 'SERVER_AUTO_SYNC_DAEMON',
          role: 'SYSTEM',
          action: 'AUTO_SYNC_DEVICE',
          targetId: prev.id,
          timestamp: new Date().toISOString(),
          ip: 'Sync Gateway'
        };
        setAuditLogs(logs => [newAudit, ...logs]);
      } else {
        setAlertBannerMessage('Switched to Offline Mode. Payments authorized peer-to-peer via Bluetooth / Hotspot.');
      }
      return {
        ...prev,
        isOnline: nextOnline,
        lastSyncedAt: nextOnline ? 'Just now' : prev.lastSyncedAt
      };
    });
  };

  const toggleBluetooth = () => {
    setWallet(prev => ({ ...prev, isBluetoothActive: !prev.isBluetoothActive }));
  };

  const setBatteryLevel = (level: number) => {
    setWallet(prev => ({ ...prev, batteryLevel: level }));
    if (level < 3) {
      setAlertBannerMessage('Critical Battery (<3%): Offline wallet automatically blocked to protect cryptographic point state.');
    }
  };

  const setLanguage = (lang: 'en' | 'hi') => {
    setWallet(prev => ({ ...prev, preferredLanguage: lang }));
  };

  const setRole = (role: 'user' | 'admin') => {
    setCurrentRole(role);
    if (role === 'admin' && currentRoute.startsWith('/user')) {
      setCurrentRoute('/admin/overview');
    } else if (role === 'user' && currentRoute.startsWith('/admin')) {
      setCurrentRoute('/user/home');
    }
  };

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
  };

  const togglePhoneFrame = () => {
    setIsPhoneFrame(prev => !prev);
  };

  const dismissBanner = () => {
    setAlertBannerMessage(null);
  };

  // User Actions
  const topUpSendBucket = (amount: number, pin: string): { success: boolean; error?: string } => {
    if (amount <= 0) return { success: false, error: 'Enter a valid amount.' };
    if (wallet.sendBucketPoints + amount > 2000) {
      return { success: false, error: 'Send bucket ceiling is 2,000 points. You can only add up to ' + (2000 - wallet.sendBucketPoints) + ' points.' };
    }
    const totalDeduction = amount + 1; // ₹1 fee line
    if (wallet.mainAccountBalance < totalDeduction) {
      return { success: false, error: 'Insufficient main bank balance (includes ₹1 platform maintenance fee).' };
    }
    if (pin !== '1234' && pin.length < 4) {
      return { success: false, error: 'Invalid PIN. (Demo test PIN is 1234)' };
    }

    // Generate new points signed by server
    const newPoints = generatePointBatch(amount, monthRules.monthId);

    setWallet(prev => ({
      ...prev,
      mainAccountBalance: prev.mainAccountBalance - totalDeduction,
      sendBucketPoints: prev.sendBucketPoints + amount,
      points: [...prev.points, ...newPoints]
    }));

    setAlertBannerMessage(`Top-up successful: +${amount} points credited to Send Bucket. ₹1 fee deducted.`);
    return { success: true };
  };

  const moveReceivedToMain = (amount: number): { success: boolean; error?: string } => {
    if (!wallet.isOnline) {
      return { success: false, error: 'Internet connection required to move points back to main bank account.' };
    }
    if (amount <= 0 || amount > wallet.receiveBucketPoints) {
      return { success: false, error: 'Invalid transfer amount.' };
    }

    setWallet(prev => ({
      ...prev,
      receiveBucketPoints: prev.receiveBucketPoints - amount,
      mainAccountBalance: prev.mainAccountBalance + amount
    }));

    setAlertBannerMessage(`Settled: Moved ${amount} points from Receive Bucket to Main Bank Account.`);
    return { success: true };
  };

  const initiatePayment = (recipientName: string, recipientPhone: string, amount: number): PaymentRecord => {
    const randomCode = Math.floor(10 + Math.random() * 90).toString();
    const newTx: PaymentRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      amount,
      counterpartyName: recipientName,
      counterpartyPhone: recipientPhone,
      counterpartyKyc: true,
      matchingCode: randomCode,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: wallet.isOnline ? 'paid' : 'pending',
      pointIds: [],
      direction: 'sent',
      transportMethod: 'bluetooth',
      dangerWarningTriggered: recipientName.toLowerCase().includes('danger') || recipientName.toLowerCase().includes('untrusted')
    };

    return newTx;
  };

  const confirmPaymentHandover = (paymentId: string): boolean => {
    const record = payments.find(p => p.id === paymentId);
    const amountToSpend = record ? record.amount : 50;

    try {
      // Spend points following mine pattern: loose -> broken mines -> whole mines
      const { spent, remaining } = spendPointsWithMinePattern(wallet.points, amountToSpend);

      setWallet(prev => ({
        ...prev,
        sendBucketPoints: Math.max(0, prev.sendBucketPoints - amountToSpend),
        points: remaining
      }));

      // Play real audio confirmation beep!
      playPaymentBeep();

      // Update payment record with transferred point IDs
      const spentIds = spent.map(s => s.id);
      setPayments(prev => [
        {
          ...(record || {
            id: paymentId,
            amount: amountToSpend,
            counterpartyName: 'Rajesh Store (Test)',
            counterpartyPhone: '+91 98111 22334',
            counterpartyKyc: true,
            matchingCode: '74',
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            status: wallet.isOnline ? 'paid' : 'pending',
            pointIds: spentIds,
            direction: 'sent',
            transportMethod: 'bluetooth',
            dangerWarningTriggered: false
          }),
          status: wallet.isOnline ? 'paid' : 'pending',
          pointIds: spentIds
        },
        ...prev.filter(p => p.id !== paymentId)
      ]);

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const acceptIncomingPayment = (amount: number, senderName: string): PaymentRecord => {
    const randomCode = Math.floor(10 + Math.random() * 90).toString();
    const mockPointId = generateServerPointId();

    setWallet(prev => ({
      ...prev,
      receiveBucketPoints: Math.min(10000, prev.receiveBucketPoints + amount)
    }));

    playPaymentBeep();

    const newPayment: PaymentRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      amount,
      counterpartyName: senderName,
      counterpartyPhone: '+91 97000 11223',
      counterpartyKyc: true,
      matchingCode: randomCode,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: wallet.isOnline ? 'paid' : 'pending',
      pointIds: [mockPointId],
      direction: 'received',
      transportMethod: 'bluetooth',
      dangerWarningTriggered: false
    };

    setPayments(prev => [newPayment, ...prev]);
    return newPayment;
  };

  const refuseIncomingPayment = (amount: number, senderName: string): PaymentRecord => {
    const newPayment: PaymentRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      amount,
      counterpartyName: senderName,
      counterpartyPhone: '+91 97000 11223',
      counterpartyKyc: false,
      matchingCode: '00',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'refused',
      pointIds: [],
      direction: 'received',
      transportMethod: 'bluetooth',
      dangerWarningTriggered: true,
      heldReason: 'Refused by receiver'
    };

    setPayments(prev => [newPayment, ...prev]);
    return newPayment;
  };

  const fileCancellationReport = (reason: string) => {
    setWallet(prev => ({ ...prev, isLoggedInElsewhere: false }));
    const newAudit: AuditAction = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      adminName: wallet.name,
      role: 'USER_CLIENT',
      action: 'CANCEL_PREVIOUS_SESSION',
      targetId: wallet.id,
      timestamp: new Date().toISOString(),
      ip: 'Device Enclave'
    };
    setAuditLogs(prev => [newAudit, ...prev]);
    setAlertBannerMessage('Previous hardware session cancelled. This device is now your primary authorized wallet.');
  };

  const fileUserAppeal = (reason: string, docName: string) => {
    const newAppeal: AppealCase = {
      id: `APP-${Math.floor(200 + Math.random() * 800)}`,
      userName: wallet.name,
      userPhone: wallet.phone,
      reason,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      deadlineHoursRemaining: 48,
      documents: [docName],
      status: 'PENDING_DECISION'
    };
    setAppeals(prev => [newAppeal, ...prev]);
    setAlertBannerMessage('Appeal submitted. Review board deadline timer active (48 hours).');
  };

  const selfLockWallet = () => {
    setWallet(prev => ({ ...prev, isSelfLocked: true }));
  };

  const unlockWallet = () => {
    setWallet(prev => ({ ...prev, isSelfLocked: false }));
  };

  // Admin Actions
  const decideHeldClaim = (claimId: string, claimantPhone: string, notes: string) => {
    setHeldClaims(prev => prev.map(c => {
      if (c.id === claimId) {
        return {
          ...c,
          status: 'DECIDED_FIRST_CLAIMANT',
          resolutionNotes: `Decided in favor of ${claimantPhone}. ${notes}`
        };
      }
      return c;
    }));

    const audit: AuditAction = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      adminName: 'Sarah Chen (Super Admin)',
      role: 'SUPER_ADMIN',
      action: 'DECIDE_HELD_CLAIM',
      targetId: claimId,
      timestamp: new Date().toISOString(),
      ip: '10.240.10.12'
    };
    setAuditLogs(prev => [audit, ...prev]);
    setAlertBannerMessage(`Held Claim ${claimId} decided. Ledger updated.`);
  };

  const resolveSecurityEvent = (eventId: string) => {
    setSecurityEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'RESOLVED' } : e));
    setAlertBannerMessage(`Tripwire event ${eventId} marked as investigated & closed.`);
  };

  const suspendUserOffline = (phone: string, reason: string) => {
    if (phone === wallet.phone) {
      setWallet(prev => ({ ...prev, offlineSuspended: !prev.offlineSuspended }));
    }
    const audit: AuditAction = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      adminName: 'Risk Desk Officer',
      role: 'FRAUD_INVESTIGATOR',
      action: 'SUSPEND_OFFLINE_USE',
      targetId: phone,
      timestamp: new Date().toISOString(),
      ip: '10.240.10.14'
    };
    setAuditLogs(prev => [audit, ...prev]);
    setAlertBannerMessage(`Offline permissions updated for ${phone}. Reason recorded: ${reason}`);
  };

  const rotateMonthRules = () => {
    const nextMonth = '2026-M11';
    setMonthRules(prev => ({
      ...prev,
      monthId: nextMonth,
      status: 'ROTATING',
      serverSignatureDigest: `SHA256:${Math.random().toString(16).substring(2, 10).toUpperCase()}_SRV_ROOT_SEAL`
    }));
    setAlertBannerMessage(`Rules rotated to cycle ${nextMonth}. 38-day grace period started for previous month IDs.`);
  };

  const reviewQueueDecision = (itemId: string, decision: 'CLEARED' | 'SUSPENDED') => {
    setReviewQueue(prev => prev.map(item => item.id === itemId ? { ...item, status: decision } : item));
    setAlertBannerMessage(`Review item ${itemId} processed: ${decision}.`);
  };

  const decideAppeal = (appealId: string, approved: boolean) => {
    setAppeals(prev => prev.map(a => a.id === appealId ? { ...a, status: approved ? 'APPROVED' : 'REJECTED' } : a));
    setAlertBannerMessage(`Appeal ${appealId} has been ${approved ? 'APPROVED' : 'REJECTED'}.`);
  };

  return (
    <OfflinePaymentContext.Provider
      value={{
        wallet,
        payments,
        securityEvents,
        heldClaims,
        reviewQueue,
        appeals,
        monthRules,
        bankLedger,
        auditLogs,
        currentRole,
        currentRoute,
        isPhoneFrame,
        alertBannerMessage,
        setRole,
        navigateTo,
        togglePhoneFrame,
        toggleOnline,
        toggleBluetooth,
        setBatteryLevel,
        setLanguage,
        dismissBanner,
        topUpSendBucket,
        moveReceivedToMain,
        initiatePayment,
        confirmPaymentHandover,
        acceptIncomingPayment,
        refuseIncomingPayment,
        fileCancellationReport,
        fileUserAppeal,
        selfLockWallet,
        unlockWallet,
        decideHeldClaim,
        resolveSecurityEvent,
        suspendUserOffline,
        rotateMonthRules,
        reviewQueueDecision,
        decideAppeal
      }}
    >
      {children}
    </OfflinePaymentContext.Provider>
  );
};

export const useOfflinePayment = () => {
  const context = useContext(OfflinePaymentContext);
  if (!context) {
    throw new Error('useOfflinePayment must be used within an OfflinePaymentProvider');
  }
  return context;
};
