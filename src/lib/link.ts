// Phone-to-phone wifi link: WebRTC data channel with NO signalling server and NO STUN (local candidates only).
// The offer and answer travel by QR. A fresh one-time key rides in the offer QR; both sides add an X25519
// exchange and sign the transcript with their device keys, then every message is ChaCha20-Poly1305 sealed.
// A third device on the same wifi never sees the QR, so it cannot read, inject or replay anything.
// The link and keys are destroyed after one payment or on timeout.
import { b64, unb64, concat, enc, dec, sha256b, randomBytes, newEphemeral, sessionKey, seal, open, sign, verify } from './crypto';
import { CompactSdp } from './protocol';

export const LINK_TIMEOUT_MS = 90_000;
const OPEN_TIMEOUT_MS = 12_000;

// ---- SDP <-> small JSON, so the offer/answer fit into one or two QR frames ----
export function compactSdp(sdp: string): CompactSdp {
  const g = (re: RegExp) => (sdp.match(re) || [])[1] ?? '';
  const f = g(/a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/).replace(/:/g, '');
  return { u: g(/a=ice-ufrag:(\S+)/), p: g(/a=ice-pwd:(\S+)/), f, c: [...sdp.matchAll(/a=candidate:(.+)/g)].map((m) => m[1].trim()) };
}
export function expandSdp(c: CompactSdp, setup: 'actpass' | 'active'): string {
  const fp = (c.f.match(/../g) || []).join(':').toUpperCase();
  return ['v=0', 'o=- 1 1 IN IP4 0.0.0.0', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${c.u}`, `a=ice-pwd:${c.p}`, 'a=ice-options:trickle', `a=fingerprint:sha-256 ${fp}`, `a=setup:${setup}`, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144',
    ...c.c.map((x) => 'a=candidate:' + x), ...(c.c.length ? ['a=end-of-candidates'] : []), ''].join('\r\n');
}
export const onlyMdns = (c: CompactSdp) => c.c.length > 0 && c.c.every((x) => /\.local /.test(x));

const gathered = (pc: RTCPeerConnection) => new Promise<void>((res) => {
  if (pc.iceGatheringState === 'complete') return res();
  const t = setTimeout(res, 3500);
  pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
});
const transcriptOf = (o: { sdp: CompactSdp; epk: string; dpk: string }, a: { sdp: CompactSdp; epk: string; dpk: string }) =>
  sha256b(enc.encode('NIPAY-LINK1|' + JSON.stringify([o.sdp, o.epk, o.dpk, a.sdp, a.epk, a.dpk])));

export type LinkState = 'new' | 'connecting' | 'open' | 'authenticated' | 'failed' | 'destroyed';

export class LinkSession {
  state: LinkState = 'new';
  rejected = 0;               // frames that failed decryption or replay checks (a third device would end up here)
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private key: Uint8Array | null = null;
  private oneTime: Uint8Array | null = null;
  private eph = newEphemeral();
  private sendCtr = 1;
  private recvMin = 0;
  private myDir: number;
  private peerDir: number;
  private life: ReturnType<typeof setTimeout>;
  code = '';
  onMessage: (b: Uint8Array) => void = () => {};
  onState: (s: LinkState) => void = () => {};
  onPeerPk: (pk: string) => void = () => {};
  private offerMeta?: { sdp: CompactSdp; epk: string; dpk: string };
  private answerMeta?: { sdp: CompactSdp; epk: string; dpk: string };

  constructor(private role: 'payer' | 'payee', private seed: Uint8Array, private myPk: Uint8Array) {
    this.pc = new RTCPeerConnection({ iceServers: [] }); // no STUN, no TURN: wifi / hotspot only
    this.myDir = role === 'payer' ? 1 : 2; this.peerDir = role === 'payer' ? 2 : 1;
    this.life = setTimeout(() => this.destroy(), LINK_TIMEOUT_MS);
    this.pc.addEventListener('connectionstatechange', () => { if (['failed', 'closed'].includes(this.pc.connectionState) && this.state !== 'destroyed') this.set('failed'); });
  }
  private set(s: LinkState) { if (this.state === 'destroyed') return; this.state = s; if (typeof localStorage !== 'undefined' && localStorage.getItem('nipay:debug')) console.log('link', this.role, s); this.onState(s); }

  /** Payer: makes the offer that goes into a QR. */
  async createOffer() {
    this.dc = this.pc.createDataChannel('nipay', { ordered: true });
    this.wire(this.dc);
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await gathered(this.pc);
    this.oneTime = randomBytes(32);
    this.offerMeta = { sdp: compactSdp(this.pc.localDescription!.sdp), epk: b64(this.eph.pk), dpk: b64(this.myPk) };
    this.set('connecting');
    return { ...this.offerMeta, key: b64(this.oneTime) };
  }
  /** Payee: takes the scanned offer, returns the answer for a QR. */
  async acceptOffer(o: { sdp: CompactSdp; epk: string; dpk: string; key: string }) {
    this.oneTime = unb64(o.key); this.offerMeta = { sdp: o.sdp, epk: o.epk, dpk: o.dpk };
    this.pc.addEventListener('datachannel', (e) => { this.dc = e.channel; this.wire(e.channel); });
    await this.pc.setRemoteDescription({ type: 'offer', sdp: expandSdp(o.sdp, 'actpass') });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await gathered(this.pc);
    this.answerMeta = { sdp: compactSdp(this.pc.localDescription!.sdp), epk: b64(this.eph.pk), dpk: b64(this.myPk) };
    const tr = transcriptOf(this.offerMeta, this.answerMeta);
    this.deriveKey(unb64(o.epk), tr);
    this.set('connecting');
    return { ...this.answerMeta, sig: b64(sign(this.seed, concat(enc.encode('answer|'), tr))) };
  }
  /** Payer: takes the scanned answer. `pinnedPeerPk` is the payee key from the card QR scanned earlier. */
  async finishOffer(a: { sdp: CompactSdp; epk: string; dpk: string; sig: string }, pinnedPeerPk: string): Promise<boolean> {
    if (!this.offerMeta || a.dpk !== pinnedPeerPk) return this.fail();
    this.answerMeta = { sdp: a.sdp, epk: a.epk, dpk: a.dpk };
    const tr = transcriptOf(this.offerMeta, this.answerMeta);
    if (!verify(unb64(a.dpk), concat(enc.encode('answer|'), tr), unb64(a.sig))) return this.fail();
    this.deriveKey(unb64(a.epk), tr);
    await this.pc.setRemoteDescription({ type: 'answer', sdp: expandSdp(a.sdp, 'active') });
    setTimeout(() => { if (this.state === 'connecting') this.fail(); }, OPEN_TIMEOUT_MS);
    return true;
  }
  private fail() { this.set('failed'); return false; }
  private deriveKey(theirEpk: Uint8Array, tr: Uint8Array) {
    this.key = sessionKey(this.eph.sk, theirEpk, this.oneTime!, tr);
    this.code = String(tr[0] % 100).padStart(2, '0');
    this.oneTime = null; // the QR key is no longer needed
    this.eph = { sk: new Uint8Array(32), pk: this.eph.pk };
    this.trHash = tr;
  }
  private trHash: Uint8Array = new Uint8Array(0);

  private wire(dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    dc.addEventListener('open', () => { this.set('open'); this.sendHello(); });
    dc.addEventListener('close', () => { if (this.state !== 'destroyed') this.set('failed'); });
    dc.addEventListener('message', (e) => this.receive(new Uint8Array(e.data as ArrayBuffer)));
  }
  private raw(plain: Uint8Array) { if (this.dc?.readyState === 'open' && this.key) this.dc.send(seal(this.key, this.sendCtr++, this.myDir, plain) as any); }
  private sendHello() {
    // proves possession of the session key and of the device key, bound to this transcript
    const msg = concat(new Uint8Array([0]), sign(this.seed, concat(enc.encode('hello|' + this.role + '|'), this.trHash)));
    this.raw(msg);
  }
  private peerPk(): Uint8Array { return unb64(this.role === 'payer' ? this.answerMeta!.dpk : this.offerMeta!.dpk); }
  private receive(sealed: Uint8Array) {
    if (!this.key) { this.rejected++; return; }
    const r = open(this.key, this.peerDir, sealed, this.recvMin);
    if (!r) { this.rejected++; return; }          // wrong key, tampered, replayed or reflected
    this.recvMin = r.counter + 1;
    const [kind, body] = [r.plain[0], r.plain.subarray(1)];
    if (kind === 0) {
      const peerRole = this.role === 'payer' ? 'payee' : 'payer';
      if (!verify(this.peerPk(), concat(enc.encode('hello|' + peerRole + '|'), this.trHash), body)) { this.rejected++; return this.fail(); }
      this.onPeerPk(b64(this.peerPk()));
      this.set('authenticated');
    } else if (kind === 1 && this.state === 'authenticated') this.onMessage(body);
    else this.rejected++;
  }
  /** Bytes queued in the data channel: the transfer layer waits on this so a big payment does not flood it. */
  buffered() { return this.dc?.bufferedAmount ?? 0; }
  /** Test hook: cut the link as if the phones moved apart. */
  simulateDrop() { try { this.dc?.close(); this.pc.close(); } catch { /* closed */ } this.set('failed'); }
  send(app: Uint8Array) { if (this.state === 'authenticated') this.raw(concat(new Uint8Array([1]), app)); }
  /** Test hook: a "third device" that does not know the key tries to inject a frame. */
  injectForgery() { if (this.dc?.readyState === 'open') this.dc.send(seal(randomBytes(32), 99, this.myDir, enc.encode('evil')) as any); }
  destroy() {
    clearTimeout(this.life);
    if (this.state === 'destroyed') return;
    this.key?.fill(0); this.key = null; this.oneTime = null; this.trHash = new Uint8Array(0);
    try { this.dc?.close(); this.pc.close(); } catch { /* already closed */ }
    this.state = 'destroyed'; this.onState('destroyed');
  }
}
