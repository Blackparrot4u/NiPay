// DEVELOPER TESTS (not part of any user or admin screen). The attack catalogue that used to be a "Run security test" button
// in the phone app now lives here: forged / edited / old-month / flagged IDs, fake rules, forged mines, handover for another
// person, the mutual check between two phones, and the chunked transfer layer (2,000 points, drop, resume).
// Run: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALPHA, acceptSigned, auditMines, checkLandmines, checkTower, parseRecipe, parseRules, phoneCheck, signHandover, verifyBankSig } from '../src/lib/idsystem';
import { b64, newKeypair, randomBytes, sign, unb64, verify, enc, dec } from '../src/lib/crypto';
import { PeerCard, checkLimit, checkPeer, cardText, makeCard, signReport, reportText } from '../src/lib/peercheck';
import { Pipe, CHUNK } from '../src/lib/pipe';
import { encodeMessage, decodeMessage } from '../src/lib/protocol';

const V = JSON.parse(readFileSync(new URL('../shared/vectors.json', import.meta.url), 'utf8'));
let n = 0; const ok = (name: string, f: () => void | Promise<void>) => Promise.resolve(f()).then(() => { n++; console.log('ok  ', name); });
const pub = unb64(V.bank_pub); const rules = parseRules(unb64(V.rules_blob));
const rid = () => Array.from(randomBytes(20), (x) => ALPHA[x % 36]).join('');
const real = V.checks.find((c: any) => c.expect === 'ok' && !c.block);

await ok('forged ID: 500 random IDs with random signatures are all rejected', () => { for (let i = 0; i < 500; i++) assert.notEqual(phoneCheck(rid(), randomBytes(64), rules, pub), 'ok'); });
await ok('tower and landmine layers alone stop most random IDs (rules are public; the bank signature is what stops forgery)', () => { let tw = 0; for (let i = 0; i < 2000; i++) if (checkTower(rid(), rules)) tw++; assert.ok(tw < 40, String(tw)); });
await ok('edited ID, old-month replay, flagged ID, honest control', () => {
  const sig = unb64(real.sig);
  assert.notEqual(phoneCheck((real.pid[0] === 'z' ? 'y' : 'z') + real.pid.slice(1), sig, rules, pub), 'ok');
  assert.ok(!verifyBankSig(pub, '2025-01', real.pid, sig));
  assert.equal(phoneCheck(real.pid, sig, rules, pub, new Set([real.pid])), 'G');
  assert.equal(phoneCheck(real.pid, sig, rules, pub), 'ok');
});
await ok('handover for another person fails; fake rules (edited, or signed by an attacker) are refused', () => {
  const dev = newKeypair(); const h = signHandover(dev.seed, V.month, 'x'.repeat(20), '+911111111111');
  assert.ok(!verify(dev.pub, `${V.month}|${'x'.repeat(20)}|+912222222222`, h));
  const blob = unb64(V.rules_blob); const t = blob.slice(); t[t.length - 5] ^= 1;
  assert.equal(acceptSigned(pub, { blob: b64(t), sig: V.rules_sig }), null);
  assert.equal(acceptSigned(pub, { blob: b64(blob), sig: b64(newKeypair().pub) }), null);
});
await ok('forged mine and unexplained extra points are caught by the mine audit', () => {
  const rec = parseRecipe(new TextEncoder().encode(JSON.stringify({ m: V.recipe.month, pos: V.recipe.pos, t: V.recipe.t })));
  const f = [rid(), rid(), rid()]; const m = V.mines;
  assert.ok(auditMines(rec, [...m.ids, ...f], [...m.found, f]).problems.includes('mine_does_not_fit'));
  assert.ok(auditMines(rec, m.ids.concat(Array.from({ length: 30 }, rid)), m.found).problems.includes('too_few_mines'));
});

// ---- mutual check ----
const bank = newKeypair(); const NOW = 1_800_000_000_000; const MONTH = V.month;
const cert = (phone: string, pk: string, over: any = {}) => { const blob = enc.encode(JSON.stringify({ u: phone, s: 520, a: 10, m: MONTH, ls: 2000, lr: 10000, x: Math.floor(NOW / 1000) + 86400 * 30, d: pk, ...over })); return { blob: b64(blob), sig: b64(sign(bank.seed, blob)) }; };
const phone = (num: string, over: any = {}, certOver: any = {}, cardOver: any = {}) => { const k = newKeypair(); const pk = b64(k.pub);
  return { k, card: makeCard(k.seed, { phone: num, name: 'T', pk, kyc: true, nonce: 'n', cert: cert(num, pk, certOver), month: MONTH, integ: '1', ...cardOver }) as PeerCard, ...over }; };
