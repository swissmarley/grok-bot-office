import { create } from 'zustand';
import type { Bot, OfficeEvent } from '@grok-office/shared';

export type Link = 'connecting' | 'open' | 'closed' | 'unauthorized';
export type TimeOfDay = 'now' | 'day' | 'evening' | 'night';

export interface FeedItem {
  id: number;
  botId: string;
  at: string;
  text: string;
}

interface OfficeStore {
  bots: Record<string, Bot>;
  desks: number;
  /** Bot account link, as reported by the server. */
  account: { state: 'connected' | 'disconnected'; handle?: string };
  /** Browser ↔ office server socket. */
  link: Link;
  feed: FeedItem[];
  selectedId: string | null;
  hoveredId: string | null;
  timeOfDay: TimeOfDay;
  /** Show every bot's speech bubble. */
  allTasks: boolean;
  apply(event: OfficeEvent): void;
  setLink(link: Link): void;
  select(id: string | null): void;
  hover(id: string | null): void;
  setTimeOfDay(t: TimeOfDay): void;
  setAllTasks(on: boolean): void;
}

const FEED_MAX = 200;
let feedSeq = 0;

export const useOffice = create<OfficeStore>((set) => ({
  bots: {},
  desks: 8,
  account: { state: 'disconnected' },
  link: 'connecting',
  feed: [],
  selectedId: null,
  hoveredId: null,
  timeOfDay: 'now',
  allTasks: false,
  setLink: (link) => set({ link }),
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setAllTasks: (allTasks) => set({ allTasks }),
  apply: (event) =>
    set((s) => {
      switch (event.type) {
        case 'snapshot': {
          const bots = Object.fromEntries(event.bots.map((b) => [b.id, b]));
          const selectedId = s.selectedId && bots[s.selectedId] ? s.selectedId : null;
          return { bots, desks: event.desks, selectedId };
        }
        case 'bot.updated':
          return { bots: { ...s.bots, [event.bot.id]: event.bot } };
        case 'activity':
          return { feed: [{ id: ++feedSeq, botId: event.botId, at: event.at, text: event.text }, ...s.feed].slice(0, FEED_MAX) };
        case 'connection':
          return { account: event.handle === undefined ? { state: event.state } : { state: event.state, handle: event.handle } };
        case 'approval.requested':
        case 'approval.resolved':
          // The approval itself travels on the bot (bot.updated); cards land in M5.
          return {};
      }
    }),
}));
