import type { SqlDb } from '../log/db';
import { meta } from '../log/log';
import { datesBetween, logicalToday } from '../log/time';

// §13.4 — the heart of the system. Everything the app "does at 4 AM"
// happens here instead, lazily, on foreground (§16.2). It must be
// idempotent: running it twice is a byte-identical no-op.
//
// W7 fills in the six steps; the skeleton, the watermark discipline,
// and the idempotency contract are fixed now so every module built
// before W7 writes data this loop can replay.

export interface ReconcileSteps {
  closeDay(db: SqlDb, date: string): void; // 1. seal? before nudge? write days row
  attributeRewards(db: SqlDb, date: string): void; // 2. fill decisions.reward
  advancePhase(db: SqlDb, date: string): void; // 3. flip arms at boundaries (seeded, silent)
  diagnose(db: SqlDb, date: string): void; // 4. signature → dose ladder → response
  updateBandit(db: SqlDb, date: string): void; // 5. decay + posterior + changepoint (dormant until day 366)
  checkInvariants(db: SqlDb, date: string): void; // 6. flag, never auto-repair (§17)
}

export function reconcile(
  db: SqlDb,
  steps: ReconcileSteps,
  today: string = logicalToday(),
): void {
  const watermark = meta.get(db, 'watermark');
  if (watermark === null) return; // not initialised until onboarding completes
  for (const d of datesBetween(watermark, today)) {
    db.tx(() => {
      steps.closeDay(db, d);
      steps.attributeRewards(db, d);
      steps.advancePhase(db, d);
      steps.diagnose(db, d);
      steps.updateBandit(db, d);
      steps.checkInvariants(db, d);
      meta.set(db, 'watermark', d); // LAST. In-tx = idempotent.
    });
  }
  // notifier.syncWindow() + maybeGenerateReport() follow in W6b/W9.
}
