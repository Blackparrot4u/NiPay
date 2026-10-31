// Wire format shared by both transports (animated QR now, WebRTC data channel over wifi).
// A message is binary; QR frames are slices of it. Authenticity comes from the signatures inside,
// the trailing checksum only catches scanning damage.
import { concat, enc, dec, sha256b, randomBytes } from './crypto';
import type { PeerCard } from './peercheck';

export type MsgType = 'card' | 'payment' | 'receipt' | 'refuse' | 'offer' | 'answer';
const TYPE: Record<MsgType, number> = { card: 0, payment: 1, receipt: 2, refuse: 3, offer: 4, answer: 5 };
const NAME = ['card', 'payment', 'receipt', 'refuse', 'offer', 'answer'] as MsgType[];

export interface PayPoint { pid: string; sig: Uint8Array; handover: Uint8Array }
export interface RcptPoint { pid: string; receipt: Uint8Array }
export type Message =
  | { type: 'card'; meta: PeerCard }
  | { type: 'payment'; meta: { ref: string; month: string; from: string; fromName: string; to: string; ts: number; pk: string; pc?: PeerCard }; points: PayPoint[] }
  | { type: 'receipt'; meta: { ref: string; from: string; to: string; ts: number }; points: RcptPoint[] }
  | { type: 'refuse'; meta: { ref: string; reason: string } }
  | { type: 'offer'; meta: { sdp: CompactSdp; epk: string; dpk: string; key: string; pc?: PeerCard } }
  | { type: 'answer'; meta: { sdp: CompactSdp; epk: string; dpk: string; sig: string } };
export interface CompactSdp { u: string; p: string; f: string; c: string[] }

export function encodeMessage(m: Message): Uint8Array {
  const meta = enc.encode(JSON.stringify(m.meta));
  const pts = 'points' in m ? m.points : [];
  const head = new Uint8Array([0x4e, 0x50, 1, TYPE[m.type], meta.length >> 8, meta.length & 255]);
  const parts: Uint8Array[] = [head, meta, new Uint8Array([pts.length >> 8, pts.length & 255])];
  for (const p of pts) {
    const x = p as any;
    parts.push(enc.encode(x.pid), x.sig ?? new Uint8Array(0), x.handover ?? x.receipt);
    if (enc.encode(x.pid).length !== 20) throw new Error('bad pid');
  }
  const body = concat(...parts);
  return concat(body, sha256b(body).subarray(0, 4));
}

export function decodeMessage(b: Uint8Array): Message | null {
  try {
    if (b.length < 12) return null;
    const body = b.subarray(0, b.length - 4);
    const sum = sha256b(body).subarray(0, 4);
    for (let i = 0; i < 4; i++) if (sum[i] !== b[b.length - 4 + i]) return null;
    if (body[0] !== 0x4e || body[1] !== 0x50 || body[2] !== 1) return null;
    const type = NAME[body[3]];
    const mlen = (body[4] << 8) | body[5];
    const meta = JSON.parse(dec.decode(body.subarray(6, 6 + mlen)));
    let o = 6 + mlen;
    const n = (body[o] << 8) | body[o + 1];
    o += 2;
    if (type === 'payment') {
      const points: PayPoint[] = [];
      for (let i = 0; i < n; i++, o += 148) points.push({ pid: dec.decode(body.subarray(o, o + 20)), sig: body.slice(o + 20, o + 84), handover: body.slice(o + 84, o + 148) });
      if (o !== body.length) return null;
      return { type, meta, points };
    }
    if (type === 'receipt') {
      const points: RcptPoint[] = [];
      for (let i = 0; i < n; i++, o += 84) points.push({ pid: dec.decode(body.subarray(o, o + 20)), receipt: body.slice(o + 20, o + 84) });
      if (o !== body.length) return null;
      return { type, meta, points };
    }
    return { type, meta } as Message;
  } catch {
    return null;
  }
}

// ---- animated QR frames: 'NF' | session(4) | total(2) | index(2) | chunk ----
const HDR = 10;
export function toFrames(msg: Uint8Array, chunk = 420): Uint8Array[] {
  const sess = randomBytes(4);
  const total = Math.max(1, Math.ceil(msg.length / chunk));
  return Array.from({ length: total }, (_, i) => concat(new Uint8Array([0x4e, 0x46]), sess, new Uint8Array([total >> 8, total & 255, i >> 8, i & 255]), msg.subarray(i * chunk, (i + 1) * chunk)));
}

export class FrameAssembler {
  private sess = '';
  private total = 0;
  private parts = new Map<number, Uint8Array>();
  /** Returns false if this was not one of our frames. */
  add(f: Uint8Array): boolean {
    if (f.length < HDR || f[0] !== 0x4e || f[1] !== 0x46) return false;
    const sess = Array.from(f.subarray(2, 6)).join('.');
    const total = (f[6] << 8) | f[7], idx = (f[8] << 8) | f[9];
    if (idx >= total || total > 400) return false;
    if (sess !== this.sess || total !== this.total) { this.sess = sess; this.total = total; this.parts.clear(); }
    this.parts.set(idx, f.slice(HDR));
    return true;
  }
  get progress() { return { have: this.parts.size, total: this.total }; }
  done() { return this.total > 0 && this.parts.size === this.total; }
  result(): Uint8Array | null {
    if (!this.done()) return null;
    return concat(...Array.from({ length: this.total }, (_, i) => this.parts.get(i)!));
  }
  reset() { this.sess = ''; this.total = 0; this.parts.clear(); }
}
