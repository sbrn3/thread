import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { installGlobalErrorHandler, logError, registerErrorDb } from './src/errors';
import { ErrorBoundary } from './src/errors/ErrorBoundary';
import { Flow } from './src/flow/Flow';
import { Knot } from './src/knot';
import { maybeGenerateReports } from './src/lab/analysis/report';
import { reconcile } from './src/lab/reconcile';
import { RECONCILE_STEPS } from './src/lab/steps';
import { BUILD_SHA } from './src/log/buildSha';
import { meta } from './src/log/log';
import { OnboardingFlow } from './src/onboarding';
import { createServices, openDb } from './src/services';
import { tokens } from './src/ui/tokens';

// Once, at module load — before any db exists, so it's armed for
// whatever happens during openDb() itself.
installGlobalErrorHandler();

export default function App() {
  const db = useMemo(() => openDb(), []);
  useEffect(() => registerErrorDb(db), [db]);

  const [onboarded, setOnboarded] = useState(() => meta.get(db, 'onboarded') === '1');
  // Rebuilt whenever onboarding completes, so the text provider picks
  // up whatever provider/key onboarding just wrote to meta.
  const services = useMemo(() => createServices(db), [db, onboarded]);

  useEffect(() => {
    if (!onboarded) return;
    // §13.4 — everything the app "does at 4 AM" happens here instead,
    // lazily, on foreground. Runs before app_open is logged so the
    // reconciled state reflects days up to (not including) today.
    reconcile({ db, log: services.log }, RECONCILE_STEPS);
    maybeGenerateReports(db);

    // §19 — marks deploy boundaries on the phase chart / amendment log.
    // Never fires on the very first-ever open (nothing to compare against).
    const lastSeenBuild = meta.get(db, 'last_seen_build_sha');
    if (lastSeenBuild !== null && lastSeenBuild !== BUILD_SHA) {
      services.log.write({ type: 'build_changed' });
    }
    meta.set(db, 'last_seen_build_sha', BUILD_SHA);

    services.log.write({ type: 'app_open' });

    // §19 "Weekly (auto): encrypted export. Silent unless it fails" —
    // fire-and-forget, never blocks app open.
    void services.backup.autoExportIfDue().catch((e: unknown) => {
      logError(db, `weekly auto-export failed: ${e instanceof Error ? e.message : String(e)}`);
    });
  }, [onboarded, services, db]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.color.paper }}>
      <ErrorBoundary db={db}>
        {onboarded ? (
          <>
            <Flow services={services} />
            <Knot services={services} />
          </>
        ) : (
          <OnboardingFlow services={services} onDone={() => setOnboarded(true)} />
        )}
      </ErrorBoundary>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
