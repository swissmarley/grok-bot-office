import { describe, expect, it } from 'vitest';
import type { Bot } from '@grok-office/shared';
import { newlyNeedingYou } from './alerts';

const bot = (id: string, status: Bot['status']): Bot => ({
  id, name: id, role: '', color: '#fff', deskIndex: 0, status, activity: '', unread: 0, updatedAt: '',
});

describe('newlyNeedingYou', () => {
  it('fires on transitions into needs_you only', () => {
    const prev = { a: 'coding', b: 'needs_you', c: 'idle' } as const;
    const now = [bot('a', 'needs_you'), bot('b', 'needs_you'), bot('c', 'done'), bot('d', 'needs_you')];
    expect(newlyNeedingYou(prev, now).map((b) => b.id)).toEqual(['a']);
  });
});
