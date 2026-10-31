// End-to-end run against a real server and the real UI (Chromium via Playwright).
// Usage: node scripts/e2e.mjs   (needs `npm run build` first; starts and stops its own server)
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const PW = process.env.PLAYWRIGHT_DIR || '/home/thepug/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = await import(PW + '/index.mjs').catch(() => import(PW));
const PORT = 8765, BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = join(homedir(), 'Pictures/offline-payments-flow/nipay-app'); mkdirSync(SHOTS, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'nipay-e2e-'));
const server = spawn('uv', ['run', '--with-requirements', 'requirements.txt', 'python', '-m', 'nipay'], {
  cwd: 'backend', env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NIPAY_DATA_DIR: dataDir, NIPAY_RATE_LIMIT: '100000', NIPAY_LOGIN_RATE: '1000' }, stdio: 'pipe', detached: true });
let log = ''; server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
if (!(await fetch(BASE + '/api/health').then((r) => r.ok).catch(() => false))) { console.log('SERVER LOG', log); process.exit(2); }
const secrets = JSON.parse(readFileSync(join(dataDir, 'secrets.json'), 'utf8'));
const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const results = [];
const step = async (name, f) => { try { await f(); results.push(['PASS', name]); console.log('PASS', name); } catch (e) { for (const [i, x] of [A, B, C].entries()) await x.page.screenshot({ path: join(SHOTS, 'fail-' + i + '.png') }).catch(() => {}); results.push(['FAIL', name + ': ' + e.message.split('\n')[0] + ' @' + (e.stack.match(/e2e.mjs:(\d+)/)||[])[1]]); console.log('FAIL', name, e.message.split('\n')[0]); } };
const newPhone = async (viewport = { width: 390, height: 800 }) => { const ctx = await browser.newContext({ viewport, permissions: [] }); const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('PAGE ERROR', e.message)); return { ctx, page }; };
const shot = (p, n) => p.screenshot({ path: join(SHOTS, n + '.png') });
const frames = async (p) => { for (let i = 0; i < 60; i++) { const v = await p.locator('[data-testid=qr]').first().getAttribute('data-frames').catch(() => null); if (v && v.length > 4) return v; await p.waitForTimeout(250); } throw new Error('no frames'); };
const inject = async (p, json) => { const d = p.locator('details').first(); if (!(await d.evaluate((e) => e.open))) await d.locator('summary').click(); await p.getByTestId('debug-paste').fill(json); await p.getByTestId('debug-inject').click(); };
const text = (p, id) => p.getByTestId(id).innerText();

async function signup(p, phone, name, bank = 'Demo Bank A') {
  await p.goto(BASE + '/#/signup'); await p.getByTestId('su-phone').fill(phone); await p.getByTestId('su-otp').fill('123456'); await p.getByTestId('su-name').fill(name); await p.getByTestId('su-pin').fill('1234');
  await p.locator('select').nth(1).selectOption(bank); await p.getByTestId('su-terms').check(); await p.getByTestId('su-renting').check(); await p.getByTestId('su-submit').click();
  await p.getByTestId('who').waitFor({ timeout: 20000 });
}
async function topup(p, n) { await p.goto(BASE + '/#/topup'); await p.getByTestId('tu-amount').fill(String(n)); await p.getByTestId('tu-pin').fill('1234'); await p.getByTestId('tu-submit').click(); await p.getByText('left your main account').waitFor({ timeout: 20000 }); }
async function pay(from, to, n) {
  await to.goto(BASE + '/#/'); await from.goto(BASE + '/#/');
  await to.goto(BASE + '/#/receive'); await from.goto(BASE + '/#/pay');
  await to.getByTestId('qr').waitFor(); await inject(from, await frames(to));
  await from.getByTestId('pay-amount').fill(String(n)); await from.getByTestId('pay-pin').fill('1234'); await from.getByTestId('pay-start').click();
  await from.getByTestId('qr').waitFor();
  await to.getByTestId('rcv-scan').click(); await inject(to, await frames(from));
  await to.getByTestId('rcv-amount').waitFor(); assert.equal(await text(to, 'match-code'), await text(from, 'match-code'));
  await to.getByTestId('rcv-accept').click(); await to.getByTestId('qr').waitFor();
  await from.getByTestId('pay-next').click(); await inject(from, await frames(to));
  await from.getByText('Payment done').waitFor({ timeout: 10000 });
}
const home = async (p) => { await p.goto(BASE + '/#/'); await p.getByTestId('who').waitFor(); await p.waitForTimeout(300); };
const setOnline = async (...c) => { for (const x of c) await x.ctx.setOffline(false); };
const waitSynced = async (p) => { await home(p); await p.getByTestId('sync-btn').click().catch(() => {}); await p.waitForFunction(() => document.querySelector('[data-testid=unsynced]')?.textContent?.startsWith('0 '), null, { timeout: 20000 }); };
const A = await newPhone(), B = await newPhone(), C = await newPhone();
const D = await newPhone({ width: 1400, height: 900 });
const adminApi = async (path) => { const r = await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: secrets.admins.admin }) }); const t = (await r.json()).token; return (await fetch(BASE + '/api' + path, { headers: { Authorization: 'Bearer ' + t } })).json(); };

