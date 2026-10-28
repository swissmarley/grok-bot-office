import { AVATAR_COLORS } from '@grok-office/shared';

// Fixed bot palette, picked by a hash of the bot id.
// The avatar colors of Grok Bot's picker.
const PALETTE: string[] = Object.values(AVATAR_COLORS);

/** Hash-picked palette color; on a clash with a bot already in the office, the next free one. */
export function botColor(id: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const start = hash(id) % PALETTE.length;
  for (let i = 0; i < PALETTE.length; i++) {
    const color = PALETTE[(start + i) % PALETTE.length]!;
    if (!used.has(color)) return color;
  }
  return PALETTE[start]!;
}

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
