// Reliable blob transfer on top of the encrypted link. Points travel only over the wifi/hotspot link, never in QR codes.
// A blob (a payment of up to 2,000 points is ~300 kB) is announced, cut into 8 kB chunks, paced against the channel
// buffer, hashed end to end, and acknowledged. If the link drops, both ends keep their partial state; on the next
// link the receiver says how many chunks it already has and the sender continues from there (resume).
import { b64, concat, dec, enc, sha256b, unb64 } from './crypto';
import type { LinkSession } from './link';

export const CHUNK = 8192;
const T = { H: 0x48, S: 0x53, D: 0x44, F: 0x46 } as const; // header, status, data, finished
const ctl = (t: number, o: object) => concat(new Uint8Array([t]), enc.encode(JSON.stringify(o)));

interface Out { bytes: Uint8Array; acked: boolean }
interface In { len: number; total: number; sha: string; chunks: Uint8Array[]; done: boolean }
export interface Progress { dir: 'out' | 'in'; id: string; done: number; total: number }

export class Pipe {
  private out = new Map<string, Out>();
  private inn = new Map<string, In>();
  private link: LinkSession | null = null;
  private sending = new Set<string>();
  onBlob: (id: string, bytes: Uint8Array) => void = () => {};
  onProgress: (p: Progress) => void = () => {};
  onAck: (id: string) => void = () => {};
  /** Binds a (new) link. Anything unacknowledged is announced again, which is how a dropped transfer resumes. */
  attach(link: LinkSession) {
    this.link = link; this.sending.clear();
    link.onMessage = (b) => this.rx(b);
    for (const id of this.out.keys()) this.announce(id);
  }
  sendBlob(id: string, bytes: Uint8Array) { this.out.set(id, { bytes, acked: false }); this.announce(id); }
  private live() { return this.link && this.link.state === 'authenticated' ? this.link : null; }
  private announce(id: string) {
    const o = this.out.get(id); const l = this.live(); if (!o || o.acked || !l) return;
    l.send(ctl(T.H, { id, len: o.bytes.length, total: Math.max(1, Math.ceil(o.bytes.length / CHUNK)), sha: b64(sha256b(o.bytes)) }));
  }
  private async push(id: string, from: number) {
    const o = this.out.get(id); const l = this.link; if (!o || !l || this.sending.has(id)) return;
    this.sending.add(id);
    const total = Math.max(1, Math.ceil(o.bytes.length / CHUNK)); const idb = enc.encode(id);
    for (let i = from; i < total; i++) {
      while (l.state === 'authenticated' && l.buffered() > 256 * 1024) await new Promise((r) => setTimeout(r, 15));
      if (l.state !== 'authenticated' || this.link !== l) break;   // dropped: resume later
      const hdr = new Uint8Array(1 + 1 + idb.length + 4); hdr[0] = T.D; hdr[1] = idb.length; hdr.set(idb, 2);
      new DataView(hdr.buffer).setUint32(2 + idb.length, i);
      l.send(concat(hdr, o.bytes.subarray(i * CHUNK, (i + 1) * CHUNK)));
      this.onProgress({ dir: 'out', id, done: i + 1, total });
    }
    this.sending.delete(id);
  }
  private rx(b: Uint8Array) {
    const t = b[0]; const l = this.link;
    if (t === T.D) {
      const n = b[1]; const id = dec.decode(b.subarray(2, 2 + n)); const idx = new DataView(b.buffer, b.byteOffset).getUint32(2 + n);
      const x = this.inn.get(id); if (!x || x.done || idx !== x.chunks.length) return;   // out of order or unknown: the status reply re-syncs
      x.chunks.push(b.slice(6 + n)); this.onProgress({ dir: 'in', id, done: x.chunks.length, total: x.total });
      if (x.chunks.length === x.total) {
        const all = concat(...x.chunks);
        if (all.length === x.len && b64(sha256b(all)) === x.sha) { x.done = true; l?.send(ctl(T.F, { id })); this.onBlob(id, all); }
        else { x.chunks = []; l?.send(ctl(T.S, { id, have: 0 })); }       // damaged: start this blob again
      }
      return;
    }
    let m: any; try { m = JSON.parse(dec.decode(b.subarray(1))); } catch { return; }
    if (t === T.H) {
      const had = this.inn.get(m.id);
      if (!had || had.sha !== m.sha) this.inn.set(m.id, { len: m.len, total: m.total, sha: m.sha, chunks: [], done: false });
      const x = this.inn.get(m.id)!;
      if (x.done) l?.send(ctl(T.F, { id: m.id })); else l?.send(ctl(T.S, { id: m.id, have: x.chunks.length }));
    } else if (t === T.S) { void this.push(m.id, Math.max(0, Number(m.have) || 0)); }
    else if (t === T.F) { const o = this.out.get(m.id); if (o && !o.acked) { o.acked = true; this.onAck(m.id); } }
  }
  get pendingOut() { return [...this.out.values()].some((o) => !o.acked); }
  reset() { this.out.clear(); this.inn.clear(); this.link = null; this.sending.clear(); }
}
