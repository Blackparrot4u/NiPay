import React from 'react';
import { OfflinePaymentProvider, useOfflinePayment } from './context/OfflinePaymentContext';
import { SandboxHeader } from './components/layout/SandboxHeader';
import { AdminSidebarNav } from './components/admin/AdminSidebarNav';

// User Screens
import { UserHomeScreen } from './components/user/UserHomeScreen';
import { TopupScreen } from './components/user/TopupScreen';
import { PayConnectScreen } from './components/user/PayConnectScreen';
import { PayDetailsScreen } from './components/user/PayDetailsScreen';
import { PayConfirmScreen } from './components/user/PayConfirmScreen';
import { ReceiveScreen } from './components/user/ReceiveScreen';
import { DangerWarningScreen } from './components/user/DangerWarningScreen';
import { ResultScreen } from './components/user/ResultScreen';
import { BlockedStateScreen } from './components/user/BlockedStateScreen';
import { LoginLockScreen } from './components/user/LoginLockScreen';
import { SignupKycScreen } from './components/user/SignupKycScreen';
import { HistoryScreen } from './components/user/HistoryScreen';
import { MoveMoneyScreen } from './components/user/MoveMoneyScreen';
import { ReportAppealScreen } from './components/user/ReportAppealScreen';
import { SettingsScreen } from './components/user/SettingsScreen';
import { MinePatternInspector } from './components/user/MinePatternInspector';

// Test Runner
import { SecurityTestsModal } from './components/tests/SecurityTestsModal';

// Admin Pages
import { AdminOverviewPage } from './components/admin/AdminOverviewPage';
import { LiveMonitorPage } from './components/admin/LiveMonitorPage';
import { UsersWalletsPage } from './components/admin/UsersWalletsPage';
import { SecurityEventsPage } from './components/admin/SecurityEventsPage';
import { HeldClaimsPage } from './components/admin/HeldClaimsPage';
import { ReviewQueuePage } from './components/admin/ReviewQueuePage';
import { AppealsPage } from './components/admin/AppealsPage';
import { FlowMapPage } from './components/admin/FlowMapPage';
import { RulesMonthsPage } from './components/admin/RulesMonthsPage';
import { BankLedgerPage } from './components/admin/BankLedgerPage';
import { AnalyticsPage } from './components/admin/AnalyticsPage';
import { AuditLogPage } from './components/admin/AuditLogPage';

const AppContent: React.FC = () => {
  const { currentRole, currentRoute, isPhoneFrame, wallet } = useOfflinePayment();

  // Route selector
  const renderView = () => {
    if (currentRoute === '/tests') {
      return <SecurityTestsModal />;
    }

    if (currentRole === 'user') {
      switch (currentRoute) {
        case '/user/signup':
          return <SignupKycScreen />;
        case '/user/login-lock':
          return <LoginLockScreen />;
        case '/user/topup':
          return <TopupScreen />;
        case '/user/pay-connect':
          return <PayConnectScreen />;
        case '/user/pay-details':
          return <PayDetailsScreen />;
        case '/user/pay-confirm':
          return <PayConfirmScreen />;
        case '/user/receive':
          return <ReceiveScreen />;
        case '/user/danger-warning':
          return <DangerWarningScreen />;
        case '/user/result':
          return <ResultScreen />;
        case '/user/blocked-state':
          return <BlockedStateScreen />;
        case '/user/history':
          return <HistoryScreen />;
        case '/user/move-money':
          return <MoveMoneyScreen />;
        case '/user/report-appeal':
          return <ReportAppealScreen />;
        case '/user/settings':
          return <SettingsScreen />;
        case '/user/mine-inspector':
          return <MinePatternInspector />;
        case '/user/home':
        default:
          return <UserHomeScreen />;
      }
    }

    // Admin views
    switch (currentRoute) {
      case '/admin/live-monitor':
        return <LiveMonitorPage />;
      case '/admin/users':
        return <UsersWalletsPage />;
      case '/admin/security-events':
        return <SecurityEventsPage />;
      case '/admin/held-claims':
        return <HeldClaimsPage />;
      case '/admin/review-queue':
        return <ReviewQueuePage />;
      case '/admin/appeals':
        return <AppealsPage />;
      case '/admin/flow-map':
        return <FlowMapPage />;
      case '/admin/rules':
        return <RulesMonthsPage />;
      case '/admin/bank-ledger':
        return <BankLedgerPage />;
      case '/admin/analytics':
        return <AnalyticsPage />;
      case '/admin/audit-log':
        return <AuditLogPage />;
      case '/admin/overview':
      default:
        return <AdminOverviewPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Plain White Header & Simulator Bar */}
      <SandboxHeader />

      {/* Main Container */}
      <div className="flex-1 flex w-full">
        {currentRole === 'admin' ? (
          <div className="flex-1 flex max-w-7xl mx-auto w-full">
            {/* Desktop Admin Sidebar */}
            <AdminSidebarNav />
            {/* Admin Main Body */}
            <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
              {renderView()}
            </main>
          </div>
        ) : (
          /* User App Mode */
          <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
            {isPhoneFrame ? (
              /* Android Phone Chassis (Spec: "User app: Android first, iPhone later") */
              <div className="relative w-full max-w-[420px] h-[850px] bg-white border-[6px] border-slate-800 rounded-[42px] shadow-xl overflow-hidden flex flex-col">
                {/* Android Status Bar & Punch-Hole Camera */}
                <div className="h-7 bg-white border-b border-slate-100 flex items-center justify-between px-6 pt-1 select-none text-[11px] font-mono text-slate-500 shrink-0">
                  <span>09:41</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-900 mx-auto" />
                  <span className="tabular-nums font-sans">5G · {wallet.batteryLevel}%</span>
                </div>

                {/* Scrollable Screen Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                  {renderView()}
                </div>

                {/* Android Bottom Navigation Pill */}
                <div className="h-6 bg-white flex items-center justify-center shrink-0">
                  <div className="w-28 h-1 rounded-full bg-slate-300" />
                </div>
              </div>
            ) : (
              /* Expanded Responsive View */
              <main className="w-full max-w-2xl py-4">
                {renderView()}
              </main>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <OfflinePaymentProvider>
      <AppContent />
    </OfflinePaymentProvider>
  );
}
