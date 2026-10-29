export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** "just now", "42s ago", "5 min ago", then the clock time. */
export function relative(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `at ${clock(iso)}`;
}

/** mm:ss until `iso`, or null once it has passed. */
export function countdown(iso: string, now = Date.now()): string | null {
  const s = Math.ceil((Date.parse(iso) - now) / 1000);
  if (s <= 0) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
