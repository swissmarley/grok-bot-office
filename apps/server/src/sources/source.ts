import type { Approval, BotAvatar, Task } from '@grok-office/shared';

/** Kind of the tool a working bot is using, when the source can tell. */
export type ToolKind = 'editor' | 'file' | 'git' | 'browser' | 'shell';

/** Raw signals a source knows about a bot; the office derives the status from them. */
export interface BotSignals {
  working: boolean;
  /** An approval card or an open question is waiting for you. */
  needsInput: boolean;
  /** Last tool in use while working; undefined when the source can't see tool steps. */
  tool?: ToolKind | null;
  /** A tool failed or the bot replied with an error; cleared by the source when work resumes. */
  error: boolean;
  /** When the bot last replied (ISO). */
  lastReplyAt?: string;
  /** The bot's cloud computer is asleep. */
  computerAsleep: boolean;
}

export interface SourceBotUpdate {
  name?: string;
  description?: string;
  /** The bot's avatar color in Grok Bot; without it the office picks one from its palette. */
  color?: string;
  avatar?: BotAvatar;
  signals?: Partial<BotSignals>;
  activity?: string;
  unread?: number;
  /** Replaces the whole task; null clears it. */
  task?: Task | null;
}

/** Callbacks a source uses to push what it sees into the office state. */
export interface SourceSink {
  updateBot(id: string, update: SourceBotUpdate): void;
  removeBot(id: string): void;
  activity(botId: string, text: string, at?: string): void;
  approvalRequested(approval: Approval): void;
  approvalResolved(id: string, result: 'allowed' | 'denied' | 'expired'): void;
  connection(state: 'connected' | 'disconnected', handle?: string): void;
}

export interface BotSource {
  readonly kind: 'mock' | 'bridge';
  start(sink: SourceSink): Promise<void>;
  stop(): Promise<void>;
}
