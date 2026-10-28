// Office data model. Bot, Task, Approval and OfficeEvent mirror SPEC.md exactly;
// the server normalizes every source into these and the browser sees nothing else.

export type BotStatus =
  | 'coding' | 'browsing' | 'terminal' | 'thinking'
  | 'needs_you' | 'error' | 'done' | 'idle' | 'sleeping';

export interface Bot {
  id: string; name: string; role: string;   // role: modificabile, default = prima parola della description
  color: string; deskIndex: number;
  status: BotStatus; activity: string;      // es. "Reading 9 pricing pages"
  unread: number; updatedAt: string;
  task?: Task; approval?: Approval;
}

export interface Task {
  title: string;                            // dal tuo ultimo messaggio, max 60 caratteri
  log: { at: string; text: string }[];      // risposte del bot nel turno, newest first
  step?: { index: number; total: number };  // solo se il bot dichiara un piano, altrimenti barra indeterminata
}

export interface Approval {
  id: string; botId: string;
  action: string; target: string; inputs: Record<string, unknown>;
  origin: 'chat' | 'routine' | 'trigger' | 'bot';
  createdAt: string; expiresAt?: string;    // +10 min se origin != 'chat'
}

export type OfficeEvent =
  | { type: 'snapshot'; bots: Bot[]; desks: number }
  | { type: 'bot.updated'; bot: Bot }
  | { type: 'activity'; botId: string; at: string; text: string }
  | { type: 'approval.requested'; approval: Approval }
  | { type: 'approval.resolved'; id: string; result: 'allowed' | 'denied' | 'expired' }
  | { type: 'connection'; state: 'connected' | 'disconnected'; handle?: string };

export const BOT_STATUSES: readonly BotStatus[] = [
  'coding', 'browsing', 'terminal', 'thinking',
  'needs_you', 'error', 'done', 'idle', 'sleeping',
];

export const WORKING_STATUSES: readonly BotStatus[] = ['coding', 'browsing', 'terminal', 'thinking'];

/** Desks come in rows of this many; a new row appears when every desk is taken. */
export const DESKS_PER_ROW = 4;
