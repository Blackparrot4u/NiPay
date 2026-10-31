// Unlocking the phone for a payment: fingerprint or face through a WebAuthn passkey (platform authenticator), with the PIN as fallback.
// WebAuthn needs HTTPS (or localhost). The check is a device-local gate: the browser asks the phone's own biometric/screen lock,
// and this app trusts that answer. It is not verified by the server and is not a face-matching feature of ours.
import { useState } from 'react';
import { Btn, Field } from '../shared/atoms';
import { b64, randomBytes, unb64 } from './crypto';
import { checkPin, get, set, useDevice } from './device';

export const passkeySupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials && window.isSecureContext;
let lastOk = 0;

export async function enablePasskey(): Promise<string | null> {
  if (!passkeySupported()) return 'This needs HTTPS (or localhost) and a browser with passkeys.';
  const s = get();
  try {
    const cred = (await navigator.credentials.create({ publicKey: {
      challenge: randomBytes(32), rp: { name: 'NiPay prototype', id: location.hostname },
      user: { id: randomBytes(16), name: s.phone || 'nipay-user', displayName: s.name || 'NiPay user' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' }, timeout: 60000 } })) as PublicKeyCredential | null;
    if (!cred) return 'Cancelled.';
    set({ passkeyId: b64(new Uint8Array(cred.rawId)) }); lastOk = Date.now();
    return null;
  } catch (e: any) { return e?.name === 'NotAllowedError' ? 'Cancelled or no fingerprint/face set up on this phone.' : 'This phone could not create a passkey.'; }
}
export async function passkeyUnlock(): Promise<boolean> {
  const id = get().passkeyId; if (!id || !passkeySupported()) return false;
  try {
    const a = await navigator.credentials.get({ publicKey: { challenge: randomBytes(32), rpId: location.hostname, userVerification: 'required', allowCredentials: [{ type: 'public-key', id: unb64(id) }], timeout: 60000 } });
    if (a) { lastOk = Date.now(); return true; }
  } catch { /* cancelled */ }
  return false;
}
/** True if the PIN is right, or the fingerprint/face check passed in the last minute. */
export async function unlock(pin: string): Promise<boolean> {
  if (pin && checkPin(pin)) return true;
  return Date.now() - lastOk < 60_000;
}
export function UnlockField({ pin, setPin, testid }: { pin: string; setPin: (v: string) => void; testid: string }) {
  const d = useDevice(); const [ok, setOk] = useState(false);
  return (<div className="space-y-2">
    {d.passkeyId && passkeySupported() && <Btn kind="ghost" data-testid="use-passkey" onClick={async () => setOk(await passkeyUnlock())}>{ok ? 'Fingerprint or face accepted' : 'Use fingerprint or face'}</Btn>}
    <Field label={d.passkeyId ? 'PIN (fallback)' : 'PIN'} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} data-testid={testid} />
  </div>);
}
