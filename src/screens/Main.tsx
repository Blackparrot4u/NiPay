import { useEffect, useState } from 'react';
import { Badge, Btn, Card, Err, Field, Notice, Title, batteryPercent, errText, go, setLanguage, useT } from '../ui';
import { api } from '../lib/api';
import { addTopupPoints, checkPin, controlKey, get, hwCounter, refreshWallet, resetDevice, set, spendable, syncNow, useDevice, currentMonth } from '../lib/device';
import { logout, fetchRules } from '../lib/actions';
import { QrDisplay } from '../components/QrDisplay';
import { enc } from '../lib/crypto';
import { enablePasskey, passkeySupported } from '../lib/unlock';

function WifiShare() {
  const [ssid, setSsid] = useState(''); const [pw, setPw] = useState('');
  const esc = (x: string) => x.replace(/([\\;,:"])/g, '\\$1');
  return (<Card className="space-y-2"><p className="font-semibold text-sm">Share wifi join code</p>
    <p className="text-xs text-slate-500">A web page cannot create or join wifi. Type your hotspot name and password; the other phone's normal camera app can scan this standard wifi code and offer to join.</p>
    <Field label="Wifi name" value={ssid} onChange={(e) => setSsid(e.target.value)} /><Field label="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
    {ssid && <QrDisplay frames={[enc.encode(`WIFI:T:WPA;S:${esc(ssid)};P:${esc(pw)};;`)]} size={220} />}</Card>);
}

export const useOnline = () => {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => { const a = () => setOn(true), b = () => setOn(false); addEventListener('online', a); addEventListener('offline', b); return () => { removeEventListener('online', a); removeEventListener('offline', b); }; }, []);
  return on;
};

export function Home() {
  const d = useDevice(); const t = useT(); const online = useOnline();
  const [msg, setMsg] = useState(''); const [bat, setBat] = useState<number | null>(null);
  useEffect(() => { batteryPercent().then(setBat); }, []);
  const s = d.server;
  const unsynced = d.sent.filter((x) => !x.synced).length + d.received.filter((x) => !x.synced).length;
  const receiveLocal = d.received.filter((x) => !x.synced).length;
  const expired = d.docs.length === 0;
  const blocked = (bat !== null && bat < 3) || s?.offline_suspended || d.locked;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-slate-500">Hello</p><p className="text-lg font-bold" data-testid="who">{d.name}</p></div>
        <div className="flex gap-1"><Badge tone={online ? 'green' : 'amber'}>{online ? 'Online' : 'Offline'}</Badge><Badge tone="slate">test money</Badge></div>
      </div>
      {blocked && <Card className="border-red-300 bg-red-50 text-sm text-red-700"><span data-testid="blocked">{bat !== null && bat < 3 ? t('battery') : t('attention')}</span></Card>}
      {expired && <Notice>No signed rules on this phone yet. Go online once to load them.</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-xs text-slate-500">{t('send_bucket')}</p><p className="text-2xl font-bold" data-testid="send-bal">{spendable().length}</p><p className="text-[11px] text-slate-400">points on this phone {s?.send_limit != null ? `(max ${s.send_limit})` : ''}</p></Card>
        <Card><p className="text-xs text-slate-500">{t('receive_bucket')}</p><p className="text-2xl font-bold" data-testid="recv-bal">{(s?.receive_bucket ?? 0) + receiveLocal}</p><p className="text-[11px] text-slate-400">{receiveLocal ? `${receiveLocal} waiting for sync` : 'settled at the bank'} {s?.receive_limit != null ? `(max ${s.receive_limit})` : ''}</p></Card>
      </div>
      <Card className="flex justify-between text-sm"><span className="text-slate-500">Main account (bank)</span><b data-testid="main-bal">Rs {s?.main_balance ?? '-'}</b></Card>
      <div className="grid grid-cols-3 gap-2">
        <Btn onClick={() => go('/pay')} data-testid="go-pay">{t('pay')}</Btn><Btn onClick={() => go('/receive')} data-testid="go-receive">{t('receive')}</Btn><Btn kind="ghost" onClick={() => go('/topup')} data-testid="go-topup">{t('topup')}</Btn>
      </div>
      <Card className="text-xs text-slate-600 space-y-1">
        <div className="flex justify-between"><span>Last synced</span><b>{d.lastSync ? new Date(d.lastSync).toLocaleString() : 'never'}</b></div>
        <div className="flex justify-between"><span>Waiting to sync</span><b data-testid="unsynced">{unsynced} log lines</b></div>
        <div className="flex justify-between"><span>IDs renew in</span><b data-testid="renew">{s?.days_until_renewal != null ? `${s.days_until_renewal} days` : '-'}</b></div>
        <div className="flex justify-between"><span>Rules month</span><b>{currentMonth() || '-'}</b></div>
        <div className="flex justify-between"><span>Trust score (bank-signed)</span><b>{d.trust?.score ?? '-'}</b></div>
      </Card>
      <Btn kind="ghost" disabled={!online} data-testid="sync-btn" onClick={async () => { const r = await syncNow(); await refreshWallet(); setMsg(r.message); }}>Sync now (needs internet)</Btn>
      {msg && <Notice tone="sky">{msg}</Notice>}
      {online && unsynced === 0 && receiveLocal === 0 && (s?.receive_bucket ?? 0) > 0 && <Notice>Advice: move your received money to the bank account soon. <a className="underline" href="#/move">Move money</a></Notice>}
      <div className="grid grid-cols-2 gap-2 text-center text-sm"><a className="underline" href="#/history">History</a><a className="underline" href="#/more">More and settings</a></div>
    </div>
  );
}

export function TopUp() {
  const d = useDevice(); const online = useOnline();
  const [amount, setAmount] = useState('50'); const [pin, setPin] = useState(''); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState('');
  const a = parseInt(amount, 10) || 0;
  const go_ = async () => {
    setErr(null); setOk('');
    if (!checkPin(pin)) return setErr('Wrong PIN.');
    try {
      const r = await api('/wallet/topup', { body: { amount: a, pin, unsynced_spent: get().sent.filter((x) => !x.synced).length }, token: d.token });
      addTopupPoints(r.points); set({ server: r.wallet }); await fetchRules();
      setOk(`Added ${a} points (+1 control key). Rs ${a + (get().server?.topup_fee ?? 0)} left your main account.`); 
    } catch (e) { setErr(errText(e)); }
  };
  return (
    <div className="space-y-3">
      <Title back="/" sub="Needs internet. Fake money.">Add points</Title>
      <Card className="text-sm space-y-1"><div className="flex justify-between"><span>Main account</span><b>Rs {d.server?.main_balance}</b></div><div className="flex justify-between"><span>Points on phone</span><b>{spendable().length}{d.server?.send_limit != null ? ` / ${d.server.send_limit}` : ''}</b></div>
        <div className="flex justify-between"><span>Fee</span><b>{d.server?.topup_fee != null ? `Rs ${d.server.topup_fee}` : '-'}</b></div><div className="flex justify-between border-t pt-1"><span>You pay</span><b>{d.server?.topup_fee != null ? `Rs ${a + d.server.topup_fee}` : '-'}</b></div></Card>
      <Field label={`Points to add${d.server?.send_limit != null ? ` (max ${d.server.send_limit} in total)` : ''}`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="tu-amount" />
      <Field label="PIN" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} data-testid="tu-pin" />
      <Err msg={err} />{ok && <Notice tone="sky">{ok}</Notice>}
      <Btn disabled={!online || a < 1} onClick={go_} data-testid="tu-submit">Confirm with PIN</Btn>
    </div>
  );
}

export function Move() {
  const d = useDevice(); const [amount, setAmount] = useState(''); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState('');
  const max = d.server?.receive_bucket ?? 0;
  const run = async () => {
    setErr(null); setOk('');
    try { const w = await api('/wallet/move-to-main', { body: { amount: parseInt(amount || String(max), 10) }, token: d.token }); set({ server: w }); setOk('Moved to your main account.'); } catch (e) { setErr(errText(e)); }
  };
  return (
    <div className="space-y-3"><Title back="/" sub="Receive bucket to main account. Needs internet and a finished sync.">Move money</Title>
      <Card className="text-sm">Settled in receive bucket: <b data-testid="movable">{max}</b></Card>
      <Field label="Amount (empty = all)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="mv-amount" /><Err msg={err} />{ok && <Notice tone="sky">{ok}</Notice>}
      <Btn disabled={max < 1} onClick={run} data-testid="mv-submit">Move</Btn></div>
  );
}

export function History() {
  const d = useDevice();
  const tone = (s: string) => (s === 'paid' ? 'green' : s === 'held' ? 'red' : 'amber') as any;
  const local = [...d.sent.filter((x) => !x.synced), ...d.received.filter((x) => !x.synced)];
  return (
    <div className="space-y-3"><Title back="/">History</Title>
      {local.length > 0 && <Card className="space-y-1"><p className="text-xs text-slate-500">On this phone, not yet at the bank</p>
        {Object.values(local.reduce((a: any, x) => { const k = x.ref + (d.sent.includes(x) ? 's' : 'r'); (a[k] ??= { ...x, n: 0, dir: d.sent.includes(x) ? 'Sent to' : 'Received from' }).n++; return a; }, {})).map((g: any) => (
          <div key={g.ref + g.dir} className="flex justify-between text-sm"><span>{g.dir} {g.peerName}: {g.n} pts</span><Badge tone="amber">pending</Badge></div>))}</Card>}
      <Card className="space-y-2">{d.history.length === 0 && <p className="text-sm text-slate-400">No settled payments yet.</p>}
        {d.history.map((h: any) => (<div key={h.id + h.direction} className="flex justify-between text-sm" data-testid="hist-row"><div><p>{h.direction === 'sent' ? 'Sent to' : 'Received from'} <b>{h.counterparty}</b></p><p className="text-[11px] text-slate-400">{new Date(h.when).toLocaleString()} · {h.transport || 'qr'}</p></div><div className="text-right"><p>{h.amount} pts</p><Badge tone={tone(h.status)}>{h.status}</Badge></div></div>))}</Card></div>
  );
}

export function More() {
  const d = useDevice(); const [rep, setRep] = useState(''); const [msg, setMsg] = useState(''); const [apps, setApps] = useState<any[]>([]);
  useEffect(() => { api('/appeals/mine', { token: d.token }).then((r) => setApps(r.appeals)).catch(() => {}); }, [d.token, msg]);
  const post = async (path: string, body: any, done: string) => { try { await api(path, { body, token: d.token }); setMsg(done); } catch (e) { setMsg(errText(e)); } };
  return (
    <div className="space-y-3"><Title back="/">More</Title>
      <Card className="space-y-2"><p className="font-semibold text-sm">Language</p><div className="flex gap-2"><Btn kind={d.language === 'en' ? 'primary' : 'ghost'} onClick={() => setLanguage('en')}>English</Btn><Btn kind={d.language === 'hi' ? 'primary' : 'ghost'} onClick={() => setLanguage('hi')}>हिन्दी</Btn></div></Card>
      <Card className="space-y-2"><p className="font-semibold text-sm">Report or appeal (needs internet)</p>
        <Field label="Describe the problem" value={rep} onChange={(e) => setRep(e.target.value)} data-testid="rep-text" />
        <Btn kind="ghost" disabled={rep.length < 3} onClick={() => post('/reports', { kind: 'payment_problem', detail: rep }, 'Report sent for review.')}>Problem with a payment</Btn>
        <Btn kind="ghost" disabled={rep.length < 3} onClick={() => post('/appeals', { reason: rep, documents: [] }, 'Appeal filed. A person decides within 48 hours.')} data-testid="appeal-btn">Appeal a flag or block</Btn>
        <Btn kind="danger" onClick={() => { if (confirm('Report this phone lost? Unspent points are NOT refunded (lost-phone rule).')) post('/reports', { kind: 'lost_phone', detail: 'lost phone' }, 'Reported. Old device cancelled, no refund.').then(() => set({ token: null })); }}>My phone is lost</Btn>
        {msg && <Notice tone="sky">{msg}</Notice>}
        {apps.map((a) => <div key={a.id} className="text-xs flex justify-between"><span>Appeal #{a.id}</span><Badge>{a.status}</Badge></div>)}</Card>
      <Card className="space-y-1 text-sm"><p className="font-semibold">Device</p><p className="text-xs text-slate-500 break-all">Device public key: {d.pub.slice(0, 16)}... (the private key never leaves this phone)</p><p className="text-xs">Counter (simulated in the browser, so weak; a real hardware counter is planned for the native app): {hwCounter()} / wallet sequence {d.seq}</p><p className="text-xs">Control key: {controlKey() ? 'present, hidden' : 'none yet'}</p></Card>
      <Card className="text-xs text-slate-600 space-y-1"><p className="font-semibold text-sm">What is real in this web demo</p>
        <p>Real: Ed25519 signatures made on this device, bank signature checks, tower, landmines, stack mines, signed rules, signed handover and received, animated-QR transfer, server settlement.</p>
        <p>Not possible in a browser, planned for the native app: Play Integrity (Android), App Attest (iPhone), root and emulator detection, a real hardware counter, self-lock, Bluetooth peripheral mode, NFC tap pairing, biometric unlock.</p>
        <p>Test data only: no real Aadhaar, PAN or bank data is stored. Fake money.</p></Card>
      <WifiShare />
      <Security />
      <Btn kind="ghost" onClick={() => go('/inspect')}>Mine inspector</Btn>
      {d.locked && <Card className="text-xs space-y-1"><p>This wallet looks restored from a copy, so it is locked (self-lock). On a real phone you would upload documents to support. Demo shortcut:</p><Btn kind="ghost" onClick={() => set({ locked: false, seq: hwCounter() })}>Support approved: unlock (demo)</Btn></Card>}
      <Btn kind="ghost" onClick={async () => { await logout(); go('/welcome'); }}>Sign out</Btn>
      <Btn kind="ghost" onClick={() => { if (confirm('Erase this phone\'s keys and points? (Test only)')) { resetDevice(); go('/welcome'); } }}>Erase this demo phone</Btn>
    </div>
  );
}

/** Fingerprint/face unlock (WebAuthn passkey, HTTPS only, PIN stays as fallback) and the demo selfie (consent, delete). */
function Security() {
  const d = useDevice(); const [m, setM] = useState('');
  const [selfie, setSelfie] = useState<boolean | null>(null);
  useEffect(() => { api('/selfie/status', { token: d.token }).then((r) => setSelfie(r.stored)).catch(() => setSelfie(null)); }, [d.token, m]);
  return (
    <Card className="space-y-2"><p className="font-semibold text-sm">Unlock and selfie</p>
      {passkeySupported()
        ? (d.passkeyId ? <div className="flex gap-2"><Badge tone="green">Fingerprint or face unlock is on</Badge><button className="underline text-xs" onClick={() => set({ passkeyId: null })}>turn off</button></div>
          : <Btn kind="ghost" data-testid="enable-passkey" onClick={async () => setM((await enablePasskey()) ?? 'Fingerprint or face unlock is on. The PIN still works as a fallback.')}>Turn on fingerprint or face unlock</Btn>)
        : <p className="text-xs text-slate-500">Fingerprint or face unlock needs HTTPS (open the secure link). PIN is used until then.</p>}
      {selfie === true && <div className="flex justify-between text-xs"><span>A demo selfie is stored on the server for this account.</span><button className="underline" data-testid="selfie-delete" onClick={async () => { await api('/selfie', { method: 'DELETE', token: d.token }).catch(() => {}); setM('Selfie deleted.'); }}>delete it</button></div>}
      {selfie === false && <button className="underline text-xs" onClick={() => go('/selfie')}>Add a demo selfie (with consent)</button>}
      {m && <Notice tone="sky">{m}</Notice>}</Card>
  );
}
