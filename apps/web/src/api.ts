import type { ApprovalDecision, ApprovalResult } from '@grok-office/shared';
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

/** Answers one card; resolves with how it ended, or null after showing the error as a toast. */
async function answer(id: string, decision: ApprovalDecision): Promise<ApprovalResult | null> {
  try {
    const res = await fetch(`/api/approvals/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    const data = (await res.json().catch(() => ({}))) as { result?: ApprovalResult; error?: unknown };
    if (res.ok && data.result) return data.result;
    useOffice.getState().toast(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`, 'error');
  } catch {
    useOffice.getState().toast('The office server is not reachable', 'error');
  }
  return null;
}

const enc = encodeURIComponent;

export const api = {
  stopBot: (id: string) => post(`/api/bots/${enc(id)}/stop`),
  openBot: (id: string) => post(`/api/bots/${enc(id)}/open`),
  setRole: (id: string, role: string) => post(`/api/bots/${enc(id)}/role`, { role }),
  reconnect: () => post('/api/reconnect'),
  answer,
};
