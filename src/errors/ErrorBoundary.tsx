import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SqlDb } from '../log/db';
import { tokens } from '../ui/tokens';
import { logError } from './index';

interface ErrorBoundaryProps {
  db: SqlDb;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * §19 error log — catches render-tree errors (what installGlobalErrorHandler
 * can't see) and shows a plain fallback instead of a blank/frozen
 * screen. Must be a class component; React has no hook equivalent for
 * getDerivedStateFromError/componentDidCatch.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    try {
      logError(this.props.db, error.message, info.componentStack ?? error.stack ?? null);
    } catch {
      // Logging the crash must never itself crash the crash handler.
    }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Text style={styles.hint}>
            Reopen the app. If this keeps happening, use &quot;Copy diagnostics&quot; in the knot for details to
            report it.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: tokens.color.paper,
  },
  title: {
    fontFamily: tokens.font.display,
    fontWeight: '900',
    fontSize: 20,
    color: tokens.color.ink,
  },
  message: {
    fontFamily: tokens.font.mono,
    fontSize: 13,
    color: tokens.color.ink60,
    textAlign: 'center',
  },
  hint: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink40,
    textAlign: 'center',
  },
});
