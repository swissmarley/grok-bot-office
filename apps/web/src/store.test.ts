import { beforeEach, describe, expect, it } from 'vitest';
import type { Bot } from '@grok-office/shared';
import { useOffice } from './store';

const bot = (over: Partial<Bot> = {}): Bot => ({
  id: 'a', name: 'Relay', role: 'Social', color: '#FF9800', deskIndex: 0,
  status: 'needs_you', activity: '', unread: 0, updatedAt: '2026-10-28T09:00:00Z', ...over,
});
const approval = { id: 'x', botId: 'a', action: 'Post thread', target: 'x.com', inputs: {}, origin: 'chat' as const, createdAt: '2026-10-28T09:00:00Z' };

describe('office store', () => {
  beforeEach(() => useOffice.setState({ bots: {}, desks: 8, feed: [], selectedId: null }));

  it('feeds approvals with the bot that asked', () => {
    const { apply } = useOffice.getState();
    apply({ type: 'snapshot', bots: [bot({ approval })], desks: 8 });
    apply({ type: 'approval.requested', approval });
    apply({ type: 'approval.resolved', id: 'x', result: 'expired' });
    apply({ type: 'bot.updated', bot: bot({ status: 'done' }) });
    expect(useOffice.getState().feed.map((f) => [f.botId, f.text])).toEqual([
      ['a', 'Expired: Post thread'],
      ['a', 'Needs you: Post thread · x.com'],
    ]);
  });

  it('keeps at most 200 feed items, newest first', () => {
    const { apply } = useOffice.getState();
    for (let i = 0; i < 250; i++) apply({ type: 'activity', botId: 'a', at: '2026-10-28T09:00:00Z', text: `#${i}` });
    const { feed } = useOffice.getState();
    expect(feed).toHaveLength(200);
    expect(feed[0]!.text).toBe('#249');
  });

  it('drops the selection when a snapshot no longer has the bot', () => {
    const { apply, select } = useOffice.getState();
    apply({ type: 'snapshot', bots: [bot()], desks: 8 });
    select('a');
    apply({ type: 'snapshot', bots: [], desks: 8 });
    expect(useOffice.getState().selectedId).toBeNull();
  });
});
