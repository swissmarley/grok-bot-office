import { useState } from 'react';
import { AvatarIcon } from '../avatar/AvatarIcon';
import { useOffice } from '../store';
import { BotText } from '../text';
import { clock } from '../time';

export function Activity() {
  const feed = useOffice((s) => s.feed);
  const bots = useOffice((s) => s.bots);
  const [filter, setFilter] = useState('');
  const items = filter ? feed.filter((f) => f.botId === filter) : feed;
  const options = Object.values(bots).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="flex min-h-[160px] flex-col md:min-h-0 md:flex-1">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Activity</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter activity by bot"
          className="rounded-md border border-line bg-panel-2 px-1.5 py-0.5 text-xs text-text"
        >
          <option value="">All bots</option>
          {options.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4 text-xs" aria-live="off">
        {items.map((item) => {
          const bot = bots[item.botId];
          return (
            <li key={item.id} className="flex gap-2">
              <time dateTime={item.at} className="shrink-0 pt-px font-mono text-muted tabular-nums">{clock(item.at)}</time>
              {bot && <AvatarIcon shape={bot.avatar?.shape} color={bot.color} size={14} />}
              <p className={`min-w-0 break-words ${item.kind === 'approval' ? 'text-st-needs' : ''}`}>
                {bot && <span className="font-medium">{bot.name} </span>}
                <span className={item.kind === 'approval' ? '' : 'text-muted'}><BotText text={item.text} /></span>
              </p>
            </li>
          );
        })}
        {items.length === 0 && <li className="text-muted">Nothing yet.</li>}
      </ol>
    </section>
  );
}
