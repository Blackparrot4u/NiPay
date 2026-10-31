import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { unb64 } from '../lib/crypto';
import { describeCameraError, openCamera, startVideo } from '../lib/camera';
import { debugOn } from '../lib/format';

/** Camera scanner for binary QR frames. Needs HTTPS or localhost. A debug box (only when the debug flag is on) lets two tabs test without a camera. */
export function QrScanner({ onBytes, hint }: { onBytes: (b: Uint8Array) => void; hint?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onBytes); cb.current = onBytes;
  const [err, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState(''); const [attempt, setAttempt] = useState(0); const debug = debugOn();
  useEffect(() => {
    let stop = false, stream: MediaStream | null = null, raf = 0, last = 0;
    const cv = document.createElement('canvas'); const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr('Camera needs HTTPS (or localhost). Open the secure link.'); return; }
      try {
        stream = await openCamera('environment', 1280);
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!; await startVideo(v, stream);
        const tick = (t: number) => {
          if (stop) return;
          if (t - last > 70 && v.videoWidth) {
            last = t; const w = Math.min(960, v.videoWidth), h = Math.round((w * v.videoHeight) / v.videoWidth);
            cv.width = w; cv.height = h; ctx.drawImage(v, 0, 0, w, h);
            const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            if (r?.binaryData?.length) cb.current(Uint8Array.from(r.binaryData));
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e: any) { stream?.getTracks().forEach((t) => t.stop()); if (!stop) { const c = describeCameraError(e); console.warn('scanner camera failed', c.name, c.message); setErr(`${c.name}: ${c.message}. ${c.help}`); } }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [attempt]);
  const inject = () => { try { for (const f of JSON.parse(paste)) cb.current(unb64(f)); setPaste(''); } catch { setErr('Debug paste is not valid frames JSON.'); } };
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-black aspect-square max-w-sm mx-auto">
        <video ref={video} muted playsInline className="w-full h-full object-cover" />
        <div className="absolute inset-6 border-2 border-white/70 rounded-lg pointer-events-none" />
      </div>
      {hint && <p className="text-center text-xs text-slate-500">{hint}</p>}
      {err && <div className="text-center space-y-1"><p className="text-xs text-red-600">{err}</p><button className="text-xs underline" onClick={() => { setErr(null); setAttempt((n) => n + 1); }}>Try the camera again</button></div>}
      {debug && <details className="text-xs text-slate-400"><summary>Debug: transfer without a camera (for testing only)</summary>
        <textarea data-testid="debug-paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={2} className="w-full border rounded p-1 font-mono" placeholder="paste frames JSON from the other tab" />
        <button data-testid="debug-inject" onClick={inject} className="border rounded px-2 py-1">Inject</button></details>}
    </div>
  );
}
