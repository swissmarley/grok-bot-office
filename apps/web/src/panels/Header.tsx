import { useOffice } from '../store';
import { isWorking } from '../status';

export function Header() {
  const bots = Object.values(useOffice((s) => s.bots));
  const desks = useOffice((s) => s.desks);
  const account = useOffice((s) => s.account);
  const link = useOffice((s) => s.link);

  const counters = [
    { label: 'working', hint: 'Coding, browsing, in terminal or thinking', value: bots.filter((b) => isWorking(b.status)).length, color: 'var(--st-coding)' },
    { label: 'need you', hint: 'Waiting for your approval or answer, or stopped on an error', value: bots.filter((b) => b.status === 'needs_you' || b.status === 'error').length, color: 'var(--st-needs)' },
    { label: 'idle', hint: 'Done, idle or sleeping', value: bots.filter((b) => b.status === 'done' || b.status === 'idle' || b.status === 'sleeping').length, color: 'var(--st-idle)' },
    { label: 'free desk', hint: 'Empty desks; a new row appears when all are taken', value: Math.max(0, desks - bots.length), color: 'var(--muted)' },
  ];

  const connected = link === 'open' && account.state === 'connected';
  const badge = link !== 'open' ? 'Office server offline' : connected ? 'Connected' : 'Disconnected';

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:gap-4 sm:px-4">
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-panel-2 text-sm">👻</span>
        <span className="max-sm:hidden">Grok Bot Office</span>
      </div>
      <ul className="flex min-w-0 flex-1 items-center justify-center gap-2.5 text-sm sm:gap-5">
        {counters.map((c) => (
          <li key={c.label} className="flex items-baseline gap-1 whitespace-nowrap sm:gap-1.5" title={c.hint}>
            <span className="font-semibold tabular-nums" style={{ color: c.color }}>{c.value}</span>
            <span className="text-muted max-sm:text-[11px]">{c.label}</span>
          </li>
        ))}
      </ul>
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-panel-2 px-2 py-1 text-xs sm:px-3" title={badge}>
        <span className="size-2 rounded-full" style={{ background: connected ? 'var(--st-done)' : 'var(--st-error)' }} />
        {account.handle && <span className="text-muted max-sm:hidden">{account.handle} ·</span>}
        <span className="max-sm:sr-only">{badge}</span>
      </div>
    </header>
  );
}
