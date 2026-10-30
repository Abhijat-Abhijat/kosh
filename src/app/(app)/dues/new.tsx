import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';

import { Band, BarButton, NavHeader, Screen } from '@/components/ui';
import { useCreateDue } from '@/features/dues/api';
import { toISODate } from '@/features/dues/dates';
import { DueFields, toRow, useDueForm } from '@/features/dues/form';
import { ensureNotificationPermission } from '@/features/dues/notifications';

export default function NewDue() {
  const form = useDueForm({ due_date: toISODate(new Date()) });
  const create = useCreateDue();
  const [error, setError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (f) => {
    setError(null);
    try {
      // Ask for notification permission at the moment it clearly matters.
      await ensureNotificationPermission(true).catch(() => false);
      await create.mutateAsync(toRow(f));
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={<BarButton title="Add payment" tone="ink" loading={create.isPending} onPress={submit} />}>
        <NavHeader title="New payment" />
        <Band tone="paper" className="pt-4">
          <DueFields form={form} />
          {error ? <Text className="font-display text-[13px] text-alert">{error}</Text> : null}
        </Band>
      </Screen>
    </KeyboardAvoidingView>
  );
}
