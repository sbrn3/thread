import type { SqlDb } from '../log/db';
import type { Log } from '../log/log';
import { meta } from '../log/log';
import { datesBetween, logicalToday } from '../log/time';

// §13.4 — the heart of the system. Everything the app "does at 4 AM"
// happens here instead, lazily, on foreground (§16.2). It must be
// idempotent: running it twice is a byte-identical no-op.

export interface ReconcileContext {
  db: SqlDb;
  log: Log;
}

export interface ReconcileSteps {
  closeDay(ctx: ReconcileContext, date: string): void; // 1. seal? before nudge? write days row
  attributeRewards(ctx: ReconcileContext, date: string): void; // 2. fill decisions.reward
  advancePhase(ctx: ReconcileContext, date: string): void; // 3. flip arms at boundaries (seeded, silent)
  diagnose(ctx: ReconcileContext, date: string): void; // 4. signature → dose ladder → response
  updateBandit(ctx: ReconcileContext, date: string): void; // 5. decay + posterior + changepoint (dormant until day 366)
  checkInvariants(ctx: ReconcileContext, date: string): void; // 6. flag, never auto-repair (§17)
}

export function reconcile(ctx: ReconcileContext, steps: ReconcileSteps, today: string = logicalToday()): void {
  const watermark = meta.get(ctx.db, 'watermark');
  if (watermark === null) return; // not initialised until onboarding completes
  for (const d of datesBetween(watermark, today)) {
    ctx.db.tx(() => {
      steps.closeDay(ctx, d);
      steps.attributeRewards(ctx, d);
      steps.advancePhase(ctx, d);
      steps.diagnose(ctx, d);
      steps.updateBandit(ctx, d);
      steps.checkInvariants(ctx, d);
      meta.set(ctx.db, 'watermark', d); // LAST. In-tx = idempotent.
    });
  }
  // notifier.syncWindow() + maybeGenerateReport() follow separately (W6b/W9 — see Flow.tsx / App.tsx).
}
