import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Flow } from './src/flow/Flow';
import { Knot } from './src/knot';
import { meta } from './src/log/log';
import { OnboardingFlow } from './src/onboarding';
import { createServices, openDb } from './src/services';
import { tokens } from './src/ui/tokens';

export default function App() {
  const db = useMemo(() => openDb(), []);
  const [onboarded, setOnboarded] = useState(() => meta.get(db, 'onboarded') === '1');
  // Rebuilt whenever onboarding completes, so the text provider picks
  // up whatever provider/key onboarding just wrote to meta.
  const services = useMemo(() => createServices(db), [db, onboarded]);

  useEffect(() => {
    if (onboarded) services.log.write({ type: 'app_open' });
  }, [onboarded, services]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.color.paper }}>
      {onboarded ? (
        <>
          <Flow services={services} />
          <Knot services={services} />
        </>
      ) : (
        <OnboardingFlow services={services} onDone={() => setOnboarded(true)} />
      )}
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
