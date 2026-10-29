import type { TimeOfDay } from '../store';

export type Preset = 'day' | 'evening' | 'night';

export interface Lighting {
  background: string;
  ambient: { color: string; intensity: number };
  hemi: { sky: string; ground: string; intensity: number };
  sun: { color: string; intensity: number; position: [number, number, number] };
  /** Window sky, top → horizon. */
  sky: [string, string];
  stars: boolean;
  /** Desk and floor lamps. */
  lamps: boolean;
}

export const LIGHTING: Record<Preset, Lighting> = {
  day: {
    background: '#0E1420',
    ambient: { color: '#FFFFFF', intensity: 0.9 },
    hemi: { sky: '#DCE8FF', ground: '#3A3F4D', intensity: 0.7 },
    sun: { color: '#FFF6E5', intensity: 2.0, position: [7, 12, 4] },
    sky: ['#5BA8F5', '#BFE3FF'],
    stars: false,
    lamps: false,
  },
  evening: {
    background: '#120F1A',
    ambient: { color: '#FFD9C2', intensity: 0.7 },
    hemi: { sky: '#FFB38A', ground: '#2A2233', intensity: 0.55 },
    sun: { color: '#FF9A5C', intensity: 1.1, position: [10, 4, 2] },
    sky: ['#3B2E6B', '#FF8E5E'],
    stars: false,
    lamps: true,
  },
  night: {
    background: '#070A12',
    ambient: { color: '#A9B8FF', intensity: 0.6 },
    hemi: { sky: '#6B78B8', ground: '#1A2030', intensity: 0.5 },
    sun: { color: '#B8C8FF', intensity: 0.7, position: [6, 12, 5] },
    sky: ['#050A1C', '#16254D'],
    stars: true,
    lamps: true,
  },
};

/** Now follows the local clock: day 7–17, evening 17–20, night otherwise. */
export function resolvePreset(timeOfDay: TimeOfDay, date = new Date()): Preset {
  if (timeOfDay !== 'now') return timeOfDay;
  const h = date.getHours();
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}
