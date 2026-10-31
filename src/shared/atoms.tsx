import React from 'react';

// Plain UI atoms shared by both websites. No device state, no user-app logic: the admin site imports only this.
// ---------- atoms ----------
export const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-xl p-4 ${className}`}>{children}</div>
);
export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'danger' }> = ({ kind = 'primary', className = '', ...p }) => (
  <button {...p} className={`w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-40 ${kind === 'primary' ? 'bg-slate-900 text-white' : kind === 'danger' ? 'bg-red-600 text-white' : 'bg-white text-slate-800 border border-slate-300'} ${className}`} />
);
export const Field: React.FC<{ label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>> = ({ label, hint, ...p }) => (
  <label className="block text-sm"><span className="text-slate-600">{label}</span>
    <input {...p} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
    {hint && <span className="text-xs text-slate-400">{hint}</span>}</label>
);
export const Badge: React.FC<React.PropsWithChildren<{ tone?: 'green' | 'amber' | 'red' | 'slate' | 'blue' }>> = ({ tone = 'slate', children }) => {
  const c = { green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', slate: 'bg-slate-100 text-slate-600', blue: 'bg-sky-50 text-sky-700' }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>;
};
export const Title: React.FC<React.PropsWithChildren<{ sub?: string; back?: string }>> = ({ children, sub, back }) => (
  <div className="mb-4">
    {back && <a href={`#${back}`} className="text-xs text-slate-500">← Back</a>}
    <h1 className="text-xl font-bold text-slate-900">{children}</h1>{sub && <p className="text-sm text-slate-500">{sub}</p>}
  </div>
);
export const Err: React.FC<{ msg: string | null }> = ({ msg }) => (msg ? <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{msg}</p> : null);
export const Notice: React.FC<React.PropsWithChildren<{ tone?: 'amber' | 'sky' }>> = ({ tone = 'amber', children }) => (
  <p className={`text-xs rounded-lg p-2 ${tone === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'}`}>{children}</p>
);
export const errText = (e: any) => {
  const d = e?.detail;
  const code = typeof d === 'string' ? d : d?.code ?? e?.message ?? 'error';
  const map: Record<string, string> = { bad_credentials: 'Wrong name or password.', offline: 'No connection.', rate_limited: 'Slow down: too many requests.', not_admin: 'Not an admin token.', bad_token: 'Session ended, sign in again.', role_cannot_decide: 'Your role is read only.' };
  return map[code] ?? code.replace(/_/g, ' ');
};
