import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_STATUSES, type BotStatus, type OfficeEvent } from '@grok-office/shared';
import { MOCK_TIME_SCALE, scaledThresholds } from '../src/config.js';
import { DeskRegistry } from '../src/desks.js';
import { OfficeState } from '../src/office-state.js';
import { MockSource } from '../src/sources/mock.js';

function runMock(seed: number, ms: number) {
  const t = scaledThresholds(MOCK_TIME_SCALE);
  const dir = mkdtempSync(join(tmpdir(), 'gbo-'));
  const state = new OfficeState({ desks: new DeskRegistry(join(dir, 'desks.json'), 8), deskCount: 8, thresholds: t });
  const events: OfficeEvent[] = [];
  state.subscribe((e) => events.push(e));
  const source = new MockSource({ thresholds: t, seed });
  void source.start(state.sink);
  const tick = setInterval(() => state.tick(), 1000);
  vi.advanceTimersByTime(ms);
  clearInterval(tick);
  void source.stop();
  return { state, events };
}

describe('MockSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T09:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it.each([1, 2, 3, 42, 1234])('shows every state within 2 minutes (seed %i)', (seed) => {
    const { events } = runMock(seed, 120_000);
    const seen = new Set<BotStatus>();
    for (const e of events) if (e.type === 'bot.updated') seen.add(e.bot.status);
    expect([...seen].sort()).toEqual([...BOT_STATUSES].sort());
  });

  it('runs 5 bots on distinct desks with roles from their descriptions', () => {
    const { state } = runMock(7, 1000);
    const { bots, desks } = state.snapshot();
    expect(bots.map((b) => `${b.name} ${b.role}`).sort()).toEqual([
      'Brush Design',
      'Patch Code',
      'Relay Social',
      'Scout Research',
      'Tally Finance',
    ]);
    expect(new Set(bots.map((b) => b.deskIndex)).size).toBe(5);
    expect(desks).toBe(8);
  });

  it('requests approvals and resolves or expires them', () => {
    const { events } = runMock(5, 120_000);
    const requested = events.filter((e) => e.type === 'approval.requested');
    const resolved = events.filter((e) => e.type === 'approval.resolved');
    expect(requested.length).toBeGreaterThan(0);
    expect(resolved.map((e) => e.result)).toEqual(expect.arrayContaining(['allowed', 'expired']));
    for (const e of requested) {
      if (e.approval.origin !== 'chat') expect(e.approval.expiresAt).toBeDefined();
    }
  });
});
