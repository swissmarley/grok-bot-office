import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { OfficeEvent } from '@grok-office/shared';
import { thresholds } from '../src/config.js';
import { DeskRegistry } from '../src/desks.js';
import { OfficeState, roleFrom } from '../src/office-state.js';

function setup(now: { t: number }, file = join(mkdtempSync(join(tmpdir(), 'gbo-')), 'desks.json')) {
  const state = new OfficeState({ desks: new DeskRegistry(file, 8), deskCount: 8, thresholds, now: () => now.t });
  const events: OfficeEvent[] = [];
  state.subscribe((e) => events.push(e));
  return { state, events, file };
}

describe('OfficeState', () => {
  it('derives role from the first word of the description', () => {
    expect(roleFrom('Research agent for pricing')).toBe('Research');
    expect(roleFrom('Design, mostly')).toBe('Design');
    expect(roleFrom(undefined)).toBe('');
  });

  it('only emits bot.updated when something changed', () => {
    const now = { t: Date.parse('2026-10-28T09:00:00Z') };
    const { state, events } = setup(now);
    state.sink.updateBot('a', { name: 'A', signals: { working: true } });
    state.sink.updateBot('a', { signals: { working: true } });
    expect(events.filter((e) => e.type === 'bot.updated')).toHaveLength(1);
  });

  it('moves done → idle → sleeping over time', () => {
    const now = { t: Date.parse('2026-10-28T09:00:00Z') };
    const { state, events } = setup(now);
    state.sink.updateBot('a', { signals: { working: false, lastReplyAt: new Date(now.t).toISOString() } });
    const statuses = () => events.flatMap((e) => (e.type === 'bot.updated' ? [e.bot.status] : []));
    now.t += 11 * 60_000;
    state.tick();
    now.t += 20 * 60_000;
    state.tick();
    expect(statuses()).toEqual(['done', 'idle', 'sleeping']);
  });

  it('expires approvals not born in chat after the TTL', () => {
    const now = { t: Date.parse('2026-10-28T09:00:00Z') };
    const { state, events } = setup(now);
    state.sink.updateBot('a', { signals: { working: true } });
    state.sink.approvalRequested({
      id: 'x', botId: 'a', action: 'Post', target: 'X', inputs: {}, origin: 'trigger',
      createdAt: new Date(now.t).toISOString(),
    });
    expect(state.snapshot().bots[0]!.status).toBe('needs_you');
    expect(state.snapshot().bots[0]!.approval!.expiresAt).toBe(new Date(now.t + 10 * 60_000).toISOString());
    now.t += 10 * 60_000;
    state.tick();
    expect(events).toContainEqual({ type: 'approval.resolved', id: 'x', result: 'expired' });
    expect(state.snapshot().bots[0]!.approval).toBeUndefined();
  });

  it('keeps desk assignments stable across restarts', () => {
    const now = { t: 0 };
    const first = setup(now);
    first.state.sink.updateBot('b', {});
    first.state.sink.updateBot('a', {});
    expect(JSON.parse(readFileSync(first.file, 'utf8'))).toEqual({ b: 0, a: 1 });

    const second = setup(now, first.file);
    second.state.sink.updateBot('a', {});
    second.state.sink.updateBot('c', {});
    second.state.sink.updateBot('b', {});
    const desks = Object.fromEntries(second.state.snapshot().bots.map((b) => [b.id, b.deskIndex]));
    expect(desks).toEqual({ a: 1, c: 2, b: 0 });
  });

  it('adds a row of desks when every desk is taken', () => {
    const now = { t: 0 };
    const { state, events } = setup(now);
    for (let i = 0; i < 8; i++) state.sink.updateBot(`b${i}`, {});
    expect(state.snapshot().desks).toBe(8);
    expect(events.some((e) => e.type === 'snapshot')).toBe(false);
    state.sink.updateBot('b8', {});
    expect(events.at(-1)).toMatchObject({ type: 'snapshot', desks: 12 });
    for (let i = 9; i < 13; i++) state.sink.updateBot(`b${i}`, {});
    expect(state.snapshot().desks).toBe(16);
  });
});
