import { describe, expect, it } from 'vitest';
import { thresholds } from '../src/config.js';
import { deriveStatus } from '../src/status.js';
import type { BotSignals } from '../src/sources/source.js';

const now = Date.parse('2026-10-28T12:00:00Z');
const base: BotSignals = { working: false, needsInput: false, error: false, computerAsleep: false };
const ago = (min: number) => new Date(now - min * 60_000).toISOString();

describe('deriveStatus', () => {
  it.each<[string, Partial<BotSignals>, string]>([
    ['needs_input', { needsInput: true, working: true, tool: 'shell' }, 'needs_you'],
    ['editor tool', { working: true, tool: 'editor' }, 'coding'],
    ['file tool', { working: true, tool: 'file' }, 'coding'],
    ['git tool', { working: true, tool: 'git' }, 'coding'],
    ['browser tool', { working: true, tool: 'browser' }, 'browsing'],
    ['shell tool', { working: true, tool: 'shell' }, 'terminal'],
    ['no active tool', { working: true, tool: null }, 'thinking'],
    ['tool steps unknown (no fork)', { working: true }, 'thinking'],
    ['failed tool', { working: true, tool: 'shell', error: true }, 'error'],
    ['idle 9 min after reply', { lastReplyAt: ago(9) }, 'done'],
    ['idle 11 min after reply', { lastReplyAt: ago(11) }, 'idle'],
    ['idle 31 min after reply', { lastReplyAt: ago(31) }, 'sleeping'],
    ['computer asleep', { lastReplyAt: ago(1), computerAsleep: true }, 'sleeping'],
    ['never replied', {}, 'sleeping'],
  ])('%s', (_name, signals, expected) => {
    expect(deriveStatus({ ...base, ...signals }, now, thresholds)).toBe(expected);
  });
});
