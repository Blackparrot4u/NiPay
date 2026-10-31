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

export { Card, Btn, Field, Badge, Title, Err, Notice, Stat } from './shared/atoms';
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
    insufficient: 'Not enough balance (the ₹1 fee is included).', phone_already_registered: 'That phone number is already registered. Sign in instead.', offline_suspended: 'Offline use is suspended on this account. File an appeal in More.',
    too_many_wrong_pins: 'Too many wrong PINs. Try again in 15 minutes.', offline: 'No internet connection.', rate_limited: 'Slow down: too many requests.', bad_pin: 'Wrong PIN.', sync_first: 'Some payments are not at the bank yet. Sync first (needs internet), then add points.', this_device_was_cancelled: 'This device was cancelled. Register again from a new device.' };
  return map[code] ?? code.replace(/_/g, ' ');
};
