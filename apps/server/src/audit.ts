import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Approval, OfficeEvent } from '@grok-office/shared';

/**
 * Appends every approval outcome to the audit log, one line each:
 * ISO time, bot, action, allowed|denied|expired, and where it was decided (office or app).
 */
export class AuditLog {
  private readonly pending = new Map<string, Approval>();
  private readonly fromOffice = new Set<string>();
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly botName: (id: string) => string,
  ) {}

  /** Feed it every office event. */
  readonly onEvent = (e: OfficeEvent): void => {
    if (e.type === 'approval.requested') this.pending.set(e.approval.id, e.approval);
    if (e.type !== 'approval.resolved') return;
    const a = this.pending.get(e.id);
    this.pending.delete(e.id);
    if (!a) return;
    const via = this.fromOffice.delete(e.id) ? 'office' : e.result === 'expired' ? '-' : 'app';
    const line = [new Date().toISOString(), this.botName(a.botId), oneLine(`${a.action} ${a.target}`.trim()), e.result, via].join('\t');
    this.chain = this.chain.then(() => this.write(line)).catch((err: unknown) => {
      console.error(`[audit] ${err instanceof Error ? err.message : String(err)}`);
    });
  };

  /** Marks the next outcome of this approval as decided in the office. */
  decidedInOffice(id: string): void {
    this.fromOffice.add(id);
  }

  /** Resolves once every line so far is on disk (tests). */
  flushed(): Promise<void> {
    return this.chain;
  }

  private async write(line: string): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await appendFile(this.file, line + '\n', { mode: 0o600 });
  }
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 300);
}
