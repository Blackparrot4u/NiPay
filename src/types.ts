export type PaymentStatus = 'pending' | 'paid' | 'held' | 'refused';

export type TransportMethod = 'bluetooth' | 'hotspot' | 'nfc' | 'qr';

export type TripwireType =
  | 'forged'
  | 'landmine'
  | 'tower'
  | 'code_check'
  | 'restore'
  | 'control_key_leak'
  | 'root';

export interface PointItem {
  id: string; // 20-character server generated ID, e.g. "PT20-7X9B-M4K2-Q1W8"
  serverSignature: string;
  monthCycle: string; // e.g. "2026-M10"
  mineGroup: string; // mine identifier (3 points per mine)
  status: 'loose' | 'broken_mine' | 'whole_mine';
  issuedAt: string;
}

export interface UserWallet {
  id: string;
  name: string;
  phone: string;
  kycStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  testAadhaar: string;
  testPan: string;
  address: string;
  mainAccountBalance: number; // Stays in bank, e.g. ₹48,500
  sendBucketPoints: number; // Max 2,000 points
  receiveBucketPoints: number; // Max 10,000 points
  trustScore: number; // 300 to 850 (credit score style, rolling 6 months)
  lastSyncedAt: string;
  daysUntilRenewal: number; // e.g. 18 days left in month
  gracePeriodDays: number; // 38 days
  isOnline: boolean;
  isBluetoothActive: boolean;
  batteryLevel: number; // e.g. 84%, simulated
  isSelfLocked: boolean;
  isLoggedInElsewhere: boolean;
  offlineSuspended: boolean;
  preferredLanguage: 'en' | 'hi';
  points: PointItem[];
}

export interface PaymentRecord {
  id: string;
  amount: number;
  counterpartyName: string;
  counterpartyPhone: string;
  counterpartyKyc: boolean;
  matchingCode: string; // 2-digit code for physical pairing confirmation
  timestamp: string;
  status: PaymentStatus;
  pointIds: string[];
  direction: 'sent' | 'received';
  transportMethod: TransportMethod;
  dangerWarningTriggered: boolean;
  dangerConfirmed?: boolean;
  heldReason?: string;
  handoverSignature?: string;
  receivedAckSignature?: string;
}

export interface SecurityEvent {
  id: string;
  type: TripwireType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  reportedAt: string;
  deviceModel: string;
  userPhone: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  pointId?: string;
}

export interface HeldClaim {
  id: string;
  pointId: string;
  firstReportTimestamp: string;
  status: 'HELD_FOR_REVIEW' | 'DECIDED_FIRST_CLAIMANT' | 'FORFEITED';
  claimants: Array<{
    userPhone: string;
    userName: string;
    reportedAt: string;
    trustScore: number;
    proofSignature: string;
  }>;
  resolutionNotes?: string;
}

export interface ReviewItem {
  id: string;
  type: 'MAP_FLAG' | 'PEER_REPORT' | 'ANOMALOUS_BURST';
  userPhone: string;
  userName: string;
  flaggedAt: string;
  riskSummary: string;
  status: 'IN_REVIEW' | 'CLEARED' | 'SUSPENDED';
}

export interface AppealCase {
  id: string;
  userPhone: string;
  userName: string;
  reason: string;
  submittedAt: string;
  deadlineHoursRemaining: number;
  documents: string[];
  status: 'PENDING_DECISION' | 'APPROVED' | 'REJECTED';
}

export interface MonthRules {
  monthId: string; // e.g. "2026-M10"
  status: 'ACTIVE' | 'ROTATING';
  gracePeriodDays: number; // 35 - 40
  regionMaxSendLimit: number; // 2000
  regionMaxReceiveLimit: number; // 10000
  serverSignatureDigest: string; // Secret key stays on server; only public digest displayed
  badIdCount: number;
  seasonConstraint: string;
}

export interface BankLedgerEntry {
  id: string;
  debtorBank: string;
  creditorBank: string;
  settlementBatch: string;
  totalPoints: number;
  amountRupees: number;
  timestamp: string;
  status: 'PENDING' | 'SETTLED' | 'IN_CLEARING';
}

export interface AuditAction {
  id: string;
  adminName: string;
  role: string;
  action: string;
  targetId: string;
  timestamp: string;
  ip: string;
}
