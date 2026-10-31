import { useEffect, useState } from 'react';
import { useDevice, syncNow, slotName } from './lib/device';
import { Welcome, Signup, Login } from './screens/Auth';
import { Home, TopUp, Move, History, More, useOnline } from './screens/Main';
import { Pay } from './screens/Pay';
import { Receive } from './screens/Receive';
import { NiPayHeader, UserSidebar, BottomNav } from './layout/UserShell';
import { Selfie } from './screens/Selfie';
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
    case '/selfie': view = <Selfie />; break;
    case '/report': view = <More />; break;
    default: view = <Home />;
  }
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {signedIn && <NiPayHeader />}
      <div className="flex flex-1">
        {signedIn && <UserSidebar route={route} />}
        <main className={`flex-1 mx-auto w-full px-4 pt-4 pb-24 md:pb-8 ${signedIn ? 'max-w-3xl' : 'max-w-md'}`}>
          {!signedIn && slotName !== 'main' && <div className="mb-2"><Badge tone="blue">test slot: {slotName}</Badge></div>}
          {view}
          <p className="mt-8 text-center text-[11px] text-slate-400">Prototype · fake money · test data only · web demo (see More for what is real)</p>
        </main>
      </div>
      {signedIn && <BottomNav route={route} />}
    </div>
  );
}
