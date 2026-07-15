import { describe, expect, it } from 'vitest';
import { hasConfound } from '../src/lab/confound';
import type { AppEvent } from '../src/log/types';

function event(type: AppEvent['type']): AppEvent {
  return {
    id: 1,
    ts: 0,
    tz_offset: 0,
    local_date: '2026-07-14',
    type,
    book: null,
    chapter: null,
    sitting: null,
    duration_ms: null,
    scroll_pct: null,
    before_nudge: null,
    exp_id: null,
    exp_arm: null,
    verses_count: null,
    target_verses: null,
    build_sha: 'test',
  };
}

describe('hasConfound (§13 confound detection)', () => {
  it('flags a cue_changed event', () => {
    expect(hasConfound([event('cue_changed')], 0)).toBe(true);
  });

  it('flags a 7+ day gap since the last seal', () => {
    expect(hasConfound([], 7)).toBe(true);
    expect(hasConfound([], 10)).toBe(true);
  });

  it('does not flag a normal day: no cue change, gap under 7', () => {
    expect(hasConfound([event('seal')], 0)).toBe(false);
    expect(hasConfound([event('reading_start')], 6)).toBe(false);
  });

  it('does not flag a normal book_finish — it is not a confound by itself', () => {
    expect(hasConfound([event('book_finish'), event('book_start')], 0)).toBe(false);
  });
});
