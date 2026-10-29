import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { avatarFromApp, type Approval, type ApprovalDecision, type ApprovalKind, type ApprovalResult, type Task } from '@grok-office/shared';
import { config } from '../config.js';
import { toolFromStatusText } from '../status.js';
import type { BotSource, BotSignals, SourceSink, ToolKind } from './source.js';

// grokbot-bridge adapter. Live state comes from `grokbot watch --json` (one JSON event per
// line); the bot list from `grokbot bots --json`; a bot's task and replies from
// `grokbot read <bot> --json --limit 20` whenever it changes state.
//
// With the office fork of the bridge (bridge-fork/ in this repo), `bots --json` also
// carries each Bot's avatar, the main Bot and the Bot computer's phase, `open <bot>`
// shows a conversation, and `office-watch` streams the tool each Bot is using (browser,
// shell, file, editor); with the upstream bridge those degrade to defaults and working
// bots show as thinking.
//
// The office never starts, quits or restarts Grok Bot. Every bridge command except
// `status` would relaunch the app with the debug port when it can't reach it, so each
// command runs with GROKBOT_APP pointing nowhere: that relaunch fails instead, and
// connectivity is checked with `grokbot status`, which never launches anything.

const NEVER_LAUNCH = '/nonexistent/grok-office-never-launches-grok-bot';
const READ_LIMIT = 20;
const ACTIVITY_MAX = 300;
const LOG_TEXT_MAX = 2000;

/** `grokbot bots --json` row. */
interface BridgeBot {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
  running: boolean;
  needsInput: boolean;
  unread: number;
  lastActivity: string | null;
  preview: string | null;
  /** Office fork only. */
  avatar?: { shape: string | null; color: string | null; hasPhoto?: boolean } | null;
  main?: boolean;
  computerPhase?: string | null;
  tool?: string | null;
  status?: string | null;
}

/** What the Team list says while a bot uses a kind of tool, like the app's own status line. */
const TOOL_ACTIVITY: Record<ToolKind, string> = {
  browser: 'Browsing the web',
  shell: 'Running commands',
  file: 'Working on files',
  editor: 'Coding',
  git: 'Working with git',
};

/** A card waiting on you, from `office-watch` (office fork). */
interface BridgeCard {
  kind: ApprovalKind;
  entryId: string;
  type: string;
  at: string | null;
  summary: string | null;
  target: string | null;
  details: Record<string, string>;
  decisions: ApprovalDecision[];
}

/** `grokbot office-watch` line (office fork): the bot's pending cards, and how recent ones ended. */
interface CardsEvent {
  type: 'cards';
  id: string;
  cards: BridgeCard[];
  settled: { entryId: string; result: ApprovalResult }[];
}

/** `grokbot office-watch` line (office fork): a question with options opened or was answered. */
interface QuestionEvent {
  type: 'question';
  id: string;
  open: boolean;
}

/** `grokbot office-watch` line (office fork). */
interface ToolEvent {
  type: 'tool';
  id: string;
  tool: ToolKind | null;
  /** The bot's own status line, when it writes one instead of showing its tools. */
  status?: string | null;
}

/** Computer phases in which Grok Bot has parked the Bot's computer. */
const ASLEEP_PHASES = new Set(['away', 'asleep']);

/** `grokbot read --json` / `watch --json` message. */
interface BridgeMessage {
  key: string;
  role: 'user' | 'assistant' | 'card';
  kind: string;
  text: string;
  at: string | null;
}

type WatchEvent =
  | ({ type: 'message'; bot: string } & BridgeMessage)
  | { type: 'working' | 'idle' | 'needs_input'; bot: string; at: string };

export interface BridgeSourceOptions {
  command?: string;
  cdpPort?: number;
  retryMinMs?: number;
  retryMaxMs?: number;
  pollMs?: number;
  readDebounceMs?: number;
  commandTimeoutMs?: number;
  /** Extra environment for the grokbot processes (tests). */
  env?: NodeJS.ProcessEnv;
}

export class NotConnectedError extends Error {
  constructor(detail?: string) {
    super(detail ?? "Grok Bot isn't reachable on its debug port. Run `grokbot launch`, then Reconnect.");
  }
}

