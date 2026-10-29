import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { OfficeEvent } from '@grok-office/shared';
import { AuditLog } from '../src/audit.js';
import { Auth } from '../src/auth.js';
import { buildApp } from '../src/app.js';
import { thresholds } from '../src/config.js';
import { DeskRegistry } from '../src/desks.js';
import { OfficeState } from '../src/office-state.js';
import type { BotSource } from '../src/sources/source.js';

const WEB = 'http://127.0.0.1:5173';
const state = new OfficeState({
  desks: new DeskRegistry(join(mkdtempSync(join(tmpdir(), 'gbo-')), 'desks.json'), 8),
  deskCount: 8,
  thresholds,
});
const auth = new Auth({ port: 4317, webOrigin: WEB });
const calls: string[] = [];
const source: BotSource = {
  kind: 'mock',
  start: async () => {},
  stop: async () => {},
  stopBot: async (id) => void calls.push(`stop ${id}`),
  openBot: async () => {
    throw new Error('Grok Bot is not running');
  },
  reconnect: async () => void calls.push('reconnect'),
  resolveApproval: async (approval, decision) => {
    calls.push(`resolve ${approval.id} ${decision}`);
    const result = decision === 'allow_once' ? 'allowed' : 'denied';
    state.sink.approvalResolved(approval.id, result);
    return result;
  },
};
const auditFile = join(mkdtempSync(join(tmpdir(), 'gbo-audit-')), 'audit.log');
const audit = new AuditLog(auditFile, (id) => state.snapshot().bots.find((b) => b.id === id)?.name ?? id);
state.subscribe(audit.onEvent);
const app = buildApp(state, auth, source, { audit });
let base = '';

beforeAll(async () => {
  await app.listen({ host: '127.0.0.1', port: 0 });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  state.sink.updateBot('a', { name: 'A' });
});
afterAll(() => app.close());

// Requests as the browser on the Vite dev origin would send them.
const browser = { host: '127.0.0.1:5173', origin: WEB };

