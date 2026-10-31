// Runs the TypeScript checker against vectors produced by the Python reference (shared/vectors.json).
// Also covers the QR wire format and the encrypted-link crypto. Run: npm run test:vectors
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unb64, unhex, newKeypair, sign, verify, b64, randomBytes, newEphemeral, sessionKey, seal, open } from '../src/lib/crypto';
import { parseRules, parseRecipe, phoneCheck, findMines, spendOrder, receiveFill, auditMines, signHandover, signReceipt, acceptSigned } from '../src/lib/idsystem';
import { encodeMessage, decodeMessage, toFrames, FrameAssembler } from '../src/lib/protocol';

const V = JSON.parse(readFileSync(new URL('../shared/vectors.json', import.meta.url), 'utf8'));
let n = 0;
const ok = (name: string, f: () => void) => { f(); n++; console.log('ok  ', name); };
const pub = unb64(V.bank_pub);
const rules = parseRules(unb64(V.rules_blob));
const rec = parseRecipe(new TextEncoder().encode(JSON.stringify({ m: V.recipe.month, pos: V.recipe.pos, t: V.recipe.t })));

ok('bank signature on rules verifies; edited rules do not', () => {
  assert.ok(acceptSigned(pub, { blob: V.rules_blob, sig: V.rules_sig }));
  const bad = unb64(V.rules_blob); bad[10] ^= 1;
  assert.equal(acceptSigned(pub, { blob: b64(bad), sig: V.rules_sig }), null);
});
ok(`phone_check matches Python on ${V.checks.length} vectors (ok, tower, landmine, signature, flagged)`, () => {
  for (const c of V.checks) {
    const got = phoneCheck(c.pid, unb64(c.sig), rules, pub, c.block ? new Set([c.pid]) : new Set());
    assert.equal(got, c.expect, `${c.pid}: ${got} vs ${c.expect}`);
  }
});
ok('findMines / spend order / void filling / audit match Python', () => {
  const m = V.mines;
  const mines = findMines(rec, m.ids.filter((x: string) => x !== m.control), 15);
  assert.deepEqual(mines, m.found);
  assert.deepEqual(m.points_after_arm, m.ids);
  const order = spendOrder(m.ids, mines, m.control).slice(0, 25);
  assert.deepEqual(order, m.spend25);
  const f = receiveFill(rec, m.fill.points_before, m.fill.mines_before, m.fill.incoming);
  assert.equal(f.filled, m.fill.filled);
  assert.deepEqual(f.points, m.fill.points_after);
  assert.deepEqual(f.mines, m.fill.mines_after);
  const ao = auditMines(rec, m.ids, mines);
  assert.deepEqual({ whole: ao.whole, exp: ao.expectedAtLeast, fake: ao.fake, problems: ao.problems }, { whole: m.audit_ok.whole, exp: m.audit_ok.expected_at_least, fake: m.audit_ok.fake, problems: m.audit_ok.problems });
  const fk = m.audit_fake;
  assert.deepEqual(auditMines(rec, fk.points, fk.mines).problems, fk.result.problems);
  assert.ok(fk.result.problems.includes('mine_does_not_fit'));
});
ok('Ed25519: TS signs byte-identical to PyNaCl and verifies Python signatures', () => {
  const d = V.device, seed = unhex(d.seed_hex);
  assert.equal(b64(newKeypair(seed).pub), d.pub);
  assert.equal(b64(signHandover(seed, d.handover.month, d.handover.pid, d.handover.to)), d.handover.sig);
  assert.equal(b64(signReceipt(seed, d.receipt.month, d.receipt.pid, d.receipt.from)), d.receipt.sig);
  assert.ok(verify(unb64(d.pub), `${d.handover.month}|${d.handover.pid}|${d.handover.to}`, unb64(d.handover.sig)));
  assert.ok(!verify(unb64(d.pub), `${d.handover.month}|${d.handover.pid}|+919000000009`, unb64(d.handover.sig)));
});
ok('QR wire format: message round trip, frames in any order, duplicates, damaged frame', () => {
  const dev = newKeypair();
  const points = V.checks.slice(0, 30).map((c: any) => ({ pid: c.pid, sig: unb64(c.sig), handover: sign(dev.seed, c.pid) }));
  const msg = { type: 'payment' as const, meta: { ref: 'abc', month: V.month, from: '+919000000001', fromName: 'A', to: '+919000000002', ts: 1, pk: 'x' }, points };
  const bytes = encodeMessage(msg);
  const back: any = decodeMessage(bytes);
  assert.deepEqual(back.meta, msg.meta);
  assert.equal(back.points.length, 30);
  assert.equal(b64(back.points[7].handover), b64(points[7].handover));
  const frames = toFrames(bytes, 420);
  assert.ok(frames.length > 5);
  const asm = new FrameAssembler();
  const shuffled = [...frames, ...frames.slice(0, 3)].sort(() => Math.random() - 0.5);
  for (const f of shuffled) asm.add(f);
  assert.ok(asm.done());
  assert.equal(b64(asm.result()!), b64(bytes));
  const asm2 = new FrameAssembler();
  const bad = new Uint8Array(frames[2]); bad[bad.length - 1] ^= 1;
  frames.forEach((f, i) => asm2.add(i === 2 ? bad : f));
  assert.ok(asm2.done() === false || decodeMessage(asm2.result()!) === null, 'a damaged frame must not produce a valid message');
});
ok('link crypto: both ends derive one key; wrong QR key, third device, replay and tampering all fail', () => {
  const qr = randomBytes(32), a = newEphemeral(), b = newEphemeral(), t = randomBytes(16);
  const ka = sessionKey(a.sk, b.pk, qr, t), kb = sessionKey(b.sk, a.pk, qr, t);
  assert.equal(b64(ka), b64(kb));
  const sealed = seal(ka, 1, 1, new TextEncoder().encode('hello'));
  assert.equal(new TextDecoder().decode(open(kb, 1, sealed, 0)!.plain), 'hello');
  // third device on the same wifi: sees both public keys (offer/answer) but not the one-time QR key
  const c = newEphemeral();
  assert.equal(open(sessionKey(c.sk, a.pk, randomBytes(32), t), 1, sealed, 0), null);
  assert.equal(open(sessionKey(c.sk, b.pk, qr, t), 1, sealed, 0), null);
  // attacker who guesses the QR key but is a man in the middle still lacks an ephemeral secret
  assert.notEqual(b64(sessionKey(c.sk, b.pk, qr, t)), b64(ka));
  const flipped = new Uint8Array(sealed); flipped[20] ^= 1;
  assert.equal(open(kb, 1, flipped, 0), null);
  assert.equal(open(kb, 2, sealed, 0), null);      // reflected back in the wrong direction
  assert.equal(open(kb, 1, sealed, 5), null);      // replay of an old counter
  assert.ok(open(kb, 1, sealed, 1));
});
console.log(`\n${n} groups passed`);
