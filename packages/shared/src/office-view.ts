import type { Bot, OfficeEvent } from './types.js';
import { WORKING_STATUSES } from './types.js';

/** What a client knows about the office after applying the server's events. */
export interface OfficeView {
  bots: Record<string, Bot>;
  desks: number;
}

export const EMPTY_VIEW: OfficeView = { bots: {}, desks: 8 };

/** Applies one event to the bot/desk view. Pure; activity and connection events don't change it. */
export function applyToView(view: OfficeView, event: OfficeEvent): OfficeView {
  switch (event.type) {
    case 'snapshot':
      return { bots: Object.fromEntries(event.bots.map((b) => [b.id, b])), desks: event.desks };
    case 'bot.updated':
      return { ...view, bots: { ...view.bots, [event.bot.id]: event.bot } };
    default:
      return view;
  }
}

export interface Counters {
  working: number;
  needYou: number;
  idle: number;
  freeDesks: number;
}

/**
 * Header counters. working + needYou + idle always equals the number of bots:
 * need you = approvals, questions and errors; idle = done, idle and sleeping.
 */
export function countBots(bots: Bot[], desks: number): Counters {
  const c: Counters = { working: 0, needYou: 0, idle: 0, freeDesks: Math.max(0, desks - bots.length) };
  for (const b of bots) {
    if (WORKING_STATUSES.includes(b.status)) c.working++;
    else if (b.status === 'needs_you' || b.status === 'error') c.needYou++;
    else c.idle++;
  }
  return c;
}
