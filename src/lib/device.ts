// The phone's own state: device key (made here, never sent), points, mines, received/sent logs, signed documents.
// Persisted in localStorage under a per-"slot" prefix so two tabs of one browser can act as two phones in tests.
import { useSyncExternalStore } from 'react';
import { b64, unb64, newKeypair, randomBytes, sha256b, enc, hex } from './crypto';
import {
  ALPHA, Rules, Recipe, parseRules, parseRecipe, acceptSigned, findMines, spendOrder, receiveFill, phoneCheck,
  signHandover, signReceipt, verifyReceipt, auditMines,
} from './idsystem';
import { api, ApiError, NetworkError } from './api';
import { Cert, CheckOutcome, CrossReport, PeerCard, checkPeer, makeCard, signReport } from './peercheck';

export interface StoredPoint { pid: string; month: string; sig: string; kind: 'value' | 'control' }
export interface Held { pid: string; month: string; sig: string; handover: string; receipt: string; peer: string; peerName: string; ref: string; ts: number; synced: boolean; status?: string; transport: string }
export interface Docs { month: string; rules: { blob: string; sig: string }; mine: { blob: string; sig: string }; policy: { blob: string; sig: string } }
export interface State {
  seed: string; pub: string;
  token: string | null; phone: string; name: string; pinHash: string; pinSalt: string; language: 'en' | 'hi';
  bankPub: string;
  docs: Docs[]; notices: string[]; trust: { score: number; age_days: number } | null;
  points: StoredPoint[]; inflight: string[]; mines: string[][]; seq: number;
  received: Held[]; sent: Held[];
  queuedReports: { type: string; pid: string; description: string }[];
  server: any | null; history: any[]; lastSync: string | null; lastSyncOk: boolean;
  trace: string[]; locked: boolean;
  cert: Cert | null; crossReports: CrossReport[]; passkeyId: string | null; selfieDone: boolean;
}
const empty = (): State => {
  const kp = newKeypair();
  return { seed: b64(kp.seed), pub: b64(kp.pub), token: null, phone: '', name: '', pinHash: '', pinSalt: '', language: 'en', bankPub: '', docs: [], notices: [], trust: null,
    points: [], inflight: [], mines: [], seq: 0, received: [], sent: [], queuedReports: [], server: null, history: [], lastSync: null, lastSyncOk: false, trace: [], locked: false, cert: null, crossReports: [], passkeyId: null, selfieDone: false };
};

const slot = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('slot')) || 'main';
const KEY = `nipay:${slot}:state`, HW = `nipay:${slot}:hwcounter`;
export const slotName = slot;

let state: State = (() => {
  try { const s = localStorage.getItem(KEY); if (s) return { ...empty(), ...JSON.parse(s) }; } catch { /* corrupt: start clean */ }
  return empty();
})();
const subs = new Set<() => void>();
export function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full */ }
  subs.forEach((f) => f());
}
export const get = () => state;
export const useDevice = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
export const resetDevice = () => { localStorage.removeItem(KEY); localStorage.removeItem(HW); state = empty(); subs.forEach((f) => f()); };

// Simulated hardware counter: kept outside the wallet so restoring a wallet copy cannot roll it back.
// A real phone needs secure hardware for this; the browser cannot. Labelled "planned for native app".
export const hwCounter = () => Number(localStorage.getItem(HW) ?? 0);
const bumpCounter = () => { const v = hwCounter() + 1; localStorage.setItem(HW, String(v)); return v; };

export const trace = (line: string) => set((s) => ({ trace: [`${new Date().toLocaleTimeString()} ${line}`, ...s.trace].slice(0, 60) }));

// ---------- local PIN (the real check is on the server at top-up) ----------
export const pinHash = (pin: string, salt: string) => hex(sha256b(enc.encode(salt + pin)));
export function setPin(pin: string) { const salt = hex(randomBytes(8)); set({ pinSalt: salt, pinHash: pinHash(pin, salt) }); }
export const checkPin = (pin: string) => !!state.pinHash && pinHash(pin, state.pinSalt) === state.pinHash;

