// TypeScript port of backend/nipay/core/idsystem.py + wallet.py (offline checker and stack-landmine logic).
// Tested against Python on shared vectors: shared/vectors.json (npm run test:vectors).
import { verify, unb64, dec, b64, sign, enc } from './crypto';

export const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';
export const VAL: Record<string, number> = Object.fromEntries([...ALPHA].map((c, i) => [c, i]));
export const LEN = 20, FLOOR = 4, K = 3;
const mod = (a: number, m: number) => ((a % m) + m) % m;

export interface Rules { month: string; joints: Set<number>[]; floorMod: number[]; badPairs: Set<string>; badTriples: Set<string> }
export interface Recipe { month: string; pos: number[]; target: number }

export function parseRules(blob: Uint8Array): Rules {
  const j = JSON.parse(dec.decode(blob));
  return { month: j.m, joints: j.j.map((x: number[]) => new Set(x)), floorMod: j.f, badPairs: new Set(j.p), badTriples: new Set(j.t) };
}
export function parseRecipe(blob: Uint8Array): Recipe {
  const j = JSON.parse(dec.decode(blob));
  return { month: j.m, pos: j.pos, target: j.t };
}

export function checkLandmines(pid: string, r: Rules): boolean {
  for (let i = 0; i < LEN - 1; i++) if (r.badPairs.has(pid.slice(i, i + 2))) return false;
  for (let i = 0; i < LEN - 2; i++) if (r.badTriples.has(pid.slice(i, i + 3))) return false;
  return true;
}
export function checkTower(pid: string, r: Rules): boolean {
  if (pid.length !== LEN || [...pid].some((c) => !(c in VAL))) return false;
  const floors = Array.from({ length: 5 }, (_, i) => pid.slice(i * FLOOR, i * FLOOR + FLOOR));
  for (let i = 0; i < 5; i++) {
    const s = [...floors[i]].reduce((n, c) => n + VAL[c], 0);
    if (s % 6 !== r.floorMod[i]) return false;
  }
  for (let i = 0; i < 4; i++) {
    const t = (VAL[floors[i][FLOOR - 1]] + VAL[floors[i + 1][0]]) % 36;
    if (!r.joints[i].has(t)) return false;
  }
  return true;
}
export function verifyBankSig(pub: Uint8Array, month: string, pid: string, sig: Uint8Array) {
  return verify(pub, `${month}|${pid}`, sig);
}
/** Receiver's offline check. Returns the first failed layer, or 'ok'. 'G' = flagged by a bank notice. */
export function phoneCheck(pid: string, sig: Uint8Array, r: Rules, pub: Uint8Array, blocklist: Set<string> = new Set()): string {
  if (!checkTower(pid, r)) return 'B';
  if (!checkLandmines(pid, r)) return 'A';
  if (!verifyBankSig(pub, r.month, pid, sig)) return 'H';
  if (blocklist.has(pid)) return 'G';
  return 'ok';
}
export const signHandover = (seed: Uint8Array, month: string, pid: string, to: string) => sign(seed, `${month}|${pid}|${to}`);
export const signReceipt = (seed: Uint8Array, month: string, pid: string, sender: string) => sign(seed, `${month}|${pid}|${sender}|received`);
export const verifyReceipt = (pub: Uint8Array, month: string, pid: string, sender: string, sig: Uint8Array) =>
  verify(pub, `${month}|${pid}|${sender}|received`, sig);

// ---- signed documents (rules, mine recipe, policy, notices, trust) ----
export function acceptSigned(bankPub: Uint8Array, doc: { blob: string; sig: string }): Uint8Array | null {
  const blob = unb64(doc.blob);
  return verify(bankPub, blob, unb64(doc.sig)) ? blob : null;
}

// ---- stack landmines ----
export const fits = (rec: Recipe, a: string, b: string, c: string) =>
  mod(VAL[a[rec.pos[0]]] + VAL[b[rec.pos[1]]] + VAL[c[rec.pos[2]]], 36) === rec.target;

export function findMines(rec: Recipe, ids: string[], want: number): string[][] {
  const byChar = new Map<string, string[]>();
  for (const i of ids) { const k = i[rec.pos[2]]; (byChar.get(k) ?? byChar.set(k, []).get(k)!).push(i); }
  const free = new Set(ids);
  const mines: string[][] = [];
  for (const a of ids) {
    if (mines.length >= want) break;
    if (!free.has(a)) continue;
    for (const b of ids) {
      if (b === a || !free.has(b) || !free.has(a)) continue;
      const need = mod(rec.target - VAL[a[rec.pos[0]]] - VAL[b[rec.pos[1]]], 36);
      const cs = (byChar.get(ALPHA[need]) ?? []).filter((c) => free.has(c) && c !== a && c !== b);
      if (cs.length) { mines.push([a, b, cs[0]]); free.delete(a); free.delete(b); free.delete(cs[0]); break; }
    }
  }
  return mines;
}

/** KT's spend order: loose points, then pieces of broken mines, then whole mines. The control key is never spent. */
export function spendOrder(points: string[], mines: string[][], control: string): string[] {
  const spendable = points.filter((p) => p !== control);
  const have = new Set(points);
  const whole: string[][] = [], broken: string[][] = [];
  for (const m of mines) (m.every((x) => have.has(x)) ? whole : broken).push(m);
  const wholePts = whole.flat();
  const brokenPts = broken.flat().filter((x) => have.has(x));
  const used = new Set([...wholePts, ...brokenPts]);
  return [...spendable.filter((p) => !used.has(p)), ...brokenPts, ...wholePts];
}

export function receiveFill(rec: Recipe, points: string[], mines: string[][], incoming: string[]) {
  let filled = 0;
  const pool = [...incoming], have = new Set(points), pts = [...points], ms = mines.map((m) => [...m]);
  ms.forEach((m, idx) => {
    const missing = m.filter((x) => !have.has(x));
    if (missing.length !== 1 || !pool.length) return;
    const slot = m.indexOf(missing[0]);
    for (const c of pool) {
      const nw = m.map((x, j) => (j === slot ? c : x));
      if (fits(rec, nw[0], nw[1], nw[2])) {
        ms[idx] = nw; pts.push(c); have.add(c); pool.splice(pool.indexOf(c), 1); filled++; break;
      }
    }
  });
  return { points: pts, mines: ms, filled };
}

export function auditMines(rec: Recipe, points: string[], mines: string[][]) {
  const have = new Set(points);
  const whole = mines.filter((m) => m.every((x) => have.has(x)));
  const fake = whole.filter((m) => !fits(rec, m[0], m[1], m[2]));
  const expected = Math.max(0, Math.floor((points.length - 1) / K) - 1);
  const problems: string[] = [];
  if (fake.length) problems.push('mine_does_not_fit');
  if (whole.length < expected) problems.push('too_few_mines');
  return { whole: whole.length, expectedAtLeast: expected, fake: fake.length, problems };
}
export { b64, enc };
