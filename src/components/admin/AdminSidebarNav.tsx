import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Users,
  ShieldAlert,
  GitPullRequest,
  Clock,
  MapPin,
  Calendar,
  Building2,
  BarChart3,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const AdminSidebarNav: React.FC = () => {
  const { currentRoute, navigateTo, heldClaims, securityEvents, appeals } = useOfflinePayment();

  const openSecurityCount = securityEvents.filter(e => e.status === 'OPEN').length;
  const pendingHeldCount = heldClaims.filter(c => c.status === 'HELD_FOR_REVIEW').length;
  const pendingAppealsCount = appeals.filter(a => a.status === 'PENDING_DECISION').length;

  const links = [
    { label: 'Overview', route: '/admin/overview', icon: LayoutDashboard },
    { label: 'Live Monitor', route: '/admin/live-monitor', icon: Activity },
    { label: 'Users & Wallets', route: '/admin/users', icon: Users },
    { label: 'Security Events', route: '/admin/security-events', icon: ShieldAlert, count: openSecurityCount, badgeColor: 'bg-rose-100 text-rose-800' },
    { label: 'Held Claims (Conflicts)', route: '/admin/held-claims', icon: AlertTriangle, count: pendingHeldCount, badgeColor: 'bg-purple-100 text-purple-800' },
    { label: 'Review Queue', route: '/admin/review-queue', icon: Clock },
    { label: 'Appeals', route: '/admin/appeals', icon: GitPullRequest, count: pendingAppealsCount, badgeColor: 'bg-amber-100 text-amber-800' },
    { label: 'Flow Map & Clusters', route: '/admin/flow-map', icon: MapPin },
    { label: 'Rules & Months', route: '/admin/rules', icon: Calendar },
    { label: 'Bank Ledger (Inter-Bank)', route: '/admin/bank-ledger', icon: Building2 },
    { label: 'Analytics & Delays', route: '/admin/analytics', icon: BarChart3 },
    { label: 'Audit Log (Unchangeable)', route: '/admin/audit-log', icon: FileText }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-3 space-y-1 shrink-0">
      <div className="px-3 py-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Central Ledger Admin
      </div>
      <nav className="space-y-0.5">
        {links.map(link => {
          const isActive = currentRoute === link.route;
          const Icon = link.icon;
          return (
            <button
              key={link.route}
              onClick={() => navigateTo(link.route)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{link.label}</span>
              </div>
              {link.count !== undefined && link.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : link.badgeColor
                }`}>
                  {link.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
