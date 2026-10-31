import React from 'react';
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  ArrowRightLeft,
  Layers,
  History,
  ShieldCheck,
  AlertTriangle,
  Settings,
  UserCheck
} from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const UserSidebarNav: React.FC = () => {
  const { currentRoute, navigateTo, wallet } = useOfflinePayment();

  const navItems = [
    { label: 'Wallet Hub', route: '/user/home', icon: LayoutDashboard },
    { label: 'Pay (Offline P2P)', route: '/user/pay-connect', icon: ArrowUpRight, badge: 'P2P' },
    { label: 'Receive Points', route: '/user/receive', icon: ArrowDownLeft },
    { label: 'Top-up Send Bucket', route: '/user/topup', icon: PlusCircle },
    { label: 'Move Money to Bank', route: '/user/move-money', icon: ArrowRightLeft },
    { label: 'ID Store & Mines', route: '/user/mine-inspector', icon: Layers, highlight: true },
    { label: 'Transaction History', route: '/user/history', icon: History },
    { label: 'KYC & Identity Verification', route: '/user/signup', icon: UserCheck },
    { label: 'Disputes & Appeals', route: '/user/report-appeal', icon: AlertTriangle },
    { label: 'Security & Settings', route: '/user/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-3 space-y-4 shrink-0 hidden md:block">
      {/* User profile card */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
            DP
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-xs text-slate-900 truncate">{wallet.name}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{wallet.phone}</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
          <span className="text-slate-500">KYC Status:</span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded text-[10px]">
            <ShieldCheck className="w-3 h-3" /> Verified
          </span>
        </div>
      </div>

      {/* Nav List */}
      <div>
        <div className="px-3 py-1.5 mb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          NiPay User Portal
        </div>
        <nav className="space-y-1">
          {navItems.map(item => {
            const isActive = currentRoute === item.route;
            const Icon = item.icon;
            return (
              <button
                key={item.route}
                onClick={() => navigateTo(item.route)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {item.highlight && !item.badge && (
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-indigo-500'}`} />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Trust & Balance Widget */}
      <div className="p-3 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl space-y-1 text-xs">
        <div className="flex justify-between items-center text-slate-500 text-[11px]">
          <span>Trust Score:</span>
          <span className="font-mono font-bold text-slate-900">{wallet.trustScore}/850</span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-full rounded-full"
            style={{ width: `${(wallet.trustScore / 850) * 100}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-400 pt-1">
          Cryptographic offline signing verified
        </div>
      </div>
    </aside>
  );
};
