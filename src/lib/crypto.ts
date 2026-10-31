// Real Ed25519 / X25519 / ChaCha20-Poly1305 in the browser via libsodium (libsodium-wrappers-sumo), no hand-rolled crypto.
// The module awaits sodium.ready once, so every function below is synchronous for callers.
import _sodium from 'libsodium-wrappers-sumo';
await _sodium.ready;
const sodium = _sodium;
export const enc = new TextEncoder();
export const dec = new TextDecoder();

export const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

export function b64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s: string): Uint8Array {
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}
export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const unhex = (s: string) => new Uint8Array((s.match(/../g) || []).map((h) => parseInt(h, 16)));
export const concat = (...p: Uint8Array[]) => {
  const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let k = 0;
  for (const x of p) { o.set(x, k); k += x.length; }
  return o;
};

export const sha256b = (b: Uint8Array): Uint8Array => sodium.crypto_hash_sha256(b);

// ---- Ed25519: the device key is made on the device; the private half never leaves it ----
export interface Keypair { seed: Uint8Array; pub: Uint8Array }
export function newKeypair(seed: Uint8Array = randomBytes(32)): Keypair {
  return { seed, pub: sodium.crypto_sign_seed_keypair(seed).publicKey };
}
const secretOf = (seed: Uint8Array) => sodium.crypto_sign_seed_keypair(seed).privateKey;
export const sign = (seed: Uint8Array, msg: Uint8Array | string) =>
  sodium.crypto_sign_detached(typeof msg === 'string' ? enc.encode(msg) : msg, secretOf(seed));
export function verify(pub: Uint8Array, msg: Uint8Array | string, sig: Uint8Array): boolean {
  try {
    return sodium.crypto_sign_verify_detached(sig, typeof msg === 'string' ? enc.encode(msg) : msg, pub);
  } catch {
    return false;
  }
}

// ---- session encryption for the wifi link: X25519 + one-time QR key -> HKDF-SHA256 -> ChaCha20-Poly1305 (IETF) ----
export function newEphemeral() {
  const sk = randomBytes(32);
  return { sk, pk: sodium.crypto_scalarmult_base(sk) };
}
const hmac = (key: Uint8Array, data: Uint8Array) => sodium.crypto_auth_hmacsha256(data, key); // keys here are always 32 bytes
/** RFC 5869 HKDF-SHA256 (extract + expand) built on libsodium's HMAC-SHA256. Output length <= 32. */
function hkdf32(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array): Uint8Array {
  const prk = hmac(salt, ikm);
  return hmac(prk, concat(info, new Uint8Array([1])));
}
export function sessionKey(mySk: Uint8Array, theirPk: Uint8Array, qrKey: Uint8Array, transcript: Uint8Array): Uint8Array {
  const shared = sodium.crypto_scalarmult(mySk, theirPk);
  return hkdf32(concat(shared, qrKey), sha256b(transcript), enc.encode('nipay-link-v1'));
}
/** Sealed message: 12-byte counter-derived nonce || ciphertext+tag. Direction byte stops reflection. */
export function seal(key: Uint8Array, counter: number, dir: number, plain: Uint8Array): Uint8Array {
  const nonce = new Uint8Array(12);
  nonce[0] = dir;
  new DataView(nonce.buffer).setUint32(8, counter);
  return concat(nonce, sodium.crypto_aead_chacha20poly1305_ietf_encrypt(plain, null, null, nonce, key));
}
export function open(key: Uint8Array, dir: number, sealed: Uint8Array, minCounter: number): { plain: Uint8Array; counter: number } | null {
  try {
    if (sealed.length < 12 + 16) return null;
    const nonce = sealed.subarray(0, 12);
    if (nonce[0] !== dir) return null;
    const counter = new DataView(nonce.buffer, nonce.byteOffset).getUint32(8);
    if (counter < minCounter) return null; // replay
    return { plain: sodium.crypto_aead_chacha20poly1305_ietf_decrypt(null, sealed.subarray(12), null, nonce, key), counter };
  } catch {
    return null;
  }
}
