import React from 'react';
import { useDevice, set } from './lib/device';

// ---------- tiny i18n: warnings and main actions in English and Hindi ----------
const T: Record<string, [string, string]> = {
  pay: ['Pay', 'भुगतान करें'], receive: ['Receive', 'पाएं'], topup: ['Add points', 'पॉइंट जोड़ें'], home: ['Home', 'होम'],
  history: ['History', 'इतिहास'], more: ['More', 'और'], send_bucket: ['Send bucket', 'भेजने का बकेट'], receive_bucket: ['Receive bucket', 'पाने का बकेट'],
  danger: ['This person may be dangerous. You may not get money for their IDs.', 'यह व्यक्ति खतरनाक हो सकता है। आपको इनके IDs का पैसा नहीं मिल सकता।'],
  failed: ['Payment failed', 'भुगतान विफल रहा'], hold: ['Hold until the beep', 'बीप तक रुकें'], success: ['Payment done', 'भुगतान हो गया'],
  attention: ['App needs attention: contact support', 'ऐप को ध्यान चाहिए: सहायता से संपर्क करें'],
  battery: ['Battery below 3%: offline payments are blocked.', 'बैटरी 3% से कम: ऑफ़लाइन भुगतान बंद है।'],
};
export function useT() {
  const { language } = useDevice();
  return (k: string) => (T[k] ?? [k, k])[language === 'hi' ? 1 : 0];
}
export const setLanguage = (l: 'en' | 'hi') => set({ language: l });

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
export const go = (path: string) => { location.hash = path; };

export function beep(ms = 220, freq = 880) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = 0.2; o.connect(g); g.connect(ctx.destination); o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, ms);
    navigator.vibrate?.(ms);
  } catch { /* no audio */ }
}
export async function batteryPercent(): Promise<number | null> {
  try { const b = await (navigator as any).getBattery?.(); return b ? Math.round(b.level * 100) : null; } catch { return null; }
}
export const errText = (e: any) => {
  const d = e?.detail;
  const code = typeof d === 'string' ? d : d?.code ?? e?.message ?? 'error';
  const map: Record<string, string> = { bad_credentials: 'Wrong phone or PIN.', bad_otp: 'Wrong demo OTP.', terms_required: 'Please accept both terms.', send_limit: 'That is above the 2,000-point send limit.',
    insufficient: 'Not enough balance (the Rs 1 fee is included).', phone_already_registered: 'That phone number is already registered. Sign in instead.', offline_suspended: 'Offline use is suspended on this account. File an appeal in More.',
    too_many_wrong_pins: 'Too many wrong PINs. Try again in 15 minutes.', offline: 'No internet connection.', rate_limited: 'Slow down: too many requests.', bad_pin: 'Wrong PIN.', this_device_was_cancelled: 'This device was cancelled. Register again from a new device.' };
  return map[code] ?? code.replace(/_/g, ' ');
};
