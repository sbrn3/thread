import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BUILD_SHA } from './src/log/buildSha';
import { openAppDb } from './src/log/expoDb';
import { Log } from './src/log/log';
import { migrate } from './src/log/schema';
import { tokens } from './src/ui/tokens';

// W1 shell: schema migrates on launch, app_open lands in the log.
// The five-zone flow replaces this screen in W3.
export default function App() {
  const log = useMemo(() => {
    const db = openAppDb();
    migrate(db);
    return new Log({ db, buildSha: BUILD_SHA });
  }, []);

  useEffect(() => {
    log.write({ type: 'app_open' });
  }, [log]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thread</Text>
      <Text style={styles.sub}>a Bible reading app for one person.</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.paper,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    color: tokens.color.ink,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  sub: {
    color: tokens.color.ink60,
    fontSize: 16,
    fontStyle: 'italic',
  },
});
