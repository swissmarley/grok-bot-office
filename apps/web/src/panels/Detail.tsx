import { useEffect, useRef, useState } from 'react';
import type { Approval, Bot } from '@grok-office/shared';
import { api } from '../api';
import { AvatarIcon } from '../avatar/AvatarIcon';
import { useNow } from '../hooks';
import { STATUS_LABEL, isWorking, statusVar } from '../status';
import { useOffice } from '../store';
import { BotText } from '../text';
import { clock, countdown, relative } from '../time';

export function Detail() {
  const bot = useOffice((s) => (s.selectedId ? s.bots[s.selectedId] : undefined));
  const select = useOffice((s) => s.select);
  const now = useNow(1000);

  if (!bot) {
    return (
      <section className="border-b border-line px-4 py-4 text-sm text-muted">
        Select a bot in the office or in Team to see its task.
      </section>
    );
  }

  return (
    <section aria-label={`${bot.name} details`} className="flex flex-col gap-3 border-b border-line px-4 py-4">
      {bot.approval && <ApprovalCard bot={bot} approval={bot.approval} now={now} />}

      <div className="flex items-start gap-3">
        <AvatarIcon shape={bot.avatar?.shape} color={bot.color} size={40} main={bot.main} closedEyes={bot.status === 'sleeping'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold">{bot.name}</h2>
            <StatusPill bot={bot} />
          </div>
          <RoleEditor bot={bot} />
          <p className="text-xs text-muted">updated {relative(bot.updatedAt, now)}</p>
        </div>
        <button type="button" onClick={() => select(null)} aria-label="Close details" className="rounded-md px-1.5 text-lg leading-none text-muted hover:bg-panel-2 hover:text-text">
          ×
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{bot.task?.title || <span className="text-muted">No task yet</span>}</h3>
        <StepBar bot={bot} />
      </div>

      {bot.task && bot.task.log.length > 0 && (
        <ol className="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs">
          {bot.task.log.map((entry, i) => (
            <li key={`${entry.at}-${i}`} className="flex gap-2">
              <time dateTime={entry.at} className="shrink-0 font-mono text-muted tabular-nums">{clock(entry.at)}</time>
              <p className="min-w-0 break-words whitespace-pre-wrap"><BotText text={entry.text} /></p>
            </li>
          ))}
        </ol>
      )}

      <div className="flex gap-2">
        <OpenButton bot={bot} />
        <StopButton bot={bot} />
      </div>
    </section>
  );
}

export function StatusPill({ bot }: { bot: Bot }) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: statusVar(bot.status), background: `color-mix(in srgb, ${statusVar(bot.status)} 16%, transparent)` }}
    >
      {STATUS_LABEL[bot.status]}
    </span>
  );
}

function StepBar({ bot }: { bot: Bot }) {
  const step = bot.task?.step;
  if (step) {
    const pct = Math.round((Math.min(step.index, step.total) / step.total) * 100);
    return (
      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-panel-2" role="progressbar" aria-valuemin={0} aria-valuemax={step.total} aria-valuenow={step.index}>
          <div className="h-full rounded-full bg-st-coding transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted">step {step.index} of {step.total}</p>
      </div>
    );
  }
  if (!isWorking(bot.status)) return null;
  return (
    <div className="gbo-indeterminate h-1.5 overflow-hidden rounded-full bg-panel-2" role="progressbar" aria-label="Working, no plan declared">
      <div className="h-full w-1/3 rounded-full bg-st-coding" />
    </div>
  );
}

function RoleEditor({ bot }: { bot: Bot }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(bot.role);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(bot.role);
          setEditing(true);
        }}
        className="group flex max-w-full items-center gap-1 text-left text-sm text-muted hover:text-text"
        title="Edit role (empty to reset)"
      >
        <span className="truncate">{bot.role || 'Add a role'}</span>
        <span aria-hidden className="text-xs opacity-0 group-hover:opacity-100">✎</span>
      </button>
    );
  }

  const save = async () => {
    setEditing(false);
    if (value.trim() !== bot.role) await api.setRole(bot.id, value);
  };
  return (
    <input
      ref={input}
      value={value}
      maxLength={40}
      aria-label={`Role of ${bot.name}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void save();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-full rounded-md border border-line bg-panel-2 px-1.5 py-0.5 text-sm outline-none focus:border-st-coding"
    />
  );
}

function OpenButton({ bot }: { bot: Bot }) {
  const mock = useOffice((s) => s.account.handle === '@mock');
  const toast = useOffice((s) => s.toast);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await api.openBot(bot.id)) toast(mock ? `Mock mode: Grok Bot would open ${bot.name}` : `Opened ${bot.name} in Grok Bot`);
      }}
      className="flex-1 rounded-lg bg-panel-2 px-3 py-1.5 text-sm font-medium ring-1 ring-line hover:bg-line"
    >
      Open in Grok Bot
    </button>
  );
}

const CONFIRM_MS = 3000;

/** Two clicks: the first arms it for a few seconds. */
function StopButton({ bot }: { bot: Bot }) {
  const [armed, setArmed] = useState(false);
  const toast = useOffice((s) => s.toast);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [armed]);
  useEffect(() => setArmed(false), [bot.id]);

  const stoppable = isWorking(bot.status) || bot.status === 'needs_you' || bot.status === 'error';
  return (
    <button
      type="button"
      disabled={!stoppable}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setArmed(false);
        if (await api.stopBot(bot.id)) toast(`Stopped. ${bot.name} has dropped its task`);
      }}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 disabled:cursor-not-allowed disabled:opacity-40 ${
        armed ? 'bg-st-error text-white ring-st-error' : 'bg-panel-2 text-st-error ring-line hover:bg-line'
      }`}
    >
      {armed ? 'Confirm stop' : 'Stop'}
    </button>
  );
}

const ORIGIN_LABEL: Record<Approval['origin'], string> = {
  chat: 'from your chat',
  routine: 'from a routine',
  trigger: 'from a trigger',
  bot: 'from another bot',
};

function formatInput(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** V1: shows what the card asks; you answer it in Grok Bot. */
function ApprovalCard({ bot, approval, now }: { bot: Bot; approval: Approval; now: number }) {
  const left = approval.expiresAt ? countdown(approval.expiresAt, now) : undefined;
  const expired = left === null;
  const inputs = Object.entries(approval.inputs);
  return (
    <div className={`rounded-xl p-3 ring-1 ${expired ? 'bg-panel-2 ring-line' : 'bg-st-needs/10 ring-st-needs/50'}`} role="region" aria-label="Approval">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className={`font-semibold ${expired ? 'text-muted' : 'text-st-needs'}`}>{expired ? 'Expired' : `${bot.name} needs you`}</span>
        {left && <span className="font-mono text-st-needs tabular-nums" aria-label="Time left">{left}</span>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Action</dt>
        <dd className="font-medium break-words">{approval.action}</dd>
        <dt className="text-muted">Target</dt>
        <dd className="break-words">{approval.target}</dd>
        <dt className="text-muted">Origin</dt>
        <dd>{ORIGIN_LABEL[approval.origin]}</dd>
        {inputs.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-muted">{k}</dt>
            <dd className="font-mono break-words whitespace-pre-wrap">{formatInput(v)}</dd>
          </div>
        ))}
      </dl>
      {!expired && <p className="mt-2 text-[11px] text-muted">Answer this card in Grok Bot: Open in Grok Bot takes you there.</p>}
    </div>
  );
}
