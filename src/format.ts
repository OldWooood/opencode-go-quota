/** Compact countdown for a window reset time, e.g. "17h 7m" or "23d 18h 33m". */
export function formatCountdown(resetIso: string, now: number): string {
  const diff = Date.parse(resetIso) - now;
  if (!Number.isFinite(diff) || diff <= 0) return "soon";
  const mins = Math.floor(diff / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;
  if (days > 0) return `${days}d ${hours}h ${rest}m`;
  if (hours > 0) return `${hours}h ${rest}m`;
  return `${rest}m`;
}
