import { describe, expect, it } from 'vitest';
import type { Approval, Bot } from '@grok-office/shared';
import { answerableDecisions, outcomeText } from './Detail';

const approval = (extra: Partial<Approval> = {}): Approval => ({
  id: 'a:e1', botId: 'a', action: 'Post thread', target: 'x.com', inputs: {}, origin: 'chat',
  createdAt: '2026-10-29T20:00:00Z', kind: 'approval', decisions: ['allow_once', 'deny'], ...extra,
});
const bot = { name: 'Relay' } as Bot;

describe('approval card buttons', () => {
  it('shows the decisions the card offers', () => {
    expect(answerableDecisions(approval(), false)).toEqual(['allow_once', 'deny']);
    expect(answerableDecisions(approval({ kind: 'draft', decisions: ['discard'] }), false)).toEqual(['discard']);
  });

  it('shows none when the details are missing, the card expired, or it is answered only in the app', () => {
    expect(answerableDecisions(approval({ target: '' }), false)).toEqual([]);
    expect(answerableDecisions(approval({ action: ' ' }), false)).toEqual([]);
    expect(answerableDecisions(approval(), true)).toEqual([]);
    expect(answerableDecisions(approval({ kind: 'takeover', decisions: [] }), false)).toEqual([]);
    expect(answerableDecisions(approval({ decisions: undefined }), false)).toEqual([]);
  });

  it('says how it ended in the toast', () => {
    expect(outcomeText(bot, approval(), 'allow_once', 'allowed')).toBe('Allowed once. Relay goes ahead: Post thread.');
    expect(outcomeText(bot, approval(), 'deny', 'denied')).toBe("Denied. Relay won't post thread.");
    expect(outcomeText(bot, approval(), 'discard', 'denied')).toBe("Draft discarded. Relay won't send it.");
    expect(outcomeText(bot, approval(), 'allow_once', 'expired')).toBe('That card had already expired.');
  });
});
