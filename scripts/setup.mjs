#!/usr/bin/env node
// One command to set up Grok Bot Office on a Mac:
//   1. checks the tools it needs (macOS, Node 22+, pnpm, Bun, git)
//   2. installs the office's dependencies and builds the UI
//   3. builds the office fork of grokbot-bridge from bridge-fork/patches/ and installs it
//      globally as `grokbot`
//
//   node scripts/setup.mjs [--bridge-dir <dir>] [--no-global]
//   pnpm run setup                                  (`pnpm setup` is a pnpm command of its own)
//
// The fork is built in ~/.grok-office/grokbot-bridge unless --bridge-dir (or GBO_BRIDGE_DIR)
// says otherwise. Running it again brings an existing fork up to date with the patches.
// --no-global builds the fork without installing it as `grokbot`.
//
// It never starts, quits or restarts Grok Bot and never opens its debug port: that is
// `grokbot launch`, which you run yourself when you want to use the office.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM = 'https://github.com/TheSethRose/grokbot-bridge.git';
/** Upstream commit the patches apply to. */
const BASE = 'b905584';
const BRANCH = 'office-adapter';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const bridgeDir = resolve(flag('--bridge-dir') ?? process.env.GBO_BRIDGE_DIR ?? join(homedir(), '.grok-office', 'grokbot-bridge'));
const global = !args.includes('--no-global');
const patchDir = join(root, 'bridge-fork', 'patches');

const step = (text) => console.log(`\n▸ ${text}`);
const fail = (text) => {
  console.error(`\n✗ ${text}`);
  process.exit(1);
};
/** Runs a command in the foreground; stops the setup if it fails. */
const run = (cmd, cmdArgs, cwd = root) => {
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
  if (r.error) fail(`Couldn't run ${cmd}: ${r.error.message}`);
  if (r.status !== 0) fail(`\`${cmd} ${cmdArgs.join(' ')}\` failed (in ${cwd}).`);
};
/** Output of a command, or null if it isn't there or fails. */
const read = (cmd, cmdArgs, cwd = root) => {
  try {
    return execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

step('Checking the tools');
if (process.platform !== 'darwin') {
  console.warn('  ! grokbot-bridge is only tested on macOS; the mock office works anywhere (`pnpm start --mock`).');
}
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) fail(`Node.js 22 or newer is needed (this is ${process.versions.node}).`);
const missing = [
  ['git', 'xcode-select --install'],
  ['pnpm', 'corepack enable   (comes with Node.js), or: npm install -g pnpm'],
  ['bun', 'brew install oven-sh/bun/bun   (or see https://bun.sh)'],
].filter(([cmd]) => read(cmd, ['--version']) === null);
if (missing.length) {
  fail(`Missing: ${missing.map(([c]) => c).join(', ')}. Install with:\n${missing.map(([c, how]) => `    ${c}: ${how}`).join('\n')}\n  then run this again.`);
}
console.log(`  node ${process.versions.node} · pnpm ${read('pnpm', ['--version'])} · bun ${read('bun', ['--version'])} · git ok`);

step('Installing the office');
run('pnpm', ['install', '--frozen-lockfile']);
run('pnpm', ['--filter', '@grok-office/web', 'build']);

step(`Building the grokbot-bridge fork in ${bridgeDir}`);
const patches = readdirSync(patchDir).filter((f) => f.endsWith('.patch')).sort().map((f) => join(patchDir, f));
if (!patches.length) fail(`No patches in ${patchDir}.`);
if (!existsSync(join(bridgeDir, '.git'))) {
  mkdirSync(dirname(bridgeDir), { recursive: true });
  run('git', ['clone', UPSTREAM, bridgeDir]);
} else if (read('git', ['status', '--porcelain'], bridgeDir)) {
  fail(`${bridgeDir} has uncommitted changes. Commit or discard them, or pass --bridge-dir <another folder>.`);
} else {
  run('git', ['fetch', '--quiet', 'origin'], bridgeDir);
}
// Rebuild the branch from the upstream base plus the patches, so a re-run picks up new ones.
run('git', ['checkout', '--quiet', '-B', BRANCH, BASE], bridgeDir);
const identity = read('git', ['config', 'user.email'], bridgeDir) ? [] : ['-c', 'user.name=Grok Bot Office setup', '-c', 'user.email=setup@grok-office.invalid'];
run('git', [...identity, 'am', '--quiet', ...patches], bridgeDir);
run('bun', ['install', '--frozen-lockfile'], bridgeDir);
run('bun', ['test'], bridgeDir);
run('bun', ['run', 'build'], bridgeDir);

if (global) {
  step('Installing it as `grokbot`');
  run('npm', ['install', '--global', bridgeDir]);
  const version = read('grokbot', ['--version']);
  if (version === null) fail('`grokbot` is not on your PATH after installing. Check `npm prefix -g`/bin is in PATH.');
  const help = read('grokbot', ['--help']) ?? '';
  if (!/office-watch/.test(help)) fail('The `grokbot` on your PATH is not the office fork. Is another one installed earlier in PATH?');
  console.log(`  grokbot ${version} (office fork) at ${read('which', ['grokbot'])}`);
} else {
  console.log(`  Skipped the global install (--no-global). Run it with: node ${join(bridgeDir, 'dist', 'cli.js')}`);
}

console.log(`
✓ Grok Bot Office is set up.

Each time you want to use it:
    grokbot launch      # restarts Grok Bot with the debug port on 127.0.0.1:9333
    grokbot internals   # optional: every line should say ok
    pnpm start          # opens the office in your browser
    grokbot restore     # when you're done: closes the debug port

Without Grok Bot: pnpm start --mock`);
