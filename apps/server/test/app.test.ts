import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { OfficeEvent } from '@grok-office/shared';
import { Auth } from '../src/auth.js';
import { buildApp } from '../src/app.js';
import { thresholds } from '../src/config.js';
import { DeskRegistry } from '../src/desks.js';
import { OfficeState } from '../src/office-state.js';

const WEB = 'http://127.0.0.1:5173';
const state = new OfficeState({
  desks: new DeskRegistry(join(mkdtempSync(join(tmpdir(), 'gbo-')), 'desks.json'), 8),
  deskCount: 8,
  thresholds,
});
const auth = new Auth({ port: 4317, webOrigin: WEB });
const app = buildApp(state, auth);
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
