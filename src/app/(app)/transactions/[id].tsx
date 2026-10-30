import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import {
  Amount,
  BarButton,
  Body,
  Chips,
  EmptyState,
  Label,
  NavHeader,
  RowLine,
  Screen,
  type IconName,
} from '@/components/ui';
import { useAccounts } from '@/features/accounts/api';
import {
  useCategories,
  useDeleteTransaction,
  useTransaction,
  useUpdateTransaction,
} from '@/features/transactions/api';
import { formatDate, formatTime } from '@/lib/format';
import { colors } from '@/theme';

function Value({ children }: { children: string }) {
  return (
    <Text numberOfLines={1} className="ml-4 flex-1 text-right font-display-medium text-[15px] text-ink">
      {children}
    </Text>
  );
}

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const txn = useTransaction(id);
  const categories = useCategories().data ?? [];
  const accounts = useAccounts().data ?? [];
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const [picking, setPicking] = useState(false);
  const [showSms, setShowSms] = useState(false);

  const t = txn.data;
  if (!t) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        {txn.error ? <EmptyState title="Transaction not found" /> : <ActivityIndicator color={colors.ink} />}
      </View>
    );
  }
  const category = categories.find((c) => c.id === t.category_id);
  const account = accounts.find((a) => a.id === t.account_id);
  const amount = t.direction === 'debit' ? -Number(t.amount) : Number(t.amount);

  const confirmDelete = () =>
    Alert.alert(
      'Delete transaction?',
      t.source === 'manual' ? 'The account balance will be adjusted back.' : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(t, { onSuccess: () => router.back() }) },
      ],
    );

  return (
    <Screen footer={<BarButton title="Delete" loading={remove.isPending} onPress={confirmDelete} />}>
      <NavHeader title="Payment detail" />
      <View className="flex-row items-center px-6 pt-6">
        <View className="h-[72px] w-[72px] items-center justify-center bg-forest">
          <Ionicons name={(category?.icon ?? 'ellipse-outline') as IconName} size={28} color={colors.paper} />
        </View>
        <View className="ml-4 flex-1">
          <Label tone="mute">{t.direction === 'debit' ? 'Paid to' : 'Received from'}</Label>
          <Text numberOfLines={2} className="font-display-bold text-[22px] text-ink">
            {t.merchant || 'Unknown'}
          </Text>
        </View>
      </View>
      <View className="px-6 pt-6">
        <Amount value={amount} size="xl" signed />
      </View>

      <View className="px-6 pt-6">
        <RowLine label="Merchant">
          <Value>{t.merchant || 'Unknown'}</Value>
        </RowLine>
        <RowLine label="Account">
          <Value>{account?.name ?? '—'}</Value>
        </RowLine>
        <RowLine label="Date">
          <Value>{formatDate(t.occurred_at, true)}</Value>
        </RowLine>
        <RowLine label="Time">
          <Value>{formatTime(t.occurred_at)}</Value>
        </RowLine>
        <RowLine label="Source">
          <Value>{t.source === 'sms' ? 'Bank SMS' : t.source === 'import' ? 'Import' : 'Manual'}</Value>
        </RowLine>
        <RowLine label="Category">
          <Pressable onPress={() => setPicking((p) => !p)} accessibilityRole="button" className="ml-4 flex-1 flex-row justify-end">
            <Text className="font-display-medium text-[15px] text-ink">{category?.name ?? 'Uncategorised'}</Text>
            <Text className="ml-3 font-display text-[13px] uppercase tracking-[1px] text-mute">
              {picking ? 'Done' : 'Change'}
            </Text>
          </Pressable>
        </RowLine>
        {picking ? (
          <View className="py-3">
            <Chips
              value={t.category_id ?? ''}
              onChange={(v) => update.mutate({ id: t.id, category_id: v }, { onSuccess: () => setPicking(false) })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </View>
        ) : null}
        {t.note ? (
          <RowLine label="Note">
            <Value>{t.note}</Value>
          </RowLine>
        ) : null}
        {update.error ? <Body className="mt-2 text-alert">{update.error.message}</Body> : null}
        {remove.error ? <Body className="mt-2 text-alert">{remove.error.message}</Body> : null}
      </View>

      {t.source === 'sms' && t.raw_sms ? (
        <View className="px-6 pb-6 pt-6">
          <Pressable onPress={() => setShowSms((s) => !s)} accessibilityRole="button" className="flex-row items-center">
            <Label tone="mute">{showSms ? 'Hide' : 'Show'} original SMS</Label>
            <Ionicons name={showSms ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mute} />
          </Pressable>
          {showSms ? <Text className="mt-2 font-num text-[13px] text-ink">{t.raw_sms}</Text> : null}
        </View>
      ) : null}
    </Screen>
  );
}
