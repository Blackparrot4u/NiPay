/**
 * NiPay Backend API Service Client
 * Provides live REST API integration for digital wallet, peer-to-peer offline sync, top-up, settlement, and admin monitoring.
 */

import { UserWallet, PaymentRecord, HeldClaim, SecurityEvent } from '../types';

export const api = {
  // Check backend server status
  async getHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch (err) {
      console.warn('Backend offline or unreachable, running in local enclave mode:', err);
      return null;
    }
  },

  // Wallet
  async getWallet(): Promise<{ success: boolean; wallet: UserWallet } | null> {
    try {
      const res = await fetch('/api/wallet');
      if (!res.ok) throw new Error('Failed to fetch wallet');
      return await res.json();
    } catch (err) {
      console.warn('API error fetching wallet:', err);
      return null;
    }
  },

  async topUpSendBucket(amount: number, pin: string) {
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, pin })
      });
      return await res.json();
    } catch (err) {
      console.error('API error in topup:', err);
      return { success: false, error: 'Network error. Could not contact settlement node.' };
    }
  },

  async sweepToBank(amount: number) {
    try {
      const res = await fetch('/api/wallet/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      return await res.json();
    } catch (err) {
      console.error('API error in sweep:', err);
      return { success: false, error: 'Network error during bank settlement.' };
    }
  },

  // Payments
  async getPayments(): Promise<{ success: boolean; payments: PaymentRecord[] } | null> {
    try {
      const res = await fetch('/api/payments');
      if (!res.ok) throw new Error('Failed to fetch payments');
      return await res.json();
    } catch (err) {
      console.warn('API error fetching payments:', err);
      return null;
    }
  },

  async createPayment(payload: {
    recipientName: string;
    recipientPhone: string;
    amount: number;
    transportMethod?: string;
  }) {
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (err) {
      console.error('API error creating payment:', err);
      return null;
    }
  },

  async receivePayment(payload: {
    senderName: string;
    senderPhone?: string;
    amount: number;
    transportMethod?: string;
  }) {
    try {
      const res = await fetch('/api/payments/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (err) {
      console.error('API error receiving payment:', err);
      return null;
    }
  },

  async syncOfflinePayments(clientPayments: PaymentRecord[]) {
    try {
      const res = await fetch('/api/payments/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientPayments })
      });
      return await res.json();
    } catch (err) {
      console.error('API error syncing offline payments:', err);
      return { success: false, error: 'Sync failed. Server unreachable.' };
    }
  },

  // Appeals
  async submitAppeal(reason: string, documentName: string) {
    try {
      const res = await fetch('/api/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, documentName })
      });
      return await res.json();
    } catch (err) {
      console.error('API error filing appeal:', err);
      return null;
    }
  },

  // Admin
  async getAdminOverview() {
    try {
      const res = await fetch('/api/admin/overview');
      return await res.json();
    } catch (err) {
      console.warn('API error fetching admin overview:', err);
      return null;
    }
  },

  async getAdminClaims(): Promise<{ success: boolean; heldClaims: HeldClaim[] } | null> {
    try {
      const res = await fetch('/api/admin/claims');
      return await res.json();
    } catch (err) {
      console.warn('API error fetching claims:', err);
      return null;
    }
  },

  async resolveClaim(id: string, decision: 'FIRST_CLAIMANT' | 'FORFEIT', notes: string) {
    try {
      const res = await fetch(`/api/admin/claims/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes })
      });
      return await res.json();
    } catch (err) {
      console.error('API error resolving claim:', err);
      return null;
    }
  },

  async getSecurityEvents(): Promise<{ success: boolean; securityEvents: SecurityEvent[] } | null> {
    try {
      const res = await fetch('/api/admin/security-events');
      return await res.json();
    } catch (err) {
      console.warn('API error fetching security events:', err);
      return null;
    }
  },

  async resolveSecurityEvent(id: string) {
    try {
      const res = await fetch(`/api/admin/security-events/${id}/resolve`, {
        method: 'POST'
      });
      return await res.json();
    } catch (err) {
      console.error('API error resolving security event:', err);
      return null;
    }
  },

  async getAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs');
      return await res.json();
    } catch (err) {
      console.warn('API error fetching audit logs:', err);
      return null;
    }
  }
};
