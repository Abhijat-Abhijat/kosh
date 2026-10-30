import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';

import { Band, BarButton, NavHeader, Screen } from '@/components/ui';
import { useCreateSubscription } from '@/features/subscriptions/api';
import { SubscriptionFields, toRow, useSubscriptionForm } from '@/features/subscriptions/form';
import { findService } from '@/features/subscriptions/known-services';
import type { BillingCycle } from '@/types/db';

type Params = { name?: string; amount?: string; cycle?: BillingCycle; pattern?: string; next?: string };

/** Add a subscription. Accepts prefill params from detected recurring charges. */
export default function NewSubscription() {
  const p = useLocalSearchParams<Params>();
  const known = findService(p.pattern ?? p.name);
  const form = useSubscriptionForm({
    name: known?.name ?? p.name ?? '',
    amount: p.amount ? Number(p.amount) : undefined,
    billing_cycle: p.cycle ?? known?.cycle,
    next_charge_date: p.next ?? null,
    merchant_pattern: p.pattern ?? null,
    android_package: known?.androidPackage ?? null,
  });
  const create = useCreateSubscription();
  const [error, setError] = useState<string | null>(null);

  const submit = form.handleSubmit(async (f) => {
    setError(null);
    try {
      await create.mutateAsync(toRow(f));
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={<BarButton title="Add subscription" tone="ink" loading={create.isPending} onPress={submit} />}>
        <NavHeader title="New subscription" />
        <Band tone="paper" className="pt-4">
          <SubscriptionFields form={form} />
          {error ? <Text className="font-display text-[13px] text-alert">{error}</Text> : null}
        </Band>
      </Screen>
    </KeyboardAvoidingView>
  );
}
