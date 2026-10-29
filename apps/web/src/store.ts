import { create } from 'zustand';
import { EMPTY_VIEW, applyToView, type Bot, type OfficeEvent } from '@grok-office/shared';
import { loadMuted, saveMuted } from './prefs';

export type Link = 'connecting' | 'open' | 'closed' | 'unauthorized';
export type TimeOfDay = 'now' | 'day' | 'evening' | 'night';

export interface FeedItem {
  id: number;
  botId: string;
  at: string;
  text: string;
  kind: 'activity' | 'approval';
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

interface OfficeStore {
  bots: Record<string, Bot>;
  desks: number;
  /** Bot account link, as reported by the server. */
  account: { state: 'connected' | 'disconnected'; handle?: string };
  /** Browser ↔ office server socket. */
  link: Link;
  /** Global event feed, newest first. */
  feed: FeedItem[];
  toasts: Toast[];
  selectedId: string | null;
  hoveredId: string | null;
  timeOfDay: TimeOfDay;
  /** Show every bot's speech bubble. */
  allTasks: boolean;
  /** No chime on needs_you. */
  muted: boolean;
  setMuted(muted: boolean): void;
  apply(event: OfficeEvent): void;
  setLink(link: Link): void;
  select(id: string | null): void;
  hover(id: string | null): void;
  setTimeOfDay(t: TimeOfDay): void;
  setAllTasks(on: boolean): void;
  toast(text: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
}

export const FEED_MAX = 200;
export const TOAST_MS = 4000;
let seq = 0;

const RESULT_TEXT = { allowed: 'Approved', denied: 'Denied', expired: 'Expired' } as const;

export const useOffice = create<OfficeStore>((set, get) => ({
  ...EMPTY_VIEW,
  account: { state: 'disconnected' },
  link: 'connecting',
  feed: [],
  toasts: [],
  selectedId: null,
  hoveredId: null,
  timeOfDay: 'now',
  allTasks: false,
  muted: loadMuted(),
  setMuted: (muted) => {
    saveMuted(muted);
    set({ muted });
  },
  setLink: (link) => set({ link }),
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setAllTasks: (allTasks) => set({ allTasks }),
  toast: (text, tone = 'ok') => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-3) }));
    setTimeout(() => get().dismissToast(id), TOAST_MS);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  apply: (event) =>
    set((s) => {
      const view = applyToView({ bots: s.bots, desks: s.desks }, event);
      const feed = feedItem(s, event);
      const next: Partial<OfficeStore> = view.bots === s.bots && view.desks === s.desks ? {} : view;
      if (feed) next.feed = [feed, ...s.feed].slice(0, FEED_MAX);
      if (event.type === 'snapshot' && s.selectedId && !view.bots[s.selectedId]) next.selectedId = null;
      if (event.type === 'connection') {
        next.account = event.handle === undefined ? { state: event.state } : { state: event.state, handle: event.handle };
      }
      return next;
    }),
}));

function feedItem(s: OfficeStore, event: OfficeEvent): FeedItem | undefined {
  switch (event.type) {
    case 'activity':
      return { id: ++seq, botId: event.botId, at: event.at, text: event.text, kind: 'activity' };
    case 'approval.requested': {
      const a = event.approval;
      return { id: ++seq, botId: a.botId, at: a.createdAt, text: `Needs you: ${a.action} · ${a.target}`, kind: 'approval' };
    }
    case 'approval.resolved': {
      // The bot still carries the approval until its own update arrives.
      const bot = Object.values(s.bots).find((b) => b.approval?.id === event.id);
      if (!bot?.approval) return undefined;
      return {
        id: ++seq,
        botId: bot.id,
        at: new Date().toISOString(),
        text: `${RESULT_TEXT[event.result]}: ${bot.approval.action}`,
        kind: 'approval',
      };
    }
    default:
      return undefined;
  }
}
