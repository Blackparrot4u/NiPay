// One place for how numbers and money look: ₹ (never "Rs"), thousands separators like 50,000.
const nf = new Intl.NumberFormat('en-IN');
export const num = (n: number | null | undefined): string => (n == null || Number.isNaN(n) ? '-' : nf.format(n));
export const inr = (n: number | null | undefined): string => (n == null || Number.isNaN(n) ? '-' : '₹' + nf.format(n));
export const dateTime = (s?: string | number | null) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
/** Whole days from now (local time) to a date, by calendar day, never negative. */
export const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(iso); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
};
/** Debug tools (paste QR frames, link handle) show only when this flag is on: localStorage nipay:debug, or open the page once with ?debug. */
export const debugOn = (): boolean => {
  try {
    if (new URLSearchParams(location.search).has('debug')) localStorage.setItem('nipay:debug', '1');
    return !!localStorage.getItem('nipay:debug');
  } catch { return false; }
};
