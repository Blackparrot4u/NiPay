# NiPay: offline payments that settle at the bank

An idea-stage prototype for GRAVITON 2026 (fintech and cybersecurity). **Fake money and test data only.** No real bank, Aadhaar, PAN or payment gateway is involved, and nothing here is approved by any bank, RBI or NPCI.

Idea in one line: the money stays in the bank. Phones carry bank-signed points; two phones pay each other with no internet; when a phone next goes online the bank checks the logs and moves the money. "We don't make the phone trustworthy. We make the cheater findable."

## Run it (one command)

```bash
./run.sh            # builds the web app, starts API + app on http://localhost:8000
```
Needs `uv` (Python), Node 20+. First start generates the bank signing key, monthly seed and admin passwords into `backend/data/secrets.json` (gitignored, never committed) and prints the admin user names. Admin logins: `admin` (super), `risk` (investigator), `auditor` (read only); passwords are in that file. Demo sign-up OTP is the fixed mock `123456`.

### On real phones (HTTPS needed for camera and offline mode)
Browsers only give a page the camera and a service worker on HTTPS or `localhost`.
1. **Needs internet:** run `./run.sh tunnel` (free `cloudflared` quick tunnel, no account) or `ssh -R 80:localhost:8000 nokey@localhost.run`. Open the printed `https://...` link on each phone.
2. **Needs internet:** on each phone, sign up and add points; the page now caches itself. "Add to home screen" installs it as an app (Android Chrome: menu; iPhone Safari: Share, Add to Home Screen).
3. **Internet off:** switch both phones to airplane mode (or just data off) and pay. Camera QR works with no connectivity at all.
4. **Needs internet again:** reconnect; each phone syncs by itself and the money moves.

### Development
```bash
npm run dev                          # Vite on :3000, proxies /api to :8000
cd backend && uv run --with-requirements requirements.txt python -m nipay
```

