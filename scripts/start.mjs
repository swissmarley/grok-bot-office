#!/usr/bin/env node
// One command: builds the UI if it changed, starts the office server on 127.0.0.1:4317
// serving it, and opens the browser with a one-time token.
//
//   pnpm start [--mock] [--no-open]
//   grok-office [--mock] [--no-open]      (after `pnpm link --global` in this folder)

import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const mock = args.includes('--mock');
const open = !args.includes('--no-open');
const port = Number(process.env.GBO_PORT ?? 4317);
const origin = `http://127.0.0.1:${port}`;

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error(`Grok Bot Office needs Node.js 22 or newer (this is ${process.version}).`);
  process.exit(1);
}
if (!existsSync(join(root, 'node_modules'))) {
  console.error(`Dependencies missing. Run \`pnpm install\` in ${root} first.`);
  process.exit(1);
}

const dist = join(root, 'apps/web/dist');
const newest = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((t, e) => {
    const p = join(dir, e.name);
    return Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }, 0);
const sources = ['apps/web/src', 'apps/web/index.html', 'packages/shared/src'].map((p) => join(root, p));
const builtAt = existsSync(join(dist, 'index.html')) ? statSync(join(dist, 'index.html')).mtimeMs : 0;
if (sources.some((p) => (statSync(p).isDirectory() ? newest(p) : statSync(p).mtimeMs) > builtAt)) {
  console.log('Building the UI…');
  execFileSync('pnpm', ['--filter', '@grok-office/web', 'build'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
}

const token = randomBytes(24).toString('base64url');
const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts', ...(mock ? ['--mock'] : [])], {
  cwd: join(root, 'apps/server'),
  env: { ...process.env, GBO_TOKEN: token, GBO_STATIC_DIR: dist, GBO_WEB_ORIGIN: origin, GBO_PORT: String(port) },
  stdio: 'inherit',
});
server.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));

// Wait until the server answers, then open the browser.
const url = `${origin}/?token=${token}`;
for (let i = 0; i < 100; i++) {
  const up = await fetch(`${origin}/api/session`).then(() => true, () => false);
  if (up) break;
  await new Promise((r) => setTimeout(r, 100));
}
if (open) {
  const [cmd, cmdArgs] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  console.log('Opened the office in your browser.');
}
