// Fixed bot palette, picked by a hash of the bot id.
const PALETTE = [
  '#F472B6', // pink
  '#FB923C', // orange
  '#FACC15', // yellow
  '#A3E635', // lime
  '#38BDF8', // sky
  '#818CF8', // indigo
  '#E879F9', // fuchsia
  '#2DD4BF', // teal
  '#F87171', // coral
  '#C4B5FD', // lavender
];

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
