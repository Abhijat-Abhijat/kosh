import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarButton, Body, Headline } from '@/components/ui';
import { colors } from '@/theme';
import { authenticate, lockCapability, lockIcon, type LockKind } from './device-auth';
import { shouldLock } from './logic';
import { useLockSettings } from './store';

function Wordmark() {
  return <Text className="font-display-bold text-[64px] leading-[64px] text-ink">kosh</Text>;
}

/**
 * Locks on cold start and after the background timeout; covers the UI while the app is
 * inactive/backgrounded so balances are hidden in the app switcher. Mount once, after the Stack.
 */
export function AppLock() {
  if (Platform.OS === 'web') return null;
  return <NativeAppLock />;
}

function NativeAppLock() {
  const { enabled, timeout } = useLockSettings();
  const [locked, setLocked] = useState(enabled); // cold start
  const [appState, setAppState] = useState(AppState.currentState);
  const [kind, setKind] = useState<LockKind>('fingerprint');
  const [failed, setFailed] = useState(false);
  const backgroundAt = useRef<number | null>(null);
  // The system prompt (and Android's PIN screen) briefly backgrounds the app; ignore that.
  const authenticating = useRef(false);
  const insets = useSafeAreaInsets();

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      const ok = await authenticate().catch(() => false);
      setFailed(!ok);
      if (ok) setLocked(false);
    } finally {
      // Let the AppState 'active' event caused by the prompt closing pass first.
      setTimeout(() => (authenticating.current = false), 500);
    }
  }, []);

  useEffect(() => {
    lockCapability()
      .then((c) => c.ok && setKind(c.kind))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setAppState(next);
      if (!enabled || authenticating.current) return;
      if (next === 'background') backgroundAt.current ??= Date.now();
      else if (next === 'active') {
        if (shouldLock(backgroundAt.current, Date.now(), timeout)) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled, timeout]);

  // Auto-prompt whenever we are locked and in the foreground.
  useEffect(() => {
    if (locked && enabled && appState === 'active') unlock();
  }, [locked, enabled, appState, unlock]);

  if (!enabled) return null;

  if (locked) {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} className="bg-paper">
        <View className="flex-1 px-6" style={{ paddingTop: insets.top + 64 }}>
          <Wordmark />
          <View className="pt-12">
            <Headline lead="Locked," title="Unlock Kosh" />
          </View>
          <View className="flex-1 items-center justify-center">
            <Ionicons name={lockIcon[kind]} size={112} color={colors.ink} />
            {failed ? (
              <Body tone="mute" className="mt-6 text-center">
                Not unlocked. Tap below to try again.
              </Body>
            ) : null}
          </View>
        </View>
        <BarButton title="Unlock" tone="ink" onPress={unlock} />
        <View className="bg-ink" style={{ height: insets.bottom }} />
      </View>
    );
  }

  if (appState !== 'active') {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} className="items-center justify-center bg-paper">
        <Wordmark />
      </View>
    );
  }

  return null;
}
