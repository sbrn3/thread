import { describe, expect, it } from 'vitest';
import { migrate } from '../src/log/schema';
import { getPendingReport, maybeGenerateReports } from '../src/lab/analysis/report';
import { openTestDb } from './util/testDb';

function seedPhase(db: ReturnType<typeof openTestDb>, expId: string, phase: number, arm: 'A' | 'B', start: string, end: string, status = 'done') {
  db.run(
    `INSERT INTO exp_phases (exp_id, phase, arm, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [expId, phase, arm, start, end, status],
  );
}

function seedDays(db: ReturnType<typeof openTestDb>, start: string, sealedCount: number, totalDays: number) {
  const startDate = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES (?, ?, 'full_chapter')`, [d, i < sealedCount ? 1 : 0]);
  }
}

function seedCompletedExperiment(db: ReturnType<typeof openTestDb>, expId: string, yearOffset = 0) {
  const y = 2026 + yearOffset; // distinct date ranges so two experiments' days rows never collide
  seedPhase(db, expId, 0, 'A', `${y}-01-01`, `${y}-01-21`);
  seedDays(db, `${y}-01-01`, 12, 21);
  seedPhase(db, expId, 1, 'B', `${y}-01-22`, `${y}-02-11`);
  seedDays(db, `${y}-01-22`, 20, 21);
  seedPhase(db, expId, 2, 'A', `${y}-02-12`, `${y}-03-04`);
  seedDays(db, `${y}-02-12`, 11, 21);
  seedPhase(db, expId, 3, 'B', `${y}-03-05`, `${y}-03-25`);
  seedDays(db, `${y}-03-05`, 19, 21);
}

describe('maybeGenerateReports (§13.4 maybeSurfaceReport)', () => {
  it('does nothing for an experiment still running', () => {
    const db = openTestDb();
    migrate(db);
    seedPhase(db, 'E4', 0, 'A', '2026-01-01', '2026-01-21', 'active');

    maybeGenerateReports(db);

    expect(db.all('SELECT * FROM reports')).toHaveLength(0);
  });

  it('generates a report the day the 4th phase finishes', () => {
    const db = openTestDb();
    migrate(db);
    seedCompletedExperiment(db, 'E4');

    maybeGenerateReports(db);

    const row = db.get<{ exp_id: string; report_text: string }>("SELECT * FROM reports WHERE exp_id = 'E4'");
    expect(row?.exp_id).toBe('E4');
    expect(row?.report_text).toContain('EXPERIMENT E4');
  });

  it('never regenerates a report once one exists for that experiment', () => {
    const db = openTestDb();
    migrate(db);
    seedCompletedExperiment(db, 'E4');
    maybeGenerateReports(db);
    const firstGeneratedAt = db.get<{ generated_at: number }>("SELECT generated_at FROM reports WHERE exp_id = 'E4'")?.generated_at;

    maybeGenerateReports(db); // called again, e.g. next app open

    const rows = db.all("SELECT * FROM reports WHERE exp_id = 'E4'");
    expect(rows).toHaveLength(1);
    expect(db.get<{ generated_at: number }>("SELECT generated_at FROM reports WHERE exp_id = 'E4'")?.generated_at).toBe(
      firstGeneratedAt,
    );
  });

  it('only ever touches reversal-queue experiments', () => {
    const db = openTestDb();
    migrate(db);
    seedCompletedExperiment(db, 'E4', 0);
    seedCompletedExperiment(db, 'E1', 1);

    maybeGenerateReports(db);

    const expIds = db.all<{ exp_id: string }>('SELECT exp_id FROM reports').map((r) => r.exp_id);
    expect(expIds.sort()).toEqual(['E1', 'E4']);
  });
});

describe('getPendingReport', () => {
  it('returns null when nothing is unresponded', () => {
    const db = openTestDb();
    migrate(db);
    expect(getPendingReport(db)).toBeNull();
  });

  it('returns the oldest unresponded report', () => {
    const db = openTestDb();
    migrate(db);
    seedCompletedExperiment(db, 'E4');
    maybeGenerateReports(db);

    const pending = getPendingReport(db);
    expect(pending?.expId).toBe('E4');
    expect(pending?.reportText).toContain('EXPERIMENT E4');
  });

  it('stops returning a report once the user has responded to it', () => {
    const db = openTestDb();
    migrate(db);
    seedCompletedExperiment(db, 'E4');
    maybeGenerateReports(db);
    db.run("UPDATE reports SET applied = 1 WHERE exp_id = 'E4'");

    expect(getPendingReport(db)).toBeNull();
  });
});
