// `pnpm dev [--mock]`: office server (tsx watch) + Vite dev server, one token for the whole run.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const mock = process.argv.includes('--mock');
const env = {
  ...process.env,
  // Generated here so server restarts under tsx watch keep the same token.
  GBO_TOKEN: process.env.GBO_TOKEN ?? randomBytes(24).toString('base64url'),
  GBO_WEB_ORIGIN: 'http://127.0.0.1:5173',
  FORCE_COLOR: '1',
};

const children = [
  run('server', ['--filter', '@grok-office/server', 'exec', 'tsx', 'watch', '--clear-screen=false', 'src/index.ts', ...(mock ? ['--mock'] : [])]),
  run('web', ['--filter', '@grok-office/web', 'exec', 'vite', '--clearScreen', 'false']),
];

function run(name, args) {
  const child = spawn('pnpm', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = name === 'server' ? '\x1b[35m[server]\x1b[0m ' : '\x1b[36m[web]\x1b[0m    ';
  for (const stream of [child.stdout, child.stderr]) {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) process.stdout.write(prefix + line + '\n');
    });
  }
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`${prefix}exited with code ${code}`);
      stop(code);
    }
  });
  return child;
}

function stop(code = 0) {
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