// ---------- verified documents ----------
export const bankPubBytes = () => unb64(state.bankPub);
export function rulesFor(month: string): Rules | null {
  const d = state.docs.find((x) => x.month === month);
  if (!d) return null;
  const blob = acceptSigned(bankPubBytes(), d.rules);
  return blob ? parseRules(blob) : null;
}
export function recipeFor(month: string): Recipe | null {
  const d = state.docs.find((x) => x.month === month);
  const blob = d && acceptSigned(bankPubBytes(), d.mine);
  return blob ? parseRecipe(blob) : null;
}
export function policy(month: string): { send: number; recv: number; grace: number } | null {
  const d = state.docs.find((x) => x.month === month);
  const blob = d && acceptSigned(bankPubBytes(), d.policy);
  return blob ? JSON.parse(new TextDecoder().decode(blob)) : null;
}
/** Accepts a rules package only if the bank signed all of it. Used for sync AND for phone-to-phone passing. */
export function acceptRulesDoc(doc: Docs): boolean {
  const pub = bankPubBytes();
  if (!pub.length || !acceptSigned(pub, doc.rules) || !acceptSigned(pub, doc.mine) || !acceptSigned(pub, doc.policy)) return false;
  set((s) => ({ docs: [doc, ...s.docs.filter((d) => d.month !== doc.month)].slice(0, 2) }));
  return true;
}
export const currentMonth = () => [...state.docs].map((d) => d.month).sort().pop() ?? '';
export function blocklist(): Set<string> {
  return new Set(state.notices);
}
/** Months this phone may accept: the latest it knows, plus last month while the bank said grace applies. */
export function acceptableMonths(): string[] {
  const m = state.docs.map((d) => d.month).sort();
  return m.slice(-2);
}

// ---------- wallet ----------
export const spendable = () => state.points.filter((p) => p.kind === 'value' && !state.inflight.includes(p.pid));
export const controlKey = () => state.points.find((p) => p.kind === 'control')?.pid ?? '';

export function armMines() {
  const month = currentMonth(); const rec = recipeFor(month);
  if (!rec) return;
  const ids = state.points.filter((p) => p.kind === 'value' && p.month === month).map((p) => p.pid);
  set({ mines: findMines(rec, ids, Math.floor(ids.length / 3)) });
}

export function addTopupPoints(points: StoredPoint[]) {
  set((s) => ({ points: [...s.points, ...points.filter((p) => !s.points.some((q) => q.pid === p.pid))] }));
  armMines();
}

/** Picks points in KT's spend order, locks them as in flight, and signs the handover to `to`. */
/** Restore detection before anything is sent: the wallet sequence must equal the (simulated) hardware counter. Locks the wallet if not. */
export function walletUsable(): boolean {
  if (state.locked || state.seq !== hwCounter()) {
    if (!state.locked) queueReport('restore', '', 'wallet sequence behind the hardware counter: wallet was restored from a copy');
    set({ locked: true });
    return false;
  }
  return true;
}
export function prepareSpend(n: number, to: string, month: string): { pid: string; month: string; sig: Uint8Array; handover: Uint8Array }[] {
  const s = state;
  // restore detection: the wallet sequence must equal the (simulated) hardware counter
  if (s.locked || s.seq !== hwCounter()) {
    if (!s.locked) queueReport('restore', '', 'wallet sequence behind the hardware counter: wallet was restored from a copy');
    set({ locked: true });
    throw new Error('locked');
  }
  const free = new Set(spendable().filter((p) => p.month === month).map((p) => p.pid));
  const order = spendOrder(s.points.map((p) => p.pid), s.mines, controlKey()).filter((p) => free.has(p)).slice(0, n);
  if (order.length < n) throw new Error('not enough points');
  const seed = unb64(s.seed);
  const out = order.map((pid) => {
    const p = s.points.find((x) => x.pid === pid)!;
    return { pid, month: p.month, sig: unb64(p.sig), handover: signHandover(seed, p.month, pid, to) };
  });
  set({ inflight: [...s.inflight, ...order] });
  return out;
}
export function releaseInflight(pids: string[]) { set((s) => ({ inflight: s.inflight.filter((p) => !pids.includes(p)) })); }
/** The receiver's signed receipt arrived: the points are really gone from this wallet. */
export function finishSpend(items: Held[]) {
  const gone = new Set(items.map((i) => i.pid));
  const c = bumpCounter();
  set((s) => ({ points: s.points.filter((p) => !gone.has(p.pid)), inflight: s.inflight.filter((p) => !gone.has(p)), sent: [...items, ...s.sent], seq: c }));
}
export function storeReceived(items: Held[]) {
  set((s) => ({ received: [...items, ...s.received.filter((r) => !items.some((i) => i.pid === r.pid))] }));
}
export function queueReport(type: string, pid: string, description: string) {
  set((s) => ({ queuedReports: [...s.queuedReports, { type, pid, description }].slice(-50) }));
}

