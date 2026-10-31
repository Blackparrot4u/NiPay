import { useEffect, useRef, useState } from 'react';
import { Btn, Card, Err, Notice, Title } from '../ui';
import { api } from '../lib/api';
import { go, errText } from '../ui';
import { get, set, useDevice } from '../lib/device';

export const CONSENT = 'I agree that this app takes my photo with the camera and sends it to the NiPay demo server, where it is kept as a file linked to my account for team demo use only. It is not shown to other users, not committed to any repository, and not used for face matching (that is not built). I can delete it at any time in More.';

/** Camera selfie at sign-up, linked to the account. Skippable. Stored only in the server's gitignored data folder. */
export function Selfie() {
  const d = useDevice(); const v = useRef<HTMLVideoElement>(null); const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false); const [shot, setShot] = useState<string | null>(null); const [ready, setReady] = useState(false);
  useEffect(() => {
    let st: MediaStream | null = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr('The camera needs HTTPS (or localhost). You can skip this step.'); return; }
      try { st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false }); v.current!.srcObject = st; await v.current!.play(); setReady(true); }
      catch { setErr('No camera access. You can skip this step.'); }
    })();
    return () => st?.getTracks().forEach((t) => t.stop());
  }, []);
  const capture = () => {
    const el = v.current!; const c = document.createElement('canvas'); c.width = 480; c.height = Math.round((480 * el.videoHeight) / el.videoWidth) || 360;
    c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height); setShot(c.toDataURL('image/jpeg', 0.8));
  };
  const save = async () => {
    try { await api('/selfie', { body: { image: shot, consent: true }, token: get().token }); set({ selfieDone: true }); go('/'); } catch (e) { setErr(errText(e)); }
  };
  return (
    <div className="space-y-3"><Title sub="Optional, for team demo use. Taken now, linked to your account.">Selfie</Title>
      {!shot ? <div className="rounded-xl overflow-hidden bg-black aspect-[4/3] max-w-sm mx-auto"><video ref={v} muted playsInline className="w-full h-full object-cover" /></div>
        : <img src={shot} alt="your selfie" className="rounded-xl max-w-sm mx-auto w-full" data-testid="selfie-preview" />}
      <Card className="space-y-2"><label className="flex gap-2 text-xs"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="selfie-consent" /> {CONSENT}</label></Card>
      <Err msg={err} />
      {!shot ? <Btn disabled={!ready || !consent} onClick={capture} data-testid="selfie-capture">Take photo</Btn> : <><Btn disabled={!consent} onClick={save} data-testid="selfie-save">Save to my account</Btn><Btn kind="ghost" onClick={() => setShot(null)}>Retake</Btn></>}
      <Btn kind="ghost" onClick={() => go('/')} data-testid="selfie-skip">Skip</Btn>
      <Notice>No face matching is built. The photo is only stored; {d.name || 'you'} can delete it in More.</Notice>
    </div>
  );
}
