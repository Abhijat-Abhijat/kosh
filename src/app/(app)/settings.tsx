import Constants from 'expo-constants';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking, Platform, Switch, Text, TextInput, View } from 'react-native';

import { Body, Chips, Label, NavHeader, RowLine, Screen, SmallButton } from '@/components/ui';
import { ensureNotificationPermission } from '@/features/dues/notifications';
import { authenticate, lockCapability, type LockCapability } from '@/features/lock/device-auth';
import { TIMEOUT_OPTIONS, type LockTimeout } from '@/features/lock/logic';
import { useLockSettings } from '@/features/lock/store';
import { rescheduleNudge } from '@/features/nudges/scheduler';
import { useNudgeSettings } from '@/features/nudges/store';
import { useProfile } from '@/features/profile/store';
import { eraseAllData, exportBackup, importBackup } from '@/lib/db/backup';
import { queryClient } from '@/lib/query-client';
import { colors } from '@/theme';

const GITHUB_URL = 'https://github.com/Abhijat-Abhijat/kosh';

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: colors.sage, false: colors.faint }}
      thumbColor={colors.paper}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="px-6 pt-10">
      <Label tone="mute" className="mb-2">
        {title}
      </Label>
      {children}
    </View>
  );
}

const fail = (e: unknown) => Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));

export default function Settings() {
  const { name, setName } = useProfile();
  const [draftName, setDraftName] = useState(name);
  const lock = useLockSettings();
  const nudges = useNudgeSettings();
  const [cap, setCap] = useState<LockCapability | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | 'erase' | null>(null);

  useEffect(() => {
    lockCapability()
      .then(setCap)
      .catch(() => setCap({ ok: false, reason: 'Could not check this phone for a screen lock.' }));
  }, []);

  const toggleLock = async (on: boolean) => {
    if (!on) return lock.setEnabled(false);
    if (await authenticate().catch(() => false)) lock.setEnabled(true);
  };

  const toggleNudges = async (on: boolean) => {
    if (on && !(await ensureNotificationPermission(true))) {
      Alert.alert('Notifications are off', 'Allow notifications for Kosh in your phone settings.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    nudges.setEnabled(on);
    rescheduleNudge(on).catch(() => undefined);
  };

  const run = async (kind: 'export' | 'import' | 'erase', fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const onExport = () => run('export', async () => void (await exportBackup()));

  const onImport = () =>
    Alert.alert('Restore from backup?', 'This replaces everything in Kosh with the backup file.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Choose file',
        onPress: () =>
          run('import', async () => {
            const res = await importBackup();
            if (!res) return;
            queryClient.clear();
            Alert.alert('Restored', `${res.restored} records restored.`);
          }),
      },
    ]);

  const onErase = () =>
    Alert.alert('Erase all data?', 'Every account, transaction and setting in Kosh will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Are you sure?', 'This cannot be undone. Export a backup first if you might need it.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Erase everything',
              style: 'destructive',
              onPress: () =>
                run('erase', async () => {
                  await eraseAllData();
                  queryClient.clear();
                }),
            },
          ]),
      },
    ]);

  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen>
      <NavHeader title="Settings" />

      <Section title="Profile">
        <TextInput
          value={draftName}
          onChangeText={setDraftName}
          onEndEditing={() => setName(draftName)}
          placeholder="Your name"
          placeholderTextColor={colors.faint}
          autoComplete="name"
          className="border-b border-ink/40 py-2 font-display text-[18px] text-ink"
        />
      </Section>

      {Platform.OS !== 'web' ? (
        <Section title="Security">
          <View className="flex-row items-center justify-between border-b border-ink/30 py-2">
            <Label>App lock</Label>
            <Toggle value={lock.enabled} onChange={toggleLock} disabled={!cap?.ok && !lock.enabled} />
          </View>
          {cap && !cap.ok ? <Body tone="mute" className="mt-2">{cap.reason}</Body> : null}
          {lock.enabled ? (
            <View className="mt-4">
              <Label tone="mute" className="mb-2">
                Lock after leaving the app
              </Label>
              <Chips
                options={TIMEOUT_OPTIONS}
                value={lock.timeout}
                onChange={(v) => lock.setLockTimeout(v as LockTimeout)}
              />
            </View>
          ) : null}
        </Section>
      ) : null}

      <Section title="Notifications">
        <View className="flex-row items-center justify-between border-b border-ink/30 py-2">
          <Label>Check-in reminders</Label>
          <Toggle value={nudges.enabled} onChange={toggleNudges} />
        </View>
        <Body tone="mute" className="mt-2">
          An occasional nudge, every few days, to log cash spends and review dues.
        </Body>
      </Section>

      <Section title="Data">
        <Body className="mb-4">
          Everything is stored on this phone only. Export a backup to keep a copy or move to a new phone.
        </Body>
        <View className="flex-row flex-wrap gap-3">
          <SmallButton title={busy === 'export' ? 'Exporting…' : 'Export backup'} disabled={!!busy} onPress={onExport} />
          <SmallButton title={busy === 'import' ? 'Restoring…' : 'Restore from backup'} disabled={!!busy} onPress={onImport} />
        </View>
        <View className="mt-6 flex-row">
          <SmallButton title={busy === 'erase' ? 'Erasing…' : 'Erase all data'} tone="solid" disabled={!!busy} onPress={onErase} />
        </View>
      </Section>

      <Section title="About">
        <RowLine label="Version">
          <Text className="font-num text-[15px] text-ink">{version}</Text>
        </RowLine>
        <RowLine label="License">
          <Text className="font-display text-[15px] text-ink">MIT</Text>
        </RowLine>
        <RowLine label="Source">
          <Text onPress={() => Linking.openURL(GITHUB_URL)} className="font-display text-[15px] text-ink underline">
            GitHub
          </Text>
        </RowLine>
      </Section>
      <View className="h-10" />
    </Screen>
  );
}
