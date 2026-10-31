import { Card, Title } from '../ui';
import { auditMines, currentMonth, recipeFor, useDevice } from '../lib/device';

export function Inspect() {
  const d = useDevice(); const rec = recipeFor(currentMonth());
  const a = rec ? auditMines(rec, d.points.filter((p) => p.kind === 'value').map((p) => p.pid), d.mines) : null;
  return (
    <div className="space-y-3"><Title back="/more" sub="Stack landmines: three points per mine, spent loosely first.">Mine inspector</Title>
      <Card className="text-sm space-y-1"><p>Points: <b>{d.points.filter((p) => p.kind === 'value').length}</b> · Mines armed: <b>{d.mines.length}</b> · Whole: <b>{a?.whole ?? 0}</b></p><p className="text-xs text-slate-500">Audit: {a ? (a.problems.join(', ') || 'clean') : 'needs rules'}</p></Card>
      <Card className="space-y-1 max-h-96 overflow-auto font-mono text-[11px]">{d.mines.slice(0, 40).map((m, i) => <div key={i}>{m.map((x) => x.slice(0, 4) + '…').join(' · ')} {m.every((x) => d.points.some((p) => p.pid === x)) ? '(whole)' : '(broken)'}</div>)}{!d.mines.length && <p>No mines yet.</p>}</Card></div>
  );
}
