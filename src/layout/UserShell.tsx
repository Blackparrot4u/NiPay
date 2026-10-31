import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Battery, BatteryWarning, History, LayoutDashboard, Layers, LifeBuoy, PlusCircle, Server, Settings, ShieldCheck, Wifi, WifiOff, Zap } from 'lucide-react';
import { useDevice } from '../lib/device';
import { api } from '../lib/api';
import { batteryPercent, setLanguage } from '../ui';
import { useOnline } from '../screens/Main';
import { slotName } from '../lib/device';
import { Badge } from '../ui';

export const NAV: { label: string; route: string; icon: React.ElementType; badge?: string; routes?: string[] }[] = [
  { label: 'Home', route: '/', icon: LayoutDashboard },
  { label: 'Pay', route: '/pay', icon: ArrowUpRight, badge: 'P2P' },
  { label: 'Receive', route: '/receive', icon: ArrowDownLeft },
  { label: 'Add points', route: '/topup', icon: PlusCircle },
  { label: 'Move money to bank', route: '/move', icon: ArrowRightLeft },
  { label: 'ID store and mines', route: '/inspect', icon: Layers },
  { label: 'History', route: '/history', icon: History },
  { label: 'Report or appeal', route: '/report', icon: LifeBuoy },
  { label: 'Settings', route: '/more', icon: Settings, routes: ['/settings', '/selfie'] },
];
const active = (route: string, item: (typeof NAV)[number]) => route === item.route || !!item.routes?.includes(route);

export function NiPayHeader() {
  const d = useDevice(); const online = useOnline();
  const [backend, setBackend] = useState<'checking' | 'up' | 'down'>('checking'); const [bat, setBat] = useState<number | null>(null);
  useEffect(() => { let on = true; const ping = () => api('/health').then(() => on && setBackend('up')).catch(() => on && setBackend('down')); ping(); const t = setInterval(ping, 20000); return () => { on = false; clearInterval(t); }; }, []);
  useEffect(() => { batteryPercent().then(setBat); }, []);
  const hi = d.language === 'hi';
  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <a href="#/" className="flex items-center gap-3 select-none shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20"><Zap className="w-5 h-5 fill-white text-white" /></div>
          <div>
            <div className="font-extrabold text-slate-900 text-lg leading-tight tracking-tight flex items-center gap-1.5"><span>NiPay</span>
              <span className="px-1.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider">Web Portal</span></div>
            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">Offline payments that settle at the bank</div>
          </div>
        </a>
        <div className="flex items-center gap-2">
          {slotName !== 'main' && <Badge tone="blue">slot {slotName}</Badge>}
          <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${backend === 'up' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : backend === 'down' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`} title="Is the settlement server reachable right now?">
            <Server className="w-3.5 h-3.5" /><span className="font-semibold">{backend === 'up' ? 'Bank server reachable' : backend === 'down' ? 'Bank server not reachable' : 'Checking server'}</span></div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${online ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`} data-testid="net-badge">
            {online ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}<span className="font-semibold hidden sm:inline">{online ? 'Online' : 'Offline (P2P)'}</span></div>
          {bat !== null && (
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${bat < 3 ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold' : 'bg-slate-100 text-slate-700 border-slate-200'}`} title="Device battery">
              {bat < 3 ? <BatteryWarning className="w-3.5 h-3.5" /> : <Battery className="w-3.5 h-3.5" />}<span className="font-mono">{bat}%</span></div>)}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded-md cursor-pointer ${!hi ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>EN</button>
            <button onClick={() => setLanguage('hi')} className={`px-2 py-1 rounded-md cursor-pointer ${hi ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>हिं</button></div>
        </div>
      </div>
    </header>
  );
}

export function UserSidebar({ route }: { route: string }) {
  const d = useDevice(); const s = d.server;
  const initials = (d.name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const score = d.trust?.score;
  return (
    <aside className="w-64 bg-white border-r border-slate-200 p-3 space-y-4 shrink-0 hidden md:block">
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">{initials}</div>
          <div className="overflow-hidden"><div className="font-bold text-xs text-slate-900 truncate">{d.name}</div><div className="text-[10px] text-slate-500 font-mono truncate">{d.phone}</div></div>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60"><span className="text-slate-500">KYC status:</span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded text-[10px]"><ShieldCheck className="w-3 h-3" /> {s?.kyc_status ? String(s.kyc_status).replace(/_/g, ' ') : '-'}</span></div>
      </div>
      <div>
        <div className="px-3 py-1.5 mb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">NiPay user portal</div>
        <nav className="space-y-1">
          {NAV.map((item) => { const on = active(route, item); const Icon = item.icon; return (
            <a key={item.route} href={`#${item.route}`} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${on ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
              <span className="flex items-center gap-2.5 truncate"><Icon className={`w-4 h-4 ${on ? 'text-white' : 'text-slate-500'}`} /><span className="truncate">{item.label}</span></span>
              {item.badge && <span className={`px-1.5 rounded text-[10px] font-bold ${on ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{item.badge}</span>}
            </a>); })}
        </nav>
      </div>
      <div className="p-3 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl space-y-1 text-xs">
        <div className="flex justify-between items-center text-slate-500 text-[11px]"><span>Trust score (bank-signed)</span><span className="font-mono font-bold text-slate-900">{score != null ? `${score}/850` : '-'}</span></div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden"><div className="bg-emerald-600 h-full rounded-full" style={{ width: `${score != null ? Math.max(0, Math.min(100, ((score - 300) / 550) * 100)) : 0}%` }} /></div>
        <div className="text-[10px] text-slate-400 pt-1">Range 300 to 850. Shown after your first sync.</div>
      </div>
    </aside>
  );
}

const TABS = [NAV[0], NAV[1], NAV[2], NAV[6], NAV[8]];
export function BottomNav({ route }: { route: string }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      <div className="grid grid-cols-5 h-16">
        {TABS.map((item) => { const on = active(route, item); const Icon = item.icon; return (
          <a key={item.route} href={`#${item.route}`} className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? 'text-blue-700 font-semibold' : 'text-slate-500'}`}>
            <Icon className={`w-5 h-5 ${on ? 'text-blue-600' : 'text-slate-400'}`} /><span>{item.label.split(' ')[0]}</span></a>); })}
      </div>
    </nav>
  );
}
