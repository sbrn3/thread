import { describe, expect, it } from 'vitest';
import { INTERVALS, reschedule } from '../src/memory/leitner';
import type { Passage } from '../src/log/types';

const passage = (box: number, held_since: string | null = null): Passage => ({
  id: 1,
  book: 'John',
  chapter: 3,
  verse_start: 16,
  verse_end: 17,
  marked_at: 0,
  promoted_at: 1,
  box,
  due_date: null,
  last_grade: null,
  held_since,
});

describe('Leitner scheduler (§21 — deliberately not Anki)', () => {
  it('held advances a box, capped at 5', () => {
    expect(reschedule(passage(1), 'held', '2026-07-14').box).toBe(2);
    expect(reschedule(passage(5), 'held', '2026-07-14').box).toBe(5);
  });

  it('partial stays, lost goes back to the start', () => {
    expect(reschedule(passage(3), 'partial', '2026-07-14').box).toBe(3);
    expect(reschedule(passage(4), 'lost', '2026-07-14').box).toBe(1);
  });

  it('due dates follow the fixed intervals [1, 3, 7, 21, 60]', () => {
    expect(reschedule(passage(1), 'held', '2026-07-14').due_date).toBe('2026-07-17'); // box 2 → +3
    expect(reschedule(passage(4), 'held', '2026-07-14').due_date).toBe('2026-09-12'); // box 5 → +60
    expect(reschedule(passage(2), 'lost', '2026-07-14').due_date).toBe('2026-07-15'); // box 1 → +1
    expect(INTERVALS).toEqual([1, 3, 7, 21, 60]);
  });

  it('held_since is set on first entry to box 5 and preserved after', () => {
    const first = reschedule(passage(4), 'held', '2026-07-14');
    expect(first.held_since).toBe('2026-07-14');
    const later = reschedule({ ...first }, 'held', '2026-08-01');
    expect(later.held_since).toBe('2026-07-14');
  });

  it('grade is pure — a failed recall provably touches nothing else', () => {
    const before = passage(3, '2026-01-01');
    const frozen = JSON.stringify(before);
    reschedule(before, 'lost', '2026-07-14');
    expect(JSON.stringify(before)).toBe(frozen); // input untouched
  });
});
