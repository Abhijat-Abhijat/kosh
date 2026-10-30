import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import {
  Amount,
  Band,
  BarButton,
  EmptyState,
  Headline,
  Label,
  ListRow,
  NavHeader,
  RowLine,
  Screen,
  SmallButton,
} from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import {
  useCheckIn,
  useDeleteSubscription,
  useSubscription,
  useSubscriptionTransactions,
  useUpdateSubscription,
} from '@/features/subscriptions/api';
import { SubscriptionFields, toForm, toRow, useSubscriptionForm } from '@/features/subscriptions/form';
import {
  CYCLE_LABEL,
  daysUnused,
  isUnused,
  monthlyCost,
  nextChargeDate,
  wastedSoFar,
} from '@/features/subscriptions/logic';
import { colors } from '@/theme';

export default function SubscriptionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sub = useSubscription(id);
  const update = useUpdateSubscription();
  const del = useDeleteSubscription();
  const checkIn = useCheckIn();
  const txns = useSubscriptionTransactions(sub.data?.merchant_pattern);
  const form = useSubscriptionForm();
  const [error, setError] = useState<string | null>(null);
  const now = useMemo(() => new Date(), [sub.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const { reset } = form;
  useEffect(() => {
    if (sub.data) reset(toForm(sub.data));
  }, [sub.data, reset]);

  const s = sub.data;
  if (!s) {
    return (
      <Screen>
        <NavHeader title="Subscription" />
        <EmptyState title={sub.isLoading ? 'Loading…' : 'Not found'} hint={sub.error?.message} />
      </Screen>
    );
  }

  const unused = isUnused(s, now);
  const next = s.next_charge_date ? nextChargeDate(s.next_charge_date, s.billing_cycle, now) : null;

  const save = form.handleSubmit(async (f) => {
    setError(null);
    try {
      await update.mutateAsync({ id: s.id, patch: toRow(f) });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const remove = () =>
    Alert.alert('Delete subscription?', `${s.name} and its pending payments will be removed.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => del.mutate(s.id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={<BarButton title="Save changes" tone="ink" loading={update.isPending} onPress={save} />}>
        <NavHeader
          title="Subscription"
          right={
            <Pressable onPress={remove} accessibilityLabel="Delete" hitSlop={12}>
              <Ionicons name="trash-outline" size={20} color={colors.ink} />
            </Pressable>
          }
        />
        <View className="px-6 pb-6 pt-2">
          <Headline lead={CYCLE_LABEL[s.billing_cycle]} title={s.name} />
          <Amount value={s.amount} size="xl" className="mt-4" />
          <Label tone="mute" className="mt-1">
            {formatMoney(monthlyCost(s.amount, s.billing_cycle))}/mo
            {next && s.status === 'active' ? ` · next ${formatDate(next, true)}` : ` · ${s.status}`}
          </Label>
        </View>

        <Band tone={unused ? 'alert' : 'deep'}>
          <Label tone={unused ? 'alertInk' : 'onDark'} className="mb-2">
            {unused ? 'Unused' : 'Usage'}
          </Label>
          <RowLine label={s.android_package ? 'Last opened' : 'Last confirmed'} tone="onDark">
            <Text className={`font-display text-[15px] ${unused ? 'text-alertInk' : 'text-onDark'}`}>
              {s.last_used_at ? formatDate(s.last_used_at, true) : 'never'}
            </Text>
          </RowLine>
          <RowLine label="Days unused" tone="onDark">
            <Text className={`font-num-medium text-[17px] ${unused ? 'text-alertInk' : 'text-onDark'}`}>
              {daysUnused(s, now)}
            </Text>
          </RowLine>
          <RowLine label="Wasted so far" tone="onDark">
            <Amount value={wastedSoFar(s, now)} size="sm" tone={unused ? 'alertInk' : 'onDark'} />
          </RowLine>
          {s.android_package ? (
            <Label tone="onDark" className="mt-2 opacity-70">
              Linked app {s.android_package}
            </Label>
          ) : null}
          {s.status === 'active' ? (
            <View className="mt-4 flex-row gap-2">
              <SmallButton
                title="Still using"
                tone={unused ? 'alertInk' : 'onDark'}
                onPress={() => checkIn.mutate({ id: s.id, stillUsing: true })}
              />
              <SmallButton
                title="Cancelled it"
                tone={unused ? 'solidLight' : 'onDark'}
                onPress={() => checkIn.mutate({ id: s.id, stillUsing: false })}
              />
            </View>
          ) : null}
        </Band>

        <Band tone="paper" className="pt-6">
          <SubscriptionFields form={form} />
          {error ? <Text className="font-display text-[13px] text-alert">{error}</Text> : null}
        </Band>

        <View className="px-6 pb-2 pt-2">
          <Label tone="mute">Charges matching “{s.merchant_pattern ?? '—'}”</Label>
        </View>
        {!s.merchant_pattern ? (
          <EmptyState title="No merchant text set" hint="Add the text your bank SMS shows to see past charges." />
        ) : txns.data?.length ? (
          txns.data.map((t) => (
            <ListRow
              key={t.id}
              icon="receipt-outline"
              title={t.merchant ?? s.name}
              caption={formatDate(t.occurred_at, true)}
              amount={t.direction === 'debit' ? -t.amount : t.amount}
            />
          ))
        ) : (
          <EmptyState title={txns.isLoading ? 'Loading…' : 'No matching charges yet'} />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
