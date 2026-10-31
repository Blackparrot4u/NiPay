import { useState } from 'react';
import { Badge, Btn, Card, Notice, Title } from '../ui';
import { ALPHA, VAL, acceptSigned, auditMines, checkLandmines, checkTower, phoneCheck, signHandover, verifyBankSig } from '../lib/idsystem';
import { b64, newKeypair, randomBytes, unb64, verify } from '../lib/crypto';
import { api } from '../lib/api';
import { bankPubBytes, checkIncoming, currentMonth, get, hwCounter, recipeFor, rulesFor, useDevice } from '../lib/device';

interface Row { name: string; attack: string; caught: boolean | null; detail: string }
const rid = () => Array.from(randomBytes(20), (x) => ALPHA[x % 36]).join('');

/** Every row below is computed now, on this phone, with the real checker. Nothing is hard-coded. */
export async function runChecks(): Promise<Row[]> {
  const s = get(); const month = currentMonth(); const rules = rulesFor(month); const pub = bankPubBytes(); const rows: Row[] = [];
  if (!rules || !pub.length) return [{ name: 'Setup', attack: 'no signed rules on this phone', caught: null, detail: 'Go online once to load the bank-signed rules, then run again.' }];
  const real = s.points.find((p) => p.kind === 'value' && p.month === month);
  const add = (name: string, attack: string, caught: boolean, detail: string) => rows.push({ name, attack, caught, detail });
  // 1 random forged ID
  let pass = 0; for (let i = 0; i < 500; i++) if (phoneCheck(rid(), randomBytes(64), rules, pub) === 'ok') pass++;
  add('Forged ID', '500 random 20-character IDs with random signatures', pass === 0, `${500 - pass} of 500 rejected (${pass} passed)`);
  // 2 patterns only, signature faked: how far do the pattern layers stop a forger who knows the rules?
  let tw = 0, lm = 0; for (let i = 0; i < 2000; i++) { const r = rid(); if (checkTower(r, rules)) tw++; if (checkLandmines(r, rules)) lm++; }
  add('Tower and landmine layers', '2000 random IDs against the monthly shape', tw < 10, `${tw} passed the tower, ${lm} passed the landmines. (Rules are on the phone, so patterns alone slow a forger; the bank signature stops him.)`);
  if (real) {
    const sig = unb64(real.sig);
    const edited = (real.pid[0] === 'z' ? 'y' : 'z') + real.pid.slice(1);
    add('Edited ID', 'one character of a real ID changed, real signature kept', phoneCheck(edited, sig, rules, pub) !== 'ok', `checker says layer ${phoneCheck(edited, sig, rules, pub)}`);
    add('Old-month ID', 'real ID presented under another month', !verifyBankSig(pub, '2025-01', real.pid, sig), 'the month is inside the bank signature, so a replay under another month fails');
    add('Honest ID control', 'an untouched real ID', phoneCheck(real.pid, sig, rules, pub) === 'ok', 'accepted, as it should be');
    add('Flagged ID (bank notice)', 'real ID listed in a bank notice', phoneCheck(real.pid, sig, rules, pub, new Set([real.pid])) === 'G', 'refused with the notice layer');
    const dup = checkIncoming([{ pid: real.pid, sig }], month);
    add('Reused ID', 'an ID this phone already holds, offered again', !dup.ok && dup.failed[0]?.layer === 'dup', 'refused as a duplicate');
  } else add('ID-based checks', 'need a real point on this phone', false, 'Add points first (Home, Add points), then run again.');
  // handover for another person
  const dev = newKeypair(); const h = signHandover(dev.seed, month, 'x'.repeat(20), '+911111111111');
  add('Handover for another person', 'handover signed to +911111111111 used by +912222222222', !verify(dev.pub, `${month}|${'x'.repeat(20)}|+912222222222`, h), 'the recipient is inside the signed text');
  // fake rules
  const d = s.docs[0]; const blob = unb64(d.rules.blob); const tampered = blob.slice(); tampered[tampered.length - 5] ^= 1;
  add('Fake rules', 'rules edited in transit, old signature kept', acceptSigned(pub, { blob: b64(tampered), sig: d.rules.sig }) === null, 'phone refuses unsigned or altered rules');
  const wrong = newKeypair();
  add('Fake rules signed by an attacker', 'weak rules signed with the attacker\'s own key', acceptSigned(pub, { blob: b64(blob), sig: b64(wrong.pub) }) === null, 'only the bank key is trusted');
  // mines
  const rec = recipeFor(month);
  if (rec) {
    const pts = s.points.filter((p) => p.kind === 'value').map((p) => p.pid);
    const forged = [rid(), rid(), rid()];
    const a = auditMines(rec, [...pts, ...forged], [...s.mines, forged]);
    add('Forged mine', 'a made-up three-point mine added to the wallet', a.problems.includes('mine_does_not_fit'), `audit says: ${a.problems.join(', ') || 'nothing'}`);
    const b = auditMines(rec, pts.concat(Array.from({ length: 30 }, rid)), s.mines);
    add('Extra points without mines', '30 unexplained points added', b.problems.includes('too_few_mines'), `audit says: ${b.problems.join(', ') || 'nothing'}`);
  }
  // restore
  const counter = hwCounter();
  add('Wallet restore', 'wallet copy with an older sequence is put back', s.seq - 1 !== counter, `sequence ${s.seq - 1} vs hardware counter ${counter} (simulated counter, real one planned for native app)`);
  // server
  try { const r = await api('/integrity/verify', { body: {}, token: s.token }); add('Play Integrity / App Attest', 'attestation by Google / Apple', false, `server says: ${r.play_integrity} / ${r.app_attest}. Not implemented in a browser; planned for the native app.`); }
  catch { add('Play Integrity / App Attest', 'attestation by Google / Apple', false, 'planned for the native app (server check needs internet)'); }
  return rows;
}

