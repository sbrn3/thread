import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Flow } from './src/flow/Flow';
import { Knot } from './src/knot';
import { createServices } from './src/services';
import { tokens } from './src/ui/tokens';

export default function App() {
  const services = useMemo(() => createServices(), []);

  useEffect(() => {
    services.log.write({ type: 'app_open' });
  }, [services]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: tokens.color.paper }}>
      <Flow services={services} />
      <Knot services={services} />
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
