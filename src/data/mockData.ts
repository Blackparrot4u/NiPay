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
import { generatePointBatch } from '../utils/pointEngine';

export const INITIAL_WALLET: UserWallet = {
  id: 'usr_wallet_001',
  name: 'Devendra Patel',
  phone: '+91 98765 43210 (Test Phone)',
  kycStatus: 'VERIFIED',
  testAadhaar: 'TEST-AADHAAR-8819-4402',
  testPan: 'TEST-PAN-ABCDE1234F',
  address: 'Plot 42, Sandbox Tech Corridor, Test City, 560001',
  mainAccountBalance: 48500, // Stays in bank
  sendBucketPoints: 650, // Up to 2,000 max
  receiveBucketPoints: 1420, // Up to 10,000 max
  trustScore: 742, // 300 - 850 credit score style
  lastSyncedAt: '24 mins ago',
  daysUntilRenewal: 18,
  gracePeriodDays: 38,
  isOnline: false, // Start offline to demonstrate offline capabilities!
  isBluetoothActive: true,
  batteryLevel: 82, // Percentage
  isSelfLocked: false,
  isLoggedInElsewhere: false,
  offlineSuspended: false,
  preferredLanguage: 'en',
  points: generatePointBatch(650)
};

export const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'TXN-9021',
    amount: 150,
    counterpartyName: 'Rajesh Fruit Stall (Test)',
    counterpartyPhone: '+91 98111 22334',
    counterpartyKyc: true,
    matchingCode: '74',
    timestamp: '2026-10-31 08:35',
    status: 'paid',
    pointIds: ['PT20-8K2M-X7N9-W4P1', 'PT20-8K2M-X7N9-W4P2'],
    direction: 'sent',
    transportMethod: 'bluetooth',
    dangerWarningTriggered: false
  },
  {
    id: 'TXN-9018',
    amount: 320,
    counterpartyName: 'Pooja Sharma (Test)',
    counterpartyPhone: '+91 97222 33445',
    counterpartyKyc: true,
    matchingCode: '19',
    timestamp: '2026-10-31 07:15',
    status: 'pending', // Waiting for online sync
    pointIds: ['PT20-3A1B-9C8D-0E2F', 'PT20-3A1B-9C8D-0E3F'],
    direction: 'received',
    transportMethod: 'bluetooth',
    dangerWarningTriggered: false
  },
  {
    id: 'TXN-8994',
    amount: 500,
    counterpartyName: 'Unknown Peer Node (Untrusted)',
    counterpartyPhone: '+91 95444 00000',
    counterpartyKyc: false,
    matchingCode: '88',
    timestamp: '2026-10-30 19:40',
    status: 'refused',
    pointIds: [],
    direction: 'received',
    transportMethod: 'hotspot',
    dangerWarningTriggered: true,
    dangerConfirmed: false,
    heldReason: 'User declined payment following full-screen danger warning.'
  },
  {
    id: 'TXN-8980',
    amount: 200,
    counterpartyName: 'Vikram Sengupta (Test)',
    counterpartyPhone: '+91 96333 44556',
    counterpartyKyc: true,
    matchingCode: '43',
    timestamp: '2026-10-29 14:10',
    status: 'held',
    pointIds: ['PT20-CONFLICT-8812'],
    direction: 'received',
    transportMethod: 'nfc',
    dangerWarningTriggered: false,
    heldReason: 'Duplicate Point ID collision detected during cloud ledger reconciliation.'
  }
];

export const INITIAL_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: 'TRIP-401',
    type: 'landmine',
    severity: 'CRITICAL',
    reportedAt: '2026-10-31 08:14',
    deviceModel: 'Rooted Redmi K20 (Test Node)',
    userPhone: '+91 91000 88990',
    description: 'Landmine tripwire: Detected duplicate handover of broken mine point without matching parent mine digest.',
    status: 'OPEN',
    pointId: 'PT20-MINE-884-COLL'
  },
  {
    id: 'TRIP-402',
    type: 'forged',
    severity: 'CRITICAL',
    reportedAt: '2026-10-30 22:04',
    deviceModel: 'Custom Android Emulator',
    userPhone: '+91 92000 77665',
    description: 'Forged bank root signature: Point serverSignature failed Ed25519 public key curve check.',
    status: 'OPEN',
    pointId: 'PT20-FORGE-991A'
  },
  {
    id: 'TRIP-403',
    type: 'code_check',
    severity: 'HIGH',
    reportedAt: '2026-10-30 16:30',
    deviceModel: 'Pixel 7 (Modified APK)',
    userPhone: '+91 93000 66554',
    description: 'Whole-code check mismatch: Play Integrity attestation verdict reported UNRECOGNIZED_VERSION.',
    status: 'OPEN'
  },
  {
    id: 'TRIP-404',
    type: 'tower',
    severity: 'MEDIUM',
    reportedAt: '2026-10-29 18:00',
    deviceModel: 'Samsung Galaxy A52',
    userPhone: '+91 94000 55443',
    description: 'Monthly tower shape anomaly: Received points from cycle 2026-M07 beyond allowed grace period.',
    status: 'RESOLVED',
    pointId: 'PT20-TOWER-009B'
  }
];

