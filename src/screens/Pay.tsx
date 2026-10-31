import { useMemo, useRef, useState } from 'react';
import { Badge, Btn, Card, Err, Field, Notice, Title, batteryPercent, beep, go, useT } from '../ui';
import { QrDisplay } from '../components/QrDisplay';
import { QrScanner } from '../components/QrScanner';
import { FrameAssembler, Message, decodeMessage, encodeMessage, toFrames } from '../lib/protocol';
import { randomBytes, b64, unb64 } from '../lib/crypto';
import { verifyReceipt } from '../lib/idsystem';
import { Held, MAX_QR_POINTS, acceptableMonths, checkPin, currentMonth, finishSpend, matchCode, prepareSpend, releaseInflight, spendable, useDevice } from '../lib/device';

type Card_ = { phone: string; name: string; pk: string; kyc: boolean; nonce: string };

export function Pay() {
  const d = useDevice(); const t = useT();
  const [step, setStep] = useState<'card' | 'amount' | 'show' | 'scanReceipt' | 'done' | 'failed'>('card');
  const [card, setCard] = useState<Card_ | null>(null);
  const [amount, setAmount] = useState('10'); const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [frames, setFrames] = useState<Uint8Array[]>([]);
  const [sent, setSent] = useState<{ pid: string; month: string; sig: Uint8Array; handover: Uint8Array }[]>([]);
  const [ref, setRef] = useState('');
  const asm = useRef(new FrameAssembler()); const [prog, setProg] = useState({ have: 0, total: 0 });
  const free = spendable().length;
  const code = card && ref ? matchCode(ref, card.nonce) : '';

  const onCard = (b: Uint8Array) => {
    const m = decodeMessage(b);
    if (m?.type === 'card') { setCard(m.meta); setStep('amount'); }
  };
  const start = async () => {
    setErr(null);
    const n = parseInt(amount, 10);
    if (!card) return;
    const bat = await batteryPercent();
    if (bat !== null && bat < 3) return setErr(t('battery'));
    if (d.server?.offline_suspended) return setErr(t('attention'));
    if (!checkPin(pin)) return setErr('Wrong PIN.');
    if (!Number.isInteger(n) || n < 1) return setErr('Enter a whole amount of at least 1.');
    if (n > MAX_QR_POINTS) return setErr(`Over QR we send at most ${MAX_QR_POINTS} points at a time (more would take too long to scan).`);
    const months = acceptableMonths().reverse();
    const month = months.find((m) => spendable().filter((p) => p.month === m).length >= n);
    if (!month) return setErr(free < n ? `You hold only ${free} spendable points. Add points while online.` : 'Not enough points from one month. Add points while online.');
    if (!acceptableMonths().includes(month)) return setErr('Wallet expired: go online once.');
    const r = b64(randomBytes(6)).replace(/[^a-z0-9]/gi, 'x');
    const pts = prepareSpend(n, card.phone, month);
    const msg: Message = { type: 'payment', meta: { ref: r, month, from: d.phone, fromName: d.name, to: card.phone, ts: Date.now(), pk: d.pub }, points: pts.map((p) => ({ pid: p.pid, sig: p.sig, handover: p.handover })) };
    setRef(r); setSent(pts); setFrames(toFrames(encodeMessage(msg), 420)); setStep('show');
  };
  const onReceipt = (b: Uint8Array) => {
    if (!asm.current.add(b)) return;
    setProg(asm.current.progress);
    if (!asm.current.done()) return;
    const m = decodeMessage(asm.current.result()!);
    asm.current.reset();
    if (!m || !card) return;
    if (m.type === 'refuse' && m.meta.ref === ref) { releaseInflight(sent.map((s) => s.pid)); setStep('failed'); return; }
    if (m.type !== 'receipt' || m.meta.ref !== ref) return;
    const pk = unb64(card.pk);
    const good: Held[] = [];
    for (const r of m.points) {
      const p = sent.find((x) => x.pid === r.pid);
      if (p && verifyReceipt(pk, p.month, p.pid, d.phone, r.receipt))
        good.push({ pid: p.pid, month: p.month, sig: b64(p.sig), handover: b64(p.handover), receipt: b64(r.receipt), peer: card.phone, peerName: card.name, ref, ts: Date.now(), synced: false, transport: 'qr' });
    }
    if (!good.length) return;
    finishSpend(good);
    releaseInflight(sent.filter((s) => !good.some((g) => g.pid === s.pid)).map((s) => s.pid));
    beep(); setStep('done');
  };
  const cancelShow = () => { releaseInflight(sent.map((s) => s.pid)); setStep('amount'); };

  return (
    <div className="space-y-3">
      <Title back="/" sub="Works with the internet off. Camera needs HTTPS.">{t('pay')}</Title>
      {step === 'card' && (<>
        <p className="text-sm">1. Ask the other person to open <b>Receive</b>, then scan their code.</p>
        <QrScanner onBytes={onCard} hint="Scan the code on their Receive screen" />
        <Notice tone="sky">Pairing by QR. NFC tap and a Bluetooth/wifi link are not available in this browser demo.</Notice>
      </>)}
      {step === 'amount' && card && (<>
        <Card className="space-y-1"><div className="flex justify-between"><b>{card.name}</b>{card.kyc && <Badge tone="green">KYC test-verified</Badge>}</div><p className="text-xs text-slate-500">{card.phone}</p></Card>
        <Field label="Amount (points = rupees)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} hint={`You hold ${free} spendable points.`} data-testid="pay-amount" />
        <Field label="PIN" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} data-testid="pay-pin" />
        <p className="text-xs text-slate-400">Biometric unlock is planned for the native app.</p>
        <Err msg={err} /><Btn onClick={start} data-testid="pay-start">Show payment code</Btn>
      </>)}
      {step === 'show' && (<>
        <Card className="text-center space-y-2"><p className="text-lg font-semibold">{t('hold')}</p><p className="text-sm text-slate-500">Matching code <b className="text-2xl" data-testid="match-code">{code}</b> must be the same on both screens.</p></Card>
        <QrDisplay frames={frames} />
        <Btn onClick={() => { asm.current.reset(); setStep('scanReceipt'); }} data-testid="pay-next">They scanned it: scan their confirmation</Btn>
        <Btn kind="ghost" onClick={cancelShow}>Cancel (keeps my points)</Btn>
      </>)}
      {step === 'scanReceipt' && (<>
        <p className="text-sm">Scan the signed "received" code on their phone. {prog.total > 0 && <b>{prog.have}/{prog.total}</b>}</p>
        <QrScanner onBytes={onReceipt} hint="Waiting for their confirmation" />
        <Notice>Your points stay locked until their signed receipt arrives. If it never does, do not pay again with the same points: sync and check history.</Notice>
        <Btn kind="ghost" onClick={() => setStep('show')}>Back to my code</Btn>
      </>)}
      {step === 'done' && (<Card className="text-center space-y-2"><p className="text-3xl">✓</p><p className="text-lg font-semibold">{t('success')}</p><p className="text-sm">Sent {sent.length} points to {card?.name}. New spendable balance: <b>{spendable().length}</b>.</p><p className="text-xs text-slate-500">It is pending until a phone syncs. Money moves when the logs reach the bank.</p><Btn onClick={() => go('/')}>Home</Btn></Card>)}
      {step === 'failed' && (<Card className="text-center space-y-2"><p className="text-lg font-semibold text-red-600">{t('failed')}</p><Btn onClick={() => go('/')}>Home</Btn></Card>)}
    </div>
  );
}
