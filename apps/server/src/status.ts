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

/**
 * Word stems that say which kind of tool a bot's own status line is about, in Italian and English,
 * checked in this order. Bots that write a status line ("cercando sul web", "eseguendo comandi")
 * don't expose their tools to Grok Bot's window, so this is the only hint.
 */
const STATUS_WORDS: [ToolKind, RegExp][] = [
  ['shell', /\b(comand|command|terminal|shell|bash|esegu|lanci|running|run |script|install)/],
  ['browser', /\b(web|internet|online|sito|siti|site|pagin|page|brows|navig|search|google|ricerc|url|link)/],
  ['editor', /\b(codic|code|coding|programm|file|git|commit|branch|pull request|refactor|debug|compil|build)/],
];

/** Kind of tool a status line like "cercando sul web" talks about; null when it doesn't say. */
export function toolFromStatusText(text: string | null | undefined): ToolKind | null {
  if (!text) return null;
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return STATUS_WORDS.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** Signal → office status, as in the mapping table of SPEC.md. */
export function deriveStatus(s: BotSignals, now: number, t: Thresholds): BotStatus {
  if (s.needsInput || s.openQuestion) return 'needs_you';
  if (s.error) return 'error';
  if (s.working) return s.tool ? TOOL_STATUS[s.tool] : 'thinking';
  if (s.computerAsleep) return 'sleeping';
  const since = s.lastReplyAt ? now - Date.parse(s.lastReplyAt) : Infinity;
  if (since <= t.doneMs) return 'done';
  if (since <= t.sleepMs) return 'idle';
  return 'sleeping';
}
