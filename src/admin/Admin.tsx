import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Badge, Btn, Card, Err, Field, Notice, errText } from '../ui';

const TK = 'nipay:admin:token';
const useAdmin = () => {
  const [tok, setTok] = useState<string | null>(sessionStorage.getItem(TK));
  const [who, setWho] = useState<{ name: string; role: string } | null>(JSON.parse(sessionStorage.getItem(TK + 'who') || 'null'));
  const call = useCallback((path: string, body?: unknown) => api(path, { token: tok, body, method: body !== undefined ? 'POST' : 'GET' }), [tok]);
  const login = async (u: string, p: string) => { const r = await api('/admin/login', { body: { username: u, password: p } }); sessionStorage.setItem(TK, r.token); sessionStorage.setItem(TK + 'who', JSON.stringify({ name: r.name, role: r.role })); setTok(r.token); setWho({ name: r.name, role: r.role }); };
  const logout = () => { sessionStorage.removeItem(TK); setTok(null); setWho(null); };
  return { tok, who, call, login, logout };
};
function usePoll<T>(call: (p: string) => Promise<T>, path: string, ms = 0): [T | null, string | null, () => void] {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { call(path).then((d) => { setData(d); setErr(null); }).catch((e) => setErr(errText(e))); }, [call, path]);
  useEffect(() => { load(); if (!ms) return; const t = setInterval(load, ms); return () => clearInterval(t); }, [load, ms]);
  return [data, err, load];
}
const tone = (s: string): any => ({ paid: 'green', PAID: 'green', held: 'red', pending: 'amber', CRITICAL: 'red', HIGH: 'amber', MEDIUM: 'slate' } as any)[s] ?? 'slate';
const Table: React.FC<{ head: string[]; rows: React.ReactNode[][] }> = ({ head, rows }) => (
  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500">{head.map((h) => <th key={h} className="py-1 pr-3">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((c, j) => <td key={j} className="py-1.5 pr-3 align-top">{c}</td>)}</tr>)}{!rows.length && <tr><td className="py-3 text-slate-400" colSpan={head.length}>Nothing yet.</td></tr>}</tbody></table></div>
);
const when = (s?: string | null) => (s ? new Date(s).toLocaleString() : '-');

const PAGES: [string, string][] = [['overview', 'Overview'], ['live-ledger', 'Live ledger'], ['live', 'Live monitor'], ['users', 'Users and wallets'], ['security', 'Security logs'], ['same-id', 'Same-ID log'], ['review', 'Review queue'], ['appeals', 'Appeals'], ['flow', 'Flow map'], ['rules', 'Rules and months'], ['ledger', 'Bank ledger'], ['analytics', 'Analytics'], ['audit', 'Audit log']];