// ---------- the offline check of an incoming payment (runs in the browser) ----------
export interface CheckResult { ok: boolean; failed: { pid: string; layer: string }[]; reasons: string[] }
export function checkIncoming(pointsIn: { pid: string; sig: Uint8Array }[], month: string): CheckResult {
  const failed: { pid: string; layer: string }[] = [], reasons: string[] = [];
  if (!acceptableMonths().includes(month)) { reasons.push('month'); return { ok: false, failed, reasons }; }
  const rules = rulesFor(month);
  if (!rules) { reasons.push('no signed rules for that month'); return { ok: false, failed, reasons }; }
  const bl = blocklist(); const pub = bankPubBytes();
  const seen = new Set<string>();
  for (const p of pointsIn) {
    const layer = seen.has(p.pid) ? 'dup' : state.received.some((r) => r.pid === p.pid) || state.points.some((q) => q.pid === p.pid) ? 'dup' : phoneCheck(p.pid, p.sig, { ...rules, month }, pub, bl);
    seen.add(p.pid);
    if (layer !== 'ok') failed.push({ pid: p.pid, layer });
  }
  return { ok: failed.length === 0, failed, reasons };
}
export const layerToTripwire = (l: string) => ({ B: 'tower', A: 'landmine', H: 'forged', G: 'forged', dup: 'forged' } as Record<string, string>)[l] ?? 'forged';

