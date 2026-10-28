import { useEffect, useState } from 'react';
import { useOffice } from '../store';
import { Activity } from './Activity';
import { Detail } from './Detail';
import { Team } from './Team';

/** Fixed 360 px column on desktop; a bottom sheet under the scene on mobile. */
export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const selectedId = useOffice((s) => s.selectedId);
  // Picking a bot on mobile opens the sheet so its details are in view.
  useEffect(() => {
    if (selectedId) setExpanded(true);
  }, [selectedId]);

  return (
    <aside
      className={`flex flex-col bg-panel max-md:rounded-t-2xl max-md:border-t max-md:border-line max-md:shadow-[0_-8px_24px_rgba(0,0,0,0.35)] max-md:transition-[height] md:w-[360px] md:border-l md:border-line ${
        expanded ? 'max-md:h-[72dvh]' : 'max-md:h-[40dvh]'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
        className="flex shrink-0 justify-center py-2 md:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-line" />
      </button>
      <div className="flex min-h-0 flex-1 flex-col max-md:overflow-y-auto">
        <Team />
        <div className="md:max-h-[50%] md:shrink-0 md:overflow-y-auto">
          <Detail />
        </div>
        <Activity />
      </div>
    </aside>
  );
}
