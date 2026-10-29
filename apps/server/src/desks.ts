import { readJsonObject, writeJson } from './json-file.js';

/** Stable bot → desk assignment, persisted as { [botId]: deskIndex }. */
export class DeskRegistry {
  private desks: Record<string, number>;

  constructor(
    private readonly file: string,
    private readonly deskCount: number,
  ) {
    this.desks = load(file);
  }

  /**
   * The bot's saved desk, or else the lowest desk nobody has saved. Only when
   * all desks are saved does a newcomer take one from a bot that isn't present.
   */
  assign(botId: string, presentIds: Iterable<string>): number {
    const taken = new Set<number>();
    for (const id of presentIds) {
      if (id !== botId && this.desks[id] !== undefined) taken.add(this.desks[id]);
    }
    const saved = this.desks[botId];
    if (saved !== undefined && !taken.has(saved)) return saved;

    const reserved = new Set(Object.entries(this.desks).filter(([id]) => id !== botId).map(([, d]) => d));
    let index = 0;
    while (taken.has(index) || (reserved.has(index) && index < this.deskCount)) index++;
    if (index >= this.deskCount) {
      // Reclaim the lowest desk held by an absent bot, if any.
      index = 0;
      while (taken.has(index)) index++;
    }
    for (const [id, desk] of Object.entries(this.desks)) {
      if (desk === index && id !== botId) delete this.desks[id];
    }
    this.desks[botId] = index;
    this.save();
    return index;
  }

  private save(): void {
    writeJson(this.file, this.desks);
  }
}

function load(file: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, desk] of Object.entries(readJsonObject(file))) {
    if (Number.isInteger(desk) && (desk as number) >= 0) out[id] = desk as number;
  }
  return out;
}
