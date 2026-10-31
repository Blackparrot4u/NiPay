// Real Ed25519 / X25519 / ChaCha20-Poly1305 in the browser (audited @noble libraries, no hand-rolled crypto).
import { ed25519, x25519 } from '@noble/curves/ed25519';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { sha256 } from '@noble/hashes/sha2';
import { hkdf } from '@noble/hashes/hkdf';

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

export const sha256b = (b: Uint8Array) => sha256(b);

// ---- Ed25519: the device key is made on the device; the private half never leaves it ----
export interface Keypair { seed: Uint8Array; pub: Uint8Array }
export function newKeypair(seed: Uint8Array = randomBytes(32)): Keypair {
  return { seed, pub: ed25519.getPublicKey(seed) };
}
export const sign = (seed: Uint8Array, msg: Uint8Array | string) =>
  ed25519.sign(typeof msg === 'string' ? enc.encode(msg) : msg, seed);
export function verify(pub: Uint8Array, msg: Uint8Array | string, sig: Uint8Array): boolean {
  try {
    return ed25519.verify(sig, typeof msg === 'string' ? enc.encode(msg) : msg, pub);
  } catch {
    return false;
  }
}

// ---- session encryption for the wifi link: X25519 + one-time QR key -> ChaCha20-Poly1305 ----
export function newEphemeral() {
  const sk = x25519.utils.randomPrivateKey();
  return { sk, pk: x25519.getPublicKey(sk) };
}
export function sessionKey(mySk: Uint8Array, theirPk: Uint8Array, qrKey: Uint8Array, transcript: Uint8Array): Uint8Array {
  const shared = x25519.getSharedSecret(mySk, theirPk);
  return hkdf(sha256, concat(shared, qrKey), sha256(transcript), enc.encode('nipay-link-v1'), 32);
}
/** Sealed message: 12-byte counter-derived nonce || ciphertext+tag. Direction byte stops reflection. */
export function seal(key: Uint8Array, counter: number, dir: number, plain: Uint8Array): Uint8Array {
  const nonce = new Uint8Array(12);
  nonce[0] = dir;
  new DataView(nonce.buffer).setUint32(8, counter);
  return concat(nonce, chacha20poly1305(key, nonce).encrypt(plain));
}
export function open(key: Uint8Array, dir: number, sealed: Uint8Array, minCounter: number): { plain: Uint8Array; counter: number } | null {
  try {
    const nonce = sealed.subarray(0, 12);
    if (nonce[0] !== dir) return null;
    const counter = new DataView(nonce.buffer, nonce.byteOffset).getUint32(8);
    if (counter < minCounter) return null; // replay
    return { plain: chacha20poly1305(key, nonce).decrypt(sealed.subarray(12)), counter };
  } catch {
    return null;
  }
}