export const INITIAL_HELD_CLAIMS: HeldClaim[] = [
  {
    id: 'CLAIM-CONFLICT-01',
    pointId: 'PT20-CONFLICT-8812',
    firstReportTimestamp: '2026-10-29 14:10:02',
    status: 'HELD_FOR_REVIEW',
    claimants: [
      {
        userName: 'Vikram Sengupta (First Claimant)',
        userPhone: '+91 96333 44556',
        reportedAt: '2026-10-29 14:10:02',
        trustScore: 780,
        proofSignature: 'sig_dev_vikram_ed25519_first_ack_8819'
      },
      {
        userName: 'Ramesh Store Terminal (Second Claimant)',
        userPhone: '+91 91222 33445',
        reportedAt: '2026-10-29 14:28:40',
        trustScore: 610,
        proofSignature: 'sig_dev_ramesh_ed25519_second_ack_4401'
      }
    ],
    resolutionNotes: 'Two claimants presented identical 20-character server signed point ID. First report wins by default unless malicious handover verified.'
  }
];

export const INITIAL_REVIEW_QUEUE: ReviewItem[] = [
  {
    id: 'REV-891',
    type: 'MAP_FLAG',
    userName: 'Kiran Verma (Test)',
    userPhone: '+91 98888 11111',
    flaggedAt: '2026-10-31 06:45',
    riskSummary: 'High-density offline transfer cluster in border district outside usual travel corridor.',
    status: 'IN_REVIEW'
  },
  {
    id: 'REV-892',
    type: 'PEER_REPORT',
    userName: 'Suresh Kumar (Test)',
    userPhone: '+91 97777 22222',
    flaggedAt: '2026-10-30 21:10',
    riskSummary: 'Counterparty reported: Handshake dropped prematurely before received-ACK returned.',
    status: 'IN_REVIEW'
  }
];

export const INITIAL_APPEALS: AppealCase[] = [
  {
    id: 'APP-104',
    userName: 'Amitabh Joshi',
    userPhone: '+91 95555 44444',
    reason: 'Offline transfer failed to sync before 38-day grace period expired due to remote mountain survey without cellular signal.',
    submittedAt: '2026-10-30 11:20',
    deadlineHoursRemaining: 34,
    documents: ['survey_dispatch_order_test.pdf', 'pan_card_test_copy.png'],
    status: 'PENDING_DECISION'
  }
];

export const INITIAL_MONTH_RULES: MonthRules = {
  monthId: '2026-M10',
  status: 'ACTIVE',
  gracePeriodDays: 38,
  regionMaxSendLimit: 2000,
  regionMaxReceiveLimit: 10000,
  serverSignatureDigest: 'SHA256:88A04BF1920BCAFED25519_SRV_ROOT_SEAL',
  badIdCount: 14,
  seasonConstraint: 'Diwali Festive Wave (Default 2,000 pt send cap preserved)'
};

export const INITIAL_BANK_LEDGER: BankLedgerEntry[] = [
  {
    id: 'SETTLE-BATCH-901',
    debtorBank: 'Apex Commercial Bank (Test)',
    creditorBank: 'Union Reserve Bank (Test)',
    settlementBatch: 'BATCH_20261031_01',
    totalPoints: 14250,
    amountRupees: 14250,
    timestamp: '2026-10-31 08:00',
    status: 'SETTLED'
  },
  {
    id: 'SETTLE-BATCH-902',
    debtorBank: 'City Mercantile Bank (Test)',
    creditorBank: 'Apex Commercial Bank (Test)',
    settlementBatch: 'BATCH_20261031_02',
    totalPoints: 8900,
    amountRupees: 8900,
    timestamp: '2026-10-31 08:30',
    status: 'IN_CLEARING'
  }
];

export const INITIAL_AUDIT_LOGS: AuditAction[] = [
  {
    id: 'AUD-8801',
    adminName: 'Sarah Chen (Super Admin)',
    role: 'SUPER_ADMIN',
    action: 'DECIDE_HELD_CLAIM',
    targetId: 'CLAIM-CONFLICT-01',
    timestamp: '2026-10-31 08:45',
    ip: '10.240.10.12'
  },
  {
    id: 'AUD-8800',
    adminName: 'Vikram Joshi (Risk Analyst)',
    role: 'FRAUD_INVESTIGATOR',
    action: 'DISMISS_MAP_FLAG',
    targetId: 'REV-889',
    timestamp: '2026-10-31 07:20',
    ip: '10.240.10.19'
  }
];
