import { Card, Notice } from '../ui';
import type { Progress } from '../lib/pipe';

/** Progress of a transfer, from the transfer layer itself (parts done of total). Empty state when nothing moves yet. */
export function ProgressBar({ p, label }: { p: Progress | null; label: string }) {
  if (!p) return <p className="text-xs text-slate-400">{label}: waiting for the first part...</p>;
  const pct = Math.round((p.done / p.total) * 100);
  return (<div className="space-y-1" data-testid="progress"><div className="h-2 rounded bg-slate-200 overflow-hidden"><div className="h-full bg-slate-900" style={{ width: pct + '%' }} /></div>
    <p className="text-xs text-slate-500">{label}: part {p.done} of {p.total} ({pct}%)</p></div>);
}

/** Which connection methods this browser can actually use. Only methods that work are selectable. */
export function ConnectionMethods() {
  const wifi = typeof RTCPeerConnection !== 'undefined';
  return (
    <Card className="space-y-1 text-sm">
      <p className="font-semibold">Connection method</p>
      <label className="flex gap-2 items-start"><input type="radio" checked readOnly disabled={!wifi} /><span>Wifi or phone hotspot (encrypted link) {wifi ? '' : '- not supported by this browser'}</span></label>
      <label className="flex gap-2 items-start text-slate-400"><input type="radio" disabled /><span>Bluetooth - not possible in a web browser (a page cannot act as a Bluetooth peer). Planned for the native app.</span></label>
      <label className="flex gap-2 items-start text-slate-400"><input type="radio" disabled /><span>NFC tap - not possible from a browser. Planned for the native app.</span></label>
      <Notice tone="sky">Both phones on the same wifi, or one phone's hotspot. A web page cannot create or join wifi for you.</Notice>
    </Card>
  );
}