// ---------- sync ----------
export interface SyncResult { ok: boolean; offline?: boolean; message: string; results?: any[] }
let syncing = false;
export async function syncNow(round = 0): Promise<SyncResult> {
  const s0 = state;
  if (!s0.token || syncing) return { ok: false, message: 'not signed in' };
  syncing = true;
  try {
    const logs = [
      ...s0.sent.filter((x) => !x.synced).map((x) => ({ role: 'sent', month: x.month, pid: x.pid, sig: x.sig, handover: x.handover, receipt: x.receipt, to_phone: x.peer, payment_ref: x.ref, transport: x.transport, ts: new Date(x.ts).toISOString() })),
      ...s0.received.filter((x) => !x.synced).map((x) => ({ role: 'received', month: x.month, pid: x.pid, sig: x.sig, handover: x.handover, payment_ref: x.ref, transport: x.transport, ts: new Date(x.ts).toISOString() })),
    ];
    const month = currentMonth();
    const wallet = { points: s0.points.map((p) => p.pid), mines: s0.mines, seq: s0.seq, counter: hwCounter(), month, control: controlKey() || undefined, counter_kind: 'simulated-browser' };   // a browser has no hardware counter: weak, labelled so
    const sentReports = s0.crossReports;
    const r = await api('/sync', { body: { logs, reports: s0.queuedReports, cross_reports: sentReports, wallet, client_time: new Date().toISOString() }, token: s0.token });
    // adopt bank-signed documents only if the signatures are good
    let rejectedDocs = 0;
    for (const d of [r.rules]) if (!acceptRulesDoc(d)) rejectedDocs++;
    const nb = acceptSigned(bankPubBytes(), r.notices);
    const results: any[] = r.results;
    const byPid = new Map(results.map((x) => [x.pid, x]));
    const mark = (list: Held[]) => list.map((x) => { const res = byPid.get(x.pid); return res && res.status !== 'pending' ? { ...x, synced: true, status: res.status } : res && res.status === 'pending' ? { ...x, status: 'pending' } : x; });
    set((s) => ({
      sent: mark(s.sent), received: mark(s.received), queuedReports: [], crossReports: s.crossReports.filter((x) => !sentReports.includes(x)), notices: nb ? JSON.parse(new TextDecoder().decode(nb)).bad : s.notices,
      trust: { score: r.trust.score, age_days: r.trust.age_days }, cert: { blob: r.trust.blob, sig: r.trust.sig }, server: r.wallet, lastSync: new Date().toISOString(), lastSyncOk: true,
    }));
    // points that settled as paid are bank-side now; remove synced received entries older than the list cap
    const hist = await api('/history', { token: s0.token }).catch(() => null);
    if (hist) set({ history: hist.payments });
    if (r.more && round < 10) { syncing = false; return syncNow(round + 1); }   // the server takes a batch per round; send the rest
    trace(`sync ok: ${logs.length} log lines, ${results.filter((x) => x.status === 'paid').length} paid, ${results.filter((x) => x.status === 'held').length} held${rejectedDocs ? ', REJECTED unsigned rules' : ''}`);
    return { ok: true, message: 'Synced', results };
  } catch (e) {
    if (e instanceof NetworkError) return { ok: false, offline: true, message: 'No internet: payments stay on this phone until you reconnect.' };
    if (e instanceof ApiError && e.status === 401) { set({ token: null }); return { ok: false, message: 'Signed out (another device took over or the session ended).' }; }
    return { ok: false, message: String(e) };
  } finally { syncing = false; }
}

export async function refreshWallet() {
  const s = state; if (!s.token) return;
  try { const w = await api('/wallet', { token: s.token }); set({ server: w }); } catch { /* offline */ }
}

export { signReceipt, verifyReceipt, auditMines, ALPHA };

/** Short code shown on both screens so people can see they are paired with the right counterpart. */
export function matchCode(ref: string, nonce: string): string {
  return String(sha256b(enc.encode(ref + '|' + nonce))[0] % 100).padStart(2, '0');
}
/** One payment over the encrypted link: up to the whole send bucket. */
export const MAX_PAYMENT = 2000;

// ---------- mutual check at connection ----------
/** Own integrity signal as far as a browser can give one: wallet not locked and sequence equals the (simulated) counter. Play Integrity / App Attest are native-app only. */
export const ownIntegrity = () => (!state.locked && state.seq === hwCounter() ? '1' : '0');
/** The card this phone shows to the other phone: identity, bank-signed certificate, rules month, integrity signal, device signature. */
export const ownCard = (nonce: string): PeerCard =>
  makeCard(unb64(state.seed), { phone: state.phone, name: state.name, pk: state.pub, kyc: true, nonce, cert: state.cert, month: currentMonth(), integ: ownIntegrity() });
export const peerCtx = () => ({ bankPub: bankPubBytes(), now: Date.now(), acceptableMonths: acceptableMonths(), flagged: blocklist() });
/** Checks the other phone's card and stores a signed cross-report of the result. Returns the outcome; the caller decides what the user sees. */
export function mutualCheck(card: PeerCard | undefined | null): CheckOutcome {
  const out = checkPeer(card, peerCtx());
  recordCross(card, out.codes);
  return out;
}
export function recordCross(card: PeerCard | undefined | null, codes: string[]) {
  if (!card?.phone) return;
  const r = signReport(unb64(state.seed), state.phone, { subject: card.phone, subject_pk: card.pk ?? '', ts: Date.now(), result: codes.length ? 'fail' : 'pass', codes, nonce: b64(randomBytes(6)), ri: ownIntegrity() });
  set((s) => ({ crossReports: [...s.crossReports, r].slice(-100) }));
}