const ctx = { bankPub: bank.pub, now: NOW, acceptableMonths: [MONTH], flagged: new Set<string>() };
await ok('mutual check: an honest card passes, both directions', () => { const a = phone('+911'), b = phone('+912'); assert.ok(checkPeer(a.card, ctx).ok && checkPeer(b.card, ctx).ok); });
await ok('mutual check: expired certificate, old rules month, failed integrity signal, flagged, over limit -> plain failure or danger', () => {
  assert.deepEqual(checkPeer(phone('+911', {}, { x: Math.floor(NOW / 1000) - 5 }).card, ctx).codes, ['cert_expired']);
  assert.equal(checkPeer(phone('+911', {}, { x: 1 }).card, ctx).level, 'plain');
  assert.ok(checkPeer(phone('+911', {}, {}, { month: '2020-01' }).card, ctx).codes.includes('rules_month'));
  const bad = checkPeer(phone('+911', {}, {}, { integ: '0' }).card, ctx); assert.equal(bad.level, 'danger'); assert.ok(bad.codes.includes('integrity'));
  const f = phone('+911'); assert.equal(checkPeer(f.card, { ...ctx, flagged: new Set(['+911']) }).level, 'danger');
  const p = phone('+911'); assert.ok(!checkLimit(checkPeer(p.card, ctx).cert, 'payer', 2001) && checkLimit(checkPeer(p.card, ctx).cert, 'payer', 2000));
});
await ok('mutual check: certificate signed by an attacker, for another phone, or lifted onto another device key is refused; a tampered card fails its signature', () => {
  const a = phone('+911'); const evil = newKeypair(); const blob = enc.encode(JSON.stringify({ u: '+911', s: 850, a: 1, m: MONTH, ls: 99999, lr: 99999, x: 4e9, d: a.card.pk }));
  assert.ok(checkPeer(makeCard(a.k.seed, { ...a.card, cert: { blob: b64(blob), sig: b64(sign(evil.seed, blob)) } }), ctx).codes.includes('cert_signature'));
  const stolen = phone('+912'); assert.ok(checkPeer(makeCard(a.k.seed, { ...a.card, cert: stolen.card.cert }), ctx).codes.includes('cert_phone'));
  const other = newKeypair(); assert.ok(checkPeer(makeCard(other.seed, { ...a.card, pk: b64(other.pub) }), ctx).codes.includes('cert_device'));
  assert.deepEqual(checkPeer({ ...a.card, name: 'Evil' }, ctx).codes, ['card_signature']);
  assert.deepEqual(checkPeer(null, ctx).codes, ['no_card']);
});
await ok('cross-report signature text matches what the server verifies', () => {
  const k = newKeypair(); const r = signReport(k.seed, '+911', { subject: '+912', subject_pk: 'pk', ts: 1, result: 'fail', codes: ['a', 'b'], nonce: 'n', ri: '1' });
  assert.ok(verify(k.pub, reportText(r, '+911'), unb64(r.sig))); assert.equal(reportText(r, '+911'), 'xr1|+911|+912|pk|1|fail|a,b|n|1');
});

// ---- chunked transfer: a 2,000-point payment, a dropped link, resume ----
class FakeLink { state = 'authenticated'; peer: FakeLink | null = null; onMessage: (b: Uint8Array) => void = () => {}; sent = 0; dropAfter = Infinity;
  buffered() { return 0; }
  send(b: Uint8Array) { if (this.sent++ >= this.dropAfter) { this.state = 'failed'; if (this.peer) this.peer.state = 'failed'; return; } const p = this.peer!; queueMicrotask(() => p.onMessage(b)); } }
const pair = () => { const a = new FakeLink(), b = new FakeLink(); a.peer = b; b.peer = a; return [a, b]; };
await ok('2,000-point payment (~300 kB): chunked, hashed, acknowledged, with progress; survives a drop and resumes where it stopped', async () => {
  const dev = newKeypair(); const points = Array.from({ length: 2000 }, () => ({ pid: rid(), sig: randomBytes(64), handover: sign(dev.seed, 'h') }));
  const bytes = encodeMessage({ type: 'payment', meta: { ref: 'r1', month: MONTH, from: '+911', fromName: 'A', to: '+912', ts: 1, pk: 'x' }, points });
  assert.ok(bytes.length > 290_000);
  const tx = new Pipe(), rx = new Pipe(); const got: Uint8Array[] = []; const prog: number[] = []; rx.onBlob = (_i, b) => got.push(b); rx.onProgress = (p) => prog.push(p.done);
  const [a1, b1] = pair(); a1.dropAfter = 12; tx.attach(a1 as any); rx.attach(b1 as any);
  tx.sendBlob('r1', bytes); await new Promise((r) => setTimeout(r, 50));
  assert.equal(got.length, 0); assert.ok(prog.length > 0 && prog.length < Math.ceil(bytes.length / CHUNK), `partial: ${prog.length}`);
  const have = prog.length;
  const [a2, b2] = pair(); tx.attach(a2 as any); rx.attach(b2 as any);          // new link after the drop
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(got.length, 1); assert.equal(b64(got[0]), b64(bytes)); assert.equal(decodeMessage(got[0])!.type, 'payment');
  assert.equal(prog.filter((x) => x === have + 1).length, 1, 'resume continued at the next part, not from zero');
  assert.equal(tx.pendingOut, false, 'acknowledged');
});
console.log(`\n${n} developer test groups passed`);
