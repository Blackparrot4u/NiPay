import { useEffect, useRef, useState } from 'react';
import { Badge, Btn, Card, Err, Field, Notice, Title, batteryPercent, beep, go, useT } from '../ui';
import { QrDisplay } from '../components/QrDisplay';
import { QrScanner } from '../components/QrScanner';
import { FrameAssembler, Message, decodeMessage, encodeMessage, toFrames } from '../lib/protocol';
import { randomBytes, b64, unb64 } from '../lib/crypto';
import { verifyReceipt } from '../lib/idsystem';
import { LinkSession, onlyMdns, expandSdp } from '../lib/link';
import { Held, MAX_QR_POINTS, acceptableMonths, checkPin, finishSpend, matchCode, prepareSpend, releaseInflight, spendable, useDevice } from '../lib/device';

type Card_ = { phone: string; name: string; pk: string; kyc: boolean; nonce: string };
type Step = 'card' | 'amount' | 'offer' | 'answer' | 'linking' | 'show' | 'scanReceipt' | 'done' | 'failed';
const MAX_LINK_POINTS = 500;

export function Pay() {
  const d = useDevice(); const t = useT();
  const [step, setStep] = useState<Step>('card');
  const [card, setCard] = useState<Card_ | null>(null);
  const [amount, setAmount] = useState('10'); const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null); const [note, setNote] = useState('');
  const [frames, setFrames] = useState<Uint8Array[]>([]);
  const [sent, setSent] = useState<{ pid: string; month: string; sig: Uint8Array; handover: Uint8Array }[]>([]);
  const [ref, setRef] = useState(''); const [transport, setTransport] = useState<'qr' | 'wifi-webrtc'>('qr');
  const [linkCode, setLinkCode] = useState('');
  const link = useRef<LinkSession | null>(null);
  const live = useRef({ ref: '', sent: [] as typeof sent, card: null as Card_ | null, transport: 'qr' as 'qr' | 'wifi-webrtc' });
  const asm = useRef(new FrameAssembler()); const [prog, setProg] = useState({ have: 0, total: 0 });
  const free = spendable().length;
  const code = transport === 'wifi-webrtc' ? linkCode : card && ref ? matchCode(ref, card.nonce) : '';
  useEffect(() => () => link.current?.destroy(), []);

  const onCard = (b: Uint8Array) => { const m = decodeMessage(b); if (m?.type === 'card') { setCard(m.meta); live.current.card = m.meta; setStep('amount'); } };

  /** Common checks before any points are touched. Returns the amount or null (error already shown). */
  const preflight = async (max: number): Promise<{ n: number; month: string } | null> => {
    setErr(null); const n = parseInt(amount, 10);
    const bat = await batteryPercent();
    if (bat !== null && bat < 3) { setErr(t('battery')); return null; }
    if (d.server?.offline_suspended || d.locked) { setErr(t('attention')); return null; }
    if (!checkPin(pin)) { setErr('Wrong PIN.'); return null; }
    if (!Number.isInteger(n) || n < 1) { setErr('Enter a whole amount of at least 1.'); return null; }
    if (n > max) { setErr(`At most ${max} points at a time on this path.`); return null; }
    const month = acceptableMonths().reverse().find((m) => spendable().filter((p) => p.month === m).length >= n);
    if (!month) { setErr(free < n ? `You hold only ${free} spendable points. Add points while online.` : 'Not enough points from one month. Add points while online.'); return null; }
    return { n, month };
  };
  const build = (n: number, month: string, tp: 'qr' | 'wifi-webrtc') => {
    const c = live.current.card!; const r = b64(randomBytes(6)).replace(/[^a-z0-9]/gi, 'x');
    let pts; try { pts = prepareSpend(n, c.phone, month); } catch { setErr(t('attention')); return null; }
    live.current = { ...live.current, ref: r, sent: pts, transport: tp };
    setRef(r); setSent(pts); setTransport(tp);
    return encodeMessage({ type: 'payment', meta: { ref: r, month, from: d.phone, fromName: d.name, to: c.phone, ts: Date.now(), pk: d.pub }, points: pts.map((p) => ({ pid: p.pid, sig: p.sig, handover: p.handover })) });
  };

  const startQr = async (fromFallback = false) => {
    const pf = await preflight(MAX_QR_POINTS); if (!pf) return;
    const msg = build(pf.n, pf.month, 'qr'); if (!msg) return;
    if (fromFallback) setNote('The wifi link did not open, so this payment continues with animated QR.');
    setFrames(toFrames(msg, 420)); setStep('show');
  };

  // ---------- wifi link path ----------
  const startLink = async () => {
    const pf = await preflight(MAX_LINK_POINTS); if (!pf) return;
    if (!card) return;
    setNote(''); setStep('offer');
    const ls = new LinkSession('payer', unb64(d.seed), unb64(d.pub)); link.current = ls;
    ls.onState = (s) => setLinkCode(ls.code);
    ls.onMessage = (b) => handleReply(b);
    const o = await ls.createOffer();
    if (onlyMdns(o.sdp)) setNote('This phone only offers mDNS (.local) addresses; the link may not open. QR will take over automatically.');
    setFrames(toFrames(encodeMessage({ type: 'offer', meta: o }), 420));
    if (localStorage.getItem('nipay:debug')) (window as any).__nipayLink = ls;
    ls.onState = (s) => {
      setLinkCode(ls.code);
      if (s === 'open' && (window as any).__nipayForgeOnOpen) ls.injectForgery(); // test hook: a third device injecting a frame
      if (s === 'authenticated') { const msg = build(pf.n, pf.month, 'wifi-webrtc'); if (msg) { ls.send(msg); setStep('linking'); } else ls.destroy(); }
      if (s === 'failed') { ls.destroy(); link.current = null; startQr(true); }
    };
  };
  const onAnswer = async (b: Uint8Array) => {
    if (!asm.current.add(b)) return; setProg(asm.current.progress); if (!asm.current.done()) return;
    const m = decodeMessage(asm.current.result()!); asm.current.reset();
    if (m?.type !== 'answer' || !link.current || !card) return;
    setStep('linking'); setNote('Opening the encrypted wifi link...');
    await link.current.finishOffer(m.meta, card.pk);
  };

  // ---------- receipts (same for both transports) ----------
  const handleReply = (bytes: Uint8Array) => {
    const m = decodeMessage(bytes); const { ref: r, sent: s, card: c, transport: tp } = live.current;
    if (!m || !c) return;
    if (m.type === 'refuse' && m.meta.ref === r) { releaseInflight(s.map((x) => x.pid)); link.current?.destroy(); setStep('failed'); return; }
    if (m.type !== 'receipt' || m.meta.ref !== r) return;
    const pk = unb64(c.pk); const good: Held[] = [];
    for (const rc of m.points) {
      const p = s.find((x) => x.pid === rc.pid);
      if (p && verifyReceipt(pk, p.month, p.pid, d.phone, rc.receipt))
        good.push({ pid: p.pid, month: p.month, sig: b64(p.sig), handover: b64(p.handover), receipt: b64(rc.receipt), peer: c.phone, peerName: c.name, ref: r, ts: Date.now(), synced: false, transport: tp });
    }
    if (!good.length) return;
    finishSpend(good); releaseInflight(s.filter((x) => !good.some((g) => g.pid === x.pid)).map((x) => x.pid));
    link.current?.destroy(); link.current = null;   // one payment per session: link and keys die here
    beep(); setStep('done');
  };
  const onReceiptFrame = (b: Uint8Array) => {
    if (!asm.current.add(b)) return; setProg(asm.current.progress); if (!asm.current.done()) return;
    const r = asm.current.result()!; asm.current.reset(); handleReply(r);
  };
  const cancelShow = () => { releaseInflight(sent.map((s) => s.pid)); link.current?.destroy(); setStep('amount'); };

  return (
    <div className="space-y-3">
      <Title back="/" sub="Works with the internet off. Camera needs HTTPS.">{t('pay')}</Title>
      {step === 'card' && (<>
        <p className="text-sm">1. Ask the other person to open <b>Receive</b>, then scan their code.</p>
        <QrScanner onBytes={onCard} hint="Scan the code on their Receive screen" />
        <Notice tone="sky">Pairing starts by QR. NFC tap is not available in a browser. Bluetooth is not used: browsers cannot act as a Bluetooth peripheral.</Notice>
      </>)}
      {step === 'amount' && card && (<>
        <Card className="space-y-1"><div className="flex justify-between"><b>{card.name}</b>{card.kyc && <Badge tone="green">KYC test-verified</Badge>}</div><p className="text-xs text-slate-500">{card.phone}</p></Card>
        <Field label="Amount (points = rupees)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`You hold ${free} spendable points.`} data-testid="pay-amount" />
        <Field label="PIN" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} data-testid="pay-pin" />
        <p className="text-xs text-slate-400">Biometric unlock is planned for the native app.</p>
        {note && <Notice>{note}</Notice>}<Err msg={err} />
        <Btn onClick={() => startQr()} data-testid="pay-start">Pay with animated QR (works with no wifi)</Btn>
        <Btn kind="ghost" onClick={startLink} data-testid="pay-link">Pay over encrypted wifi link (up to {MAX_LINK_POINTS} points)</Btn>
        <Notice tone="sky">Wifi link: both phones must be on the same wifi, or one phone's hotspot. A web page cannot create or join wifi for you, so join it by hand in Settings, or have the other phone scan a wifi QR (More, "Share wifi join code"). If the link fails it falls back to QR by itself.</Notice>
      </>)}
      {step === 'offer' && (<>
        <Card className="text-center space-y-1"><p className="font-semibold">Wifi link: step 1</p><p className="text-sm">Let them scan this on their Receive screen. It carries a one-time key.</p></Card>
        <QrDisplay frames={frames} />{note && <Notice>{note}</Notice>}
        <Btn onClick={() => { asm.current.reset(); setStep('answer'); }} data-testid="offer-next">They scanned it: scan their answer</Btn>
        <Btn kind="ghost" onClick={() => { link.current?.destroy(); setStep('amount'); }}>Back</Btn>
      </>)}
      {step === 'answer' && (<><p className="text-sm">Scan the answer code on their phone. {prog.total > 0 && <b>{prog.have}/{prog.total}</b>}</p><QrScanner onBytes={onAnswer} hint="Their screen shows the answer" /></>)}
      {step === 'linking' && (<Card className="text-center space-y-2"><p className="font-semibold">{t('hold')}</p><p className="text-sm">{note || 'Encrypted link open: sending signed points...'}</p>{linkCode && <p className="text-sm">Matching code <b className="text-2xl" data-testid="match-code">{linkCode}</b></p>}<p className="text-xs text-slate-500">Waiting for their signed "received"...</p></Card>)}
      {step === 'show' && (<>
        <Card className="text-center space-y-2"><p className="text-lg font-semibold">{t('hold')}</p><p className="text-sm text-slate-500">Matching code <b className="text-2xl" data-testid="match-code">{code}</b> must be the same on both screens.</p></Card>
        {note && <Notice>{note}</Notice>}<QrDisplay frames={frames} />
        <Btn onClick={() => { asm.current.reset(); setStep('scanReceipt'); }} data-testid="pay-next">They scanned it: scan their confirmation</Btn>
        <Btn kind="ghost" onClick={cancelShow}>Cancel (keeps my points)</Btn>
      </>)}
      {step === 'scanReceipt' && (<>
        <p className="text-sm">Scan the signed "received" code on their phone. {prog.total > 0 && <b>{prog.have}/{prog.total}</b>}</p>
        <QrScanner onBytes={onReceiptFrame} hint="Waiting for their confirmation" />
        <Notice>Your points stay locked until their signed receipt arrives. If it never does, do not pay again with the same points: sync and check history.</Notice>
        <Btn kind="ghost" onClick={() => setStep('show')}>Back to my code</Btn>
      </>)}
      {step === 'done' && (<Card className="text-center space-y-2"><p className="text-3xl">✓</p><p className="text-lg font-semibold">{t('success')}</p><p className="text-sm">Sent {sent.length} points to {card?.name} ({transport === 'qr' ? 'animated QR' : 'encrypted wifi link'}). New spendable balance: <b>{spendable().length}</b>.</p><p className="text-xs text-slate-500">It is pending until a phone syncs. Money moves when the logs reach the bank.</p><Btn onClick={() => go('/')}>Home</Btn></Card>)}
      {step === 'failed' && (<Card className="text-center space-y-2"><p className="text-lg font-semibold text-red-600">{t('failed')}</p><Btn onClick={() => go('/')}>Home</Btn></Card>)}
    </div>
  );
}