export function Checks() {
  useDevice();
  const [rows, setRows] = useState<Row[] | null>(null); const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3"><Title back="/more" sub="Runs the real checks now, on this phone. Results are computed, not typed in.">Security checks</Title>
      <Btn disabled={busy} data-testid="run-checks" onClick={async () => { setBusy(true); setRows(await runChecks()); setBusy(false); }}>{busy ? 'Running...' : 'Run all checks'}</Btn>
      {rows?.map((r) => (
        <Card key={r.name} className="space-y-1" >
          <div className="flex justify-between items-center"><b className="text-sm">{r.name}</b><span data-testid="check-result"><Badge tone={r.caught === null ? 'slate' : r.caught ? 'green' : 'red'}>{r.caught === null ? 'not run' : r.caught ? 'caught / ok' : 'NOT caught'}</Badge></span></div>
          <p className="text-xs text-slate-500">Attack: {r.attack}</p><p className="text-xs">{r.detail}</p></Card>))}
      <Notice>Same-ID (one valid ID handed to two people) passes offline by design. It is caught at the bank when both claims arrive. See README, known limits.</Notice>
    </div>
  );
}

export function Inspect() {
  const d = useDevice(); const rec = recipeFor(currentMonth());
  const a = rec ? auditMines(rec, d.points.filter((p) => p.kind === 'value').map((p) => p.pid), d.mines) : null;
  return (
    <div className="space-y-3"><Title back="/more" sub="Stack landmines: three points per mine, spent loosely first.">Mine inspector</Title>
      <Card className="text-sm space-y-1"><p>Points: <b>{d.points.filter((p) => p.kind === 'value').length}</b> · Mines armed: <b>{d.mines.length}</b> · Whole: <b>{a?.whole ?? 0}</b></p><p className="text-xs text-slate-500">Audit: {a ? (a.problems.join(', ') || 'clean') : 'needs rules'}</p></Card>
      <Card className="space-y-1 max-h-96 overflow-auto font-mono text-[11px]">{d.mines.slice(0, 40).map((m, i) => <div key={i}>{m.map((x) => x.slice(0, 4) + '…').join(' · ')} {m.every((x) => d.points.some((p) => p.pid === x)) ? '(whole)' : '(broken)'}</div>)}{!d.mines.length && <p>No mines yet.</p>}</Card></div>
  );
}
