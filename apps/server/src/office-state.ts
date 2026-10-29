import { AVATAR_FIXED_COLORS, DESKS_PER_ROW, type Approval, type Bot, type OfficeEvent } from '@grok-office/shared';
import type { Thresholds } from './config.js';
import { TASK_TITLE_MAX_CHARS } from './config.js';
import { botColor } from './colors.js';
import type { DeskRegistry } from './desks.js';
import { RoleStore } from './roles.js';
import { deriveStatus } from './status.js';
import type { BotSignals, SourceBotUpdate, SourceSink } from './sources/source.js';

interface Entry {
  bot: Bot;
  signals: BotSignals;
  /** Name and description as the source reports them; name and role derive from these. */
  rawName: string;
  description?: string;
}

export interface OfficeStateOptions {
  desks: DeskRegistry;
  roles?: RoleStore;
  deskCount: number;
  thresholds: Thresholds;
  now?: () => number;
}

type Listener = (event: OfficeEvent) => void;

const DEFAULT_SIGNALS: BotSignals = {
  working: false,
  needsInput: false,
  error: false,
  computerAsleep: false,
};

/** The single normalized Office state; every change goes out as an OfficeEvent. */
export class OfficeState {
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<Listener>();
  private conn: Extract<OfficeEvent, { type: 'connection' }> = { type: 'connection', state: 'disconnected' };
  private readonly now: () => number;
  private readonly roles: RoleStore;