export class BridgeSource implements BotSource {
  readonly kind = 'bridge';
  private readonly o: Required<Omit<BridgeSourceOptions, 'env'>> & { env: NodeJS.ProcessEnv };
  private sink?: SourceSink;
  private stopped = false;
  private connected = false;
  private connecting = false;
  private attempt = 0;
  private watcher?: ChildProcess;
  private toolWatcher?: ChildProcess;
  private toolRetryTimer?: NodeJS.Timeout;
  private retryTimer?: NodeJS.Timeout;
  private pollTimer?: NodeJS.Timeout;
  private readonly readTimers = new Map<string, NodeJS.Timeout>();
  /** Watch events name bots; the office keys them by id. */
  private readonly idByName = new Map<string, string>();
  private readonly known = new Set<string>();
  private readonly tasks = new Map<string, Task>();
  /** The card each bot shows in the office: office approval id → the card's conversation entry. */
  private readonly shown = new Map<string, { approvalId: string; entryId: string }>();
  /** Every grokbot process still running, so stop() can end them all. */
  private readonly children = new Set<ChildProcess>();

  constructor(opts: BridgeSourceOptions = {}) {
    const b = config.bridge;
    this.o = {
      command: opts.command ?? b.command,
      cdpPort: opts.cdpPort ?? b.cdpPort,
      retryMinMs: opts.retryMinMs ?? b.retryMinMs,
      retryMaxMs: opts.retryMaxMs ?? b.retryMaxMs,
      pollMs: opts.pollMs ?? b.pollMs,
      readDebounceMs: opts.readDebounceMs ?? b.readDebounceMs,
      commandTimeoutMs: opts.commandTimeoutMs ?? b.commandTimeoutMs,
      env: opts.env ?? {},
    };
  }

