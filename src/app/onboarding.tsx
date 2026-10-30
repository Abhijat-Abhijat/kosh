import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { Band, BarButton, Body, Headline, Label, Screen } from '@/components/ui';
import { ensureNotificationPermission } from '@/features/dues/notifications';
import { authenticate, lockCapability, lockIcon, type LockCapability } from '@/features/lock/device-auth';
import { useLockSettings } from '@/features/lock/store';
import { rescheduleNudge } from '@/features/nudges/scheduler';
import { useNudgeSettings } from '@/features/nudges/store';
import { useProfile } from '@/features/profile/store';
import { colors } from '@/theme';

const FEATURES = [
  'Accounts, cards and cash in one place',
  'Spends read from bank SMS, on this phone',
  'Dues and subscriptions, with reminders',
  'Savings and investments at a glance',
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(useProfile.getState().name);
  const [cap, setCap] = useState<LockCapability | null>(null);
  const [lockOn, setLockOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lockCapability()
      .then((c) => {
        setCap(c);
        setLockOn(c.ok); // default on when the phone can do it
      })
      .catch(() => setCap({ ok: false, reason: 'Could not check this phone for a screen lock.' }));
  }, []);

  const finish = async (to: string) => {
    setError(null);
    setBusy(true);
    try {
      if (lockOn) {
        if (!(await authenticate())) {
          setError('Not verified. Try again, or turn App lock off for now.');
          return;
        }
        useLockSettings.getState().setEnabled(true);
      }
      if (await ensureNotificationPermission(true).catch(() => false)) {
        await rescheduleNudge(useNudgeSettings.getState().enabled).catch(() => undefined);
      }
      const p = useProfile.getState();
      p.setName(name);
      p.finishOnboarding();
      router.replace(to as Href);
    } finally {
      setBusy(false);
    }
  };

  if (step === 0) {
    return (
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen footer={<BarButton title="Next" tone="ink" onPress={() => setStep(1)} />}>
          <View className="px-6 pt-16">
            <Text className="font-display-bold text-[64px] leading-[64px] text-ink">kosh</Text>
            <Text className="-mt-1 font-display-bold text-[40px] text-mute">money</Text>
          </View>
          <View className="px-6 pt-12">
            <Headline lead="Hello," title="Meet Kosh" />
            <View className="mt-6 gap-2">
              {FEATURES.map((f) => (
                <Body key={f}>{f}</Body>
              ))}
            </View>
          </View>
          <Band tone="paper" className="pt-8">
            <Label tone="mute">What should we call you? (optional)</Label>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.faint}
              autoComplete="name"
              className="border-b border-ink/40 py-2 font-display text-[18px] text-ink"
            />
          </Band>
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  if (step === 1) {
    return (
      <Screen footer={<BarButton title="Next" tone="ink" onPress={() => setStep(2)} />}>
        <View className="px-6 pt-16">
          <Headline lead="Private," title="Your Data Never Leaves This Phone" />
        </View>
        <Band tone="sage" className="mt-10 py-8">
          <Ionicons name="phone-portrait-outline" size={40} color={colors.onDark} />
          <Body tone="onDark" className="mt-4">
            No account, no server, no sign-up. Everything is stored in a database on this phone, and bank SMS
            are read here too.
          </Body>
          <Body tone="onDark" className="mt-3">
            Changing phones? Export a backup from Settings and restore it on the new one.
          </Body>
        </Band>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <BarButton title="Add your first account" tone="ink" loading={busy} onPress={() => finish('/accounts/new')} />
      }
    >
      <View className="px-6 pt-16">
        <Headline lead="Finally," title="Lock Kosh" />
        <Body tone="mute" className="mt-4">
          Ask for your fingerprint, face or phone PIN whenever Kosh opens.
        </Body>
      </View>
      <View className="items-center py-12">
        <Ionicons name={cap?.ok ? lockIcon[cap.kind] : 'lock-closed-outline'} size={96} color={colors.ink} />
      </View>
      <Band tone="paper">
        <View className="flex-row items-center justify-between border-b border-ink/30 py-2">
          <Label>App lock</Label>
          <Switch
            value={lockOn}
            onValueChange={setLockOn}
            disabled={!cap?.ok}
            trackColor={{ true: colors.sage, false: colors.faint }}
            thumbColor={colors.paper}
          />
        </View>
        {cap && !cap.ok ? <Body tone="mute" className="mt-3">{cap.reason}</Body> : null}
        {error ? <Text className="mt-3 font-display text-[13px] text-alert">{error}</Text> : null}
        <Pressable onPress={() => finish('/')} disabled={busy} className="mt-6" hitSlop={8}>
          <Label tone="mute">Skip, go to home</Label>
        </Pressable>
      </Band>
    </Screen>
  );
}
