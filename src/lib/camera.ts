// Opening a webcam or phone camera, tolerant of laptops: "ideal" constraints first, then any camera at all.
// Errors are returned with their real name and message so the screen can show them (never swallowed).
export interface CameraError { name: string; message: string; help: string }

export const describeCameraError = (e: any): CameraError => {
  const name = e?.name || 'Error'; const message = e?.message || String(e);
  const help: Record<string, string> = {
    NotAllowedError: 'The browser blocked the camera. Click the camera icon in the address bar (Firefox and Brave both show one) and choose Allow, then press Try again. In Brave also check that Shields are not blocking it for this site.',
    PermissionDeniedError: 'The browser blocked the camera. Allow it for this site in the address bar, then press Try again.',
    NotFoundError: 'No camera was found on this device. Plug one in or continue without a selfie.',
    DevicesNotFoundError: 'No camera was found on this device. Plug one in or continue without a selfie.',
    NotReadableError: 'The camera is busy or locked by another program or browser tab (a video call app, another window). Close it and press Try again.',
    TrackStartError: 'The camera is busy or locked by another program. Close it and press Try again.',
    OverconstrainedError: 'This camera does not match the requested settings. Press Try again.',
    SecurityError: 'The camera needs HTTPS or localhost.',
    AbortError: 'The camera was interrupted while starting. Press Try again.',
  };
  return { name, message, help: help[name] ?? 'The camera could not start. Press Try again, or continue without it.' };
};

export async function openCamera(prefer: 'user' | 'environment', width: number): Promise<MediaStream> {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) throw Object.assign(new Error('navigator.mediaDevices is not available (the page must be on HTTPS or localhost)'), { name: 'SecurityError' });
  const tries: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: prefer }, width: { ideal: width } }, audio: false },
    { video: { width: { ideal: width } }, audio: false },
    { video: true, audio: false },
  ];
  let last: any;
  for (const c of tries) {
    try { return await md.getUserMedia(c); }
    catch (e: any) {
      last = e;
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError' || e?.name === 'NotFoundError' || e?.name === 'SecurityError') break;   // retrying a different constraint cannot fix these
    }
  }
  throw last;
}

/** Attaches a stream to a <video> and resolves once frames are really arriving (videoWidth > 0). */
export async function startVideo(v: HTMLVideoElement, stream: MediaStream): Promise<void> {
  v.muted = true; v.setAttribute('playsinline', 'true'); v.autoplay = true; v.srcObject = stream;
  await new Promise<void>((res, rej) => {
    if (v.videoWidth > 0) return res();
    const ok = () => { cleanup(); res(); }; const t = setTimeout(() => { cleanup(); rej(Object.assign(new Error('The camera opened but sent no picture within 8 seconds'), { name: 'NotReadableError' })); }, 8000);
    const cleanup = () => { clearTimeout(t); v.removeEventListener('loadeddata', ok); v.removeEventListener('playing', ok); };
    v.addEventListener('loadeddata', ok); v.addEventListener('playing', ok);
  });
  try { await v.play(); } catch (e: any) { if (e?.name !== 'AbortError') throw e; }
}