  async start(sink: SourceSink): Promise<void> {
    this.sink = sink;
    sink.connection('disconnected');
    void this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.teardown();
    clearTimeout(this.retryTimer);
    // Leave no grokbot processes behind.
    await Promise.all(
      [...this.children].map(
        (child) =>
          new Promise<void>((resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) return resolve();
            const timer = setTimeout(() => {
              child.kill('SIGKILL');
              resolve();
            }, 2000);
            child.once('exit', () => {
              clearTimeout(timer);
              resolve();
            });
            child.kill('SIGTERM');
          }),
      ),
    );
  }

  async stopBot(id: string): Promise<void> {
    if (!this.connected) throw new NotConnectedError();
    const out = parseJson(await this.run(['stop', id, '--json']));
    if (!isObject(out) || out.stopped !== true) throw new Error(`${this.nameOf(id)} wasn't working.`);
    this.scheduleRead(id);
  }

  async openBot(id: string): Promise<void> {
    if (!this.known.has(id)) throw new Error('No such bot.');
    if (!this.connected) throw new NotConnectedError();
    try {
      const out = parseJson(await this.run(['open', id, '--json']));
      if (isObject(out) && (out.selected === true || out.focused === true)) return;
    } catch (err) {
      // The upstream bridge has no `open`: fall back to bringing the app forward.
      if (!(err instanceof Error) || !/Unknown command/i.test(err.message)) throw err;
    }
    if (process.platform !== 'darwin') throw new Error('Opening Grok Bot from the office works on macOS only.');
    await new Promise<void>((resolve, reject) => {
      execFile('open', ['-a', 'Grok Bot'], (err) => (err ? reject(new Error("Couldn't bring Grok Bot to the front.")) : resolve()));
    });
  }

  /** Drops the link and tries again now; reports why if Grok Bot still isn't reachable. */
  async reconnect(): Promise<void> {
    this.teardown();
    this.sink?.connection('disconnected');
    clearTimeout(this.retryTimer);
    this.attempt = 0;
    await this.connect();
    if (!this.connected) throw new NotConnectedError(this.lastError);
  }

  private lastError?: string;

  private async connect(): Promise<void> {
    if (this.stopped || this.connecting || this.connected) return;
    this.connecting = true;
    try {
      const status = parseJson(await this.run(['status', '--json']));
      if (!isObject(status) || status.connected !== true) throw new NotConnectedError();
      await this.refreshBots(true);
      this.startWatch();
      this.startToolWatch();
      this.connected = true;
      this.attempt = 0;
      this.lastError = undefined;
      this.pollTimer = setInterval(() => void this.refreshBots(false).catch(() => {}), this.o.pollMs);
      for (const id of this.known) this.scheduleRead(id);
      const label = await this.appLabel();
      // The watch may already have died while we looked up the version.
      if (this.connected) this.sink?.connection('connected', label);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.teardown();
      this.scheduleRetry();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    const base = Math.min(this.o.retryMaxMs, this.o.retryMinMs * 2 ** this.attempt++);
    this.retryTimer = setTimeout(() => void this.connect(), base * (0.8 + Math.random() * 0.4));
  }

  private teardown(): void {
    const wasConnected = this.connected;
    this.connected = false;
    clearInterval(this.pollTimer);
    for (const t of this.readTimers.values()) clearTimeout(t);
    this.readTimers.clear();
    const w = this.watcher;
    this.watcher = undefined;
    if (w && w.exitCode === null) w.kill('SIGTERM');
    clearTimeout(this.toolRetryTimer);
    const tw = this.toolWatcher;
    this.toolWatcher = undefined;
    if (tw && tw.exitCode === null) tw.kill('SIGTERM');
    if (wasConnected) this.sink?.connection('disconnected');
  }

  private startWatch(): void {
    const child = spawn(this.o.command, ['watch', '--json'], { env: this.env(), stdio: ['ignore', 'pipe', 'pipe'] });
    this.track(child);
    this.watcher = child;
    createInterface({ input: child.stdout! }).on('line', (line) => {
      if (this.watcher === child) this.onWatchLine(line);
    });
    child.stderr!.resume();
    const ended = () => {
      if (this.watcher !== child) return;
      // Grok Bot closed or the watch died: back off and reconnect.
      this.lastError = "Lost the connection to Grok Bot.";
      this.teardown();
      this.scheduleRetry();
    };
    child.on('exit', ended);
    child.on('error', ended);
  }

  /**
   * Tool steps from the fork's `office-watch`. Optional: with the upstream bridge, or if it
   * fails, working bots show as thinking and nothing else changes.
   */
  private startToolWatch(): void {
    const child = spawn(this.o.command, ['office-watch'], { env: this.env(), stdio: ['ignore', 'pipe', 'pipe'] });
    this.track(child);
    this.toolWatcher = child;
    let streamed = false;
    createInterface({ input: child.stdout! }).on('line', (line) => {
      if (this.toolWatcher !== child) return;
      const e = parseJson(line);
      if (isCardsEvent(e) && this.known.has(e.id)) {
        streamed = true;
        this.onCards(e);
        return;
      }
      if (isQuestionEvent(e) && this.known.has(e.id)) {
        streamed = true;
        this.sink?.updateBot(e.id, { signals: { openQuestion: e.open }, ...(e.open ? { activity: 'Waiting for your answer in Grok Bot' } : {}) });
        return;
      }
      if (!isToolEvent(e) || !this.known.has(e.id)) return;
      streamed = true;
      this.sink?.updateBot(e.id, toolUpdate(e.tool, e.status));
    });
    child.stderr!.resume();
    const ended = () => {
      if (this.toolWatcher !== child) return;
      this.toolWatcher = undefined;
      // Don't leave a bot stuck on its last tool.
      for (const id of this.known) this.sink?.updateBot(id, { signals: { tool: null, openQuestion: false } });
      // Without office-watch the office can't tell when a card ends: drop them, the app still has them.
      for (const [id, shown] of this.shown) {
        this.sink?.approvalResolved(shown.approvalId, 'expired');
        this.shown.delete(id);
      }
      // It worked before (a hiccup): try again. It never did (upstream bridge): leave it.
      if (streamed && this.connected) {
        this.toolRetryTimer = setTimeout(() => {
          if (this.connected && !this.toolWatcher) this.startToolWatch();
        }, this.o.retryMaxMs);
      }
    };
    child.on('exit', ended);
    child.on('error', ended);
  }

  /** Shows the bot's oldest pending card; a card that went away ends with how the app settled it. */
  private onCards(e: CardsEvent): void {
    const sink = this.sink!;
    const card = e.cards[0];
    const shown = this.shown.get(e.id);
    if (shown && shown.entryId !== card?.entryId) {
      const result = e.settled.find((s) => s.entryId === shown.entryId)?.result ?? 'expired';
      sink.approvalResolved(shown.approvalId, result);
      this.shown.delete(e.id);
    }
    if (!card || this.shown.get(e.id)?.entryId === card.entryId) return;
    const approval: Approval = {
      id: `${e.id}:${card.entryId}`,
      botId: e.id,
      action: card.summary ?? 'Answer in Grok Bot',
      target: card.target ?? '',
      inputs: card.details,
      // The conversation doesn't say whether a routine or a trigger asked: treat it as chat (no countdown).
      origin: 'chat',
      createdAt: card.at ?? new Date().toISOString(),
      kind: card.kind,
      decisions: card.decisions,
    };
    this.shown.set(e.id, { approvalId: approval.id, entryId: card.entryId });
    sink.approvalRequested(approval);
  }

  async resolveApproval(approval: Approval, decision: ApprovalDecision): Promise<ApprovalResult> {
    if (!this.connected) throw new NotConnectedError();
    const shown = this.shown.get(approval.botId);
    if (!shown || shown.approvalId !== approval.id) throw new Error('That card is no longer waiting.');
    if (!approval.decisions?.includes(decision)) throw new Error("This card can't be answered that way from the office.");
    const out = parseJson(await this.run(['resolve', approval.botId, shown.entryId, decision, '--json']));
    const result = isObject(out) ? out.result : undefined;
    if (result === 'gone') throw new Error('That card was already answered in Grok Bot.');
    if (result !== 'allowed' && result !== 'denied' && result !== 'expired') throw new Error('Unexpected answer from `grokbot resolve`.');
    this.shown.delete(approval.botId);
    this.sink?.approvalResolved(approval.id, result);
    return result;
  }

  private onWatchLine(line: string): void {
    const e = parseJson(line);
    if (!isWatchEvent(e)) return;
    const id = this.idByName.get(e.bot);
    if (!id) {
      // A bot we haven't listed yet (new or renamed): re-read the list, then handle it.
      void this.refreshBots(false).then(() => {
        if (this.idByName.has(e.bot)) this.onWatchLine(line);
      });
      return;
    }
    const sink = this.sink!;
    switch (e.type) {
      case 'working':
        sink.updateBot(id, { signals: { working: true, needsInput: false, error: false } });
        break;
      case 'idle':
        sink.updateBot(id, { signals: { working: false, needsInput: false } });
        break;
      case 'needs_input':
        sink.updateBot(id, { activity: 'Waiting for you in Grok Bot', signals: { needsInput: true } });
        break;
      case 'message':
        this.onMessage(id, e);
        return;
    }
    this.scheduleRead(id);
  }

  /** Applies a new message right away, so replies reach the log without waiting for a read. */
  private onMessage(id: string, m: BridgeMessage): void {
    const sink = this.sink!;
    const at = m.at ?? new Date().toISOString();
    if (m.role === 'user') {
      const task: Task = { title: firstLine(m.text) || 'New task', log: [] };
      this.tasks.set(id, task);
      sink.updateBot(id, { task });
      sink.activity(id, `You: ${clip(m.text, ACTIVITY_MAX)}`, at);
      return;
    }
    const task = this.tasks.get(id) ?? { title: '', log: [] };
    const next: Task = { ...task, log: [{ at, text: clip(m.text, LOG_TEXT_MAX) }, ...task.log].slice(0, READ_LIMIT) };
    const step = parseStep(m.text);
    if (step) next.step = step;
    this.tasks.set(id, next);
    const signals: Partial<BotSignals> = { lastReplyAt: at };
    if (isErrorKind(m.kind)) signals.error = true;
    sink.updateBot(id, {
      task: next.title ? next : undefined,
      activity: m.role === 'card' ? `Needs you: ${firstLine(m.text)}` : firstLine(m.text),
      signals,
    });
    sink.activity(id, clip(m.text, ACTIVITY_MAX), at);
  }

  private scheduleRead(id: string): void {
    clearTimeout(this.readTimers.get(id));
    this.readTimers.set(
      id,
      setTimeout(() => {
        this.readTimers.delete(id);
        void this.readBot(id).catch(() => {});
      }, this.o.readDebounceMs),
    );
  }

  /** Rebuilds the bot's task from its conversation: your last message and the replies after it. */
  private async readBot(id: string): Promise<void> {
    if (!this.connected) return;
    const out = parseJson(await this.run(['read', id, '--json', '--limit', String(READ_LIMIT)]));
    if (!isObject(out) || !Array.isArray(out.messages)) return;
    const messages = out.messages.filter(isMessage);
    const lastUser = messages.map((m) => m.role).lastIndexOf('user');
    const replies = messages.slice(lastUser + 1).filter((m) => m.role !== 'user');
    const now = new Date().toISOString();
    const log = replies
      .map((m) => ({ at: m.at ?? now, text: clip(m.text, LOG_TEXT_MAX) }))
      .reverse();
    const title = lastUser >= 0 ? firstLine(messages[lastUser]!.text) : '';
    const task: Task | null = title || log.length ? { title: title || 'Ongoing conversation', log } : null;
    const step = [...replies].reverse().map((m) => parseStep(m.text)).find(Boolean);
    if (task && step) task.step = step;
    if (task) this.tasks.set(id, task);
    else this.tasks.delete(id);

    const latest = replies.at(-1);
    const signals: Partial<BotSignals> = {};
    if (latest?.at) signals.lastReplyAt = latest.at;
    if (latest) signals.error = isErrorKind(latest.kind);
    this.sink?.updateBot(id, {
      task,
      ...(latest ? { activity: latest.role === 'card' ? `Needs you: ${firstLine(latest.text)}` : firstLine(latest.text) } : {}),
      signals,
    });
  }

  /** Reads the bot list. The first read after connecting also sets each bot's state. */
  private async refreshBots(initial: boolean): Promise<void> {
    const out = parseJson(await this.run(['bots', '--json']));
    if (!Array.isArray(out)) throw new Error('Unexpected output from `grokbot bots --json`.');
    const bots = out.filter(isBridgeBot).filter((b) => !b.hidden);
    const seen = new Set<string>();
    this.idByName.clear();
    for (const b of bots) {
      seen.add(b.id);
      this.idByName.set(b.name, b.id);
      const fresh = !this.known.has(b.id);
      this.known.add(b.id);
      const looks = b.avatar ? avatarFromApp(b.avatar.shape, b.avatar.color) : undefined;
      this.sink?.updateBot(b.id, {
        name: b.name,
        description: b.description,
        unread: b.unread,
        ...(looks ? { avatar: looks.avatar, ...(looks.color ? { color: looks.color } : {}) } : {}),
        ...(typeof b.main === 'boolean' ? { main: b.main } : {}),
        ...(initial || fresh
          ? {
              activity: firstLine(b.preview ?? '') || (b.needsInput ? 'Waiting for you in Grok Bot' : ''),
              signals: {
                working: b.running,
                needsInput: b.needsInput,
                error: false,
                computerAsleep: isAsleep(b),
                lastReplyAt: b.lastActivity ?? undefined,
                ...(isToolKind(b.tool) || b.tool === null ? { tool: toolUpdate(b.tool, b.status).signals.tool } : {}),
              },
            }
          : typeof b.computerPhase === 'string'
            ? { signals: { computerAsleep: isAsleep(b) } }
            : {}),
      });
      if (fresh && !initial) this.scheduleRead(b.id);
    }
    for (const id of [...this.known]) {
      if (seen.has(id)) continue;
      this.known.delete(id);
      this.tasks.delete(id);
      this.sink?.removeBot(id);
    }
  }

  /** "Grok Bot 0.71.2" from the debug port's version info, when it says. */
  private async appLabel(): Promise<string | undefined> {
    try {
      const res = await fetch(`http://127.0.0.1:${this.o.cdpPort}/json/version`, { signal: AbortSignal.timeout(1500) });
      const info = (await res.json()) as Record<string, unknown>;
      const ua = String(info['User-Agent'] ?? '');
      const m = /Grok ?Bot\/([\d.]+)/i.exec(ua);
      return m ? `Grok Bot ${m[1]}` : undefined;
    } catch {
      return undefined;
    }
  }

  private nameOf(id: string): string {
    for (const [name, botId] of this.idByName) if (botId === id) return name;
    return 'The bot';
  }

  private env(): NodeJS.ProcessEnv {
    return { ...process.env, ...this.o.env, GROKBOT_APP: NEVER_LAUNCH, GROKBOT_CDP_PORT: String(this.o.cdpPort) };
  }

  /** Runs a grokbot command; rejects with its own error message. */
  private run(args: string[]): Promise<string> {
    if (this.stopped) return Promise.reject(new Error('The office is shutting down.'));
    return new Promise((resolve, reject) => {
      const child = execFile(
        this.o.command,
        args,
        { env: this.env(), timeout: this.o.commandTimeoutMs, maxBuffer: 16 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (!err) return resolve(stdout);
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return reject(new Error(`\`${this.o.command}\` not found. Install grokbot-bridge (see README).`));
          }
          const msg = /grokbot: (.+)/.exec(stderr)?.[1] ?? err.message;
          // Our never-launch guard tripping means the app isn't reachable.
          if (/no Grok Bot window/i.test(msg)) {
            return reject(new NotConnectedError('Grok Bot is running, but its window is closed. Open it from the Dock, then Reconnect.'));
          }
          reject(/app not found|isn't reachable/i.test(msg) ? new NotConnectedError() : new Error(msg));
        },
      );
      this.track(child);
    });
  }

  private track(child: ChildProcess): void {
    this.children.add(child);
    child.once('exit', () => this.children.delete(child));
    child.once('error', () => this.children.delete(child));
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function isBridgeBot(v: unknown): v is BridgeBot {
  return (
    isObject(v) && isStr(v.id) && isStr(v.name) && typeof v.running === 'boolean' && typeof v.needsInput === 'boolean' &&
    (v.description === undefined || isStr(v.description))
  );
}

function isMessage(v: unknown): v is BridgeMessage {
  return isObject(v) && isStr(v.key) && (v.role === 'user' || v.role === 'assistant' || v.role === 'card') && isStr(v.text) &&
    (v.at === null || v.at === undefined || isStr(v.at));
}

function isWatchEvent(v: unknown): v is WatchEvent {
  if (!isObject(v) || !isStr(v.bot)) return false;
  if (v.type === 'message') return isMessage(v);
  return v.type === 'working' || v.type === 'idle' || v.type === 'needs_input';
}

const TOOL_KINDS = new Set<string>(['browser', 'shell', 'file', 'editor', 'git']);

function isToolKind(v: unknown): v is ToolKind {
  return typeof v === 'string' && TOOL_KINDS.has(v);
}

const KINDS = new Set(['approval', 'draft', 'takeover']);
const DECISIONS = new Set(['allow_once', 'deny', 'discard']);
const RESULTS = new Set(['allowed', 'denied', 'expired']);

function isCard(v: unknown): v is BridgeCard {
  return (
    isObject(v) && KINDS.has(v.kind as string) && isStr(v.entryId) && isStr(v.type) &&
    (v.summary === null || isStr(v.summary)) && (v.target === null || isStr(v.target)) && (v.at === null || isStr(v.at)) &&
    isObject(v.details) && Object.values(v.details).every(isStr) &&
    Array.isArray(v.decisions) && v.decisions.every((d) => DECISIONS.has(d as string))
  );
}

function isCardsEvent(v: unknown): v is CardsEvent {
  return (
    isObject(v) && v.type === 'cards' && isStr(v.id) && Array.isArray(v.cards) && v.cards.every(isCard) &&
    Array.isArray(v.settled) && v.settled.every((s) => isObject(s) && isStr(s.entryId) && RESULTS.has(s.result as string))
  );
}

function isQuestionEvent(v: unknown): v is QuestionEvent {
  return isObject(v) && v.type === 'question' && isStr(v.id) && typeof v.open === 'boolean';
}

function isToolEvent(v: unknown): v is ToolEvent {
  return (
    isObject(v) && v.type === 'tool' && isStr(v.id) && (v.tool === null || isToolKind(v.tool)) &&
    (v.status === undefined || v.status === null || isStr(v.status))
  );
}

/**
 * The tool from office-watch, else the one the bot's status line talks about; the status line,
 * if any, is what the bot is doing in its own words.
 */
function toolUpdate(tool: ToolKind | null, status: string | null | undefined) {
  const text = status?.trim() ? clip(status.trim(), 120) : null;
  const kind = tool ?? toolFromStatusText(text);
  const activity = text ? text.charAt(0).toUpperCase() + text.slice(1) : tool ? TOOL_ACTIVITY[tool] : undefined;
  return { signals: { tool: kind }, ...(activity ? { activity } : {}) };
}

function isAsleep(b: BridgeBot): boolean {
  return typeof b.computerPhase === 'string' && ASLEEP_PHASES.has(b.computerPhase);
}

function isErrorKind(kind: string | undefined): boolean {
  return !!kind && /error|fail/i.test(kind);
}

function firstLine(text: string): string {
  return (text.split('\n').find((l) => l.trim()) ?? '').trim().slice(0, 120);
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/** "step 2 of 4", "Step 3/5": only when the bot declares a plan. */
export function parseStep(text: string): { index: number; total: number } | undefined {
  const m = /\bstep\s+(\d{1,2})\s*(?:of|\/|di)\s*(\d{1,2})\b/i.exec(text);
  if (!m) return undefined;
  const index = Number(m[1]);
  const total = Number(m[2]);
  return total > 0 && index > 0 && index <= total ? { index, total } : undefined;
}
