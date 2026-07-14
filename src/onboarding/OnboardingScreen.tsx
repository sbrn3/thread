import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../ui/tokens';

interface OnboardingScreenProps {
  step: string; // "1 of 6 · The anchor"
  title: string;
  sub?: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
}

/** Shared layout for every onboarding screen (§05) — step label, heading, body, primary CTA, optional skip. */
export function OnboardingScreen({
  step,
  title,
  sub,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  onSkip,
  skipLabel,
}: OnboardingScreenProps) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.step}>{step}</Text>
        <Text style={styles.title}>{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        {children}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, primaryDisabled && styles.primaryBtnDisabled]}
          onPress={onPrimary}
          disabled={primaryDisabled}
        >
          <Text style={[styles.primaryLabel, primaryDisabled && styles.primaryLabelDisabled]}>{primaryLabel}</Text>
        </Pressable>
        {onSkip ? (
          <Pressable onPress={onSkip} style={styles.skipBtn}>
            <Text style={styles.skipLabel}>{skipLabel ?? 'Skip'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.paper },
  content: { paddingHorizontal: 32, paddingTop: 64, paddingBottom: 24, gap: 4 },
  step: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: tokens.color.thread,
    marginBottom: 12,
  },
  title: {
    fontFamily: tokens.font.display,
    fontWeight: '900',
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: tokens.color.ink,
    marginBottom: 12,
  },
  sub: {
    fontFamily: tokens.font.scripture,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.color.ink40,
    marginBottom: 22,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: tokens.color.ink,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: tokens.color.ink15 },
  primaryLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
    color: tokens.color.paper,
  },
  primaryLabelDisabled: { color: tokens.color.ink40 },
  skipBtn: { alignItems: 'center', marginTop: 14 },
  skipLabel: {
    fontFamily: tokens.font.display,
    fontSize: 12.5,
    color: tokens.color.ink40,
    textDecorationLine: 'underline',
  },
});
