import type { Approval, Task } from '@grok-office/shared';
import type { Thresholds } from '../config.js';
import type { BotSource, SourceSink, ToolKind } from './source.js';

// Scripted bots that loop through every office state. Durations are in real
// milliseconds; the office runs mock mode with compressed thresholds so that
// done → idle → sleeping also happen within a couple of minutes.

type Phase =
  | { kind: 'work'; tool: ToolKind | null; activity: string; ms: number; reply?: string; step?: boolean }
  | { kind: 'error'; activity: string; ms: number; reply: string }
  | {
      kind: 'approval';
      origin: Approval['origin'];
      action: string;
      target: string;
      inputs: Record<string, unknown>;
      /** For chat approvals: how long until you "answer in the app". Others wait for expiry. */
      ms?: number;
    }
  | { kind: 'rest'; ms: number }
  | { kind: 'asleep'; ms: number };

interface Script {
  id: string;
  name: string;
  description: string;
  tasks: { title: string; steps?: number; phases: Phase[] }[];
}

const S = 1000;

export const MOCK_SCRIPTS: Script[] = [
  {
    id: 'mock-scout',
    name: 'Scout',
    description: 'Research agent for market, pricing and competitor questions',
    tasks: [
      {
        title: 'Compare pricing of the top 9 CRMs',
        steps: 4,
        phases: [
          { kind: 'work', tool: 'browser', activity: 'Reading 9 pricing pages', ms: 10 * S, step: true, reply: 'Found pricing pages for all 9 CRMs.' },
          { kind: 'work', tool: null, activity: 'Comparing seat tiers', ms: 6 * S, step: true },
          { kind: 'work', tool: 'browser', activity: 'Checking G2 reviews', ms: 8 * S, step: true, reply: 'Pulled ratings from G2 for each tier.' },
          { kind: 'work', tool: 'file', activity: 'Writing pricing table', ms: 6 * S, step: true, reply: 'Table ready: HubSpot and Pipedrive are cheapest under 10 seats.' },
          { kind: 'rest', ms: 25 * S },
        ],
      },
      {
        title: 'Summarize this week in AI agents',
        phases: [
          { kind: 'work', tool: 'browser', activity: 'Skimming 14 articles', ms: 9 * S, reply: 'Shortlisted 6 articles worth reading.' },
          { kind: 'work', tool: null, activity: 'Drafting the summary', ms: 7 * S, reply: 'Summary drafted, 5 bullets.' },
          { kind: 'rest', ms: 45 * S },
        ],
      },
    ],
  },
  {
    id: 'mock-brush',
    name: 'Brush',
    description: 'Design partner for landing pages and social visuals',
    tasks: [
      {
        title: 'Refresh the landing page hero',
        steps: 3,
        phases: [
          { kind: 'work', tool: null, activity: 'Sketching hero layouts', ms: 6 * S, step: true },
          { kind: 'work', tool: 'file', activity: 'Exporting 3 hero variants', ms: 8 * S, step: true, reply: 'Exported 3 variants to /designs/hero.' },
          {
            kind: 'approval',
            origin: 'routine',
            action: 'Upload files',
            target: 'Figma · Marketing / Landing',
            inputs: { files: ['hero-a.png', 'hero-b.png', 'hero-c.png'], overwrite: false },
          },
          { kind: 'rest', ms: 15 * S },
          { kind: 'asleep', ms: 20 * S },
        ],
      },
      {
        title: 'Make 4 carousel slides for the launch',
        phases: [
          { kind: 'work', tool: 'editor', activity: 'Laying out slide 1 of 4', ms: 9 * S },
          { kind: 'work', tool: 'browser', activity: 'Looking for reference shots', ms: 7 * S, reply: 'Slides done, sending previews.' },
          { kind: 'rest', ms: 40 * S },
        ],
      },
    ],
  },
  {
    id: 'mock-patch',
    name: 'Patch',
    description: 'Code maintainer for the web app and its CI',
    tasks: [
      {
        title: 'Fix the flaky checkout test',
        steps: 4,
        phases: [
          { kind: 'work', tool: 'editor', activity: 'Reading checkout.spec.ts', ms: 8 * S, step: true },
          { kind: 'work', tool: 'shell', activity: 'Running the test suite', ms: 6 * S, step: true },
          { kind: 'error', activity: '2 tests failing in checkout', ms: 5 * S, reply: 'Error: 2 tests failed (timeout in payment mock).' },
          { kind: 'work', tool: 'editor', activity: 'Patching the payment mock', ms: 6 * S, step: true },
          { kind: 'work', tool: 'git', activity: 'Committing the fix', ms: 4 * S },
          { kind: 'work', tool: 'shell', activity: 'Re-running the suite', ms: 5 * S, step: true, reply: 'All 212 tests pass. Fix pushed to fix/checkout-flake.' },
          { kind: 'rest', ms: 40 * S },
        ],
      },
    ],
  },
  {
    id: 'mock-tally',
    name: 'Tally',
    description: 'Finance bookkeeper for invoices and the monthly close',
    tasks: [
      {
        title: 'Reconcile October invoices',
        phases: [
          { kind: 'work', tool: 'shell', activity: 'Exporting invoices to CSV', ms: 5 * S },
          { kind: 'work', tool: null, activity: 'Matching 48 payments', ms: 4 * S, reply: '46 of 48 invoices matched; 2 need a look.' },
          { kind: 'rest', ms: 105 * S },
          { kind: 'asleep', ms: 15 * S },
        ],
      },
    ],
  },
  {
    id: 'mock-relay',
    name: 'Relay',
    description: 'Social media manager for X and LinkedIn',
    tasks: [
      {
        title: 'Launch thread on X',
        steps: 4,
        phases: [
          { kind: 'work', tool: null, activity: 'Drafting a 6-post thread', ms: 5 * S, step: true, reply: 'Draft ready: 6 posts, 1 image.' },
          { kind: 'work', tool: 'browser', activity: 'Checking replies on X', ms: 6 * S, step: true },
          {
            kind: 'approval',
            origin: 'chat',
            action: 'Post thread',
            target: 'x.com · @nakya',
            inputs: { posts: 6, first: 'We just shipped Grok Bot Office 🎉', image: 'office.png' },
            ms: 15 * S,
          },
          { kind: 'work', tool: 'browser', activity: 'Posting the thread', ms: 6 * S, step: true, reply: 'Thread is live: 6 posts.' },
          { kind: 'work', tool: 'browser', activity: 'Watching first replies', ms: 5 * S, step: true },
          { kind: 'rest', ms: 50 * S },
        ],
      },
    ],
  },
];

