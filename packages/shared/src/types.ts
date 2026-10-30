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

/**
 * The 14 avatar shapes of Grok Bot's "Create New Bot" picker, in its order. Names are the
 * app's own `avatarShape` values where seen (Grok Bot 0.78.1); cloud, square, sparkle,
 * flower, pill and pentagon are ours until a bot with one of them shows the real name.
 */
export type AvatarShape =
  | 'blob' | 'cloud' | 'square' | 'sparkle' | 'clover'
  | 'heart' | 'flower' | 'teardrop' | 'pill' | 'wedge'
  | 'pentagon' | 'star' | 'hex' | 'pumpkin';

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
  kind?: ApprovalKind;                      // aggiunta (V2): approvazione, bozza email o "serve te nell'app"
  decisions?: ApprovalDecision[];           // aggiunta (V2): cosa si può rispondere dall'ufficio; vuoto = solo nell'app
}

/** approval: Auto Review card (Allow once / Deny); draft: email draft (Discard; sending stays in the app); takeover: answer in the app. */
export type ApprovalKind = 'approval' | 'draft' | 'takeover';
/** Never "always allow": that and Auto Review rules stay in the app. */
export type ApprovalDecision = 'allow_once' | 'deny' | 'discard';
export type ApprovalResult = 'allowed' | 'denied' | 'expired';

export type OfficeEvent =
  | { type: 'snapshot'; bots: Bot[]; desks: number }
  | { type: 'bot.updated'; bot: Bot }
  | { type: 'activity'; botId: string; at: string; text: string }
  | { type: 'approval.requested'; approval: Approval }
  | { type: 'approval.resolved'; id: string; result: ApprovalResult }
  | { type: 'connection'; state: 'connected' | 'disconnected'; handle?: string };

export const BOT_STATUSES: readonly BotStatus[] = [
  'coding', 'browsing', 'terminal', 'thinking',
  'needs_you', 'error', 'done', 'idle', 'sleeping',
];

export const AVATAR_SHAPES: readonly AvatarShape[] = [
  'blob', 'cloud', 'square', 'sparkle', 'clover',
  'heart', 'flower', 'teardrop', 'pill', 'wedge',
  'pentagon', 'star', 'hex', 'pumpkin',
];

/**
 * The 11 avatar colors of the same picker, in its order, by the app's `avatarColor` names
 * where seen. `black` is the picker's first swatch: the app draws it white on its dark
 * theme, and so does the office. The app calls pink `magenta`.
 */
export const AVATAR_COLORS = {
  black: '#FFFFFF',
  brown: '#936439',
  red: '#FF263C',
  orange: '#FF6700',
  yellow: '#FF9800',
  green: '#00C972',
  cyan: '#00BCA6',
  blue: '#1084FE',
  violet: '#9159FE',
  pink: '#FF309B',
  gray: '#777777',
} as const;

export type AvatarColorName = keyof typeof AVATAR_COLORS;

/**
 * The app has more shapes than its picker shows; a Bot that never picked one gets one of
 * blob, pebble, squircle, tablet, wedge, hex, cloud, teardrop. The rest map to our closest.
 */
const SHAPE_ALIASES: Record<string, AvatarShape> = {
  round: 'blob', circle: 'blob', drop: 'teardrop', triangle: 'wedge', hexagon: 'hex', splat: 'star',
  diamond: 'square', bean: 'pill', capsule: 'pill', house: 'pentagon',
  pebble: 'blob', egg: 'blob', dome: 'blob', squircle: 'square', tablet: 'pill', cylinder: 'pill',
  gem: 'hex', crystal: 'hex', shield: 'pentagon', arch: 'pentagon', leaf: 'teardrop',
};
const COLOR_ALIASES: Record<string, AvatarColorName> = {
  white: 'black', amber: 'yellow', teal: 'cyan', purple: 'violet', grey: 'gray', magenta: 'pink',
};

/**
 * Grok Bot's avatarShape / avatarColor (as the bridge fork will pass them) → the office's
 * avatar and color. Unknown names fall back to the blob and no color (the office palette).
 */
export function avatarFromApp(shape?: string | null, color?: string | null): { avatar: BotAvatar; color?: string } {
  const s = (shape ?? '').toLowerCase();
  const c = (color ?? '').toLowerCase();
  const known = (AVATAR_SHAPES as readonly string[]).includes(s) ? (s as AvatarShape) : SHAPE_ALIASES[s];
  const colorName = c in AVATAR_COLORS ? (c as AvatarColorName) : COLOR_ALIASES[c];
  return { avatar: { shape: known ?? 'blob' }, ...(colorName ? { color: AVATAR_COLORS[colorName] } : {}) };
}

/** Shapes that keep their own color whatever color is picked. */
export const AVATAR_FIXED_COLORS: Partial<Record<AvatarShape, string>> = {
  pumpkin: AVATAR_COLORS.orange,
};

export const WORKING_STATUSES: readonly BotStatus[] = ['coding', 'browsing', 'terminal', 'thinking'];

/** Desks come in rows of this many; a new row appears when every desk is taken. */
export const DESKS_PER_ROW = 4;
