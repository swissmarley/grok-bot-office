import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { Bot, OfficeEvent } from '@grok-office/shared';
import { thresholds } from '../src/config.js';
import { DeskRegistry } from '../src/desks.js';
import { OfficeState } from '../src/office-state.js';
import { BridgeSource, parseStep } from '../src/sources/bridge.js';

const FAKE = fileURLToPath(new URL('./fixtures/fake-grokbot.mjs', import.meta.url));

const BOTS = [
  { id: 'b1', name: 'Ada - Chief of Staff', description: 'Runs the team', hidden: false, running: false, needsInput: false, unread: 0, lastActivity: '2026-10-28T08:00:00.000Z', preview: 'All set' },
  { id: 'c1', name: 'Rui - The Rent Scout', description: 'Finds flats', hidden: false, running: true, needsInput: false, unread: 2, lastActivity: null, preview: null },
  { id: 'h1', name: 'Helper', description: '', hidden: true, running: false, needsInput: false, unread: 0, lastActivity: null, preview: null },
];

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'gbo-bridge-'));
  writeFileSync(join(dir, 'bots.json'), JSON.stringify(BOTS));
  writeFileSync(join(dir, 'events.jsonl'), '');
  writeFileSync(join(dir, 'connected'), '');
  writeFileSync(
    join(dir, 'read-c1.json'),
    JSON.stringify({
      bot: 'Rui - The Rent Scout',
      messages: [
        { key: 'k1', role: 'user', kind: 'message', text: 'Find 3 flats in Zurich under 2500 CHF', links: [], at: '2026-10-28T09:00:00.000Z' },
        { key: 'k2', role: 'assistant', kind: 'send-message/text', text: 'On it. Step 1 of 3: searching Homegate.', links: [], at: '2026-10-28T09:00:05.000Z' },
      ],
    }),
  );
  const state = new OfficeState({ desks: new DeskRegistry(join(dir, 'desks.json'), 8), deskCount: 8, thresholds });
  const events: OfficeEvent[] = [];
  state.subscribe((e) => events.push(e));
  const source = new BridgeSource({
    command: FAKE,
    env: { FAKE_GROKBOT_DIR: dir },
    retryMinMs: 50,
    retryMaxMs: 200,
    pollMs: 60_000,
    readDebounceMs: 20,
    cdpPort: 1, // nothing listens: no version label
  });
  const bot = (id: string): Bot | undefined => state.snapshot().bots.find((b) => b.id === id);
  const event = (line: object) => appendFileSync(join(dir, 'events.jsonl'), JSON.stringify(line) + '\n');
  const calls = () => readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const watching = () => until(() => existsSync(join(dir, 'watch-ready')), 10_000);
  cleanup.push(async () => {
    await source.stop();
    // A grokbot child may still be finishing a write into the directory.
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  return { dir, state, events, source, bot, event, calls, watching };
}

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0)) await f();
});