export interface MockSourceOptions {
  thresholds: Thresholds;
  /** Seed for duration jitter, so runs are reproducible. */
  seed?: number;
  scripts?: Script[];
}

export class MockSource implements BotSource {
  readonly kind = 'mock';
  private timers = new Set<NodeJS.Timeout>();
  private approvalSeq = 0;
  private readonly rand: () => number;

  constructor(private readonly opts: MockSourceOptions) {
    this.rand = mulberry32(opts.seed ?? Date.now());
  }

  async start(sink: SourceSink): Promise<void> {
    sink.connection('connected', '@mock');
    for (const script of this.opts.scripts ?? MOCK_SCRIPTS) {
      sink.updateBot(script.id, { name: script.name, description: script.description, activity: 'Waiting for a task' });
      this.runBot(sink, script);
    }
  }

  async stop(): Promise<void> {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private runBot(sink: SourceSink, script: Script): void {
    let taskIndex = 0;
    let phaseIndex = 0;
    let task: Task = { title: '', log: [] };
    let step = 0;

    const reply = (text: string): void => {
      const at = new Date().toISOString();
      task = { ...task, log: [{ at, text }, ...task.log].slice(0, 20) };
      sink.activity(script.id, text, at);
      sink.updateBot(script.id, { task, unread: task.log.length, signals: { lastReplyAt: at } });
    };

    const next = (): void => {
      const current = script.tasks[taskIndex]!;
      if (phaseIndex === 0) {
        step = 0;
        task = { title: current.title, log: [] };
        sink.activity(script.id, `New task: ${current.title}`);
        sink.updateBot(script.id, { task, unread: 0, signals: { computerAsleep: false } });
      }
      const phase = current.phases[phaseIndex]!;
      if (phase.kind === 'work' && phase.step && current.steps) {
        step = Math.min(step + 1, current.steps);
        task = { ...task, step: { index: step, total: current.steps } };
        sink.updateBot(script.id, { task });
      }
      phaseIndex++;
      if (phaseIndex >= current.phases.length) {
        phaseIndex = 0;
        taskIndex = (taskIndex + 1) % script.tasks.length;
      }
      this.after(this.runPhase(sink, script.id, phase, task.title, reply), next);
    };

    next();
  }

  /** Starts a phase and returns how long it lasts; `done` runs as it ends. */
  private runPhase(
    sink: SourceSink,
    id: string,
    phase: Phase,
    taskTitle: string,
    reply: (text: string) => void,
  ): number {
    switch (phase.kind) {
      case 'work': {
        sink.updateBot(id, { activity: phase.activity, signals: { working: true, tool: phase.tool, error: false } });
        const ms = this.jitter(phase.ms);
        if (phase.reply) this.after(ms - 50, () => reply(phase.reply!));
        return ms;
      }
      case 'error': {
        sink.updateBot(id, { activity: phase.activity, signals: { working: true, error: true } });
        reply(phase.reply);
        return this.jitter(phase.ms);
      }
      case 'approval': {
        const createdAt = new Date();
        const approval: Approval = {
          id: `mock-approval-${++this.approvalSeq}`,
          botId: id,
          action: phase.action,
          target: phase.target,
          inputs: phase.inputs,
          origin: phase.origin,
          createdAt: createdAt.toISOString(),
        };
        const ms = phase.origin === 'chat' ? this.jitter(phase.ms ?? 15_000) : this.opts.thresholds.approvalTtlMs;
        if (phase.origin !== 'chat') approval.expiresAt = new Date(createdAt.getTime() + ms).toISOString();
        sink.updateBot(id, { activity: `Waiting for you: ${phase.action}`, signals: { working: false, needsInput: true } });
        sink.approvalRequested(approval);
        this.after(ms - 50, () => {
          if (phase.origin === 'chat') {
            // Mock stand-in for you answering the card in the Grok Bot app (approvals V1).
            sink.approvalResolved(approval.id, 'allowed');
            sink.activity(id, `Approved in Grok Bot: ${phase.action}`);
          } else {
            sink.approvalResolved(approval.id, 'expired');
            sink.activity(id, `Approval expired: ${phase.action}`);
          }
          sink.updateBot(id, { signals: { needsInput: false } });
        });
        return ms;
      }
      case 'rest': {
        const at = new Date().toISOString();
        sink.updateBot(id, {
          activity: `Finished: ${taskTitle}`,
          signals: { working: false, tool: null, error: false, lastReplyAt: at },
        });
        return this.jitter(phase.ms);
      }
      case 'asleep': {
        sink.activity(id, 'Computer went to sleep');
        sink.updateBot(id, { activity: 'Computer asleep', signals: { working: false, computerAsleep: true } });
        return this.jitter(phase.ms);
      }
    }
  }

  private after(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, Math.max(0, ms));
    this.timers.add(t);
  }

  private jitter(ms: number): number {
    return Math.round(ms * (0.85 + this.rand() * 0.3));
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