  constructor(private readonly opts: OfficeStateOptions) {
    this.now = opts.now ?? Date.now;
    this.roles = opts.roles ?? new RoleStore();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot(): Extract<OfficeEvent, { type: 'snapshot' }> {
    const bots = [...this.entries.values()].map((e) => e.bot);
    return { type: 'snapshot', bots: structuredClone(bots), desks: this.deskCount() };
  }

  /** At least the configured desks; beyond that, whole rows as bots need them. */
  private deskCount(): number {
    const highest = Math.max(-1, ...[...this.entries.values()].map((e) => e.bot.deskIndex));
    return Math.max(this.opts.deskCount, Math.ceil((highest + 1) / DESKS_PER_ROW) * DESKS_PER_ROW);
  }

  connection(): Extract<OfficeEvent, { type: 'connection' }> {
    return { ...this.conn };
  }

  /** Re-evaluates time-based states (done → idle → sleeping) and approval expiry. */
  tick(): void {
    const now = this.now();
    for (const [id, entry] of this.entries) {
      const expiresAt = entry.bot.approval?.expiresAt;
      if (expiresAt && Date.parse(expiresAt) <= now) {
        this.resolveApproval(entry.bot.approval!.id, 'expired');
      }
      this.refresh(id);
    }
  }

  /** The pending approval with this id, if any. */
  approval(id: string): Approval | undefined {
    for (const entry of this.entries.values()) if (entry.bot.approval?.id === id) return structuredClone(entry.bot.approval);
    return undefined;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Sets the role you chose for a bot; empty brings back the default. */
  setRole(id: string, role: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.roles.set(id, role);
    const before = JSON.stringify(entry.bot);
    this.applyNaming(entry);
    this.emitIfChanged(entry, before);
  }

  readonly sink: SourceSink = {
    updateBot: (id, update) => this.updateBot(id, update),
    removeBot: (id) => {
      if (!this.entries.delete(id)) return;
      // No dedicated removal event in the protocol: resend the snapshot.
      this.emit(this.snapshot());
    },
    activity: (botId, text, at) => {
      if (!this.entries.has(botId)) return;
      this.emit({ type: 'activity', botId, at: at ?? this.iso(), text });
    },
    approvalRequested: (approval) => this.requestApproval(approval),
    approvalResolved: (id, result) => this.resolveApproval(id, result),
    connection: (state, handle) => {
      this.conn = handle === undefined ? { type: 'connection', state } : { type: 'connection', state, handle };
      this.emit(this.connection());
    },
  };

  private updateBot(id: string, update: SourceBotUpdate): void {
    let entry = this.entries.get(id);
    if (!entry) {
      const desksBefore = this.deskCount();
      entry = {
        rawName: update.name ?? id,
        bot: {
          id,
          name: id,
          role: '',
          color: botColor(id, [...this.entries.values()].map((e) => e.bot.color)),
          deskIndex: this.opts.desks.assign(id, this.entries.keys()),
          status: 'idle',
          activity: '',
          unread: 0,
          updatedAt: this.iso(),
        },
        signals: { ...DEFAULT_SIGNALS },
      };
      this.entries.set(id, entry);
      // Brand-new bots always go out; if they opened a new row of desks, as a fresh snapshot.
      this.apply(entry, update);
      entry.bot.status = this.statusOf(entry);
      if (this.deskCount() !== desksBefore) this.emit(this.snapshot());
      else this.emit({ type: 'bot.updated', bot: structuredClone(entry.bot) });
      return;
    }
    const before = JSON.stringify(entry.bot);
    this.apply(entry, update);
    entry.bot.status = this.statusOf(entry);
    this.emitIfChanged(entry, before);
  }

  private apply(entry: Entry, update: SourceBotUpdate): void {
    const { bot } = entry;
    if (update.name !== undefined) entry.rawName = update.name;
    if (update.description !== undefined) entry.description = update.description;
    this.applyNaming(entry);
    if (update.main !== undefined) {
      if (update.main) bot.main = true;
      else delete bot.main;
    }
    if (update.color !== undefined) bot.color = update.color;
    if (update.avatar !== undefined) bot.avatar = update.avatar;
    const fixed = bot.avatar && AVATAR_FIXED_COLORS[bot.avatar.shape];
    if (fixed) bot.color = fixed;
    if (update.activity !== undefined) bot.activity = update.activity;
    if (update.unread !== undefined) bot.unread = update.unread;
    if (update.signals) entry.signals = { ...entry.signals, ...update.signals };
    if (update.task === null) delete bot.task;
    else if (update.task) bot.task = { ...update.task, title: truncate(update.task.title, TASK_TITLE_MAX_CHARS) };
  }

  /**
   * "Ada - Chief of Staff" → name Ada, role Chief of Staff. Role: the one you set in
   * the office, else the part after the dash, else the description's first word.
   */
  private applyNaming(entry: Entry): void {
    const { name, role } = splitName(entry.rawName);
    entry.bot.name = name;
    entry.bot.role = this.roles.get(entry.bot.id) ?? role ?? roleFrom(entry.description);
  }

  private requestApproval(approval: Approval): void {
    const entry = this.entries.get(approval.botId);
    if (!entry) return;
    const full: Approval = { ...approval };
    if (full.origin !== 'chat' && !full.expiresAt) {
      full.expiresAt = new Date(Date.parse(full.createdAt) + this.opts.thresholds.approvalTtlMs).toISOString();
    }
    const before = JSON.stringify(entry.bot);
    entry.bot.approval = full;
    entry.bot.status = this.statusOf(entry);
    this.emit({ type: 'approval.requested', approval: structuredClone(full) });
    this.emitIfChanged(entry, before);
  }

  private resolveApproval(id: string, result: 'allowed' | 'denied' | 'expired'): void {
    for (const entry of this.entries.values()) {
      if (entry.bot.approval?.id !== id) continue;
      const before = JSON.stringify(entry.bot);
      delete entry.bot.approval;
      entry.bot.status = this.statusOf(entry);
      this.emit({ type: 'approval.resolved', id, result });
      this.emitIfChanged(entry, before);
      return;
    }
  }

  private refresh(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const before = JSON.stringify(entry.bot);
    entry.bot.status = this.statusOf(entry);
    this.emitIfChanged(entry, before);
  }

  private statusOf(entry: Entry): Bot['status'] {
    const signals = entry.bot.approval ? { ...entry.signals, needsInput: true } : entry.signals;
    return deriveStatus(signals, this.now(), this.opts.thresholds);
  }

  private emitIfChanged(entry: Entry, before: string): void {
    if (JSON.stringify(entry.bot) === before) return;
    entry.bot.updatedAt = this.iso();
    this.emit({ type: 'bot.updated', bot: structuredClone(entry.bot) });
  }

  private emit(event: OfficeEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }
}

export function splitName(raw: string): { name: string; role?: string } {
  const m = /^\s*(.+?)\s+[-–—]\s+(.+?)\s*$/.exec(raw);
  return m ? { name: m[1]!, role: m[2]! } : { name: raw.trim() || raw };
}

/** Default role: first word of the bot's description. */
export function roleFrom(description: string | undefined): string {
  const word = description?.trim().split(/\s+/)[0] ?? '';
  return word.replace(/[^\p{L}\p{N}-]+/gu, '');
}

function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : chars.slice(0, max - 1).join('') + '…';
}
