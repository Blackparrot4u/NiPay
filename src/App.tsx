import React from 'react';
import { OfflinePaymentProvider, useOfflinePayment } from './context/OfflinePaymentContext';
import { NiPayHeader } from './components/layout/NiPayHeader';
import { UserSidebarNav } from './components/user/UserSidebarNav';
import { UserWalletHub } from './components/user/UserWalletHub';
import { UserPayConnect } from './components/user/UserPayConnect';
import { UserReceive } from './components/user/UserReceive';
import { UserTopUp } from './components/user/UserTopUp';
import { UserMoveMoney } from './components/user/UserMoveMoney';
import { UserMineInspector } from './components/user/UserMineInspector';
import { UserHistory } from './components/user/UserHistory';
import { UserKyc } from './components/user/UserKyc';
import { UserDisputes } from './components/user/UserDisputes';
import { AdminDashboard } from './components/admin/AdminDashboard';
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  ShieldCheck,
  PlusCircle
} from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentRole, currentRoute, navigateTo } = useOfflinePayment();

  // Route router for user portal
  const renderUserScreen = () => {
    switch (currentRoute) {
      case '/user/pay-connect':
        return <UserPayConnect />;
      case '/user/receive':
        return <UserReceive />;
      case '/user/topup':
        return <UserTopUp />;
      case '/user/move-money':
        return <UserMoveMoney />;
      case '/user/mine-inspector':
        return <UserMineInspector />;
      case '/user/history':
        return <UserHistory />;
      case '/user/signup':
      case '/user/settings':
        return <UserKyc />;
      case '/user/report-appeal':
        return <UserDisputes />;
      case '/user/home':
      default:
        return <UserWalletHub />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <NiPayHeader />

      {/* Main Body */}
      {currentRole === 'admin' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-20">
          <AdminDashboard />
        </main>
      ) : (
        <div className="flex-1 max-w-7xl w-full mx-auto flex">
          {/* Left Desktop Sidebar Nav */}
          <UserSidebarNav />

          {/* User Screen Content */}
          <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-12 max-w-5xl overflow-y-auto">
            {renderUserScreen()}
          </main>
        </div>
      )}

      {/* Mobile Bottom Navigation (User Role Only) */}
      {currentRole === 'user' && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 shadow-lg">
          <div className="grid grid-cols-5 text-center text-[10px] font-semibold py-1">
            <button
              onClick={() => navigateTo('/user/home')}
              className={`py-2 flex flex-col items-center gap-1 cursor-pointer ${
                currentRoute === '/user/home' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Hub</span>
            </button>

            <button
              onClick={() => navigateTo('/user/pay-connect')}
              className={`py-2 flex flex-col items-center gap-1 cursor-pointer ${
                currentRoute === '/user/pay-connect' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Pay</span>
            </button>

            <button
              onClick={() => navigateTo('/user/receive')}
              className={`py-2 flex flex-col items-center gap-1 cursor-pointer ${
                currentRoute === '/user/receive' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Receive</span>
            </button>

            <button
              onClick={() => navigateTo('/user/topup')}
              className={`py-2 flex flex-col items-center gap-1 cursor-pointer ${
                currentRoute === '/user/topup' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Top-up</span>
            </button>

            <button
              onClick={() => navigateTo('/user/history')}
              className={`py-2 flex flex-col items-center gap-1 cursor-pointer ${
                currentRoute === '/user/history' ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default function App() {
  return (
    <OfflinePaymentProvider>
      <MainAppContent />
    </OfflinePaymentProvider>
  );
}
