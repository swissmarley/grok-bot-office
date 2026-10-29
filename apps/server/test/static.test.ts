import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Auth } from '../src/auth.js';
import { buildApp } from '../src/app.js';
import { thresholds } from '../src/config.js';
import { DeskRegistry } from '../src/desks.js';
import { OfficeState } from '../src/office-state.js';

const dir = mkdtempSync(join(tmpdir(), 'gbo-static-'));
const dist = join(dir, 'dist');
mkdirSync(join(dist, 'assets'), { recursive: true });
writeFileSync(join(dist, 'index.html'), '<!doctype html><title>office</title>');
writeFileSync(join(dist, 'assets', 'app-123.js'), 'console.log(1)');
writeFileSync(join(dir, 'secret.txt'), 'outside the build');

const state = new OfficeState({ desks: new DeskRegistry(join(dir, 'desks.json'), 8), deskCount: 8, thresholds });
const app = buildApp(state, new Auth({ port: 4317, webOrigin: 'http://127.0.0.1:4317' }), undefined, { staticDir: dist });
afterAll(() => app.close());
const get = (url: string) => app.inject({ method: 'GET', url, headers: { host: '127.0.0.1:4317' } });

describe('production UI', () => {
  it('serves the app shell and hashed assets', async () => {
    const shell = await get('/?token=abc');
    expect(shell.statusCode).toBe(200);
    expect(shell.headers['content-type']).toMatch(/text\/html/);
    expect(shell.headers['cache-control']).toBe('no-cache');
    const asset = await get('/assets/app-123.js');
    expect(asset.body).toBe('console.log(1)');
    expect(asset.headers['cache-control']).toMatch(/immutable/);
  });

  it('never serves files outside the build', async () => {
    for (const url of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/../../secret.txt', '/..%2Fsecret.txt']) {
      const res = await get(url);
      expect(res.body).not.toContain('outside the build');
    }
    expect((await get('/%E0%A4%A')).statusCode).toBe(400);
  });

  it('sends anti-framing and CSP headers', async () => {
    const res = await get('/');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy']).toContain('ws://127.0.0.1:4317');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('keeps the API out of the fallback', async () => {
    expect((await get('/api/nope')).statusCode).toBe(401);
  });
});
