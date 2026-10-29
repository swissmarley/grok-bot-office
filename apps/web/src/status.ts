import type { BotStatus } from '@grok-office/shared';

export const STATUS_LABEL: Record<BotStatus, string> = {
  coding: 'Coding',
  browsing: 'Browsing',
  terminal: 'In terminal',
  thinking: 'Thinking',
  needs_you: 'Needs you',
  error: 'Error',
  done: 'Done',
  idle: 'Idle',
  sleeping: 'Sleeping',
};

const STATUS_TOKEN: Record<BotStatus, string> = {
  coding: '--st-coding',
  browsing: '--st-browsing',
  terminal: '--st-terminal',
  thinking: '--st-thinking',
  needs_you: '--st-needs',
  error: '--st-error',
  done: '--st-done',
  idle: '--st-idle',
  sleeping: '--st-idle',
};

/** CSS value for panels: `var(--st-…)`. */
export function statusVar(status: BotStatus): string {
  return `var(${STATUS_TOKEN[status]})`;
}

let resolved: Partial<Record<BotStatus, string>> = {};

/** Hex for the scene, read from the same CSS tokens the panels use. */
export function statusHex(status: BotStatus): string {
  const cached = resolved[status];
  if (cached) return cached;
  const value = getComputedStyle(document.documentElement).getPropertyValue(STATUS_TOKEN[status]).trim();
  resolved = { ...resolved, [status]: value || '#64748B' };
  return resolved[status]!;
}

/** Team list order: needs_you, error, working, done, idle, sleeping. */
export const STATUS_RANK: Record<BotStatus, number> = {
  needs_you: 0,
  error: 1,
  coding: 2,
  browsing: 2,
  terminal: 2,
  thinking: 2,
  done: 3,
  idle: 4,
  sleeping: 5,
};

export function isWorking(status: BotStatus): boolean {
  return STATUS_RANK[status] === 2;
}
