// Mutual check at connection. When two phones connect, each one verifies the other's signed card
// before any payment proceeds. No button, no user step. The result is recorded as a signed cross-report
// (stored on the phone, uploaded at the next sync). A report is evidence for logs and review only.
import { b64, sign, unb64, verify, dec } from './crypto';
import { acceptSigned } from './idsystem';

export interface Cert { blob: string; sig: string }
/** What a phone shows the other phone: identity, bank-signed certificate, the rules month it holds, own integrity signal, device signature. */
export interface PeerCard { phone: string; name: string; pk: string; kyc: boolean; nonce: string; cert: Cert | null; month: string; integ: string; csig: string }
export interface CrossReport { subject: string; subject_pk: string; ts: number; result: 'pass' | 'fail'; codes: string[]; nonce: string; ri: string; sig: string }

export const cardText = (c: Omit<PeerCard, 'csig'>) => ['card1', c.phone, c.name, c.pk, c.nonce, c.month, c.cert?.sig ?? '', c.integ].join('|');
export const reportText = (r: Omit<CrossReport, 'sig'>, reporterPhone: string) =>
  ['xr1', reporterPhone, r.subject, r.subject_pk, r.ts, r.result, r.codes.join(','), r.nonce, r.ri].join('|');

export function makeCard(seed: Uint8Array, c: Omit<PeerCard, 'csig'>): PeerCard {
  return { ...c, csig: b64(sign(seed, cardText(c))) };
}

export interface CheckCtx {
  bankPub: Uint8Array; now: number;            // ms
  acceptableMonths: string[]; flagged: Set<string>;
}
export interface CheckOutcome { ok: boolean; codes: string[]; /** 'danger' = show the danger warning, 'plain' = just "payment failed" */ level: 'none' | 'plain' | 'danger'; cert?: any }

/** Verifies the other phone's card. `role` is the role of the card's owner in this payment. */
export function checkPeer(card: PeerCard | undefined | null, ctx: CheckCtx): CheckOutcome {
  const codes: string[] = []; const danger = new Set(['card_signature', 'cert_signature', 'cert_phone', 'cert_device', 'flagged', 'integrity']);
  const done = (cert?: any): CheckOutcome => ({ ok: codes.length === 0, codes, level: codes.length === 0 ? 'none' : codes.some((c) => danger.has(c)) ? 'danger' : 'plain', cert });
  if (!card || typeof card.phone !== 'string' || typeof card.pk !== 'string') { codes.push('no_card'); return done(); }
  let pk: Uint8Array | null = null; try { pk = unb64(card.pk); } catch { /* bad */ }
  if (!pk || pk.length !== 32 || !card.csig || !verify(pk, cardText(card), unb64(card.csig))) { codes.push('card_signature'); return done(); }
  if (card.integ !== '1') codes.push('integrity');
  if (ctx.flagged.has(card.phone) || ctx.flagged.has(card.pk)) codes.push('flagged');
  if (!acceptableMonthsIncludes(ctx, card.month)) codes.push('rules_month');
  let cert: any;
  const blob = card.cert ? safe(() => acceptSigned(ctx.bankPub, card.cert!)) : null;
  if (!card.cert) codes.push('no_cert');
  else if (!blob) codes.push('cert_signature');
  else {
    cert = JSON.parse(dec.decode(blob));
    if (cert.u !== card.phone) codes.push('cert_phone');
    if (cert.d !== card.pk) codes.push('cert_device');
    if (!(cert.x * 1000 > ctx.now)) codes.push('cert_expired');
    if (!acceptableMonthsIncludes(ctx, cert.m)) codes.push('cert_month');
    if (!(cert.s >= 300 && cert.s <= 850)) codes.push('cert_score');
  }
  return done(cert);
}
const acceptableMonthsIncludes = (ctx: CheckCtx, m: string) => ctx.acceptableMonths.includes(m);
const safe = <T,>(f: () => T): T | null => { try { return f(); } catch { return null; } };

/** Limit check once the amount is known: the payer's certificate must allow it to send it, the payee's must allow it to receive it. */
export function checkLimit(cert: any, role: 'payer' | 'payee', n: number): boolean {
  if (!cert) return false;
  return role === 'payer' ? n <= cert.ls : n <= cert.lr;
}

export function signReport(seed: Uint8Array, reporterPhone: string, r: Omit<CrossReport, 'sig'>): CrossReport {
  return { ...r, sig: b64(sign(seed, reportText(r, reporterPhone))) };
}
