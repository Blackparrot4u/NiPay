// End-to-end run against a real server and the real UI (Chromium via Playwright).
// Usage: node scripts/e2e.mjs   (needs `npm run build` first; starts and stops its own server)
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const PW = process.env.PLAYWRIGHT_DIR || '/home/thepug/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = await import(PW + '/index.mjs').catch(() => import(PW));
const PORT = 8765, APORT = 8766, BASE = `http://localhost:${PORT}`, ABASE = `http://localhost:${APORT}`; // localhost: WebAuthn needs a hostname, not an IP
const SHOTS = join(homedir(), 'Pictures/offline-payments-flow/nipay-app'); mkdirSync(SHOTS, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'nipay-e2e-'));
const spawnSite = (portal, port) => spawn('uv', ['run', '--with-requirements', 'requirements.txt', 'python', '-m', 'nipay', portal], {
  cwd: 'backend', env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NIPAY_DATA_DIR: dataDir, NIPAY_RATE_LIMIT: '100000', NIPAY_LOGIN_RATE: '1000' }, stdio: 'pipe', detached: true });
const servers = [spawnSite('user', PORT), spawnSite('admin', APORT)];
let log = ''; for (const sv of servers) { sv.stdout.on('data', (d) => (log += d)); sv.stderr.on('data', (d) => (log += d)); }
const stop = () => { for (const sv of servers) try { process.kill(-sv.pid, 'SIGTERM'); } catch {} };
process.on('exit', stop);
for (const b of [BASE, ABASE]) { for (let i = 0; i < 80; i++) { try { if ((await fetch(b.replace('localhost', '127.0.0.1') + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  if (!(await fetch(b.replace('localhost', '127.0.0.1') + '/api/health').then((r) => r.ok).catch(() => false))) { console.log('SERVER LOG', log); stop(); process.exit(2); } }
const secrets = JSON.parse(readFileSync(join(dataDir, 'secrets.json'), 'utf8'));
const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const results = [];
const only = process.env.ONLY; const extra = [];
const step = async (name, f) => { if (only && !name.includes(only)) return; try { await f(); results.push(['PASS', name]); console.log('PASS', name); } catch (e) { for (const [i, x] of [A, B, C, ...extra].entries()) await x.page.screenshot({ path: join(SHOTS, 'fail-' + i + '.png') }).catch(() => {}); results.push(['FAIL', name + ': ' + e.message.split('\n').slice(0, 4).join(' | ') + ' @' + (e.stack.match(/e2e.mjs:(\d+)/)||[])[1]]); console.log('FAIL', name, e.message.split('\n')[0]); } };
const VP = (process.env.E2E_VIEWPORT || '390x800').split('x').map(Number);
const newPhone = async (viewport = { width: VP[0], height: VP[1] }) => { const ctx = await browser.newContext({ viewport, permissions: [] }); await ctx.addInitScript(() => { try { localStorage.setItem('nipay:debug', '1'); } catch {} }); const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('PAGE ERROR', e.message)); return { ctx, page }; };
const shot = (p, n) => p.screenshot({ path: join(SHOTS, n + '.png') });
const frames = async (p) => { for (let i = 0; i < 60; i++) { const v = await p.locator('[data-testid=qr]').first().getAttribute('data-frames').catch(() => null); if (v && v.length > 4) return v; await p.waitForTimeout(250); } throw new Error('no frames'); };
const inject = async (p, json) => { const d = p.locator('details').first(); if (!(await d.evaluate((e) => e.open))) await d.locator('summary').click(); await p.getByTestId('debug-paste').fill(json); await p.getByTestId('debug-inject').click(); };
const text = (p, id) => p.getByTestId(id).innerText();

async function signup(p, phone, name, bank = 'Demo Bank A') {
  await p.goto(BASE + '/#/signup'); await p.getByTestId('su-phone').fill(phone); await p.getByTestId('su-otp').fill('123456'); await p.getByTestId('su-name').fill(name); await p.getByTestId('su-pin').fill('1234');
  await p.locator('select').nth(1).selectOption(bank); await p.getByTestId('su-terms').check(); await p.getByTestId('su-renting').check(); await p.getByTestId('su-submit').click();
  await p.getByTestId('selfie-skip').click(); await p.getByTestId('who').waitFor({ timeout: 20000 });
}
async function topup(p, n) { await p.goto(BASE + '/#/topup'); await p.getByTestId('tu-amount').fill(String(n)); await p.getByTestId('tu-pin').fill('1234'); await p.getByTestId('tu-submit').click(); await p.getByText('left your main account').waitFor({ timeout: 20000 }); }
async function pay(from, to, n, opt = {}) {
  await to.goto(BASE + '/#/'); await from.goto(BASE + '/#/');
  await from.evaluate(() => localStorage.setItem('nipay:debug', '1'));
  await to.goto(BASE + '/#/receive'); await from.goto(BASE + '/#/pay');
  await to.getByTestId('qr').waitFor(); await inject(from, await frames(to));            // QR 1: payee card, checked by the payer automatically
  await from.getByTestId('pay-amount').fill(String(n));
  if (opt.passkey) await from.getByTestId('use-passkey').click(); else await from.getByTestId('pay-pin').fill('1234');
  await from.getByTestId('pay-link').click(); await from.getByTestId('qr').waitFor();     // QR 2: connection offer (carries the payer card)
  await to.getByTestId('rcv-scan').click(); await inject(to, await frames(from));
  await to.getByTestId('link-state').waitFor(); await to.getByTestId('qr').waitFor(); const ans = await frames(to);   // QR 3: answer
  await from.getByTestId('offer-next').click(); await inject(from, ans);
  if (opt.drop) {
    await from.evaluate((k) => { window.__nipayDropAtPart = k; }, opt.drop);
    await from.getByTestId('pay-retry').waitFor({ timeout: 30000 }); await to.getByTestId('rcv-reconnect').waitFor({ timeout: 30000 });
    opt.onDrop && await opt.onDrop();
    await from.getByTestId('pay-retry').click(); await from.getByTestId('qr').waitFor();
    await to.getByTestId('rcv-reconnect').click(); await inject(to, await frames(from));
    await to.getByTestId('link-state').waitFor(); await to.getByTestId('qr').waitFor(); const ans2 = await frames(to);
    await from.getByTestId('offer-next').click(); await inject(from, ans2);
  }
  await to.getByTestId('rcv-amount').waitFor({ timeout: 60000 }); if (opt.expectPoints) assert.equal(await text(to, 'rcv-amount'), opt.expectPoints + ' points'); assert.equal(await text(to, 'match-code'), await text(from, 'match-code'));
  if (opt.forge) assert.ok(Number(await text(to, 'link-rejected')) >= 1, 'forged frame was rejected by the link');
  await to.getByTestId('rcv-accept').click();
  await from.getByText('Payment done').waitFor({ timeout: 60000 });
}
const home = async (p) => { await p.goto(BASE + '/#/'); await p.getByTestId('who').waitFor(); await p.waitForTimeout(300); };
const setOnline = async (...c) => { for (const x of c) await uncut(x); };
const waitSynced = async (p) => { await home(p); await p.getByTestId('sync-btn').click().catch(() => {}); await p.waitForFunction(() => document.querySelector('[data-testid=unsynced]')?.textContent?.startsWith('0 '), null, { timeout: 20000 }); };
// "No internet" for the phones = the server cannot be reached. The local wifi/hotspot link between two phones keeps working (Playwright's own offline mode would also cut WebRTC).
const cut = (c) => c.ctx.route('**/api/**', (r) => r.abort('internetdisconnected'));
const uncut = (c) => c.ctx.unroute('**/api/**');
const A = await newPhone(), B = await newPhone(), C = await newPhone();
const D = await newPhone({ width: 1400, height: 900 });
const adminApi = async (path) => { const r = await fetch(ABASE + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: secrets.admins.admin }) }); const t = (await r.json()).token; return (await fetch(ABASE + '/api' + path, { headers: { Authorization: 'Bearer ' + t } })).json(); };

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
  await cut(A); await cut(B);
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
await step('link payment with a third device injecting a forged frame: rejected, keys die after one payment', async () => {
  await A.page.goto(BASE + '/#/'); await A.page.evaluate(() => { localStorage.setItem('nipay:debug', '1'); window.__nipayForgeOnOpen = true; });
  await pay(A.page, B.page, 4, { forge: true }); await shot(A.page, '18-link-done');
  await A.page.waitForFunction(() => window.__nipayLink.state === 'destroyed', null, { timeout: 5000 });
  await A.page.evaluate(() => { window.__nipayForgeOnOpen = false; }); await home(A.page); assert.equal(await text(A.page, 'send-bal'), '8');
});
await step('double spend: wallet snapshot restored, same points handed to Chand; bank pays first, holds second', async () => {
  // A saves a copy of the wallet, pays Bela, restores the copy and pays Chand with the same points
  await home(A.page);
  const snap = await A.page.evaluate(() => [localStorage.getItem('nipay:main:state'), localStorage.getItem('nipay:main:hwcounter')]);
  await cut(A); await cut(B); await cut(C);
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
  await B.page.getByTestId('pay-amount').fill('1'); await B.page.getByTestId('pay-pin').fill('1234'); await B.page.getByTestId('pay-link').click();
  await B.page.getByText('App needs attention').waitFor(); await shot(B.page, '08a-self-lock-on-restore');
  await waitSynced(B.page); const sec = await adminApi('/admin/security-logs'); assert.ok(sec.events.some((e) => e.type === 'restore'), 'restore reported to bank');
});
await step('no security-test button or /checks route in the user app', async () => {
  await A.page.goto(BASE + '/#/more'); await A.page.getByText('What is real in this web demo').waitFor();
  assert.equal(await A.page.getByTestId('to-checks').count(), 0); assert.equal(await A.page.getByText(/run (all )?(security )?checks?/i).count(), 0);
  await A.page.goto(BASE + '/#/checks'); await A.page.waitForTimeout(400); assert.equal(await A.page.getByTestId('run-checks').count(), 0);
});
await step('mutual check: a payee phone with no bank certificate is refused automatically: plain "Payment failed", and the report reaches the admin logs', async () => {
  const P = await newPhone(), Q = await newPhone(); await signup(P.page, '+919000000011', 'Pia'); await signup(Q.page, '+919000000012', 'Qadir');
  await home(P.page); await home(Q.page); await P.page.waitForTimeout(800);
  await cut(Q); await cut(P);
  await Q.page.evaluate(() => { const k = 'nipay:main:state'; const s = JSON.parse(localStorage.getItem(k)); s.cert = null; localStorage.setItem(k, JSON.stringify(s)); }); await Q.page.reload();
  await Q.page.goto(BASE + '/#/receive'); await P.page.goto(BASE + '/#/pay'); await Q.page.getByTestId('qr').waitFor(); await inject(P.page, await frames(Q.page));
  await P.page.getByText('Payment failed').waitFor({ timeout: 8000 }); assert.equal(await P.page.getByTestId('pay-amount').count(), 0); await shot(P.page, '08-mutual-check-plain-failed');
  await uncut(P); await waitSynced(P.page);
  const x = await adminApi('/admin/cross-reports'); const fail = x.reports.find((r) => r.result === 'fail' && r.subject_phone === '+919000000012'); assert.ok(fail && fail.codes.includes('no_cert'), JSON.stringify(x.reports));
  const sec = await adminApi('/admin/security-logs'); assert.ok(sec.events.some((e) => e.type === 'cross_check_fail'));
  const us = await adminApi('/admin/users'); assert.equal(us.users.find((u) => u.phone === '+919000000012').offline_suspended, false, 'a report suspends nobody');
});
await step('mutual check passes both ways on honest payments and is uploaded at sync as signed cross-reports', async () => {
  const x = await adminApi('/admin/cross-reports'); const pass = x.reports.filter((r) => r.result === 'pass');
  assert.ok(pass.some((r) => r.reporter === 'Asha') && pass.some((r) => r.reporter === 'Bela'), 'both directions: ' + JSON.stringify(pass.map((r) => r.reporter)));
});
await step('2,000-point payment over the encrypted link: progress bar, link cut mid-transfer, retry resumes, fingerprint/face (virtual passkey) unlock, bank settles all 2,000', async () => {
  const R = await newPhone(), S = await newPhone(); extra.push(R, S); for (const x of [R, S]) x.page.on('console', (m) => console.log('  [console]', m.text().slice(0, 160))); for (const x of [R, S]) await x.page.addInitScript(() => localStorage.setItem('nipay:debug', '1')); await signup(R.page, '+919000000021', 'Ravi'); await signup(S.page, '+919000000022', 'Sana');
  await topup(R.page, 2000); await home(R.page); assert.equal(await text(R.page, 'send-bal'), '2000');
  const cdp = await R.ctx.newCDPSession(R.page); await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await R.page.goto(BASE + '/#/more'); await R.page.getByTestId('enable-passkey').click(); await R.page.getByText('Fingerprint or face unlock is on').first().waitFor({ timeout: 10000 });
  await cut(R); await cut(S);
  await pay(R.page, S.page, 2000, { passkey: true, expectPoints: 2000, drop: 12, onDrop: async () => { assert.match(await R.page.getByText(/parts/).first().innerText(), /\d+\/\d+ parts/); await shot(R.page, '19-link-lost-resume'); } });
  await S.page.getByTestId('rcv-done').waitFor({ timeout: 30000 });
  await home(R.page); assert.equal(await text(R.page, 'send-bal'), '0');
  await setOnline(R, S); await waitSynced(R.page); await waitSynced(S.page);
  await S.page.goto(BASE + '/#/'); await S.page.waitForFunction(() => document.querySelector('[data-testid=recv-bal]')?.textContent === '2000', null, { timeout: 30000 });
  await shot(S.page, '20-two-thousand-settled');
});
await step('selfie at sign-up: camera capture with consent, stored server-side only, deletable', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, permissions: ['camera'] }); const p = await ctx.newPage();
  await p.goto(BASE + '/#/signup'); await p.getByTestId('su-phone').fill('+919000000031'); await p.getByTestId('su-otp').fill('123456'); await p.getByTestId('su-name').fill('Selfie Tester'); await p.getByTestId('su-pin').fill('1234');
  await p.getByTestId('su-terms').check(); await p.getByTestId('su-renting').check(); await p.getByTestId('su-submit').click();
  await p.getByTestId('selfie-consent').waitFor({ timeout: 20000 }); assert.equal(await p.getByTestId('selfie-capture').isDisabled(), true, 'needs consent first');
  await p.getByTestId('selfie-consent').check(); await p.getByTestId('selfie-capture').click({ timeout: 15000 }); await p.getByTestId('selfie-preview').waitFor(); await shot(p, '21-selfie');
  await p.getByTestId('selfie-save').click(); await p.getByTestId('who').waitFor();
  let us = await adminApi('/admin/users'); assert.equal(us.users.find((u) => u.phone === '+919000000031').selfie_on_file, true);
  assert.ok(existsSync(join(dataDir, 'selfies')), 'file is in the data folder, not in the repo');
  await p.goto(BASE + '/#/more'); await p.getByTestId('selfie-delete').click(); await p.getByText('Selfie deleted.').waitFor();
  us = await adminApi('/admin/users'); assert.equal(us.users.find((u) => u.phone === '+919000000031').selfie_on_file, false);
});
await step('installable PWA: loads again with the internet off after first visit', async () => {
  const P = await newPhone(); await P.page.goto(BASE + '/'); await P.page.evaluate(() => navigator.serviceWorker.ready); await P.page.reload(); await P.page.waitForTimeout(800);
  await P.ctx.setOffline(true); await P.page.reload(); await P.page.getByText('Create account').waitFor({ timeout: 8000 });
  const mf = await (await fetch(BASE + '/manifest.webmanifest')).json(); assert.equal(mf.display, 'standalone'); await shot(P.page, '09-pwa-offline-reload');
});
await step('separate sites: admin API and pages exist only on the admin origin; user origin has no admin routes; PWA only on the user site', async () => {
  assert.equal((await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  assert.equal((await fetch(BASE + '/api/admin/overview')).status, 404);
  assert.equal((await fetch(ABASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  assert.equal((await fetch(ABASE + '/api/wallet')).status, 404);
  const mf = await fetch(ABASE + '/manifest.webmanifest'); assert.ok(!mf.ok || (mf.headers.get('content-type') || '').includes('html'), 'no manifest on admin');
  const sw = await fetch(ABASE + '/sw.js'); assert.ok(!sw.ok || (sw.headers.get('content-type') || '').includes('html'), 'no service worker on admin');
  const ah = await (await fetch(ABASE + '/')).text(); assert.ok(!/manifest|serviceWorker|apple-touch/.test(ah));
  const tok = (await (await fetch(ABASE + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: secrets.admins.admin }) })).json()).token;
  assert.equal((await fetch(BASE + '/api/wallet', { headers: { Authorization: 'Bearer ' + tok } })).status, 403, 'admin token is not a phone token');
  const o = await fetch(ABASE + '/api/admin/overview', { headers: { Origin: BASE, Authorization: 'Bearer ' + tok } }); assert.equal(o.headers.get('access-control-allow-origin'), null, 'admin API does not allow the user origin');
  const D2 = await newPhone(); await D2.page.goto(BASE + '/#/admin/overview'); await D2.page.getByTestId('to-signup').waitFor(); assert.equal(await D2.page.getByText('NiPay dashboard').count(), 0);
});
await step('dashboard (admin site): login, read-only security logs and same-ID log, no resolve buttons, flow map, live ledger', async () => {
  const p = D.page; await p.goto(ABASE + '/'); await p.getByTestId('ad-pass').fill(secrets.admins.admin); await p.getByTestId('ad-login').click(); await p.getByText('Overview').first().waitFor();
  await shot(p, '10-admin-overview');
  await p.goto(ABASE + '/#/security'); await p.getByText('Mutual checks at connection').waitFor(); await p.waitForTimeout(800); assert.equal(await p.getByRole('button', { name: /resolve|close|fix/i }).count(), 0); await shot(p, '11-admin-security-logs');
  await p.goto(ABASE + '/#/same-id'); await p.waitForTimeout(800); assert.equal(await p.getByRole('button', { name: /resolve|close|decide/i }).count(), 0); await shot(p, '12-admin-same-id');
  await p.goto(ABASE + '/#/flow'); await p.waitForTimeout(800); await shot(p, '13-admin-flow-map');
  await p.goto(ABASE + '/#/live-ledger'); await p.waitForTimeout(2500); await shot(p, '14-admin-live-ledger');
  await p.goto(ABASE + '/#/users'); await p.waitForTimeout(800); await shot(p, '15-admin-users');
});
await browser.close(); stop();
console.log('\n' + results.map((r) => r.join(' ')).join('\n'));
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
