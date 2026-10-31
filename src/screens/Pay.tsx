import { useEffect, useRef, useState } from 'react';
import { Badge, Btn, Card, Err, Field, Notice, Title, batteryPercent, beep, go, useT } from '../ui';
import { QrDisplay } from '../components/QrDisplay';
import { QrScanner } from '../components/QrScanner';
import { FrameAssembler, decodeMessage, encodeMessage, toFrames } from '../lib/protocol';
import { randomBytes, b64, unb64 } from '../lib/crypto';
import { verifyReceipt } from '../lib/idsystem';
import { LinkSession, onlyMdns } from '../lib/link';
import { Pipe, Progress } from '../lib/pipe';
import { checkLimit, PeerCard } from '../lib/peercheck';
import { Held, MAX_PAYMENT, acceptableMonths, finishSpend, mutualCheck, ownCard, prepareSpend, recordCross, releaseInflight, spendable, useDevice } from '../lib/device';
import { ConnectionMethods, ProgressBar } from './parts';
import { unlock, UnlockField } from '../lib/unlock';

type Step = 'card' | 'amount' | 'offer' | 'answer' | 'linking' | 'done' | 'failed' | 'danger' | 'lost';

/** Payer. The QR codes only set up the connection (card, offer, answer). Every point travels over the encrypted wifi/hotspot link. */
export function Pay() {
  const d = useDevice(); const t = useT();
  const [step, setStep] = useState<Step>('card'); const [connFail, setConnFail] = useState(false);
  const [card, setCard] = useState<PeerCard | null>(null); const peerCert = useRef<any>(null);
  const [amount, setAmount] = useState('10'); const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null); const [note, setNote] = useState('');
  const [frames, setFrames] = useState<Uint8Array[]>([]);
  const [prog, setProg] = useState<Progress | null>(null); const [scan, setScan] = useState({ have: 0, total: 0 });
  const [linkCode, setLinkCode] = useState(''); const [sentCount, setSentCount] = useState(0);
  const link = useRef<LinkSession | null>(null); const pipe = useRef(new Pipe());
  const live = useRef({ ref: '', sent: [] as { pid: string; month: string; sig: Uint8Array; handover: Uint8Array }[], card: null as PeerCard | null, finished: false, pending: null as null | { n: number; month: string } });
  const asm = useRef(new FrameAssembler());
  const free = spendable().length;
  useEffect(() => () => { link.current?.destroy(); }, []);

  const cardAsm = useRef(new FrameAssembler());
  const onCard = (b: Uint8Array) => {
    if (!cardAsm.current.add(b) || !cardAsm.current.done()) return;
    const m = decodeMessage(cardAsm.current.result()!); cardAsm.current.reset(); if (m?.type !== 'card') return;
    if (live.current.card?.nonce === m.meta.nonce) return;
    const out = mutualCheck(m.meta);             // automatic: the payee's certificate, rules month, flagged list, integrity signal
    if (!out.ok) { setStep(out.level === 'danger' ? 'danger' : 'failed'); return; }
    peerCert.current = out.cert; live.current.card = m.meta; setCard(m.meta); setStep('amount');
  };

  const preflight = async (): Promise<{ n: number; month: string } | null> => {
    setErr(null); const n = parseInt(amount, 10);
    const bat = await batteryPercent();
    if (bat !== null && bat < 3) { setErr(t('battery')); return null; }
    if (d.server?.offline_suspended || d.locked) { setErr(t('attention')); return null; }
    if (!(await unlock(pin))) { setErr('Wrong PIN.'); return null; }
    if (!Number.isInteger(n) || n < 1) { setErr('Enter a whole amount of at least 1.'); return null; }
    if (n > MAX_PAYMENT) { setErr(`At most ${MAX_PAYMENT} points in one payment.`); return null; }
    if (!checkLimit(peerCert.current, 'payee', n)) { recordCross(live.current.card, ['limit']); setStep('failed'); return null; }
    const month = acceptableMonths().reverse().find((m) => spendable().filter((p) => p.month === m).length >= n);
    if (!month) { setErr(free < n ? `You hold only ${free} spendable points. Add points while online.` : 'Not enough points from one month. Add points while online.'); return null; }
    return { n, month };
  };

  const buildPayment = (n: number, month: string) => {
    const c = live.current.card!; const r = b64(randomBytes(6)).replace(/[^a-z0-9]/gi, 'x');
    let pts; try { pts = prepareSpend(n, c.phone, month); } catch { setErr(t('attention')); return null; }
    live.current.ref = r; live.current.sent = pts; setSentCount(pts.length);
    return encodeMessage({ type: 'payment', meta: { ref: r, month, from: d.phone, fromName: d.name, to: c.phone, ts: Date.now(), pk: d.pub, pc: ownCard(b64(randomBytes(6))) }, points: pts.map((p: any) => ({ pid: p.pid, sig: p.sig, handover: p.handover })) });
  };

  const onReply = (id: string, bytes: Uint8Array) => {
    const m = decodeMessage(bytes); const { ref, sent, card: c } = live.current;
    if (!m || !c || live.current.finished) return;
    if (m.type === 'refuse' && m.meta.ref === ref) { releaseInflight(sent.map((x) => x.pid)); live.current.finished = true; link.current?.destroy(); setStep('failed'); return; }
    if (m.type !== 'receipt' || m.meta.ref !== ref) return;
    const pk = unb64(c.pk); const good: Held[] = [];
    for (const rc of m.points) {
      const p = sent.find((x) => x.pid === rc.pid);
      if (p && verifyReceipt(pk, p.month, p.pid, d.phone, rc.receipt))
        good.push({ pid: p.pid, month: p.month, sig: b64(p.sig), handover: b64(p.handover), receipt: b64(rc.receipt), peer: c.phone, peerName: c.name, ref, ts: Date.now(), synced: false, transport: 'wifi-webrtc' });
    }
    if (!good.length) return;
    live.current.finished = true;
    finishSpend(good); releaseInflight(sent.filter((x) => !good.some((g) => g.pid === x.pid)).map((x) => x.pid));
    setTimeout(() => { link.current?.destroy(); link.current = null; }, 800);   // one payment per session: link and keys die here
    beep(); setStep('done');
  };

  const start = async () => {
    const pf = live.current.pending ?? await preflight(); if (!pf || !card) return;
    live.current.pending = pf; setNote('');
    const ls = new LinkSession('payer', unb64(d.seed), unb64(d.pub)); link.current = ls; setStep('offer');
    const o = await ls.createOffer();
    if (onlyMdns(o.sdp)) setNote('This phone only offers mDNS (.local) addresses; the link may not open. Join the same hotspot and retry.');
    setFrames(toFrames(encodeMessage({ type: 'offer', meta: { ...o, pc: ownCard(b64(randomBytes(6))) } }), 420));
    if (localStorage.getItem('nipay:debug')) (window as any).__nipayLink = ls;
    ls.onState = (s) => {
      setLinkCode(ls.code);
      if (s === 'open' && (window as any).__nipayForgeOnOpen) ls.injectForgery();
      if (s === 'authenticated') {
        pipe.current.attach(ls); setStep('linking');
        if (!live.current.ref) { const msg = buildPayment(pf.n, pf.month); if (!msg) { ls.destroy(); return; } pipe.current.sendBlob(live.current.ref, msg); }
      }
      if (s === 'failed' && !live.current.finished) { ls.destroy(); link.current = null; if (live.current.ref) setStep('lost'); else { setConnFail(true); setStep('failed'); } }
    };
  };
  useEffect(() => {
    pipe.current.onProgress = (p) => setProg(p); pipe.current.onBlob = onReply;
  });
  const onAnswer = async (b: Uint8Array) => {
    if (!asm.current.add(b)) return; setScan(asm.current.progress); if (!asm.current.done()) return;
    const m = decodeMessage(asm.current.result()!); asm.current.reset();
    if (m?.type !== 'answer' || !link.current || !card) return;
    setStep('linking'); setNote('Opening the encrypted wifi link...');
    await link.current.finishOffer(m.meta, card.pk);
  };
  const retry = () => { setErr(null); setConnFail(false); setStep('amount'); void start(); };
  const cancel = () => { releaseInflight(live.current.sent.map((s) => s.pid)); link.current?.destroy(); pipe.current.reset(); live.current.ref = ''; live.current.pending = null; setStep('amount'); };

  return (
    <div className="space-y-3">
      <Title back="/" sub="Works with the internet off. The QR only sets up the connection; the points travel over the encrypted wifi or hotspot link.">{t('pay')}</Title>
      {step === 'card' && (<>
        <p className="text-sm">1. Ask the other person to open <b>Receive</b>, then scan their code. Their phone and yours check each other automatically.</p>
        <QrScanner onBytes={onCard} hint="Scan the code on their Receive screen" />
        <Notice tone="sky">Both phones must be on the same wifi, or one phone's hotspot.</Notice>
      </>)}
      {step === 'amount' && card && (<>
        <Card className="space-y-1"><div className="flex justify-between"><b>{card.name}</b><Badge tone="green">checked: certificate, rules, integrity</Badge></div><p className="text-xs text-slate-500">{card.phone}</p></Card>
        <Field label="Amount (points = rupees)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`You hold ${free} spendable points. Up to ${MAX_PAYMENT} in one payment.`} data-testid="pay-amount" />
        <UnlockField pin={pin} setPin={setPin} testid="pay-pin" />
        {note && <Notice>{note}</Notice>}<Err msg={err} />
        <ConnectionMethods />
        <Btn onClick={start} data-testid="pay-link">Connect and pay</Btn>
      </>)}
      {step === 'offer' && (<>
        <Card className="text-center space-y-1"><p className="font-semibold">Connection: step 1</p><p className="text-sm">Let them scan this on their Receive screen. It carries a one-time key.</p></Card>
        <QrDisplay frames={frames} />{note && <Notice>{note}</Notice>}
        <Btn onClick={() => { asm.current.reset(); setStep('answer'); }} data-testid="offer-next">They scanned it: scan their answer</Btn>
        <Btn kind="ghost" onClick={cancel}>Back</Btn>
      </>)}
      {step === 'answer' && (<><p className="text-sm">Scan the answer code on their phone. {scan.total > 0 && <b>{scan.have}/{scan.total}</b>}</p><QrScanner onBytes={onAnswer} hint="Their screen shows the answer" /></>)}
      {step === 'linking' && (<Card className="text-center space-y-2"><p className="font-semibold">{t('hold')}</p><p className="text-sm">{note || 'Encrypted link open: sending signed points...'}</p>
        {linkCode && <p className="text-sm">Matching code <b className="text-2xl" data-testid="match-code">{linkCode}</b></p>}
        <ProgressBar p={prog} label="Sending" /><p className="text-xs text-slate-500">Waiting for their signed "received"...</p></Card>)}
      {step === 'lost' && (<Card className="space-y-2 text-center"><p className="font-semibold text-amber-700">Connection lost</p><p className="text-sm">Join the same hotspot or wifi as the other phone and retry. The transfer continues where it stopped ({prog ? `${prog.done}/${prog.total} parts` : 'progress kept'}).</p><Btn onClick={retry} data-testid="pay-retry">Retry connection</Btn><Btn kind="ghost" onClick={cancel}>Cancel (keeps my points)</Btn></Card>)}
      {step === 'done' && (<Card className="text-center space-y-2"><p className="text-3xl">✓</p><p className="text-lg font-semibold">{t('success')}</p><p className="text-sm">Sent {sentCount} points to {card?.name} over the encrypted wifi link. New spendable balance: <b>{spendable().length}</b>.</p><p className="text-xs text-slate-500">It is pending until a phone syncs. Money moves when the logs reach the bank.</p><Btn onClick={() => go('/')}>Home</Btn></Card>)}
      {step === 'failed' && (<Card className="text-center space-y-2"><p className="text-lg font-semibold text-red-600">{t('failed')}</p>
        {!connFail ? null : <p className="text-sm text-slate-600" data-testid="conn-failed">If the connection did not open: connection failed, join the same hotspot or wifi on both phones and retry.</p>}
        {live.current.pending && <Btn onClick={retry} data-testid="pay-retry">Retry connection</Btn>}<Btn kind="ghost" onClick={() => go('/')}>Home</Btn></Card>)}
      {step === 'danger' && (<Card className="space-y-3 border-red-300 bg-red-50 text-center"><p className="text-4xl">⚠</p><p className="font-semibold text-red-700">{t('danger')}</p><p className="text-sm text-red-700">{t('failed')}</p><Btn onClick={() => go('/')}>Home</Btn></Card>)}
    </div>
  );
}
