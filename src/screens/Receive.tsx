import { useMemo, useRef, useState } from 'react';
import { Badge, Btn, Card, Notice, Title, batteryPercent, beep, go, useT } from '../ui';
import { QrDisplay } from '../components/QrDisplay';
import { QrScanner } from '../components/QrScanner';
import { FrameAssembler, Message, decodeMessage, encodeMessage, toFrames } from '../lib/protocol';
import { b64, randomBytes, unb64, verify } from '../lib/crypto';
import { signReceipt } from '../lib/idsystem';
import { Held, checkIncoming, layerToTripwire, matchCode, queueReport, storeReceived, useDevice } from '../lib/device';

export function Receive() {
  const d = useDevice(); const t = useT();
  const nonce = useMemo(() => b64(randomBytes(6)), []);
  const [step, setStep] = useState<'card' | 'scan' | 'review' | 'show' | 'danger' | 'refused'>('card');
  const asm = useRef(new FrameAssembler()); const [prog, setProg] = useState({ have: 0, total: 0 });
  const [pay, setPay] = useState<Extract<Message, { type: 'payment' }> | null>(null);
  const [frames, setFrames] = useState<Uint8Array[]>([]);
  const [info, setInfo] = useState('');
  const cardMsg = useMemo(() => [encodeMessage({ type: 'card', meta: { phone: d.phone, name: d.name, pk: d.pub, kyc: true, nonce } })], [d.phone, d.name, d.pub, nonce]);

  const onFrame = async (b: Uint8Array) => {
    if (!asm.current.add(b)) return;
    setProg(asm.current.progress);
    if (!asm.current.done()) return;
    const m = decodeMessage(asm.current.result()!);
    asm.current.reset();
    if (!m || m.type !== 'payment') return;
    // ---- every check runs here, in the browser, with the bank public key and signed rules, no internet ----
    const bat = await batteryPercent();
    const chk = checkIncoming(m.points, m.meta.month);
    const pk = unb64(m.meta.pk);
    const badHandover = m.points.filter((p) => !verify(pk, `${m.meta.month}|${p.pid}|${d.phone}`, p.handover));
    const cap = (d.server?.receive_bucket ?? 0) + d.received.filter((r) => !r.synced).length + m.points.length > (d.server?.receive_limit ?? 10000);
    const fail = !chk.ok || m.meta.to !== d.phone || badHandover.length > 0 || cap || (bat !== null && bat < 3) || m.points.length === 0;
    if (fail) {
      for (const f of chk.failed.slice(0, 5)) queueReport(layerToTripwire(f.layer), f.pid, `receiving check failed at layer ${f.layer}`);
      if (badHandover.length) queueReport('forged', badHandover[0].pid, 'handover not signed for me');
      setInfo(''); setStep('danger'); return;
    }
    setPay(m); setStep('review');
  };
  const accept = () => {
    if (!pay) return;
    const seed = unb64(d.seed);
    const items: Held[] = pay.points.map((p) => ({ pid: p.pid, month: pay.meta.month, sig: b64(p.sig), handover: b64(p.handover), receipt: b64(signReceipt(seed, pay.meta.month, p.pid, pay.meta.from)), peer: pay.meta.from, peerName: pay.meta.fromName, ref: pay.meta.ref, ts: Date.now(), synced: false, transport: 'qr' }));
    storeReceived(items);
    const rc = encodeMessage({ type: 'receipt', meta: { ref: pay.meta.ref, from: pay.meta.from, to: d.phone, ts: Date.now() }, points: items.map((i) => ({ pid: i.pid, receipt: unb64(i.receipt) })) });
    setFrames(toFrames(rc, 420)); beep(); setStep('show');
  };
  const refuse = () => {
    if (pay) setFrames([encodeMessage({ type: 'refuse', meta: { ref: pay.meta.ref, reason: 'refused' } })]);
    setStep('refused');
  };
  const code = pay ? matchCode(pay.meta.ref, nonce) : '';

  return (
    <div className="space-y-3">
      <Title back="/" sub="Works with the internet off.">{t('receive')}</Title>
      {step === 'card' && (<>
        <Card className="text-center space-y-1"><p className="text-sm">Show this to the person paying you</p><QrDisplay frames={cardMsg} size={240} /><p className="font-semibold">{d.name} <Badge tone="green">KYC test-verified</Badge></p></Card>
        <Btn onClick={() => { asm.current.reset(); setStep('scan'); }} data-testid="rcv-scan">They scanned me: scan their payment code</Btn>
      </>)}
      {step === 'scan' && (<>
        <p className="text-sm">Scan the animated code on their phone. {prog.total > 0 && <b data-testid="rcv-prog">{prog.have}/{prog.total}</b>}</p>
        <QrScanner onBytes={onFrame} hint="Hold steady until it reaches the end" />
        <Btn kind="ghost" onClick={() => setStep('card')}>Back</Btn>
      </>)}
      {step === 'review' && pay && (<>
        <Card className="space-y-2"><p className="text-sm text-slate-500">Incoming payment</p><p className="text-3xl font-bold" data-testid="rcv-amount">{pay.points.length} points</p>
          <p className="text-sm">From <b>{pay.meta.fromName}</b> ({pay.meta.from}) <Badge tone="green">checks passed</Badge></p>
          <p className="text-sm">Matching code <b className="text-2xl" data-testid="match-code">{code}</b></p>
          <p className="text-xs text-slate-500">Checked on this phone: bank signature, tower shape, landmines, flagged IDs, signed handover.</p></Card>
        <Notice>{t('hold')}. These points cannot be spent offline: move them to your account after you sync.</Notice>
        <Btn onClick={accept} data-testid="rcv-accept">Accept</Btn><Btn kind="ghost" onClick={refuse}>Refuse</Btn>
      </>)}
      {step === 'show' && (<>
        <Card className="text-center"><p className="text-lg font-semibold">{t('hold')}</p><p className="text-sm">Let the payer scan this signed "received" code.</p></Card>
        <QrDisplay frames={frames} />
        <Btn onClick={() => go('/')} data-testid="rcv-done">Done</Btn>
      </>)}
      {step === 'refused' && (<><QrDisplay frames={frames} size={200} /><p className="text-sm text-center">Show this so the payer's phone releases the points.</p><Btn onClick={() => go('/')}>Home</Btn></>)}
      {step === 'danger' && (
        <Card className="space-y-3 border-red-300 bg-red-50 text-center">
          <p className="text-4xl">⚠</p><p className="font-semibold text-red-700">{t('danger')}</p><p className="text-sm text-red-700">{t('failed')}</p>
          <p className="text-xs text-slate-500">The reason is not shown. A report will reach the bank at your next sync.</p><Btn onClick={() => go('/')}>Home</Btn></Card>
      )}
    </div>
  );
}
