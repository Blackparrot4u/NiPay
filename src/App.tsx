import { useEffect, useState } from 'react';
import { useDevice, syncNow, slotName } from './lib/device';
import { Welcome, Signup, Login } from './screens/Auth';
import { Home, TopUp, Move, History, More, useOnline } from './screens/Main';
import { Pay } from './screens/Pay';
import { Receive } from './screens/Receive';
import { Checks, Inspect } from './screens/Checks';
import { Admin } from './admin/Admin';
import { Badge } from './ui';

const useRoute = () => {
  const [r, setR] = useState(location.hash.slice(1) || '/');
  useEffect(() => { const f = () => setR(location.hash.slice(1) || '/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
};

export default function App() {
  const route = useRoute(); const d = useDevice(); const online = useOnline();
  // any internet contact forces a ping: sync as soon as we are online and signed in
  useEffect(() => { if (online && d.token) syncNow(); }, [online, d.token]);
  if (route.startsWith('/admin')) return <Admin page={route.split('/')[2] ?? 'overview'} />;
  const signedIn = !!d.token;
  let view;
  if (!signedIn && !['/signup', '/login'].includes(route)) view = <Welcome />;
  else switch (route) {
    case '/signup': view = <Signup />; break;
    case '/login': view = <Login />; break;
    case '/topup': view = <TopUp />; break;
    case '/pay': view = <Pay />; break;
    case '/receive': view = <Receive />; break;
    case '/history': view = <History />; break;
    case '/move': view = <Move />; break;
    case '/more': view = <More />; break;
    case '/checks': view = <Checks />; break;
    case '/inspect': view = <Inspect />; break;
    default: view = <Home />;
  }
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-24 pt-4">
        {slotName !== 'main' && <div className="mb-2"><Badge tone="blue">test slot: {slotName}</Badge></div>}
        {view}
        <p className="mt-8 text-center text-[11px] text-slate-400">Prototype · fake money · test data only · web demo (see More for what is real)</p>
      </div>
      {signedIn && (
        <nav className="fixed bottom-0 inset-x-0 border-t bg-white">
          <div className="mx-auto max-w-md grid grid-cols-5 text-center text-xs">
            {[['/', 'Home'], ['/pay', 'Pay'], ['/receive', 'Receive'], ['/history', 'History'], ['/more', 'More']].map(([p, l]) => <a key={p} href={`#${p}`} className={`py-3 ${route === p ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{l}</a>)}
          </div>
        </nav>
      )}
    </div>
  );
}
