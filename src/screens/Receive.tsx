import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Btn, Card, Notice, Title, batteryPercent, beep, go, useT } from '../ui';
import { QrDisplay } from '../components/QrDisplay';
import { QrScanner } from '../components/QrScanner';
import { FrameAssembler, Message, decodeMessage, encodeMessage, toFrames } from '../lib/protocol';
import { b64, randomBytes, unb64, verify } from '../lib/crypto';
import { signReceipt } from '../lib/idsystem';
import { LinkSession } from '../lib/link';
import { Pipe, Progress } from '../lib/pipe';
import { checkLimit } from '../lib/peercheck';
import { Held, checkIncoming, layerToTripwire, mutualCheck, ownCard, queueReport, recordCross, storeReceived, useDevice } from '../lib/device';
import { ProgressBar } from './parts';

type Step = 'card' | 'scan' | 'answer' | 'receiving' | 'review' | 'show' | 'danger' | 'failed' | 'lost' | 'refused';

/** Payee. QR codes only set up the connection; the payment and the signed receipt arrive over the encrypted link. */
export function Receive() {
  const d = useDevice(); const t = useT();
  const nonce = useMemo(() => b64(randomBytes(6)), []);
  const [step, setStep] = useState<Step>('card');
  const link = useRef<LinkSession | null>(null); const pipe = useRef(new Pipe());
  const [linkInfo, setLinkInfo] = useState({ code: '', state: '', rejected: 0 });
  const asm = useRef(new FrameAssembler()); const [scan, setScan] = useState({ have: 0, total: 0 });
  const [pay, setPay] = useState<Extract<Message, { type: 'payment' }> | null>(null);
  const [frames, setFrames] = useState<Uint8Array[]>([]); const [info, setInfo] = useState('');
  const [prog, setProg] = useState<Progress | null>(null);
  const peer = useRef<{ cert: any; dpk: string } | null>(null); const started = useRef(false);
  const cardMsg = useMemo(() => [encodeMessage({ type: 'card', meta: ownCard(nonce) })], [d.phone, d.name, d.pub, d.cert, nonce]);
  const cardFrames = useMemo(() => toFrames(cardMsg[0], 420), [cardMsg]);
  useEffect(() => () => link.current?.destroy(), []);
  const fail = (level: 'plain' | 'danger') => { link.current?.destroy(); setStep(level === 'danger' ? 'danger' : 'failed'); };

  const onFrame = async (b: Uint8Array) => {
    if (!asm.current.add(b)) return;
    setScan(asm.current.progress);
    if (!asm.current.done()) return;
    const m = decodeMessage(asm.current.result()!); asm.current.reset();
    if (m?.type === 'offer') await handleOffer(m.meta);
  };
  const handleOffer = async (o: Extract<Message, { type: 'offer' }>['meta']) => {
    if (link.current) return;
    // mutual check, automatic, before the link even opens: the payer's certificate, rules month, flagged list, integrity signal
    const out = mutualCheck(o.pc && o.pc.pk === o.dpk ? o.pc : null);
    if (!out.ok) { setStep(out.level === 'danger' ? 'danger' : 'failed'); return; }
    peer.current = { cert: out.cert, dpk: o.dpk };
    const ls = new LinkSession('payee', unb64(d.seed), unb64(d.pub)); link.current = ls;
    const upd = () => setLinkInfo({ code: ls.code, state: ls.state, rejected: ls.rejected });
    ls.onState = (st) => {
      upd();
      if (st === 'authenticated') { pipe.current.attach(ls); setStep((s) => (s === 'answer' ? 'receiving' : s)); }
      if (st === 'failed' && !done.current) { ls.destroy(); link.current = null; setStep(started.current ? 'lost' : 'failed'); setInfo('connection failed, join the same hotspot or wifi on both phones and ask the payer to retry'); }
    };
    const timer = setInterval(upd, 700); const prevDestroy = ls.destroy.bind(ls); ls.destroy = () => { clearInterval(timer); prevDestroy(); };
    try { const ans = await ls.acceptOffer(o); setFrames(toFrames(encodeMessage({ type: 'answer', meta: ans }), 420)); setStep('answer'); } catch { setInfo('Could not start the wifi link on this phone.'); setStep('failed'); }
  };
  const done = useRef(false);
  useEffect(() => {
    pipe.current.onProgress = (p) => { started.current = true; setProg(p); };
    pipe.current.onBlob = (_id, bytes) => { const m = decodeMessage(bytes); if (m?.type === 'payment' && peer.current && m.meta.pk === peer.current.dpk) void handlePayment(m); };
  });
  const handlePayment = async (m: Extract<Message, { type: 'payment' }>) => {
    // ---- every check runs here, in the browser, with the bank public key and signed rules, no internet ----
    const bat = await batteryPercent();
    const chk = checkIncoming(m.points, m.meta.month);
    const pk = unb64(m.meta.pk);
    const badHandover = m.points.filter((p) => !verify(pk, `${m.meta.month}|${p.pid}|${d.phone}`, p.handover));
    const cap = (d.server?.receive_bucket ?? 0) + d.received.filter((r) => !r.synced).length + m.points.length > (d.server?.receive_limit ?? peer.current?.cert?.lr ?? Infinity) /* limit comes from the server or the signed certificate; unknown means no local cap */;
    const overSend = !checkLimit(peer.current?.cert, 'payer', m.points.length);
    const bad = !chk.ok || m.meta.to !== d.phone || badHandover.length > 0 || cap || overSend || (bat !== null && bat < 3) || m.points.length === 0;
    if (bad) {
      for (const f of chk.failed.slice(0, 5)) queueReport(layerToTripwire(f.layer), f.pid, `receiving check failed at layer ${f.layer}`);
      if (badHandover.length) queueReport('forged', badHandover[0].pid, 'handover not signed for me');
      if (overSend) recordCross(m.meta.pc ?? null, ['limit']);
      link.current?.destroy(); setStep(chk.ok && !badHandover.length ? 'failed' : 'danger'); return;
    }
    setPay(m); setStep('review');
  };
  const accept = () => {
    if (!pay) return;
    const seed = unb64(d.seed);
    const items: Held[] = pay.points.map((p) => ({ pid: p.pid, month: pay.meta.month, sig: b64(p.sig), handover: b64(p.handover), receipt: b64(signReceipt(seed, pay.meta.month, p.pid, pay.meta.from)), peer: pay.meta.from, peerName: pay.meta.fromName, ref: pay.meta.ref, ts: Date.now(), synced: false, transport: 'wifi-webrtc' }));
    storeReceived(items);
    done.current = true;
    pipe.current.sendBlob(pay.meta.ref + 'r', encodeMessage({ type: 'receipt', meta: { ref: pay.meta.ref, from: pay.meta.from, to: d.phone, ts: Date.now() }, points: items.map((i) => ({ pid: i.pid, receipt: unb64(i.receipt) })) }));
    pipe.current.onAck = () => setTimeout(() => { link.current?.destroy(); link.current = null; }, 600);
    beep(); setStep('show');
  };
  const refuse = () => {
    if (pay) { done.current = true; pipe.current.sendBlob(pay.meta.ref + 'r', encodeMessage({ type: 'refuse', meta: { ref: pay.meta.ref, reason: 'refused' } })); }
    setStep('refused');
  };

  return (
    <div className="space-y-3">
      <Title back="/" sub="Works with the internet off. The QR only sets up the connection.">{t('receive')}</Title>
      {step === 'card' && (<>
        <Card className="text-center space-y-1"><p className="text-sm">Show this to the person paying you</p><QrDisplay frames={cardFrames} size={240} /><p className="font-semibold">{d.name}</p></Card>
        {!d.cert && <Notice>This phone has no bank certificate yet. Go online once (it syncs by itself) so the other phone can check you.</Notice>}
        {info && <Notice>{info}</Notice>}
        <Btn onClick={() => { asm.current.reset(); setStep('scan'); }} data-testid="rcv-scan">They scanned me: scan their connection code</Btn>
      </>)}
      {step === 'scan' && (<>
        <p className="text-sm">Scan the connection code on their phone. {scan.total > 0 && <b data-testid="rcv-prog">{scan.have}/{scan.total}</b>}</p>
        <QrScanner onBytes={onFrame} hint="Hold steady until it reaches the end" />
        <Btn kind="ghost" onClick={() => setStep('card')}>Back</Btn>
      </>)}
      {step === 'answer' && (<>
        <Card className="text-center space-y-1"><p className="font-semibold">Connection: step 2</p><p className="text-sm">Let the payer scan this answer. The link opens by itself.</p><p className="text-xs text-slate-500" data-testid="link-state">Link: {linkInfo.state || 'connecting'} · rejected frames: <span data-testid="link-rejected">{linkInfo.rejected}</span></p></Card>
        <QrDisplay frames={frames} />{info && <Notice>{info}</Notice>}
        <Btn kind="ghost" onClick={() => { link.current?.destroy(); link.current = null; setStep('card'); }}>Cancel</Btn>
      </>)}
      {step === 'receiving' && (<Card className="text-center space-y-2"><p className="font-semibold">Receiving over the encrypted link</p>{linkInfo.code && <p className="text-sm">Matching code <b className="text-2xl" data-testid="match-code-wait">{linkInfo.code}</b></p>}<ProgressBar p={prog} label="Receiving" /></Card>)}
      {step === 'review' && pay && (<>
        <Card className="space-y-2"><p className="text-sm text-slate-500">Incoming payment</p><p className="text-3xl font-bold" data-testid="rcv-amount">{pay.points.length} points</p>
          <p className="text-sm">From <b>{pay.meta.fromName}</b> ({pay.meta.from}) <Badge tone="green">mutual check passed</Badge></p>
          <p className="text-sm">Matching code <b className="text-2xl" data-testid="match-code">{linkInfo.code}</b></p>
          <p className="text-xs text-slate-500">Frames rejected by the link (wrong key, tampered, replayed): <span data-testid="link-rejected">{linkInfo.rejected}</span></p>
          <p className="text-xs text-slate-500">Checked on this phone: their bank certificate (limit, expiry, signed trust), rules month, integrity signal, and every point's bank signature, tower shape, landmines, flagged IDs and signed handover.</p></Card>
        <Notice>{t('hold')}. These points cannot be spent offline: move them to your account after you sync.</Notice>
        <Btn onClick={accept} data-testid="rcv-accept">Accept</Btn><Btn kind="ghost" onClick={refuse}>Refuse</Btn>
      </>)}
      {step === 'show' && (<>
        <Card className="text-center space-y-2"><p className="text-lg font-semibold">{t('hold')}</p><p className="text-sm">Sending your signed "received" over the encrypted link.</p><ProgressBar p={prog} label="Sending receipt" /></Card>
        <Btn onClick={() => go('/')} data-testid="rcv-done">Done</Btn>
      </>)}
      {step === 'lost' && (<Card className="space-y-2 text-center"><p className="font-semibold text-amber-700">Connection lost</p><p className="text-sm">Join the same hotspot or wifi as the payer, then scan their new connection code. Parts already received are kept.</p><Btn onClick={() => { asm.current.reset(); setStep('scan'); }} data-testid="rcv-reconnect">Scan their new code</Btn></Card>)}
      {step === 'refused' && (<><p className="text-sm text-center">Refusal sent. The payer's phone releases the points.</p><Btn onClick={() => go('/')}>Home</Btn></>)}
      {step === 'failed' && (<Card className="space-y-3 text-center"><p className="text-lg font-semibold text-red-600">{t('failed')}</p>{info && <p className="text-sm text-slate-600" data-testid="conn-failed">{info}</p>}<Btn onClick={() => go('/')}>Home</Btn></Card>)}
      {step === 'danger' && (
        <Card className="space-y-3 border-red-300 bg-red-50 text-center">
          <p className="text-4xl">⚠</p><p className="font-semibold text-red-700">{t('danger')}</p><p className="text-sm text-red-700">{t('failed')}</p>
          <p className="text-xs text-slate-500">The reason is not shown. A report will reach the bank at your next sync.</p><Btn onClick={() => go('/')}>Home</Btn></Card>
      )}
    </div>
  );
}
