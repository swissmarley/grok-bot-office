import type { OfficeEvent } from '@grok-office/shared';
import { useOffice } from './store';

/** Swaps a `?token=` from the URL for the session cookie, then drops it from the address bar. */
async function establishSession(): Promise<boolean> {
  const url = new URL(location.href);
  const token = url.searchParams.get('token');
  if (token) {
    url.searchParams.delete('token');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.ok) return true;
  }
  return (await fetch('/api/session')).ok;
}

/** Connects to the office server and keeps reconnecting with backoff. */
export function connect(): () => void {
  const { apply, setLink } = useOffice.getState();
  let ws: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    const delay = Math.min(10_000, 500 * 2 ** attempt++);
    retry = setTimeout(open, delay);
  };

  const open = async () => {
    setLink('connecting');
    let authed: boolean;
    try {
      authed = await establishSession();
    } catch {
      setLink('closed');
      return schedule();
    }
    if (!authed) return setLink('unauthorized');
    if (stopped) return;

    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => {
      attempt = 0;
      setLink('open');
    };
    ws.onmessage = (msg) => {
      if (typeof msg.data !== 'string') return;
      try {
        apply(JSON.parse(msg.data) as OfficeEvent);
      } catch {
        // Ignore malformed frames.
      }
    };
    ws.onclose = () => {
      setLink('closed');
      schedule();
    };
  };

  void open();
  return () => {
    stopped = true;
    clearTimeout(retry);
    ws?.close();
  };
}
