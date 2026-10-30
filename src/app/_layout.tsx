import '../global.css';

import {
  ChakraPetch_400Regular,
  ChakraPetch_500Medium,
  ChakraPetch_600SemiBold,
} from '@expo-google-fonts/chakra-petch';
import {
  FamiljenGrotesk_400Regular,
  FamiljenGrotesk_500Medium,
  FamiljenGrotesk_600SemiBold,
  FamiljenGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/familjen-grotesk';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ReminderBootstrap } from '@/features/dues/notifications';
import { AppLock } from '@/features/lock/app-lock';
import { useLockSettings } from '@/features/lock/store';
import { NudgeScheduler } from '@/features/nudges/scheduler';
import { useNudgeSettings } from '@/features/nudges/store';
import { useProfile } from '@/features/profile/store';
import { env } from '@/lib/env';
import { queryClient } from '@/lib/query-client';
import { colors } from '@/theme';

if (env.sentryDsn) {
  Sentry.init({ dsn: env.sentryDsn, sendDefaultPii: false, tracesSampleRate: 0.2 });
}

SplashScreen.preventAutoHideAsync();

const persisted = [useLockSettings, useNudgeSettings, useProfile];

/** True once every secure-store-backed settings store has loaded. */
function useSettingsHydrated() {
  const [ok, setOk] = useState(() => persisted.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    const check = () => setOk(persisted.every((s) => s.persist.hasHydrated()));
    const unsubs = persisted.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, []);
  return ok;
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    FamiljenGrotesk_400Regular,
    FamiljenGrotesk_500Medium,
    FamiljenGrotesk_600SemiBold,
    FamiljenGrotesk_700Bold,
    ChakraPetch_400Regular,
    ChakraPetch_500Medium,
    ChakraPetch_600SemiBold,
  });
  const ready = useSettingsHydrated();

  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync();
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <ReminderBootstrap />
          <NudgeScheduler />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="onboarding" />
          </Stack>
          <AppLock />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default env.sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;
