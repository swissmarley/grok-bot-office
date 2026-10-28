// Office data model. Bot, Task, Approval and OfficeEvent mirror SPEC.md, plus the
// optional Bot.avatar and Bot.main; the server normalizes every source into these and
// the browser sees nothing else.

export type BotStatus =
  | 'coding' | 'browsing' | 'terminal' | 'thinking'
  | 'needs_you' | 'error' | 'done' | 'idle' | 'sleeping';

export interface Bot {
  id: string; name: string; role: string;   // role: modificabile, default = prima parola della description
  color: string; deskIndex: number;
  status: BotStatus; activity: string;      // es. "Reading 9 pricing pages"
  unread: number; updatedAt: string;
  task?: Task; approval?: Approval;
  avatar?: BotAvatar;                       // aggiunta: forma dell'avatar di Grok Bot (il colore è `color`)
  main?: boolean;                           // aggiunta: il bot principale (stellina nell'app)
}

/** The 14 avatar shapes of Grok Bot's "Create New Bot" picker, in its order. */
export type AvatarShape =
  | 'round' | 'cloud' | 'square' | 'sparkle' | 'clover'
  | 'heart' | 'flower' | 'drop' | 'pill' | 'triangle'
  | 'pentagon' | 'splat' | 'hexagon' | 'pumpkin';

export interface BotAvatar {
  shape: AvatarShape;
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

export const AVATAR_SHAPES: readonly AvatarShape[] = [
  'round', 'cloud', 'square', 'sparkle', 'clover',
  'heart', 'flower', 'drop', 'pill', 'triangle',
  'pentagon', 'splat', 'hexagon', 'pumpkin',
];

/** The 11 avatar colors of the same picker, in its order. */
export const AVATAR_COLORS = {
  white: '#FFFFFF',
  brown: '#936439',
  red: '#FF263C',
  orange: '#FF6700',
  amber: '#FF9800',
  green: '#00C972',
  teal: '#00BCA6',
  blue: '#1084FE',
  purple: '#9159FE',
  pink: '#FF309B',
  gray: '#777777',
} as const;

/** Shapes that keep their own color whatever color is picked. */
export const AVATAR_FIXED_COLORS: Partial<Record<AvatarShape, string>> = {
  pumpkin: AVATAR_COLORS.orange,
};

export const WORKING_STATUSES: readonly BotStatus[] = ['coding', 'browsing', 'terminal', 'thinking'];

/** Desks come in rows of this many; a new row appears when every desk is taken. */
export const DESKS_PER_ROW = 4;