## What it does
- **Phones** (web app, mobile first): sign up with test KYC, one login at a time (a second device must file a cancellation report), add points (send bucket up to 2,000, Rs 1 fee), pay and receive offline, history, move received money to the main account, report or appeal, English and Hindi warnings.
- **Bank server** (FastAPI + SQLite via SQLAlchemy; set `DATABASE_URL` for Postgres): makes and signs 20-character IDs (month inside the signature), signed monthly rules, signed bad-ID notices, signed trust certificate (rolling 6 months, fixed 300 to 850 range, never raises the limit), atomic ledger, claims (**first report paid, rest held and traced to the owner's device**), lost-phone rule (no refund, valid claims still paid), map flags go to review only, flow map from real events, audit log with a hash chain, token auth, rate limiting.
- **Dashboard** (`/#/admin`): overview, live monitor, users and wallets, **Security logs (read-only, no resolve or close buttons)**, **Same-ID log (read-only, automatic outcomes)**, review queue, appeals, flow map, rules and months, bank ledger between fictional banks, analytics, audit log, and a **Live ledger** page for projectors.

## Architecture
```
 phone A (browser)  <-- animated QR  or  encrypted WebRTC over wifi -->  phone B (browser)
   device key (Ed25519, made on the phone)                                same
   checks: bank sig, tower, landmines, flags, handover
        |  online only: /api/sync, /api/wallet/topup ...                       |
        +--------------------------> bank server (FastAPI) <-------------------+
                                     SQLite/Postgres, signing key + seed in secrets.json
```
- `backend/nipay/core/idsystem.py`, `wallet.py`: ported reference code (tower, landmines, stack mines, signed rules, trust). `backend/nipay/service.py`: claims, ledger, trust, flow map. `backend/nipay/main.py`: API.
- `src/lib/idsystem.ts`: TypeScript port of the checker and mine logic, tested against Python on shared vectors (`shared/vectors.json`, made from public test constants by `backend/tools/make_vectors.py`).
- `src/lib/link.ts`: the wifi link. `src/lib/protocol.ts`: wire format and animated-QR frames.
- IDs and signatures are made on the server only. The client never makes IDs.

## Real versus simulated
| Real in this repo | Not implemented in the web demo |
|---|---|
| Ed25519 device keys made in the browser; signed handover and signed "received" | Play Integrity (Android) and App Attest (iPhone): **planned for the native app** |
| Bank signature, tower, landmine, flagged-ID checks run in the browser with the bank public key and signed rules | Root and emulator detection: **planned for the native app** |
| Stack mines, spend order, void filling, mine audit, control key | A real hardware counter: the counter here lives in browser storage, so a determined user can reset it (**planned for native**). The wallet self-lock on restore is real but only as strong as that counter |
| Animated multi-frame QR both ways (payer to payee handover, payee to payer receipt) | NFC (not possible from a browser; dropped). Bluetooth (a browser cannot be a Bluetooth peripheral; not used) |
| Encrypted WebRTC link over wifi/hotspot (no STUN, no server), X25519 + one-time QR key, ChaCha20-Poly1305, transcript signatures, one payment per session, auto fallback to QR | Creating or auto-joining wifi (a web page cannot; manual step, with a wifi-join QR helper) |
| Server: atomic ledger, claims, signed rules/notices/trust, lost-phone rule, audit hash chain, rate limits | Real KYC, SMS OTP (mock fixed code), selfie/biometric (planned), insurance add-on, real bank settlement (ledger between fictional banks only) |
| Service worker: app runs with the internet off after first load | Push notifications, backups disabled, VPN check at sync |

KYC fields accept **test data only**; Aadhaar and PAN are checked for shape and discarded, nothing about them is stored (a test asserts this).

## Known limits (not hidden)
- **Same-ID:** one valid ID handed to two people passes offline. It is caught at the bank when both claims arrive: the first report is paid, the rest are held and traced to the owner's device, and the owner is blocked automatically by rule. The first honest receiver of the second claim may lose out; who pays is an open question.
- A clean-copy app can beat software code checks; a modified app that leaves mines intact but edits other code passes the mine audit; a wallet restore needs a real hardware counter to be seen reliably.
- Rules and the mine recipe are on every phone by design (an attacker can read them from his own phone); the bank signature is what stops forgery. The pattern layers only slow a forger.
- Over QR a payment is capped at 60 points (148 bytes per point makes more too slow to scan); the wifi link allows 500.
- If the payer never receives the signed "received" its points stay locked on that phone; paying again with them risks a double spend, so sync and check history first.
- Wifi link: browsers may hide local addresses behind mDNS names; some phones/networks block device-to-device traffic (client isolation). Then the link does not open and the app falls back to QR by itself. **Not tested on real phones.**

## Tests
```bash
cd backend && uv run --with-requirements requirements.txt python -m pytest -q tests   # 28 server tests
npm run test:vectors      # TypeScript vs Python on shared vectors, QR wire format, link crypto (wrong key, tamper, replay)
npm run build             # type check + production build
npm run build && node scripts/e2e.mjs   # real UI + real server in Chromium (Playwright): sign-up, top-up, offline payment, sync, double spend, wifi link, PWA offline, dashboard
```
Server tests cover forged ID, reused ID, handover for another person, old-month ID, fake rules, atomic ledger and a race, lost phone, one login at a time, the offline two-phone flow, roles and the read-only security logs. What was **not** tested: real phones, real cameras, Android/iPhone browsers, real wifi or hotspot, Bluetooth, NFC. In the Playwright run the camera is replaced by a debug box (visible in the scanner screen) that moves the same frame bytes between two browser contexts.

## Live demo script (2 to 3 people, about 5 minutes)
Roles: **Person A** (payer), **Person B** (payee), optionally **Person C** (cheater), and a **presenter** with a laptop on a projector.
1. Presenter: `./run.sh tunnel`, open `https://<tunnel>/#/admin`, sign in as `admin`, open **Live ledger** and select A and B (big numbers, labelled **TEST MONEY**). *Needs internet.*
2. A and B open the link on their phones, add to home screen, sign up (OTP `123456`, test KYC). A adds 50 points. The ledger animates: A's account drops by 51, A's slot shows 50. *Needs internet.*
3. **Both phones go to airplane mode.** Point out: the live ledger does not move from now on.
4. B opens **Receive** (shows a QR). A opens **Pay**, scans it, enters 10 and the PIN. Choose animated QR (or the wifi link if both are on one hotspot). A shows an animated code; B scans it; both screens show the same 2-digit code; B accepts; B shows a "received" code; A scans it. The beep means done. Phones show it pending; the ledger is still unchanged.
5. **Switch data back on.** Both phones sync by themselves. Only now the ledger animates: A's slot 50 to 40, B's receive slot 0 to 10. B can **Move money** to the account.
6. Cheater round (C optional): in **More, Security checks**, run the live checks and show forged, edited, old-month and fake-rules cases being caught. For the double spend, A pays B, and the presenter restores A's saved wallet copy to pay C with the same points; the dashboard **Same-ID log** shows the first claim paid, the second held, traced to A's device. The **Security logs** page only records; nobody can "resolve" it.
7. Say honestly: Play Integrity, App Attest, root detection, hardware counter and self-lock are for the native app; this web demo does the signatures, checks, QR and wifi link for real.

## Repo hygiene
No keys, databases or `.env` are committed (`.gitignore` covers `backend/data/`, `*.db`, `.env*`, `node_modules`, `dist`). `.env.example` has placeholders only. The shared test vectors use public test constants, not the server's seed. Hidden factor lists and real recipe values do not exist in the repo; they are derived at runtime from the seed.
