# NiPay: offline payments that settle at the bank

An idea-stage prototype for GRAVITON 2026 (fintech and cybersecurity). **Fake money and test data only.** No real bank, Aadhaar, PAN or payment gateway is involved, and nothing here is approved by any bank, RBI or NPCI.

Idea in one line: the money stays in the bank. Phones carry bank-signed points; two phones pay each other with no internet; when a phone next goes online the bank checks the logs and moves the money. "We don't make the phone trustworthy. We make the cheater findable."

## Run it (one command)

```bash
./run.sh            # builds both websites, starts them, prints both URLs
./run.sh tunnel     # same, plus one free HTTPS tunnel per site (cloudflared), prints both public URLs
```
**Two separate websites**, built and served separately:

| Site | URL | Who | Build / entry | Notes |
|---|---|---|---|---|
| User site (phones) | http://localhost:8000 | customers | `vite.user.config.ts`, `index.html` -> `dist/user` | the only site with the PWA (manifest, service worker) |
| Admin site (dashboard, projector ledger) | http://localhost:8001 | bank staff | `vite.admin.config.ts`, `admin-site/index.html` -> `dist/admin` | no phone wallet code, no service worker; projector ledger at `/#/live-ledger` |

Each site has its own port and origin, its own CORS list, and its own API: the user server has no `/admin/*` routes at all, the admin server has no phone routes, and admin routes need an admin token (a phone token gets 403 on the admin API and the reverse). `npm run build` builds both; the e2e test greps the user bundle for admin code (none) and the admin bundle for wallet code (none).

Needs `uv` (Python), Node 20+. First start generates the bank signing key, monthly seed and admin passwords into `backend/data/secrets.json` (gitignored, never committed) and the admin server prints the admin user names. Admin logins: `admin` (super), `risk` (investigator), `auditor` (read only); passwords are in that file. The sign-up OTP is a **labelled demo value** (no SMS exists); the app reads it from the server (`/meta`) and says so on screen.

