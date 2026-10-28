import type { BotStatus } from '@grok-office/shared';
import type { Thresholds } from './config.js';
import type { BotSignals, ToolKind } from './sources/source.js';

const TOOL_STATUS: Record<ToolKind, BotStatus> = {
  editor: 'coding',
  file: 'coding',
  git: 'coding',
  browser: 'browsing',
  shell: 'terminal',
};

/** Signal → office status, as in the mapping table of SPEC.md. */
export function deriveStatus(s: BotSignals, now: number, t: Thresholds): BotStatus {
  if (s.needsInput) return 'needs_you';
  if (s.error) return 'error';
  if (s.working) return s.tool ? TOOL_STATUS[s.tool] : 'thinking';
  if (s.computerAsleep) return 'sleeping';
  const since = s.lastReplyAt ? now - Date.parse(s.lastReplyAt) : Infinity;
  if (since <= t.doneMs) return 'done';
  if (since <= t.sleepMs) return 'idle';
  return 'sleeping';
}
