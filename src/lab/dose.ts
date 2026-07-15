import type { SqlDb } from '../log/db';

/**
 * §16.5 resolution order: the lapse ladder wins during a lapse
 * (Phase 4 — never fights the titration search), else an active E10
 * dose arm (Phase 2, day 190+, blocked while E4 is active), else the
 * titrated target, else null — meaning "seed mode": no fixed verse
 * target, just today's own chapter length, capped by splitSittings'
 * default. Collapses to null unconditionally until Phase 2/4 land —
 * this pass deliberately doesn't build them yet, same as
 * registry.ts's note on E7/E9/E10.
 */
export function todaysTarget(_db: SqlDb, _date: string): number | null {
  return null;
}