### On real phones (HTTPS needed for camera, passkeys and offline mode)
Browsers only give a page the camera, WebAuthn passkeys and a service worker on HTTPS or `localhost`.
1. **Needs internet:** run `./run.sh tunnel`; open the printed **user** `https://...` link on each phone. The admin link is for the presenter's laptop only.
2. **Needs internet:** on each phone, sign up (optional camera selfie with consent), add points; the page caches itself. "Add to home screen" installs it as an app. In More, turn on fingerprint/face unlock (PIN stays as fallback).
3. **Internet off:** put both phones on the same hotspot or wifi (a phone's hotspot works with its mobile data off) and pay. The QR codes only set up the connection; the points travel over the encrypted link.
4. **Needs internet again:** reconnect; each phone syncs by itself and the money moves.

### Development
```bash
npm run dev          # user site on :3000, proxies /api to :8000
npm run dev:admin    # admin site on :3001, proxies /api to :8001
cd backend && PORT=8000 uv run --with-requirements requirements.txt python -m nipay user
cd backend && PORT=8001 uv run --with-requirements requirements.txt python -m nipay admin
```

## What it does
- **Phones** (web app, mobile first): sign up with test KYC, one login at a time (a second device must file a cancellation report), add points (send bucket up to 2,000, Rs 1 fee), pay and receive offline over an encrypted wifi/hotspot link (up to 2,000 points in one payment), a **mutual security check** when two phones connect, fingerprint/face unlock (WebAuthn passkey, HTTPS only, PIN fallback), an optional consented demo selfie, history, move received money to the main account, report or appeal, English and Hindi warnings.
- **Bank server** (FastAPI + SQLite via SQLAlchemy; set `DATABASE_URL` for Postgres): makes and signs 20-character IDs (month inside the signature), signed monthly rules, signed bad-ID notices, signed trust certificate (rolling 6 months, fixed 300 to 850 range, never raises the limit), atomic ledger, claims (**first report paid, rest held and traced to the owner's device**), lost-phone rule (no refund, valid claims still paid), map flags go to review only, flow map from real events, audit log with a hash chain, token auth, rate limiting.
- **Admin site** (port 8001, separate from the phone site): overview, live monitor, users and wallets, **Security logs (read-only, no resolve or close buttons)**, **Same-ID log (read-only, automatic outcomes)**, review queue, appeals, flow map, rules and months, bank ledger between fictional banks, analytics, audit log, **mutual-check cross-reports** (inside Security logs), and a **Live ledger** page for projectors. The check runner that used to be a button in the phone app is now a developer test script (`npm test`).

## Architecture
```
 phone A (browser)  <-- QR only sets up the link;  points travel over encrypted WebRTC (wifi/hotspot) -->  phone B (browser)
   device key (Ed25519, made on the phone)                                same
   checks: bank sig, tower, landmines, flags, handover
        |  online only: /api/sync, /api/wallet/topup ...                       |
        +--------------------------> bank server (FastAPI) <-------------------+
                                     SQLite/Postgres, signing key + seed in secrets.json
```
- `backend/nipay/core/idsystem.py`, `wallet.py`: ported reference code (tower, landmines, stack mines, signed rules, trust). `backend/nipay/service.py`: claims, ledger, trust, flow map. `backend/nipay/main.py`: API.
- `src/lib/idsystem.ts`: TypeScript port of the checker and mine logic, tested against Python on shared vectors (`shared/vectors.json`, made from public test constants by `backend/tools/make_vectors.py`).
- `src/lib/link.ts`: the wifi link. `src/lib/pipe.ts`: chunked, hashed, resumable transfer on the link. `src/lib/peercheck.ts`: the mutual check and signed cross-reports. `src/lib/protocol.ts`: wire format and the QR frames used for pairing. `src/lib/crypto.ts`: libsodium (Ed25519, X25519, ChaCha20-Poly1305).
- IDs and signatures are made on the server only. The client never makes IDs.

## Server rules added after the audit
- A sync with no wallet snapshot is logged (`wallet_omitted`) and counts as a failed integrity check for any cross-reports in it. The bank keeps its own highest sequence per device, so a phone cannot hide a restore by lying about `seq` and `counter`.
- Official builds: the operator registers digests (setting `official_build_digest`, comma separated). A sync with a missing or unknown `code_digest` is logged; with none registered nothing is enforced. The web demo does not send a trustworthy digest (a page can be edited), so this is for the native app.
- Honest late claims stay valid for 6 months after the month the point was issued (phones still accept only the grace window offline).
- First report wins on a same-ID dispute. Held claims show the claimant's trust and a review time (72 h at trust 300 down to 12 h at 850); nothing is released automatically because the first report was already paid.
- A full receive bucket never loses a claim: the overflow is paid to the receiver's main account and the first-report order is kept.
- `/sync` takes up to 2,500 log lines per round and answers `more: true`; the phone keeps syncing until done (a 2,000-point payment syncs fully).
- Refill: the phone says how many points it spent offline and has not synced; the bank subtracts that (never below zero) when checking the send limit, with a hard ceiling of twice the limit, and logs the report.
- A sync that settles at least 200 points and 5 times the user's usual rate opens a **review item only**. No daily spend limit exists (the wallet holds 2,000), and nothing is ever frozen by a review item.
- Counter: a phone without a hardware counter gets the lower `weak_counter_send_limit` instead of a mark. The browser's counter is simulated and **weak**; the demo keeps the full limit (set `NIPAY_WEAK_COUNTER_LIMIT` to try a stricter one).

## Real versus simulated
| Real in this repo | Not implemented in the web demo |
|---|---|
| Ed25519 device keys made in the browser; signed handover and signed "received" | Play Integrity (Android) and App Attest (iPhone): **planned for the native app** |
| Bank signature, tower, landmine, flagged-ID checks run in the browser with the bank public key and signed rules | Root and emulator detection: **planned for the native app** |
| Stack mines, spend order, void filling, mine audit, control key | A real hardware counter: the counter here lives in browser storage, so a determined user can reset it (**planned for native**). The wallet self-lock on restore is real but only as strong as that counter |
| QR codes for pairing only (payee card, connection offer, answer); never for money | NFC (not possible from a browser; dropped). Bluetooth (a browser cannot be a Bluetooth peripheral; not used) |
| Encrypted WebRTC link over wifi/hotspot (no STUN, no server), X25519 + one-time QR key, ChaCha20-Poly1305, transcript signatures, one payment per session, up to 2,000 points, 8 kB chunks with end-to-end hash and resume after a dropped link; if the link cannot open the app says "connection failed, join the same hotspot" and offers retry (no QR money fallback) | Creating or auto-joining wifi (a web page cannot; manual step, with a wifi-join QR helper) |
| Server: atomic ledger, claims, signed rules/notices/trust, lost-phone rule, audit hash chain, rate limits | Real KYC, SMS OTP (mock fixed code, labelled), face matching (not built; the demo selfie is only stored, with consent and a delete option), passkey assertions are checked by the phone's own biometric/lock and not verified by the server, insurance add-on, real bank settlement (ledger between fictional banks only) |
| Service worker: app runs with the internet off after first load | Push notifications, backups disabled, VPN check at sync |

KYC fields accept **test data only**; Aadhaar and PAN are checked for shape and discarded, nothing about them is stored (a test asserts this).

## Known limits (not hidden)
- **Same-ID:** one valid ID handed to two people passes offline. It is caught at the bank when both claims arrive: the first report is paid, the rest are held and traced to the owner's device, and the owner is blocked automatically by rule. The first honest receiver of the second claim may lose out; who pays is an open question.
- A clean-copy app can beat software code checks; a modified app that leaves mines intact but edits other code passes the mine audit; a wallet restore needs a real hardware counter to be seen reliably.
- Rules and the mine recipe are on every phone by design (an attacker can read them from his own phone); the bank signature is what stops forgery. The pattern layers only slow a forger.
- One payment is capped at 2,000 points (the send bucket). Connection methods: only wifi/hotspot works in a browser. **Web Bluetooth cannot make a phone-to-phone payment link** (a page can only be a Bluetooth *client* to a peripheral, never act as one or accept a peer), and NFC is not available to pages; the app lists both as not available instead of offering them. Planned for the native app.
- Mutual check: the other phone's integrity signal is self-reported (the browser has no Play Integrity / App Attest), so it catches an honest-but-restored wallet and a modified client, not a determined attacker. Cross-reports are evidence for logs and review; they never suspend anybody, and the server drops them if the reporter's own integrity check fails.
- If the payer never receives the signed "received" its points stay locked on that phone; paying again with them risks a double spend, so sync and check history first.
- Wifi link: browsers may hide local addresses behind mDNS names; some phones/networks block device-to-device traffic (client isolation). Then the link does not open and the app falls back to QR by itself. **Not tested on real phones.**

## Tests
```bash
cd backend && uv run --with-requirements requirements.txt python -m pytest -q tests   # server tests
npm test                  # test:vectors (TypeScript vs Python on shared vectors, QR wire format, link crypto) + developer attack tests (forged/edited/old-month/flagged IDs, fake rules, forged mines, mutual check, 2,000-point chunked transfer with drop and resume)
npm run build             # type check + production build
npm run build && node scripts/e2e.mjs   # real UIs + both real servers in Chromium (Playwright): sign-up, selfie, top-up, offline link payment, sync, double spend, mutual check, 2,000-point payment with a cut link and virtual passkey, site separation, PWA offline, admin dashboard
```
Server tests cover forged ID, reused ID, handover for another person, old-month ID, fake rules, atomic ledger and a race, lost phone, one login at a time, the offline two-phone flow, roles and the read-only security logs. What was **not** tested: real phones, real cameras, Android/iPhone browsers, real wifi or hotspot, Bluetooth, NFC. In the Playwright run the camera is replaced by a debug box (visible in the scanner screen) that moves the same frame bytes between two browser contexts.

## Live demo script (2 to 3 people, about 5 minutes)
Roles: **Person A** (payer), **Person B** (payee), optionally **Person C** (cheater), and a **presenter** with a laptop on a projector.
1. Presenter: `./run.sh tunnel`. Note the two printed addresses. On the laptop open the **admin** tunnel URL, sign in as `admin`, open **Live ledger** (`/#/live-ledger`) and select A and B (big numbers, labelled **TEST MONEY**). *Needs internet.*
2. A and B open the **user** tunnel URL on their phones, add to home screen, sign up (the sign-up screen shows the demo OTP and says it is a mock), optionally take the consented selfie. A adds 50 points. The ledger animates: A's account drops by 51, A's slot shows 50. In More, turn on fingerprint/face unlock. *Needs internet.*
3. **Both phones go to airplane mode, then join the same hotspot** (one phone's hotspot, mobile data off). Point out: the live ledger does not move from now on.
4. B opens **Receive** (shows a QR). A opens **Pay** and scans it: the phones check each other **automatically** (bank-signed certificate, rules month, flagged list, integrity signal); no button. A enters 10 and unlocks with fingerprint/face or the PIN, taps **Connect and pay**. A shows a connection QR, B scans it and shows an answer QR, A scans that. The encrypted link opens, a progress bar runs, both screens show the same 2-digit code, B accepts, A hears the beep. The QR codes never carried money. Phones show it pending; the ledger is still unchanged. (Optional: pull one phone off the hotspot mid-payment; the app says to join the same hotspot and resumes where it stopped.)
5. **Switch data back on.** Both phones sync by themselves, uploading their signed cross-reports too. Only now the ledger animates: A's slot 50 to 40, B's receive slot 0 to 10. B can **Move money** to the account.
6. Cheater round (C optional): a phone whose bank certificate is missing or expired, or whose integrity signal fails, is refused at connection with a plain "Payment failed" (or the danger warning); the admin **Security logs** page lists the cross-reports and nobody is suspended by them. For the double spend, A pays B, and the presenter restores A's saved wallet copy to pay C with the same points; **Same-ID log** shows the first claim paid, the second held, traced to A's device. The security attack catalogue is not a phone feature; run `npm test` to show it.
7. Say honestly: Play Integrity, App Attest, root detection, hardware counter and self-lock are for the native app; Bluetooth and NFC pairing are impossible from a web page; this web demo does the signatures, checks, mutual check and the encrypted wifi link for real.

## Repo hygiene
No keys, databases or `.env` are committed (`.gitignore` covers `backend/data/`, `*.db`, `.env*`, `node_modules`, `dist`). `.env.example` has placeholders only. The shared test vectors use public test constants, not the server's seed. Hidden factor lists and real recipe values do not exist in the repo; they are derived at runtime from the seed.