export function Admin({ page }: { page: string }) {
  const a = useAdmin();
  const [u, setU] = useState('admin'); const [p, setP] = useState(''); const [err, setErr] = useState<string | null>(null);
  if (!a.tok) return (
    <div className="max-w-sm mx-auto mt-16 space-y-3"><h1 className="text-2xl font-bold">NiPay dashboard</h1><Notice>Admin password: printed by the server on first start and kept in backend/data/secrets.json (not in git).</Notice>
      <Field label="User (admin, risk or auditor)" value={u} onChange={(e) => setU(e.target.value)} data-testid="ad-user" /><Field label="Password" type="password" value={p} onChange={(e) => setP(e.target.value)} data-testid="ad-pass" /><Err msg={err} />
      <Btn data-testid="ad-login" onClick={() => a.login(u, p).catch((e) => setErr(errText(e)))}>Sign in</Btn></div>
  );
  if (page === 'live-ledger') return <LiveLedger a={a} />;
  const Page = { overview: Overview, live: Live, users: Users, security: Security, 'same-id': SameId, review: Review, appeals: Appeals, flow: Flow, rules: Rules, ledger: Ledger, analytics: Analytics, audit: Audit }[page] ?? Overview;
  return (
    <div className="flex min-h-screen bg-slate-50">
      <nav className="w-52 shrink-0 border-r bg-white p-3 space-y-0.5 text-sm">
        <p className="font-bold px-2 pb-2">NiPay admin</p>
        {PAGES.map(([k, l]) => <a key={k} href={`#/admin/${k}`} className={`block rounded px-2 py-1.5 ${page === k ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{l}</a>)}
        <p className="px-2 pt-4 text-xs text-slate-400">{a.who?.name} ({a.who?.role})</p><button className="px-2 text-xs underline" onClick={a.logout}>Sign out</button>
      </nav>
      <main className="flex-1 p-6 max-w-5xl space-y-4"><Page a={a} /></main>
    </div>
  );
}
type P = { a: ReturnType<typeof useAdmin> };

function Overview({ a }: P) {
  const [d, e] = usePoll<any>(a.call, '/admin/overview', 3000);
  if (!d) return <Err msg={e} />;
  const m = d.money_in_slots;
  return (<><h1 className="text-xl font-bold">Overview <Badge tone="blue">test money</Badge></h1>
    <div className="grid grid-cols-4 gap-3">{([['Main accounts', m.main], ['In send slots', m.send_bucket], ['In receive slots', m.receive_bucket], ['Kept by bank (lost phones)', m.bank_kept], ['Payments today', d.payments_today], ['Pending sync', d.pending_sync], ['Held claims', d.held_claims], ['Alerts (24h)', d.active_alerts]] as [string, number][]).map(([l, v]) => <Card key={l}><p className="text-xs text-slate-500">{l}</p><p className="text-2xl font-bold">{v}</p></Card>)}</div>
    <Card className="text-sm space-y-1"><p>Health: database {d.health.database}; ledger balanced: <b>{String(d.health.ledger_balanced)}</b>; audit chain intact: <b>{String(d.health.audit_chain_intact)}</b>; rules month {d.month}; users {d.users}; fees collected Rs {m.fees}.</p></Card></>);
}

function Live({ a }: P) {
  const [d] = usePoll<any>(a.call, '/admin/live', 2000);
  return (<><h1 className="text-xl font-bold">Live monitor</h1><Card><Table head={['Time', 'Type', 'Who', 'What']} rows={(d?.events ?? []).map((x: any) => [when(x.ts), <Badge tone={tone(x.type.replace('PAYMENT_', ''))}>{x.type}</Badge>, x.who, x.text])} /></Card></>);
}

function Users({ a }: P) {
  const [d, , load] = usePoll<any>(a.call, '/admin/users', 4000);
  const [msg, setMsg] = useState<string | null>(null);
  const sus = async (u: any) => { const reason = prompt(`${u.offline_suspended ? 'Restore' : 'Suspend'} offline use for ${u.name}. Reason:`); if (!reason) return; try { await a.call(`/admin/users/${u.id}/suspend`, { suspended: !u.offline_suspended, reason }); load(); } catch (e) { setMsg(errText(e)); } };
  return (<><h1 className="text-xl font-bold">Users and wallets</h1><Err msg={msg} /><Card><Table head={['Name', 'KYC', 'Bank / region', 'Main', 'Send', 'Receive', 'Trust', 'Devices', 'Last sync', '']} rows={(d?.users ?? []).map((u: any) => [<div><b>{u.name}</b><br /><span className="text-xs text-slate-400">{u.phone}</span></div>, <Badge tone="green">{u.kyc_status}</Badge>, `${u.bank} / ${u.region}`, u.main_balance, u.send_bucket, u.receive_bucket, u.trust, u.devices.map((x: any) => `${x.label}${x.active ? '' : ' (cancelled)'}`).join(', '), when(u.last_sync_at), <div>{u.offline_suspended && <Badge tone="red">offline suspended</Badge>} <button className="underline text-xs" onClick={() => sus(u)}>{u.offline_suspended ? 'restore' : 'suspend'}</button></div>])} /></Card></>);
}

function Security({ a }: P) {
  const [d] = usePoll<any>(a.call, '/admin/security-logs', 4000);
  return (<><h1 className="text-xl font-bold">Security logs</h1>
    <Notice tone="sky">Read-only. Tripwires fire on the phones with no server involved; this page only records what arrived at sync. Nothing here is resolved, fixed or closed by an admin.</Notice>
    <Card><Table head={['Time', 'Type', 'Severity', 'Account', 'Region', 'Point', 'Detail']} rows={(d?.events ?? []).map((e: any) => [when(e.at), <b>{e.type}</b>, <Badge tone={tone(e.severity)}>{e.severity}</Badge>, e.user ?? '-', e.region ?? '-', <code className="text-xs">{e.pid ? e.pid.slice(0, 8) + '…' : ''}</code>, <span className="text-xs">{e.description}</span>])} /></Card></>);
}

function SameId({ a }: P) {
  const [d] = usePoll<any>(a.call, '/admin/same-id', 4000);
  return (<><h1 className="text-xl font-bold">Same-ID log</h1>
    <Notice tone="sky">Read-only. Outcomes are automatic by rule: the first report is paid, later claims are held, and the point is traced to its owner's device. Humans act only through Appeals.</Notice>
    {(d?.cases ?? []).map((c: any) => (<Card key={c.pid} className="space-y-2"><div className="flex justify-between"><code className="text-sm">{c.pid}</code><Badge tone="red">{c.claimants.length} claimants</Badge></div>
      <p className="text-sm">Traced to owner <b>{c.owner}</b> ({c.owner_phone}), device "{c.owner_device}". {c.outcome}.</p>
      <Table head={['Claimant', 'Status', 'Why', 'At', 'Trust']} rows={c.claimants.map((x: any) => [`${x.name} (${x.phone})`, <Badge tone={tone(x.status)}>{x.status}</Badge>, x.reason, when(x.at), x.trust])} /></Card>))}
    {!d?.cases?.length && <Card className="text-sm text-slate-400">No point has been claimed twice.</Card>}</>);
}

function Review({ a }: P) {
  const [d, , load] = usePoll<any>(a.call, '/admin/review', 4000); const [msg, setMsg] = useState<string | null>(null);
  const dec = async (id: number, decision: string) => { try { await a.call(`/admin/review/${id}/decide`, { decision, note: '' }); load(); } catch (e) { setMsg(errText(e)); } };
  return (<><h1 className="text-xl font-bold">Review queue</h1><Notice tone="sky">A flag only sends a case here. It never freezes anyone by itself. A person decides.</Notice><Err msg={msg} />
    <Card><Table head={['When', 'Type', 'Account', 'Summary', 'Status', '']} rows={(d?.items ?? []).map((i: any) => [when(i.at), <Badge>{i.type}</Badge>, i.user, <span className="text-xs">{i.summary}</span>, <Badge tone={i.status === 'IN_REVIEW' ? 'amber' : 'slate'}>{i.status}</Badge>, i.status === 'IN_REVIEW' ? <span className="whitespace-nowrap"><button className="underline text-xs mr-2" onClick={() => dec(i.id, 'CLEARED')}>clear</button><button className="underline text-xs" onClick={() => dec(i.id, 'SUSPENDED')}>suspend offline use</button></span> : i.decided_by])} /></Card></>);
}

function Appeals({ a }: P) {
  const [d, , load] = usePoll<any>(a.call, '/admin/appeals', 4000); const [msg, setMsg] = useState<string | null>(null);
  const dec = async (id: number, decision: string) => { try { await a.call(`/admin/appeals/${id}/decide`, { decision, note: '' }); load(); } catch (e) { setMsg(errText(e)); } };
  return (<><h1 className="text-xl font-bold">Appeals</h1><Err msg={msg} />
    <Card><Table head={['#', 'User', 'Reason', 'Deadline', 'Status', '']} rows={(d?.appeals ?? []).map((x: any) => [x.id, x.user, x.reason, `${x.hours_left} h left`, <Badge tone={x.status === 'PENDING_DECISION' ? 'amber' : 'slate'}>{x.status}</Badge>, x.status === 'PENDING_DECISION' ? <span><button data-testid={`approve-${x.id}`} className="underline text-xs mr-2" onClick={() => dec(x.id, 'APPROVED')}>approve</button><button className="underline text-xs" onClick={() => dec(x.id, 'REJECTED')}>reject</button></span> : x.decided_by])} /></Card></>);
}

function Flow({ a }: P) {
  const [d] = usePoll<any>(a.call, '/admin/flow-map', 5000);
  if (!d) return null;
  const users = d.nodes.filter((n: any) => n.kind === 'user'); const W = 640, H = 360, cx = W / 2, cy = H / 2;
  const pos: Record<string, [number, number]> = { BANK: [cx, cy] };
  users.forEach((u: any, i: number) => { const ang = (i / Math.max(1, users.length)) * Math.PI * 2 - Math.PI / 2; pos[u.id] = [cx + Math.cos(ang) * 230, cy + Math.sin(ang) * 135]; });
  const col = (s: string) => (s === 'held' ? '#dc2626' : s === 'pending' ? '#d97706' : s === 'issued' ? '#94a3b8' : '#059669');
  return (<><h1 className="text-xl font-bold">Flow map</h1><Notice tone="sky">{d.note}</Notice>
    <Card><svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {d.edges.map((e: any, i: number) => { const f = pos[e.from], t = pos[e.to]; if (!f || !t) return null; const off = e.kind === 'transfer' ? 8 : 0; return (<g key={i}><line x1={f[0]} y1={f[1] + off} x2={t[0]} y2={t[1] + off} stroke={col(e.status)} strokeWidth={Math.min(6, 1 + e.count / 5)} opacity={0.7} strokeDasharray={e.kind === 'issued' ? '4 3' : undefined} /><text x={(f[0] + t[0]) / 2} y={(f[1] + t[1]) / 2 + off} fontSize="10" fill={col(e.status)} textAnchor="middle">{e.count} {e.status}</text></g>); })}
      {d.nodes.map((n: any) => { const p = pos[n.id]; return p && (<g key={n.id}><circle cx={p[0]} cy={p[1]} r={n.kind === 'bank' ? 34 : 24} fill={n.kind === 'bank' ? '#0f172a' : '#fff'} stroke="#0f172a" /><text x={p[0]} y={p[1] + 4} textAnchor="middle" fontSize="11" fill={n.kind === 'bank' ? '#fff' : '#0f172a'}>{n.kind === 'bank' ? 'Bank' : n.label.slice(0, 9)}</text></g>); })}</svg></Card>
    <div className="grid grid-cols-3 gap-3 text-sm"><Card>IDs not returned: <b>{d.ids_not_returned}</b></Card><Card>Received, not yet moved to main: <b>{d.received_not_moved_to_main}</b></Card><Card>Suspicious clusters: <b>{d.suspicious_clusters.length}</b></Card></div>
    <Card><p className="text-sm font-semibold mb-1">Blackout view: region and date</p><Table head={['Region', 'Date', 'Transfers', 'Held', 'Pending']} rows={d.blackout.map((b: any) => [b.region, b.date, b.transfers, b.held, b.pending])} /></Card>
    <a className="text-sm underline" href={'data:application/json,' + encodeURIComponent(JSON.stringify(d, null, 1))} download="flow-map-export.json">Export for authorities (JSON)</a></>);
}

function Rules({ a }: P) {
  const [d, , load] = usePoll<any>(a.call, '/admin/rules'); const [msg, setMsg] = useState<string | null>(null);
  return (<><h1 className="text-xl font-bold">Rules and months</h1>
    {d && <Card className="text-sm space-y-1"><p>Current month <b>{d.month}</b> · previous <b>{d.previous_month}</b> {d.previous_in_grace ? <Badge tone="green">in grace</Badge> : <Badge>closed</Badge>} · grace {d.grace_days} days</p>
      <p>Limits: send {d.send_limit}, receive {d.receive_limit} · bad-ID notices {d.bad_id_notices} · points issued this month {d.points_issued_this_month}</p>
      <p className="text-xs break-all">Bank public key: {d.bank_public_key}</p><p className="text-xs text-slate-500">{d.secrets}</p>
      <Btn kind="ghost" className="w-auto" onClick={async () => { if (!confirm('Rotate to the next month? Last month goes into the grace period.')) return; try { await a.call('/admin/rules/rotate', {}); load(); } catch (e) { setMsg(errText(e)); } }} data-testid="rotate">Rotate to next month</Btn><Err msg={msg} /></Card>}</>);
}

function Ledger({ a }: P) {
  const [d, , load] = usePoll<any>(a.call, '/admin/ledger'); const [msg, setMsg] = useState<string | null>(null);
  return (<><h1 className="text-xl font-bold">Bank ledger</h1><Notice tone="sky">{d?.note} Fictional banks, test money.</Notice>
    <Card><Table head={['Debtor bank', 'Creditor bank', 'Batch', 'Points', 'Rupees', 'Status']} rows={(d?.entries ?? []).map((e: any) => [e.debtor_bank, e.creditor_bank, e.batch, e.points, e.rupees, <Badge tone={e.status === 'SETTLED' ? 'green' : 'amber'}>{e.status}</Badge>])} />
      <Btn kind="ghost" className="w-auto mt-3" onClick={async () => { try { await a.call('/admin/ledger/settle', {}); load(); } catch (e) { setMsg(errText(e)); } }}>Close and settle the open batch</Btn><Err msg={msg} /></Card></>);
}

function Analytics({ a }: P) {
  const [d] = usePoll<any>(a.call, '/admin/analytics', 5000); if (!d) return null;
  const bars = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => <div key={k} className="flex items-center gap-2 text-sm"><span className="w-32">{k}</span><div className="h-3 bg-slate-800 rounded" style={{ width: Math.min(300, 10 + v * 20) }} /><span>{v}</span></div>);
  return (<><h1 className="text-xl font-bold">Analytics</h1><div className="grid grid-cols-2 gap-3"><Card><p className="font-semibold text-sm mb-1">Transfers by status</p>{bars(d.transfers_by_status)}</Card><Card><p className="font-semibold text-sm mb-1">Tripwires by type</p>{bars(d.tripwires_by_type)}</Card><Card><p className="font-semibold text-sm mb-1">Transfers by region</p>{bars(d.transfers_by_region)}</Card>
    <Card className="text-sm space-y-1"><p>Average time to settle: <b>{d.avg_settle_delay_seconds}s</b></p><p>Kept by bank after lost phones: <b>Rs {d.kept_by_bank_after_lost_phones}</b></p><p>Fees collected: <b>Rs {d.fees_collected}</b></p></Card></div></>);
}

function Audit({ a }: P) {
  const [d] = usePoll<any>(a.call, '/admin/audit-log', 5000);
  return (<><h1 className="text-xl font-bold">Audit log</h1><Notice tone="sky">Append-only. Each row carries a hash of the row before it. Chain intact: <b>{String(d?.chain_intact)}</b></Notice>
    <Card><Table head={['When', 'Who', 'Role', 'Action', 'Target', 'IP']} rows={(d?.entries ?? []).map((e: any) => [when(e.at), e.actor, e.role, e.action, e.target, e.ip])} /></Card></>);
}

// ---------- projector-friendly page ----------
function Count({ v }: { v: number }) {
  const [shown, setShown] = useState(v); const [flash, setFlash] = useState(0); const prev = useRef(v);
  useEffect(() => {
    if (prev.current === v) return; const from = prev.current, to = v; prev.current = v; setFlash(to > from ? 1 : -1);
    const t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 900); setShown(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); const off = setTimeout(() => setFlash(0), 1800); return () => { cancelAnimationFrame(raf); clearTimeout(off); };
  }, [v]);
  return <span className={`tabular-nums transition-colors duration-700 ${flash > 0 ? 'text-emerald-500' : flash < 0 ? 'text-red-500' : ''}`}>{shown.toLocaleString()}</span>;
}
function LiveLedger({ a }: P) {
  const [pa, setPa] = useState(''), [pb, setPb] = useState('');
  const [d] = usePoll<any>(a.call, `/admin/live-ledger?a=${encodeURIComponent(pa)}&b=${encodeURIComponent(pb)}`, 1500);
  const A = d?.a, B = d?.b;
  const Big = ({ label, v, sub }: { label: string; v?: number; sub?: string }) => (<div className="bg-white border-2 border-slate-200 rounded-3xl p-8 text-center"><p className="text-3xl text-slate-500">{label}</p><p className="text-8xl font-bold mt-2" data-testid={`ll-${label}`}>Rs <Count v={v ?? 0} /></p>{sub && <p className="text-2xl text-slate-400 mt-1">{sub}</p>}</div>);
  return (
    <div className="min-h-screen bg-slate-50 p-8 space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-5xl font-bold">Live ledger</h1><span className="text-3xl font-bold bg-amber-100 text-amber-800 rounded-xl px-5 py-2">TEST MONEY - fake rupees</span></div>
      <div className="flex gap-3 items-center text-lg"><select className="border rounded p-1" value={pa} onChange={(e) => setPa(e.target.value)}><option value="">Person A: first user</option>{d?.users.map((u: any) => <option key={u.phone} value={u.phone}>{u.name}</option>)}</select>
        <select className="border rounded p-1" value={pb} onChange={(e) => setPb(e.target.value)}><option value="">Person B: second user</option>{d?.users.map((u: any) => <option key={u.phone} value={u.phone}>{u.name}</option>)}</select>
        <a href="#/admin/overview" className="underline ml-auto text-sm">Back to dashboard</a></div>
      <div className="grid grid-cols-3 gap-6"><Big label={`${A?.name ?? 'A'}: account`} v={A?.account} sub="main account at the bank" /><Big label={`${A?.name ?? 'A'}: send slot`} v={A?.send_slot} sub="offline points not yet spent" /><Big label={`${B?.name ?? 'B'}: account`} v={B?.account} sub={`+ receive slot: ${B?.receive_slot ?? 0}`} /></div>
      <p className="text-2xl text-slate-500">These numbers change only when a phone syncs with the bank. While phones are offline and paying each other, they stay exactly as they are. Updated {d ? new Date(d.server_time).toLocaleTimeString() : '...'}</p>
      <div className="space-y-2">{d?.entries.map((e: any) => (<div key={e.id} className="bg-white border rounded-xl px-5 py-3 text-2xl flex justify-between animate-[fadein_.8s]"><span>{new Date(e.at).toLocaleTimeString()} · <b>{e.kind.replace(/_/g, ' ')}</b> · {e.who}{e.other ? ` → ${e.other}` : ''}</span><span className="text-slate-600">{[e.d_main && `account ${e.d_main > 0 ? '+' : ''}${e.d_main}`, e.d_send && `send ${e.d_send > 0 ? '+' : ''}${e.d_send}`, e.d_recv && `receive ${e.d_recv > 0 ? '+' : ''}${e.d_recv}`].filter(Boolean).join(', ')}</span></div>))}</div>
    </div>
  );
}
