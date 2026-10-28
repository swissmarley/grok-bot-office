import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { thresholds } from '../src/config.js';
import { DeskRegistry } from '../src/desks.js';
import { OfficeState, splitName } from '../src/office-state.js';
import { RoleStore } from '../src/roles.js';

function setup(dir = mkdtempSync(join(tmpdir(), 'gbo-'))) {
  const state = new OfficeState({
    desks: new DeskRegistry(join(dir, 'desks.json'), 8),
    roles: new RoleStore(join(dir, 'roles.json')),
    deskCount: 8,
    thresholds,
  });
  const bot = (id: string) => state.snapshot().bots.find((b) => b.id === id)!;
  return { state, bot, dir };
}

describe('bot naming', () => {
  it.each([
    ['Ada - Chief of Staff', 'Ada', 'Chief of Staff'],
    ['Rui – The Rent Scout', 'Rui', 'The Rent Scout'],
    ['Lin — The Reviewer', 'Lin', 'The Reviewer'],
    ['Scout', 'Scout', undefined],
    ['Re-Do', 'Re-Do', undefined],
  ])('splits %s', (raw, name, role) => {
    expect(splitName(raw)).toEqual(role ? { name, role } : { name });
  });

  it('prefers your role, then the name suffix, then the description', () => {
    const { state, bot, dir } = setup();
    state.sink.updateBot('a', { name: 'Scout', description: 'Research agent' });
    expect(bot('a')).toMatchObject({ name: 'Scout', role: 'Research' });
    state.sink.updateBot('a', { name: 'Scout - The Researcher' });
    expect(bot('a')).toMatchObject({ name: 'Scout', role: 'The Researcher' });
    state.setRole('a', '  Market intel  ');
    expect(bot('a').role).toBe('Market intel');

    // Survives a restart, and clearing it brings the default back.
    const again = setup(dir);
    again.state.sink.updateBot('a', { name: 'Scout - The Researcher' });
    expect(again.bot('a').role).toBe('Market intel');
    again.state.setRole('a', '');
    expect(again.bot('a').role).toBe('The Researcher');
  });

  it('flags the main bot', () => {
    const { state, bot } = setup();
    state.sink.updateBot('a', { name: 'Bob', main: true });
    expect(bot('a').main).toBe(true);
    state.sink.updateBot('a', { main: false });
    expect(bot('a').main).toBeUndefined();
  });
});
