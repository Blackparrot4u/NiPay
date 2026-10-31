import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { b64 } from '../lib/crypto';

/** Shows one or many frames; many frames loop like an animated GIF. Frames are raw bytes (binary QR). */
export function QrDisplay({ frames, fps = 5, size = 300 }: { frames: Uint8Array[]; fps?: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); if (frames.length < 2) return; const t = setInterval(() => setI((x) => (x + 1) % frames.length), 1000 / fps); return () => clearInterval(t); }, [frames, fps]);
  useEffect(() => {
    const f = frames[i % Math.max(1, frames.length)]; const cv = ref.current; if (!f || !cv) return;
    const q = QRCode.create([{ data: f, mode: 'byte' }] as any, { errorCorrectionLevel: 'L' });
    const n = q.modules.size, quiet = 4, px = Math.floor(size / (n + quiet * 2));
    cv.width = cv.height = px * (n + quiet * 2);
    const c = cv.getContext('2d')!; c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.get(x, y)) c.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
  }, [frames, i, size]);
  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={ref} style={{ width: size, maxWidth: '100%', imageRendering: 'pixelated' }} className="border border-slate-200 rounded-lg" data-testid="qr" data-frames={JSON.stringify(frames.map(b64))} />
      <p className="text-xs text-slate-500">{frames.length > 1 ? `Animated code: frame ${(i % frames.length) + 1} of ${frames.length}. Keep it steady.` : 'Scan this code'}</p>
    </div>
  );
}
