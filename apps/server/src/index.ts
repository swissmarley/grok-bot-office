import { join } from 'node:path';
import { config, MOCK_TIME_SCALE, scaledThresholds, thresholds } from './config.js';
import { Auth } from './auth.js';
import { buildApp } from './app.js';
import { DeskRegistry } from './desks.js';
import { OfficeState } from './office-state.js';
import { RoleStore } from './roles.js';
import { BridgeSource } from './sources/bridge.js';
import { MockSource } from './sources/mock.js';
import type { BotSource } from './sources/source.js';

const mock = process.argv.includes('--mock') || process.env.GBO_SOURCE === 'mock';
const activeThresholds = mock ? scaledThresholds(MOCK_TIME_SCALE) : thresholds;

const state = new OfficeState({
  // Mock bots keep their own desk file so they never take desks from real bots.
  desks: new DeskRegistry(join(config.dataDir, mock ? 'desks.mock.json' : 'desks.json'), config.deskCount),
  roles: new RoleStore(join(config.dataDir, mock ? 'roles.mock.json' : 'roles.json')),
  deskCount: config.deskCount,
  thresholds: activeThresholds,
});
const auth = new Auth({ token: process.env.GBO_TOKEN, port: config.port, webOrigin: config.webOrigin });
const source: BotSource = mock
  ? new MockSource({
      thresholds: activeThresholds,
      count: Number(process.env.GBO_MOCK_BOTS) || undefined,
      showcase: process.env.GBO_MOCK_SHOWCASE === '1',
    })
  : new BridgeSource();
const app = buildApp(state, auth, source);

await app.listen({ host: config.host, port: config.port });
const tick = setInterval(() => state.tick(), config.tickMs);

console.log(`Grok Bot Office server on http://${config.host}:${config.port} (${source.kind} source)`);
console.log(`Open: ${config.webOrigin}/?token=${auth.token}`);

source.start(state.sink).catch((err: unknown) => {
  console.error(`[${source.kind}] ${err instanceof Error ? err.message : String(err)}`);
});

const shutdown = async () => {
  clearInterval(tick);
  await source.stop();
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
