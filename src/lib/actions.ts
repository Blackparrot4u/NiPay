import { api } from './api';
import { b64, unb64, newKeypair } from './crypto';
import { get, set, setPin, acceptRulesDoc, resetDevice, syncNow, trace, currentMonth, armMines, StoredPoint } from './device';

export async function fetchRules() {
  const s = get();
  const r = await api('/rules/current', { token: s.token });
  const okCur = acceptRulesDoc(r.current);
  if (r.previous) acceptRulesDoc(r.previous);
  return okCur;
}

async function adopt(res: any, extra: Record<string, any> = {}) {
  set({ token: res.token, bankPub: res.bank_public_key, server: res.wallet, phone: res.wallet.phone, name: res.wallet.name, language: res.wallet.language, ...extra });
  await fetchRules();
  await syncAll();
}

export async function register(f: { phone: string; otp: string; name: string; pin: string; address: string; aadhaar: string; pan: string; region: string; bank: string; terms: boolean; renting: boolean; language: 'en' | 'hi' }) {
  const s = get();
  if (!s.pub) { const kp = newKeypair(); set({ seed: b64(kp.seed), pub: b64(kp.pub) }); }
  const res = await api('/auth/register', { body: {
    phone: f.phone, otp: f.otp, name: f.name, pin: f.pin, device_public_key: get().pub, device_label: deviceLabel(), region: f.region, bank: f.bank, language: f.language,
    accepted_terms: f.terms, no_account_renting: f.renting, kyc: { test_aadhaar: f.aadhaar, test_pan: f.pan, address: f.address } } });
  setPin(f.pin);
  await adopt(res);
}

export async function login(phone: string, pin: string) {
  const res = await api('/auth/login', { body: { phone, pin, device_public_key: get().pub, device_label: deviceLabel() } });
  setPin(pin);
  await adopt(res);
}

export async function cancelOtherDevice(phone: string, pin: string, reason: string, summary: string) {
  const res = await api('/auth/cancel-device', { body: { phone, pin, device_public_key: get().pub, device_label: deviceLabel(), reason, balance_summary: summary } });
  setPin(pin);
  // a new device starts with an empty wallet: the old device's points were forfeited by the lost-phone rule
  set({ points: [], mines: [], received: [], sent: [], inflight: [], seq: 0 });
  await adopt(res);
  return res;
}

export async function logout() {
  const s = get();
  try { if (s.token) await api('/auth/logout', { method: 'POST', body: {}, token: s.token }); } catch { /* offline */ }
  set({ token: null });
}

export const deviceLabel = () => /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone browser' : /Android/.test(navigator.userAgent) ? 'Android browser' : 'Desktop browser';
export { resetDevice, trace, unb64 };

/** Monthly ID renewal: hands the bank this phone's unspent IDs of an older month (still in grace) and swaps them for current-month IDs. No money moves. */
export async function renewIds(): Promise<number> {
  const s = get(); const cur = currentMonth();
  if (!s.token || !cur) return 0;
  const old = s.points.filter((p) => p.kind === 'value' && p.month < cur && !s.inflight.includes(p.pid));
  if (!old.length) return 0;
  try {
    const r = await api('/wallet/renew', { body: { pids: old.map((p) => p.pid) }, token: s.token });
    const fresh: StoredPoint[] = r.points; if (!fresh.length) return 0;
    const gone = new Set(old.map((p) => p.pid));
    const newControl = fresh.some((p) => p.kind === 'control');
    set((x) => ({ points: [...x.points.filter((p) => !gone.has(p.pid) && !(newControl && p.kind === 'control' && p.month < cur)), ...fresh], server: r.wallet }));
    armMines(); trace(`renewed ${old.length} IDs into ${cur}`);
    return old.length;
  } catch { return 0; }   // offline or refused: the old IDs keep working inside the grace period
}
/** Sync, then renew old-month IDs if there are any. This is what "any internet contact" runs. */
export async function syncAll() {
  const r = await syncNow();
  if (r.ok) { const n = await renewIds(); if (n) await syncNow(); }
  return r;
}
