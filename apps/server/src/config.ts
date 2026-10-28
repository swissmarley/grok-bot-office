import { homedir } from 'node:os';
import { join } from 'node:path';

const MIN = 60_000;

export interface Thresholds {
  /** idle within this long after the last reply shows as `done`. */
  doneMs: number;
  /** idle beyond this long shows as `sleeping` (between doneMs and this: `idle`). */
  sleepMs: number;
  /** approvals not born in chat expire after this long. */
  approvalTtlMs: number;
}

export const thresholds: Thresholds = {
  doneMs: 10 * MIN,
  sleepMs: 30 * MIN,
  approvalTtlMs: 10 * MIN,
};

/** Mock mode compresses time so every state shows up within a couple of minutes. */
export const MOCK_TIME_SCALE = 20;

export function scaledThresholds(scale: number): Thresholds {
  return {
    doneMs: thresholds.doneMs / scale,
    sleepMs: thresholds.sleepMs / scale,
    approvalTtlMs: thresholds.approvalTtlMs / scale,
  };
}

export const config = {
  host: '127.0.0.1',
  port: Number(process.env.GBO_PORT ?? 4317),
  /** Origin the browser UI is served from; the Vite dev server in development. */
  webOrigin: process.env.GBO_WEB_ORIGIN ?? 'http://127.0.0.1:4317',
  deskCount: 8,
  /** How often time-based states (done → idle → sleeping, expiries) are re-evaluated. */
  tickMs: 1000,
  dataDir: process.env.GBO_HOME ?? join(homedir(), '.grok-office'),
  bridge: {
    /** grokbot-bridge CLI. */
    command: process.env.GROKBOT_BIN ?? 'grokbot',
    cdpPort: Number(process.env.GROKBOT_CDP_PORT ?? 9333),
    /** Reconnect backoff after Grok Bot goes away. */
    retryMinMs: 1000,
    retryMaxMs: 15_000,
    /** How often the bot list is re-read (names, unread, new or deleted bots). */
    pollMs: 30_000,
    /** Wait this long after a state change before reading the conversation, to batch bursts. */
    readDebounceMs: 300,
    commandTimeoutMs: 20_000,
  },
};

export const TASK_TITLE_MAX_CHARS = 60;
