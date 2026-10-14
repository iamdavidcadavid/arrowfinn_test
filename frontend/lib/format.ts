const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtUsd = (n: number) => usd.format(n);
export const fmtSignedUsd = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + usd.format(Math.abs(n));
export const fmtPrice = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
export const pnlClass = (n: number) => (n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-ink-300');
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + 'Z';
export const fmtSession = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + 'Z';
