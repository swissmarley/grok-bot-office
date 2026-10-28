import type { BotStatus } from '@grok-office/shared';
import { useOffice, type TimeOfDay } from '../store';
import { STATUS_LABEL, statusVar } from '../status';

const LEGEND: BotStatus[] = ['coding', 'browsing', 'terminal', 'thinking', 'needs_you', 'error', 'done'];
const TIMES: { value: TimeOfDay; label: string }[] = [
  { value: 'now', label: 'Now' },
  { value: 'day', label: 'Day' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
];

export function Footer() {
  const timeOfDay = useOffice((s) => s.timeOfDay);
  const setTimeOfDay = useOffice((s) => s.setTimeOfDay);
  const allTasks = useOffice((s) => s.allTasks);
  const setAllTasks = useOffice((s) => s.setAllTasks);

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-panel px-4 py-2 text-xs">
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted max-md:hidden" aria-label="Legend">
        {LEGEND.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: statusVar(s) }} />
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ul>
      <div className="ml-auto flex items-center gap-3 max-md:w-full max-md:justify-between">
        <div role="radiogroup" aria-label="Time of day" className="flex rounded-lg border border-line bg-panel-2 p-0.5">
          {TIMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={timeOfDay === t.value}
              onClick={() => setTimeOfDay(t.value)}
              className={`rounded-md px-2.5 py-1 ${timeOfDay === t.value ? 'bg-line text-text' : 'text-muted hover:text-text'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-muted select-none">
          <input type="checkbox" className="accent-[var(--st-coding)]" checked={allTasks} onChange={(e) => setAllTasks(e.target.checked)} />
          All tasks
        </label>
      </div>
    </footer>
  );
}
