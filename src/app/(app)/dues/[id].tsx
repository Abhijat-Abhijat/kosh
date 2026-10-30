import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import {
  Amount,
  Band,
  BarButton,
  EmptyState,
  Headline,
  Label,
  NavHeader,
  RowLine,
  Screen,
  SmallButton,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useDeleteDue, useDue, useMarkPaid, useUpdateDue } from '@/features/dues/api';
import { DueFields, toForm, toRow, useDueForm } from '@/features/dues/form';
import { DUE_KIND_LABEL, RECURRENCE_LABEL, dueWhen, nextRecurrenceDate } from '@/features/dues/logic';

export default function DueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const due = useDue(id);
  const update = useUpdateDue();
  const del = useDeleteDue();
  const markPaid = useMarkPaid();
  const form = useDueForm();
  const [error, setError] = useState<string | null>(null);

  const { reset } = form;
  useEffect(() => {
    if (due.data) reset(toForm(due.data));
  }, [due.data, reset]);

  const d = due.data;
  if (!d) {
    return (
      <Screen>
        <NavHeader title="Payment" />
        <EmptyState title={due.isLoading ? 'Loading…' : 'Not found'} hint={due.error?.message} />
      </Screen>
    );
  }

  const pending = d.status === 'pending';
  const overdue = pending && dueWhen(d.due_date).endsWith('late');
  const next = nextRecurrenceDate(d.due_date, d.recurrence);

  const save = form.handleSubmit(async (f) => {
    setError(null);
    try {
      await update.mutateAsync({ id: d.id, patch: toRow(f) });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const settle = (status: 'paid' | 'skipped') =>
    Alert.alert(
      status === 'paid' ? 'Mark as paid?' : 'Skip this payment?',
      next ? `The next one will be added for ${formatDate(next, true)}.` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: status === 'paid' ? 'Mark paid' : 'Skip', onPress: () => markPaid.mutate({ due: d, status }, { onSuccess: () => router.back() }) },
      ],
    );

  const remove = () =>
    Alert.alert('Delete payment?', 'Its reminders will be cancelled too.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate(d, { onSuccess: () => router.back() }) },
    ]);

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        footer={
          pending ? (
            <BarButton title="Mark paid" tone={overdue ? 'alert' : 'ink'} loading={markPaid.isPending} onPress={() => settle('paid')} />
          ) : undefined
        }
      >
        <NavHeader title="Payment" />
        <View className="px-6 pb-6 pt-2">
          <Headline lead={DUE_KIND_LABEL[d.kind]} title={d.title} />
          <Amount value={d.amount} size="xl" className="mt-4" />
        </View>

        <Band tone={overdue ? 'alert' : 'deep'}>
          <RowLine label="Due" tone="onDark">
            <Text className={`font-display text-[15px] ${overdue ? 'text-alertInk' : 'text-onDark'}`}>
              {formatDate(d.due_date, true)} · {dueWhen(d.due_date)}
            </Text>
          </RowLine>
          <RowLine label="Status" tone="onDark">
            <Text className="font-display text-[15px] capitalize text-onDark">
              {d.status}
              {d.paid_at ? ` ${formatDate(d.paid_at)}` : ''}
            </Text>
          </RowLine>
          <RowLine label="Repeats" tone="onDark">
            <Text className="font-display text-[15px] text-onDark">{RECURRENCE_LABEL[d.recurrence]}</Text>
          </RowLine>
          {pending ? (
            <View className="mt-4 flex-row gap-2">
              <SmallButton title="Skip" tone={overdue ? 'alertInk' : 'onDark'} onPress={() => settle('skipped')} />
              <SmallButton title="Delete" tone={overdue ? 'alertInk' : 'onDark'} onPress={remove} />
            </View>
          ) : (
            <View className="mt-4 flex-row gap-2">
              <SmallButton title="Delete" tone="onDark" onPress={remove} />
            </View>
          )}
        </Band>

        <Band tone="paper" className="pt-6">
          <Label tone="mute" className="mb-4">
            Edit
          </Label>
          <DueFields form={form} />
          {error ? <Text className="font-display text-[13px] text-alert">{error}</Text> : null}
          <SmallButton title={update.isPending ? 'Saving…' : 'Save changes'} tone="solid" onPress={save} disabled={update.isPending} />
        </Band>
      </Screen>
    </KeyboardAvoidingView>
  );
}
