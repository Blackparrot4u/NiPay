import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for generating authentic 20-character server cryptographic point IDs
function generateServerPointId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 12; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PT20-${rand.substring(0, 4)}-${rand.substring(4, 8)}-${rand.substring(8, 12)}`;
}

// In-Memory Database store for NiPay Backend
interface PointItem {
  id: string;
  serverSignature: string;
  monthCycle: string;
  mineGroup: string;
  status: 'loose' | 'broken_mine' | 'whole_mine';
  issuedAt: string;
}

interface PaymentRecord {
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

// Seed initial points
function generatePointBatch(count: number, monthCycle = '2026-M10'): PointItem[] {
  const points: PointItem[] = [];
  const fullMines = Math.floor(count / 3);
  const remainder = count % 3;
  let currentMineIdx = 1;

  for (let m = 0; m < fullMines; m++) {
    const mineId = `MINE-${monthCycle}-${currentMineIdx.toString().padStart(4, '0')}`;
    for (let p = 0; p < 3; p++) {
      points.push({
        id: generateServerPointId(),
        serverSignature: `sig_ed25519_srv_${Math.random().toString(36).substring(2, 12)}`,
        monthCycle,
        mineGroup: mineId,
        status: 'whole_mine',
        issuedAt: new Date().toISOString()
      });
    }
    currentMineIdx++;
  }

  if (remainder > 0) {
    const mineId = `MINE-${monthCycle}-LOOSE-${currentMineIdx}`;
    for (let p = 0; p < remainder; p++) {
      points.push({
        id: generateServerPointId(),
        serverSignature: `sig_ed25519_srv_${Math.random().toString(36).substring(2, 12)}`,
        monthCycle,
        mineGroup: mineId,
        status: remainder === 1 ? 'loose' : 'broken_mine',
        issuedAt: new Date().toISOString()
      });
    }
  }

  return points;
}

// State storage
let userWallet = {
  id: 'usr_wallet_001',
  name: 'Devendra Patel',
  phone: '+91 98765 43210',
  kycStatus: 'VERIFIED' as const,
  aadhaarNumber: '**** **** 4402',
  panNumber: 'ABCDE1234F',
  address: 'Plot 42, Tech Innovation Corridor, Bangalore 560001',
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
  preferredLanguage: 'en' as const,
  points: generatePointBatch(650)
};

let payments: PaymentRecord[] = [
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
    heldReason: 'Duplicate Point ID collision detected during cloud ledger reconciliation.'
  }
];

let heldClaims = [
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
        proofSignature: 'ed25519:7b9c3f...'
      },
      {
        userPhone: '+91 99888 77665',
        userName: 'Suresh Rao',
        reportedAt: '14:23:44 UTC',
        trustScore: 610,
        proofSignature: 'ed25519:4a8e1d...'
      }
    ],
    resolutionNotes: 'First claimant submitted earlier timestamp with trusted hardware enclave beacon.'
  }
];

let securityEvents = [
  {
    id: 'EVT-001',
    type: 'landmine',
    severity: 'HIGH',
    reportedAt: new Date(Date.now() - 3600000).toISOString().replace('T', ' ').substring(0, 16),
    deviceModel: 'Pixel 8 Pro (TEE HW-Keyed)',
    userPhone: '+91 98765 43210',
    description: 'Double-spend landmine tripped on Point PT20-9K11-B2C4-8991 across two Bluetooth peers.',
    status: 'OPEN',
    pointId: 'PT20-9K11-B2C4-8991'
  }
];

let auditLogs = [
  {
    id: 'AUD-901',
    adminName: 'SYSTEM_DAEMON',
    role: 'SYSTEM',
    action: 'INIT_SERVER_BACKEND',
    targetId: 'CENTRAL_SETTLEMENT_NODE',
    timestamp: new Date().toISOString(),
    ip: '127.0.0.1'
  }
];

let appeals = [
  {
    id: 'APP-101',
    userName: 'Karan Mehra',
    userPhone: '+91 91234 56789',
    reason: 'Phone battery died during offline Bluetooth transfer, points debited from send bucket but receiver claims timeout.',
    submittedAt: new Date(Date.now() - 86400000).toISOString().replace('T', ' ').substring(0, 16),
    deadlineHoursRemaining: 36,
    documents: ['battery_log_dump.json', 'vendor_receipt.pdf'],
    status: 'PENDING_DECISION'
  }
];

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'NiPay Enterprise Payment & Offline Cryptographic Settlement Engine',
      version: '2.4.0',
      timestamp: new Date().toISOString()
    });
  });

  // User Wallet API
  app.get('/api/wallet', (_req: Request, res: Response) => {
    res.json({
      success: true,
      wallet: {
        ...userWallet,
        testAadhaar: userWallet.aadhaarNumber,
        testPan: userWallet.panNumber
      }
    });
  });

  // Top-up Send Bucket
  app.post('/api/wallet/topup', (req: Request, res: Response) => {
    const { amount, pin } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Enter a valid top-up amount.' });
    }

    if (userWallet.sendBucketPoints + numAmount > 2000) {
      return res.status(400).json({
        success: false,
        error: `Send bucket limit is 2,000 points. You can add at most ${2000 - userWallet.sendBucketPoints} points.`
      });
    }

    const fee = 1; // ₹1 maintenance fee line
    const totalDeduction = numAmount + fee;

    if (userWallet.mainAccountBalance < totalDeduction) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance in underlying bank account (requires ₹${totalDeduction} including ₹1 fee).`
      });
    }

    if (pin && pin !== '1234' && pin.length < 4) {
      return res.status(400).json({ success: false, error: 'Invalid security PIN.' });
    }

    // Server-signed points issuance
    const newPoints = generatePointBatch(numAmount, '2026-M10');
    userWallet.mainAccountBalance -= totalDeduction;
    userWallet.sendBucketPoints += numAmount;
    userWallet.points = [...userWallet.points, ...newPoints];

    auditLogs.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      adminName: userWallet.name,
      role: 'USER_CLIENT',
      action: 'TOPUP_SEND_BUCKET',
      targetId: `+${numAmount}_POINTS`,
      timestamp: new Date().toISOString(),
      ip: req.ip || '127.0.0.1'
    });

    res.json({
      success: true,
      message: `Successfully topped up ${numAmount} points. ₹1 platform fee applied.`,
      wallet: {
        ...userWallet,
        testAadhaar: userWallet.aadhaarNumber,
        testPan: userWallet.panNumber
      }
    });
  });

  // Sweep Receive Bucket to Bank
  app.post('/api/wallet/sweep', (req: Request, res: Response) => {
    const { amount } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0 || numAmount > userWallet.receiveBucketPoints) {
      return res.status(400).json({ success: false, error: 'Invalid transfer amount.' });
    }

    userWallet.receiveBucketPoints -= numAmount;
    userWallet.mainAccountBalance += numAmount;

    auditLogs.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      adminName: userWallet.name,
      role: 'USER_CLIENT',
      action: 'SWEEP_RECEIVE_BUCKET',
      targetId: `₹${numAmount}_TO_BANK`,
      timestamp: new Date().toISOString(),
      ip: req.ip || '127.0.0.1'
    });

    res.json({
      success: true,
      message: `Settled: Transferred ₹${numAmount} points to linked bank account.`,
      wallet: {
        ...userWallet,
        testAadhaar: userWallet.aadhaarNumber,
        testPan: userWallet.panNumber
      }
    });
  });

  // Payments API
  app.get('/api/payments', (_req: Request, res: Response) => {
    res.json({
      success: true,
      payments
    });
  });

  // Authorize Payment
  app.post('/api/payments/create', (req: Request, res: Response) => {
    const { recipientName, recipientPhone, amount, transportMethod = 'bluetooth' } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount.' });
    }

    if (userWallet.sendBucketPoints < numAmount) {
      return res.status(400).json({ success: false, error: 'Insufficient points in send bucket.' });
    }

    // Spend points from wallet
    const spentPoints = userWallet.points.slice(0, numAmount);
    userWallet.points = userWallet.points.slice(numAmount);
    userWallet.sendBucketPoints -= numAmount;

    const randomCode = Math.floor(10 + Math.random() * 90).toString();
    const newTx: PaymentRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: numAmount,
      counterpartyName: recipientName || 'Recipient',
      counterpartyPhone: recipientPhone || '+91 98000 00000',
      counterpartyKyc: true,
      matchingCode: randomCode,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: userWallet.isOnline ? 'paid' : 'pending',
      pointIds: spentPoints.map(p => p.id),
      direction: 'sent',
      transportMethod,
      dangerWarningTriggered: (recipientName || '').toLowerCase().includes('danger')
    };

    payments.unshift(newTx);

    res.json({
      success: true,
      payment: newTx,
      wallet: {
        ...userWallet,
        testAadhaar: userWallet.aadhaarNumber,
        testPan: userWallet.panNumber
      }
    });
  });

  // Receive Payment
  app.post('/api/payments/receive', (req: Request, res: Response) => {
    const { amount, senderName, senderPhone, transportMethod = 'bluetooth' } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid received amount.' });
    }

    userWallet.receiveBucketPoints = Math.min(10000, userWallet.receiveBucketPoints + numAmount);

    const randomCode = Math.floor(10 + Math.random() * 90).toString();
    const newTx: PaymentRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: numAmount,
      counterpartyName: senderName || 'P2P Sender',
      counterpartyPhone: senderPhone || '+91 97000 11223',
      counterpartyKyc: true,
      matchingCode: randomCode,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: userWallet.isOnline ? 'paid' : 'pending',
      pointIds: [generateServerPointId()],
      direction: 'received',
      transportMethod,
      dangerWarningTriggered: false
    };

    payments.unshift(newTx);

    res.json({
      success: true,
      payment: newTx,
      wallet: {
        ...userWallet,
        testAadhaar: userWallet.aadhaarNumber,
        testPan: userWallet.panNumber
      }
    });
  });

  // Auto-sync offline queued payments when coming online
  app.post('/api/payments/sync', (req: Request, res: Response) => {
    const { clientPayments = [] } = req.body;
    let syncedCount = 0;

    payments = payments.map(p => {
      if (p.status === 'pending') {
        syncedCount++;
        return { ...p, status: 'paid' };
      }
      return p;
    });

    userWallet.lastSyncedAt = 'Just now';

    auditLogs.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      adminName: 'CENTRAL_SETTLEMENT_RECONCILER',
      role: 'SYSTEM',
      action: 'SYNC_OFFLINE_LEDGER',
      targetId: `${syncedCount}_PAYMENTS_SETTLED`,
      timestamp: new Date().toISOString(),
      ip: req.ip || '127.0.0.1'
    });

    res.json({
      success: true,
      syncedCount,
      payments,
      wallet: {
        ...userWallet,
        testAadhaar: userWallet.aadhaarNumber,
        testPan: userWallet.panNumber
      }
    });
  });

  // Appeals API
  app.post('/api/appeals', (req: Request, res: Response) => {
    const { reason, documentName } = req.body;
    const newAppeal = {
      id: `APP-${Math.floor(200 + Math.random() * 800)}`,
      userName: userWallet.name,
      userPhone: userWallet.phone,
      reason: reason || 'Dispute transaction',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      deadlineHoursRemaining: 48,
      documents: [documentName || 'user_report.pdf'],
      status: 'PENDING_DECISION'
    };

    appeals.unshift(newAppeal);

    res.json({
      success: true,
      appeal: newAppeal
    });
  });

  // Admin APIs
  app.get('/api/admin/overview', (_req: Request, res: Response) => {
    const circulatingSend = userWallet.sendBucketPoints + 84200;
    const circulatingReceive = userWallet.receiveBucketPoints + 195400;
    const pendingSyncCount = payments.filter(p => p.status === 'pending').length;

    res.json({
      success: true,
      overview: {
        totalCirculatingPoints: circulatingSend + circulatingReceive,
        sendBucketPool: circulatingSend,
        receiveBucketPool: circulatingReceive,
        heldClaimsCount: heldClaims.length,
        openSecurityTripwires: securityEvents.filter(e => e.status === 'OPEN').length,
        pendingReviewCount: appeals.length,
        pendingOfflineSyncCount: pendingSyncCount,
        systemHealth: 'OPERATIONAL',
        activeMonthCycle: '2026-M10'
      }
    });
  });

  app.get('/api/admin/claims', (_req: Request, res: Response) => {
    res.json({ success: true, heldClaims });
  });

  app.post('/api/admin/claims/:id/resolve', (req: Request, res: Response) => {
    const { id } = req.params;
    const { decision, notes } = req.body;

    heldClaims = heldClaims.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: decision === 'FIRST_CLAIMANT' ? 'DECIDED_FIRST_CLAIMANT' : 'FORFEITED',
          resolutionNotes: notes || 'Resolved by Super Admin desk.'
        };
      }
      return c;
    });

    res.json({ success: true, message: `Claim ${id} resolved.` });
  });

  app.get('/api/admin/security-events', (_req: Request, res: Response) => {
    res.json({ success: true, securityEvents });
  });

  app.post('/api/admin/security-events/:id/resolve', (req: Request, res: Response) => {
    const { id } = req.params;
    securityEvents = securityEvents.map(e => e.id === id ? { ...e, status: 'RESOLVED' } : e);
    res.json({ success: true, message: `Event ${id} marked as resolved.` });
  });

  app.get('/api/admin/audit-logs', (_req: Request, res: Response) => {
    res.json({ success: true, auditLogs });
  });

  // In production, serve dist folder. In development, mount Vite middleware.
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NiPay Enterprise Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