await step('sign up Asha, Bela, Chand through the real UI (key made in the browser)', async () => {
  await signup(A.page, '+919000000001', 'Asha'); await signup(B.page, '+919000000002', 'Bela', 'Demo Bank B'); await signup(C.page, '+919000000003', 'Chand');
  assert.match(await text(A.page, 'main-bal'), /50000/); await shot(A.page, '01-home-after-signup');
});
await step('top-up 20 points (server issues and signs the IDs; fee Rs 1)', async () => {
  await topup(A.page, 20); await home(A.page);
  assert.equal(await text(A.page, 'send-bal'), '20'); assert.match(await text(A.page, 'main-bal'), /49979/); await shot(A.page, '02-topup-done');
});
const adminSnap = async () => (await adminApi('/admin/live-ledger?a=%2B919000000001&b=%2B919000000002'));
let before;
await step('offline payment A to B (8 points) with both phones offline: the live ledger does not move', async () => {
  await A.page.goto(BASE + '/#/'); await B.page.goto(BASE + '/#/');
  before = await adminSnap();
  await A.ctx.setOffline(true); await B.ctx.setOffline(true);
  await pay(A.page, B.page, 8);
  await shot(A.page, '03-pay-done-offline');
  const mid = await adminSnap();
  assert.deepEqual([mid.a, mid.b, mid.last_entry_id], [before.a, before.b, before.last_entry_id]);
  await home(A.page); assert.equal(await text(A.page, 'send-bal'), '12'); assert.match(await text(A.page, 'unsynced'), /^8 /);
  await home(B.page); assert.equal(await text(B.page, 'recv-bal'), '8'); await shot(B.page, '04-receiver-pending');
});
await step('sync: money moves only now; A 12 in slot, B receive bucket 8, history paid', async () => {
  await setOnline(A, B); await waitSynced(A.page); await waitSynced(B.page);
  const after = await adminSnap();
  assert.equal(after.a.send_slot, 12); assert.equal(after.b.receive_slot, 8);
  await B.page.goto(BASE + '/#/history'); await B.page.getByTestId('hist-row').first().waitFor();
  assert.match(await B.page.getByTestId('hist-row').first().innerText(), /paid/); await shot(B.page, '05-history-paid');
  await B.page.goto(BASE + '/#/move'); await B.page.getByTestId('mv-submit').click(); await B.page.getByText('Moved to your main account').waitFor(); await shot(B.page, '06-move-to-main');
});
await step('wifi link: A pays B 4 points over a real WebRTC data channel (offer/answer by QR, no server), a forged frame is rejected, then keys die', async () => {
  await A.page.goto(BASE + '/#/'); await B.page.goto(BASE + '/#/'); await A.page.evaluate(() => { localStorage.setItem('nipay:debug', '1'); window.__nipayForgeOnOpen = true; });
  await B.page.goto(BASE + '/#/receive'); await A.page.goto(BASE + '/#/pay'); await B.page.getByTestId('qr').waitFor(); await inject(A.page, await frames(B.page));
  await A.page.getByTestId('pay-amount').fill('4'); await A.page.getByTestId('pay-pin').fill('1234'); await A.page.getByTestId('pay-link').click(); await A.page.getByTestId('qr').waitFor();
  await B.page.getByTestId('rcv-scan').click(); await inject(B.page, await frames(A.page));
  await B.page.getByTestId('link-state').waitFor(); await shot(B.page, '16-wifi-link-answer');
  await B.page.getByTestId('qr').waitFor(); const ans = await frames(B.page);
  await A.page.getByTestId('offer-next').click(); await inject(A.page, ans);
  await B.page.getByTestId('rcv-amount').waitFor({ timeout: 20000 });
  assert.equal(await text(B.page, 'match-code'), await text(A.page, 'match-code'));
  assert.ok(Number(await text(B.page, 'link-rejected')) >= 1, 'forged frame was rejected by the link');
  await shot(B.page, '17-wifi-link-review');
  await B.page.getByTestId('rcv-accept').click(); await A.page.getByText('encrypted wifi link').waitFor({ timeout: 15000 }); await shot(A.page, '18-wifi-link-done');
  assert.equal(await A.page.evaluate(() => window.__nipayLink.state), 'destroyed');
  await A.page.evaluate(() => { window.__nipayForgeOnOpen = false; }); await home(A.page); assert.equal(await text(A.page, 'send-bal'), '8');
});
await step('double spend: wallet snapshot restored, same points handed to Chand; bank pays first, holds second', async () => {
  // A saves a copy of the wallet, pays Bela, restores the copy and pays Chand with the same points
  await home(A.page);
  const snap = await A.page.evaluate(() => [localStorage.getItem('nipay:main:state'), localStorage.getItem('nipay:main:hwcounter')]);
  await A.ctx.setOffline(true); await B.ctx.setOffline(true); await C.ctx.setOffline(true);
  await pay(A.page, B.page, 5);
  // the attacker also rolls back the counter: our counter is only simulated in the browser, a real hardware counter could not be rolled back
  await A.page.evaluate(([s, c]) => { localStorage.setItem('nipay:main:state', s); localStorage.setItem('nipay:main:hwcounter', c); }, snap); await A.page.reload();
  await pay(A.page, C.page, 5);
  await shot(A.page, '07-second-payment-after-restore');
  await setOnline(B, C, A); await waitSynced(B.page); await waitSynced(C.page); await waitSynced(A.page);
  const same = await adminApi('/admin/same-id'); assert.ok(same.cases.length >= 1, 'same-ID case recorded');
  const stat = same.cases[0].claimants.map((c) => c.status).sort(); assert.deepEqual(stat, ['held', 'paid']);
  const sec = await adminApi('/admin/security-logs'); assert.ok(sec.events.some((e) => e.type === 'same_id'));
});
await step('plain wallet restore (counter not rolled back) is caught on the phone: self-lock, and reported at sync', async () => {
  await topup(B.page, 6); await home(B.page); const snap = await B.page.evaluate(() => localStorage.getItem('nipay:main:state'));
  await pay(B.page, C.page, 2); await setOnline(B, C);
  await B.page.evaluate((s) => localStorage.setItem('nipay:main:state', s), snap); await B.page.reload();
  await B.page.goto(BASE + '/#/'); await C.page.goto(BASE + '/#/'); await B.page.goto(BASE + '/#/pay'); await C.page.goto(BASE + '/#/receive'); await C.page.getByTestId('qr').waitFor(); await inject(B.page, await frames(C.page));
  await B.page.getByTestId('pay-amount').fill('1'); await B.page.getByTestId('pay-pin').fill('1234'); await B.page.getByTestId('pay-start').click();
  await B.page.getByText('App needs attention').waitFor(); await shot(B.page, '08a-self-lock-on-restore');
  await waitSynced(B.page); const sec = await adminApi('/admin/security-logs'); assert.ok(sec.events.some((e) => e.type === 'restore'), 'restore reported to bank');
});
await step('security checks screen computes real results', async () => {
  await A.page.goto(BASE + '/#/checks'); await A.page.getByTestId('run-checks').click(); await A.page.getByTestId('check-result').first().waitFor({ timeout: 15000 });
  const t = await A.page.getByTestId('check-result').allInnerTexts(); assert.ok(t.length >= 10); assert.ok(t.filter((x) => x.includes('NOT caught')).length <= 1, t.join()); await shot(A.page, '08-security-checks');
});
await step('installable PWA: loads again with the internet off after first visit', async () => {
  const P = await newPhone(); await P.page.goto(BASE + '/'); await P.page.evaluate(() => navigator.serviceWorker.ready); await P.page.reload(); await P.page.waitForTimeout(800);
  await P.ctx.setOffline(true); await P.page.reload(); await P.page.getByText('Create account').waitFor({ timeout: 8000 });
  const mf = await (await fetch(BASE + '/manifest.webmanifest')).json(); assert.equal(mf.display, 'standalone'); await shot(P.page, '09-pwa-offline-reload');
});
await step('dashboard: login, read-only security logs and same-ID log, no resolve buttons, flow map, live ledger', async () => {
  const p = D.page; await p.goto(BASE + '/#/admin'); await p.getByTestId('ad-pass').fill(secrets.admins.admin); await p.getByTestId('ad-login').click(); await p.getByText('Overview').first().waitFor();
  await shot(p, '10-admin-overview');
  await p.goto(BASE + '/#/admin/security'); await p.waitForTimeout(800); assert.equal(await p.getByRole('button', { name: /resolve|close|fix/i }).count(), 0); await shot(p, '11-admin-security-logs');
  await p.goto(BASE + '/#/admin/same-id'); await p.waitForTimeout(800); assert.equal(await p.getByRole('button', { name: /resolve|close|decide/i }).count(), 0); await shot(p, '12-admin-same-id');
  await p.goto(BASE + '/#/admin/flow'); await p.waitForTimeout(800); await shot(p, '13-admin-flow-map');
  await p.goto(BASE + '/#/admin/live-ledger'); await p.waitForTimeout(2500); await shot(p, '14-admin-live-ledger');
  await p.goto(BASE + '/#/admin/users'); await p.waitForTimeout(800); await shot(p, '15-admin-users');
});
await browser.close(); stop();
console.log('\n' + results.map((r) => r.join(' ')).join('\n'));
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