async function until(check: () => unknown, ms = 8000): Promise<number> {
  const t0 = Date.now();
  while (!check()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
  return Date.now() - t0;
}

describe('BridgeSource', () => {
  it('lists the bots (not hidden ones), splits names and reads their task', async () => {
    const { state, source, bot, events } = setup();
    await source.start(state.sink);
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    expect(state.snapshot().bots.map((b) => b.id).sort()).toEqual(['b1', 'c1']);
    expect(bot('b1')).toMatchObject({ name: 'Ada', role: 'Chief of Staff', status: 'sleeping' });
    await until(() => bot('c1')?.task);
    expect(bot('c1')).toMatchObject({
      name: 'Rui',
      status: 'thinking',
      unread: 2,
      task: { title: 'Find 3 flats in Zurich under 2500 CHF', step: { index: 1, total: 3 }, log: [{ text: 'On it. Step 1 of 3: searching Homegate.' }] },
    });
  });

  it('puts a reply in the log within 2 s of the watch event', async () => {
    const { state, source, bot, event, events, watching } = setup();
    await source.start(state.sink);
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    await until(() => bot('c1')?.task);
    await watching();
    const t0 = Date.now();
    event({ type: 'message', bot: 'Rui - The Rent Scout', key: 'k3', role: 'assistant', kind: 'send-message/text', text: 'Found one in Wiedikon: 2400 CHF', links: [], at: new Date().toISOString() });
    await until(() => bot('c1')?.task?.log[0]?.text.startsWith('Found one'));
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(events).toContainEqual(expect.objectContaining({ type: 'activity', botId: 'c1', text: 'Found one in Wiedikon: 2400 CHF' }));
  });

  it('maps working, needs_input and idle', async () => {
    const { state, source, bot, event, events, watching } = setup();
    await source.start(state.sink);
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    // Like the real watch, the fake only streams what happens after it started.
    await watching();
    event({ type: 'needs_input', bot: 'Ada - Chief of Staff', at: new Date().toISOString() });
    await until(() => bot('b1')?.status === 'needs_you');
    event({ type: 'working', bot: 'Ada - Chief of Staff', at: new Date().toISOString() });
    await until(() => bot('b1')?.status === 'thinking');
    event({ type: 'idle', bot: 'Ada - Chief of Staff', at: new Date().toISOString() });
    await until(() => bot('b1')?.status !== 'thinking');
  });

  it('goes Disconnected when Grok Bot closes and comes back by itself', async () => {
    const { dir, state, source, events } = setup();
    await source.start(state.sink);
    const conn = () => events.filter((e) => e.type === 'connection').map((e) => (e as { state: string }).state);
    await until(() => conn().at(-1) === 'connected');
    rmSync(join(dir, 'connected'));
    await until(() => conn().at(-1) === 'disconnected');
    writeFileSync(join(dir, 'connected'), '');
    await until(() => conn().at(-1) === 'connected');
    expect(conn().join(' ')).toMatch(/^disconnected connected( disconnected)+ connected$/);
  });

  it('never lets the bridge launch Grok Bot', async () => {
    const { dir, state, source, events, calls } = setup();
    rmSync(join(dir, 'connected'));
    await source.start(state.sink);
    await new Promise((r) => setTimeout(r, 400));
    expect(events.filter((e) => e.type === 'connection').every((e) => (e as { state: string }).state === 'disconnected')).toBe(true);
    // While unreachable only `status` runs; every call carries the never-launch app path.
    expect(new Set(calls().map((c) => c.cmd))).toEqual(new Set(['status']));
    await expect(source.reconnect()).rejects.toThrow(/grokbot launch/);
    writeFileSync(join(dir, 'connected'), '');
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    expect(calls().every((c) => c.app === '/nonexistent/grok-office-never-launches-grok-bot')).toBe(true);
  });

  it('stops a bot with `grokbot stop <id>`', async () => {
    const { state, source, events, calls } = setup();
    await source.start(state.sink);
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    await source.stopBot('c1');
    expect(calls()).toContainEqual(expect.objectContaining({ cmd: 'stop', args: ['c1', '--json'] }));
  });

  it('leaves no grokbot processes behind when stopped', async () => {
    const { dir, state, source, events, watching } = setup();
    await source.start(state.sink);
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    await watching();
    const pid = Number(readFileSync(join(dir, 'watch-ready'), 'utf8'));
    await source.stop();
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('ignores malformed watch lines', async () => {
    const { dir, state, source, events } = setup();
    await source.start(state.sink);
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    appendFileSync(join(dir, 'events.jsonl'), 'not json\n{"type":"message","bot":"Ada - Chief of Staff"}\n{"type":"hack"}\n');
    await new Promise((r) => setTimeout(r, 200));
    expect(events.filter((e) => e.type === 'connection').at(-1)).toMatchObject({ state: 'connected' });
  });
});

describe('BridgeSource with the office fork', () => {
  it('takes avatars, the main bot and a sleeping computer from bots --json', async () => {
    const { dir, state, source, bot, events } = setup();
    writeFileSync(
      join(dir, 'bots.json'),
      JSON.stringify(
        BOTS.map((b, i) => ({ ...b, avatar: i === 0 ? { shape: 'blob', color: 'black', hasPhoto: false } : { shape: 'heart', color: 'red' }, main: i === 0, computerPhase: 'away' })),
      ),
    );
    await source.start(state.sink);
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    expect(bot('b1')).toMatchObject({ avatar: { shape: 'blob' }, color: '#FFFFFF', main: true, status: 'sleeping' });
    expect(bot('c1')).toMatchObject({ avatar: { shape: 'heart' }, color: '#FF263C' });
    expect(bot('c1')?.main).toBeUndefined();
  });

  it('opens the conversation with `grokbot open`', async () => {
    const { dir, state, source, events, calls } = setup();
    writeFileSync(join(dir, 'fork'), '');
    await source.start(state.sink);
    await until(() => events.some((e) => e.type === 'connection' && e.state === 'connected'));
    await source.openBot('c1');
    expect(calls()).toContainEqual(expect.objectContaining({ cmd: 'open', args: ['c1', '--json'] }));
  });
});

describe('parseStep', () => {
  it.each([
    ['Step 2 of 4: drafting', { index: 2, total: 4 }],
    ['step 3/5 done', { index: 3, total: 5 }],
    ['Passo? no. step 9 of 4', undefined],
    ['no plan here', undefined],
  ])('%s', (text, step) => expect(parseStep(text)).toEqual(step));
});
