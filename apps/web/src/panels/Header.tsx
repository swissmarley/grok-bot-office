import { countBots } from '@grok-office/shared';
import { api } from '../api';
import { retryNow } from '../connection';
import { useState } from 'react';
import { useOffice } from '../store';

export function Header() {
  const bots = Object.values(useOffice((s) => s.bots));
  const desks = useOffice((s) => s.desks);
  const account = useOffice((s) => s.account);
  const link = useOffice((s) => s.link);
  const c = countBots(bots, desks);
  const muted = useOffice((s) => s.muted);
  const setMuted = useOffice((s) => s.setMuted);
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));

  const counters = [
    { label: 'working', hint: 'Coding, browsing, in terminal or thinking', value: c.working, color: 'var(--st-coding)' },
    { label: 'need you', hint: 'Waiting for your approval or answer, or stopped on an error', value: c.needYou, color: 'var(--st-needs)' },
    { label: 'idle', hint: 'Done, idle or sleeping', value: c.idle, color: 'var(--st-idle)' },
    { label: 'free desk', hint: 'Empty desks; a new row appears when all are taken', value: c.freeDesks, color: 'var(--muted)' },
  ];

  const serverDown = link !== 'open';
  const connected = !serverDown && account.state === 'connected';
  const badge = serverDown ? (link === 'connecting' ? 'Connecting…' : 'Office server offline') : connected ? 'Connected' : 'Disconnected';
  const canRetry = link === 'closed' || (!serverDown && !connected);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:gap-4 sm:px-4">
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-panel-2 text-sm">👻</span>
        <span className="max-sm:hidden">Grok Bot Office</span>
      </div>
      <ul className="flex min-w-0 flex-1 items-center justify-center gap-2.5 text-sm sm:gap-5" aria-label="Counters">
        {counters.map((x) => (
          <li key={x.label} className="flex items-baseline gap-1 whitespace-nowrap sm:gap-1.5" title={x.hint}>
            <span className="font-semibold tabular-nums" style={{ color: x.color }}>{x.value}</span>
            <span className="text-muted max-sm:text-[11px]">{x.label}</span>
          </li>
        ))}
      </ul>
      <div className="flex shrink-0 items-center gap-2">
        {permission === 'default' && (
          <button
            type="button"
            onClick={async () => setPermission(await Notification.requestPermission())}
            className="rounded-full p-1.5 text-muted hover:bg-panel-2 hover:text-text"
            title="Notify me when a bot needs me and this tab is in the background"
            aria-label="Enable notifications"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          aria-pressed={!muted}
          aria-label={muted ? 'Sound off' : 'Sound on'}
          title={muted ? 'Sound off: no chime when a bot needs you' : 'Sound on: a chime when a bot needs you'}
          className="rounded-full p-1.5 text-muted hover:bg-panel-2 hover:text-text"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            {muted ? <path d="m22 9-6 6m0-6 6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
          </svg>
        </button>
        <div className="flex items-center gap-2 rounded-full border border-line bg-panel-2 px-2 py-1 text-xs sm:px-3" title={badge} role="status">
          <span className="size-2 rounded-full" style={{ background: connected ? 'var(--st-done)' : link === 'connecting' ? 'var(--st-needs)' : 'var(--st-error)' }} />
          {account.handle && <span className="text-muted max-sm:hidden">{account.handle} ·</span>}
          <span className="max-sm:sr-only">{badge}</span>
        </div>
        {canRetry && (
          <button
            type="button"
            onClick={() => (link === 'closed' ? retryNow() : void api.reconnect())}
            className="rounded-full bg-st-coding px-3 py-1 text-xs font-medium text-white hover:brightness-110"
          >
            Reconnect
          </button>
        )}
      </div>
    </header>
  );
}
