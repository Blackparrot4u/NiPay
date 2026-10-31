export interface PointItem {
  id: string;
  serverSignature: string;
  monthCycle: string;
  mineGroup: string;
  status: 'whole_mine' | 'broken_mine' | 'loose';
  issuedAt: string;
}

export interface UserWallet {
  id: string;
  name: string;
  phone: string;
  kycStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  aadhaarNumber: string;
  panNumber: string;
  address: string;
  bankName?: string;
  mainAccountBalance: number;
  sendBucketPoints: number;
  receiveBucketPoints: number;
  trustScore: number;
  lastSyncedAt: string;
  daysUntilRenewal: number;
  gracePeriodDays: number;
  isOnline: boolean;
  isBluetoothActive: boolean;
  batteryLevel: number;
  isSelfLocked: boolean;
  isLoggedInElsewhere: boolean;
  offlineSuspended: boolean;
  preferredLanguage: 'en' | 'hi';
  points: PointItem[];
  testAadhaar?: string;
  testPan?: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  counterpartyName: string;
  counterpartyPhone: string;
  counterpartyKyc: boolean;
  matchingCode: string;
  timestamp: string;
  status: 'pending' | 'paid' | 'held' | 'refused';
  pointIds: string[];
  direction: 'sent' | 'received';
  transportMethod: 'bluetooth' | 'hotspot' | 'nfc' | 'qr';
  dangerWarningTriggered: boolean;
  heldReason?: string;
}

export interface HeldClaimant {
  userPhone: string;
  userName: string;
  reportedAt: string;
  trustScore: number;
  proofSignature: string;
}

export interface HeldClaim {
  id: string;
  pointId: string;
  firstReportTimestamp: string;
  status: string;
  claimants: HeldClaimant[];
  resolutionNotes?: string;
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reportedAt: string;
  deviceModel: string;
  userPhone: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  pointId: string;
}

export interface AuditLog {
  id: string;
  adminName: string;
  role: string;
  action: string;
  targetId: string;
  timestamp: string;
  ip: string;
}

export interface AppealRecord {
  id: string;
  userName: string;
  userPhone: string;
  reason: string;
  submittedAt: string;
  deadlineHoursRemaining: number;
  documents: string[];
  status: string;
}

export interface AdminOverview {
  totalCirculatingPoints: number;
  sendBucketPool: number;
  receiveBucketPool: number;
  heldClaimsCount: number;
  openSecurityTripwires: number;
  pendingReviewCount: number;
  pendingOfflineSyncCount: number;
  systemHealth: string;
  activeMonthCycle: string;
}
