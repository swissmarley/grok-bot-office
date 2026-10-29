import { useOffice } from './store';

/** POSTs to the office server; on failure, shows the error as a toast and returns false. */
async function post(path: string, body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return true;
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    useOffice.getState().toast(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`, 'error');
  } catch {
    useOffice.getState().toast('The office server is not reachable', 'error');
  }
  return false;
}

const enc = encodeURIComponent;

export const api = {
  stopBot: (id: string) => post(`/api/bots/${enc(id)}/stop`),
  openBot: (id: string) => post(`/api/bots/${enc(id)}/open`),
  setRole: (id: string, role: string) => post(`/api/bots/${enc(id)}/role`, { role }),
  reconnect: () => post('/api/reconnect'),
};