function openWs(headers: Record<string, string>): Promise<{ events: OfficeEvent[] } | { status: number }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`, { headers });
    const events: OfficeEvent[] = [];
    ws.on('message', (d) => {
      events.push(JSON.parse(String(d)));
      if (events.length === 2) {
        ws.close();
        resolve({ events });
      }
    });
    ws.on('unexpected-response', (_req, res) => resolve({ status: res.statusCode ?? 0 }));
  });
}

describe('server security', () => {
  it('rejects a wrong token and sets an httpOnly cookie for the right one', async () => {
    const bad = await app.inject({ method: 'POST', url: '/api/session', headers: browser, payload: { token: 'nope' } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/api/session', headers: browser, payload: { token: auth.token } });
    expect(ok.statusCode).toBe(204);
    expect(ok.headers['set-cookie']).toMatch(/HttpOnly; SameSite=Strict/);
  });

  it('rejects foreign origins and hosts, and sends no CORS headers', async () => {
    const foreign = await app.inject({
      method: 'POST', url: '/api/session',
      headers: { ...browser, origin: 'https://evil.example' }, payload: { token: auth.token },
    });
    expect(foreign.statusCode).toBe(403);
    const rebound = await app.inject({ method: 'GET', url: '/api/session', headers: { host: 'evil.example:4317' } });
    expect(rebound.statusCode).toBe(403);
    const preflight = await app.inject({
      method: 'OPTIONS', url: '/api/session',
      headers: { ...browser, origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('checks Origin and session cookie on the WebSocket, then sends snapshot + connection', async () => {
    const cookie = auth.sessionCookie().split(';')[0]!;
    expect(await openWs({ ...browser, cookie, origin: 'https://evil.example' })).toEqual({ status: 403 });
    expect(await openWs({ ...browser })).toEqual({ status: 401 });
    const res = await openWs({ ...browser, cookie });
    expect('events' in res && res.events.map((e) => e.type)).toEqual(['snapshot', 'connection']);
  });
});

describe('bot actions', () => {
  const cookie = () => auth.sessionCookie().split(';')[0]!;

  it('need the session cookie and a local origin', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/bots/a/stop', headers: browser })).statusCode).toBe(401);
    const foreign = await app.inject({ method: 'POST', url: '/api/bots/a/stop', headers: { ...browser, cookie: cookie(), origin: 'https://evil.example' } });
    expect(foreign.statusCode).toBe(403);
    expect(calls).toEqual([]);
  });

  it('run on the source and report its errors', async () => {
    const headers = { ...browser, cookie: cookie() };
    expect((await app.inject({ method: 'POST', url: '/api/bots/a/stop', headers })).statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url: '/api/bots/nope/stop', headers })).statusCode).toBe(404);
    const open = await app.inject({ method: 'POST', url: '/api/bots/a/open', headers });
    expect(open.statusCode).toBe(502);
    expect(open.json()).toEqual({ error: 'Grok Bot is not running' });
    expect((await app.inject({ method: 'POST', url: '/api/reconnect', headers })).statusCode).toBe(204);
    expect(calls).toEqual(['stop a', 'reconnect']);
  });

  it('edit the role', async () => {
    const headers = { ...browser, cookie: cookie() };
    const res = await app.inject({ method: 'POST', url: '/api/bots/a/role', headers, payload: { role: 'Lead' } });
    expect(res.statusCode).toBe(204);
    expect(state.snapshot().bots[0]!.role).toBe('Lead');
    expect((await app.inject({ method: 'POST', url: '/api/bots/a/role', headers, payload: { role: 7 } })).statusCode).toBe(400);
  });
});

describe('approvals', () => {
  const cookie = () => auth.sessionCookie().split(';')[0]!;
  const card = (id: string, extra: Record<string, unknown> = {}) =>
    state.sink.approvalRequested({
      id, botId: 'a', action: 'Run a command', target: 'ls ~', inputs: {}, origin: 'chat',
      createdAt: new Date().toISOString(), kind: 'approval', decisions: ['allow_once', 'deny'], ...extra,
    });
  const answer = (id: string, decision: unknown, headers: Record<string, string> = { ...browser, cookie: cookie() }) =>
    app.inject({ method: 'POST', url: `/api/approvals/${id}`, headers, payload: { decision } });

  it('need the session cookie and a local origin', async () => {
    card('c1');
    expect((await answer('c1', 'deny', browser)).statusCode).toBe(401);
    expect((await answer('c1', 'deny', { ...browser, cookie: cookie(), origin: 'https://evil.example' })).statusCode).toBe(403);
    expect(calls.filter((c) => c.startsWith('resolve'))).toEqual([]);
  });

  it('Allow once and Deny reach the source, the result comes back and lands in audit.log', async () => {
    const ok = await answer('c1', 'allow_once');
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ result: 'allowed' });
    card('c2');
    expect((await answer('c2', 'deny')).json()).toEqual({ result: 'denied' });
    await audit.flushed();
    const lines = readFileSync(auditFile, 'utf8').trim().split('\n').map((l) => l.split('\t'));
    expect(lines.map((l) => l.slice(1))).toEqual([
      ['A', 'Run a command ls ~', 'allowed', 'office'],
      ['A', 'Run a command ls ~', 'denied', 'office'],
    ]);
  });

  it('refuses always allow, decisions the card does not offer, expired and unknown cards', async () => {
    card('c3', { decisions: [] });
    expect((await answer('c3', 'always')).statusCode).toBe(400);
    expect((await answer('c3', 'allow_once')).statusCode).toBe(409);
    state.sink.approvalResolved('c3', 'expired');
    card('c4', { expiresAt: new Date(Date.now() - 1000).toISOString(), origin: 'routine' });
    expect((await answer('c4', 'deny')).statusCode).toBe(409);
    expect((await answer('nope', 'deny')).statusCode).toBe(404);
    expect(calls.filter((c) => c.startsWith('resolve'))).toEqual(['resolve c1 allow_once', 'resolve c2 deny']);
  });

  it('logs expired cards too', async () => {
    state.sink.approvalResolved('c4', 'expired');
    await audit.flushed();
    expect(readFileSync(auditFile, 'utf8').trim().split('\n').at(-1)).toMatch(/\tA\tRun a command ls ~\texpired\t-$/);
  });
});
