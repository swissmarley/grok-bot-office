import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_VIEW, applyToView, countBots, type OfficeView } from '@grok-office/shared';
import { MOCK_TIME_SCALE, scaledThresholds } from '../src/config.js';
import { DeskRegistry } from '../src/desks.js';
import { OfficeState } from '../src/office-state.js';
import { MockSource } from '../src/sources/mock.js';

// The browser rebuilds the office from the event stream (snapshot, then deltas).
// At any moment its view, and the counters drawn from it, must equal the server's.
describe('client view vs server state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T09:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it.each([5, 13])('stays identical through 2 minutes of mock with %i bots', async (count) => {
    const t = scaledThresholds(MOCK_TIME_SCALE);
    const dir = mkdtempSync(join(tmpdir(), 'gbo-'));
    const state = new OfficeState({ desks: new DeskRegistry(join(dir, 'desks.json'), 8), deskCount: 8, thresholds: t });
    const source = new MockSource({ thresholds: t, seed: 9, count });

    // A client that connects late gets a snapshot first, like the WebSocket does.
    let view: OfficeView | undefined;
    await source.start(state.sink);
    const tick = setInterval(() => state.tick(), 1000);
    vi.advanceTimersByTime(7_000);
    view = applyToView(EMPTY_VIEW, state.snapshot());
    state.subscribe((e) => (view = applyToView(view!, e)));

    for (let s = 0; s < 120; s++) {
      vi.advanceTimersByTime(1000);
      if (s % 10 === 0) await source.stopBot(`mock-patch`).catch(() => {});
      const server = state.snapshot();
      expect(Object.values(view.bots).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [...server.bots].sort((a, b) => a.id.localeCompare(b.id)),
      );
      expect(view.desks).toBe(server.desks);
      const c = countBots(Object.values(view.bots), view.desks);
      expect(c.working + c.needYou + c.idle).toBe(server.bots.length);
      expect(c).toEqual(countBots(server.bots, server.desks));
    }
    clearInterval(tick);
    await source.stop();
  });
});
