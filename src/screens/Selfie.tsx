import { useEffect, useRef, useState } from 'react';
import { Btn, Card, Err, Notice, Title } from '../ui';
import { api } from '../lib/api';
import { go, errText } from '../ui';
import { get, set, useDevice } from '../lib/device';
import { CameraError, describeCameraError, openCamera, startVideo } from '../lib/camera';

export const CONSENT = 'I agree that this app takes my photo with the camera and sends it to the NiPay demo server, where it is kept as a file linked to my account for team demo use only. It is not shown to other users, not committed to any repository, and not used for face matching (that is not built). I can delete it at any time in Settings.';

/** Camera selfie at sign-up, linked to the account. Always skippable; a camera problem shows its real error and can be retried. */
export function Selfie() {
  const d = useDevice(); const v = useRef<HTMLVideoElement>(null);
  const [camErr, setCamErr] = useState<CameraError | null>(null); const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false); const [shot, setShot] = useState<string | null>(null);
  const [ready, setReady] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (shot) return;
    let cancelled = false; let stream: MediaStream | null = null;
    setReady(false); setCamErr(null);
    (async () => {
      try {
        stream = await openCamera('user', 640);
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }   // unmounted (or React strict-mode re-run) while the browser was asking: never leave the camera held
        await startVideo(v.current!, stream);
        if (!cancelled) setReady(true);
      } catch (e: any) {
        stream?.getTracks().forEach((t) => t.stop());
        if (!cancelled) { console.warn('selfie camera failed', e?.name, e?.message); setCamErr(describeCameraError(e)); }
      }
    })();
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); if (v.current) v.current.srcObject = null; };
  }, [attempt, shot]);
  const capture = () => {
    const el = v.current!; if (!el.videoWidth) { setErr('The picture is not ready yet. Wait a second and try again.'); return; }
    const c = document.createElement('canvas'); c.width = 480; c.height = Math.round((480 * el.videoHeight) / el.videoWidth) || 360;
    c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height); setShot(c.toDataURL('image/jpeg', 0.8)); setErr(null);
  };
  const save = async () => {
    try { await api('/selfie', { body: { image: shot, consent: true }, token: get().token }); set({ selfieDone: true }); go('/'); } catch (e) { setErr(errText(e)); }
  };
  return (
    <div className="space-y-4 max-w-xl mx-auto"><Title sub="Optional, for team demo use. Taken now, linked to your account.">Selfie</Title>
      {!shot ? (
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] max-w-md mx-auto border border-slate-200">
          <video ref={v} muted playsInline autoPlay className="w-full h-full object-cover [transform:scaleX(-1)]" />
          {!ready && !camErr && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80" data-testid="selfie-starting">Starting the camera... allow it if the browser asks.</p>}
        </div>
      ) : <img src={shot} alt="your selfie" className="rounded-2xl max-w-md mx-auto w-full border border-slate-200" data-testid="selfie-preview" />}
      {camErr && (
        <Card className="space-y-2 border-red-200 bg-red-50" >
          <p className="text-sm font-semibold text-red-700" data-testid="selfie-error">Camera problem: {camErr.name}</p>
          <p className="text-xs text-red-700 break-words">{camErr.message}</p>
          <p className="text-sm text-slate-700">{camErr.help}</p>
          <Btn kind="ghost" onClick={() => setAttempt((n) => n + 1)} data-testid="selfie-retry">Try again</Btn>
        </Card>
      )}
      <Card className="space-y-2"><label className="flex gap-2 text-xs"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="selfie-consent" /> {CONSENT}</label></Card>
      <Err msg={err} />
      {!shot ? <Btn disabled={!ready || !consent} onClick={capture} data-testid="selfie-capture">Take photo</Btn> : <><Btn disabled={!consent} onClick={save} data-testid="selfie-save">Save to my account</Btn><Btn kind="ghost" onClick={() => setShot(null)}>Retake</Btn></>}
      <Btn kind="ghost" onClick={() => go('/')} data-testid="selfie-skip">{camErr ? 'Continue without a selfie' : 'Skip'}</Btn>
      <Notice>No face matching is built. The photo is only stored; {d.name || 'you'} can delete it in Settings. You can also add it later.</Notice>
    </div>
  );
}
