import { useOffice } from '../store';
import { STATUS_LABEL, STATUS_RANK, statusVar } from '../status';

export function Team() {
  const bots = useOffice((s) => s.bots);
  const sorted = Object.values(bots).sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name),
  );

  return (
    <section className="flex min-h-0 flex-col">
      <h2 className="px-4 pt-4 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">Team</h2>
      <ul className="min-h-0 overflow-y-auto px-2 pb-2">
        {sorted.map((bot) => (
          <li key={bot.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-panel-2">
            <span aria-hidden className="size-8 shrink-0 rounded-full rounded-b-md" style={{ background: bot.color }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 text-sm">
                <span className="font-medium">{bot.name}</span>
                {bot.role && <span className="text-muted">· {bot.role}</span>}
              </div>
              <p className="truncate text-xs text-muted">{bot.activity}</p>
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ color: statusVar(bot.status), background: `color-mix(in srgb, ${statusVar(bot.status)} 16%, transparent)` }}
            >
              {STATUS_LABEL[bot.status]}
            </span>
          </li>
        ))}
        {sorted.length === 0 && <li className="px-2 py-4 text-sm text-muted">No bots yet.</li>}
      </ul>
    </section>
  );
}
