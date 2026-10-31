import React from 'react';

// Plain UI atoms shared by both websites (the NiPay design: white cards on slate-50, slate-900 primary, blue accent).
// No device state, no user-app logic: the admin site imports only this.
export const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-5 ${className}`}>{children}</div>
);
export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'danger' | 'blue' }> = ({ kind = 'primary', className = '', ...p }) => (
  <button {...p} className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${kind === 'primary' ? 'bg-slate-900 hover:bg-slate-800 text-white' : kind === 'blue' ? 'bg-blue-600 hover:bg-blue-700 text-white' : kind === 'danger' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300'} ${className}`} />
);
export const Field: React.FC<{ label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>> = ({ label, hint, ...p }) => (
  <label className="block text-sm"><span className="text-xs font-semibold text-slate-600">{label}</span>
    <input {...p} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
    {hint && <span className="text-[11px] text-slate-400">{hint}</span>}</label>
);
export const Badge: React.FC<React.PropsWithChildren<{ tone?: 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple' }>> = ({ tone = 'slate', children }) => {
  const c = { green: 'bg-emerald-100/70 text-emerald-700', amber: 'bg-amber-100/70 text-amber-800', red: 'bg-rose-100 text-rose-700', slate: 'bg-slate-100 text-slate-600', blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-800' }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
};
export const Title: React.FC<React.PropsWithChildren<{ sub?: string; back?: string }>> = ({ children, sub, back }) => (
  <div className="mb-4">
    {back && <a href={`#${back}`} className="text-xs text-blue-600 hover:underline">← Back</a>}
    <h1 className="text-xl font-bold text-slate-900">{children}</h1>{sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
  </div>
);
export const Err: React.FC<{ msg: string | null }> = ({ msg }) => (msg ? <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">{msg}</p> : null);
export const Notice: React.FC<React.PropsWithChildren<{ tone?: 'amber' | 'sky' }>> = ({ tone = 'amber', children }) => (
  <p className={`text-xs rounded-xl p-2.5 border ${tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>{children}</p>
);
/** A small stat tile: label, big number, optional caption. */
export const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; testid?: string }> = ({ label, value, sub, tone = 'text-slate-900', testid }) => (
  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">{label}</span>
    <div className={`text-xl font-bold font-mono tabular-nums ${tone}`} data-testid={testid}>{value}</div>
    {sub && <span className="text-[10px] text-slate-400 font-mono block">{sub}</span>}
  </div>
);
export const errText = (e: any) => {
  const d = e?.detail;
  const code = typeof d === 'string' ? d : d?.code ?? e?.message ?? 'error';
  const map: Record<string, string> = { bad_credentials: 'Wrong name or password.', offline: 'No connection.', rate_limited: 'Slow down: too many requests.', not_admin: 'Not an admin token.', bad_token: 'Session ended, sign in again.', role_cannot_decide: 'Your role is read only.', super_admin_only: 'Only a super admin can do this.', bad_digest: 'A digest has no spaces or commas.' };
  return map[code] ?? code.replace(/_/g, ' ');
};
