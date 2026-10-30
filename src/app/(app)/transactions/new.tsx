import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { Band, BarButton, ChipField, Label, NavHeader, Screen, TextField } from '@/components/ui';
import { useAccounts } from '@/features/accounts/api';
import { useCategories, useCreateTransaction } from '@/features/transactions/api';
import { toISODate } from '@/lib/format';
import { colors } from '@/theme';

const schema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount')
    .refine((v) => Number(v) > 0, 'Enter an amount'),
  direction: z.enum(['debit', 'credit']),
  account_id: z.string().min(1, 'Pick an account'),
  category_id: z.string(),
  merchant: z.string().trim(),
  note: z.string().trim(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Not a valid date'),
});
type Form = z.infer<typeof schema>;

/** Today keeps the current time; other dates land at noon local. */
function occurredAt(date: string) {
  if (date === toISODate(new Date())) return new Date().toISOString();
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}

export default function NewTransaction() {
  const accountsData = useAccounts().data;
  const accounts = accountsData ?? [];
  const categories = useCategories().data ?? [];
  const create = useCreateTransaction();
  const { control, handleSubmit, setValue, getValues } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      direction: 'debit',
      account_id: '',
      category_id: '',
      merchant: '',
      note: '',
      date: toISODate(new Date()),
    },
  });
  const amount = useController({ control, name: 'amount' });
  const direction = useWatch({ control, name: 'direction' });

  // Default to the Cash account once accounts load.
  useEffect(() => {
    if (getValues('account_id') || !accountsData?.length) return;
    const cash = accountsData.find((a) => a.kind === 'cash') ?? accountsData[0];
    setValue('account_id', cash.id);
  }, [accountsData, getValues, setValue]);

  const catOptions = categories
    .filter((c) => (direction === 'debit' ? c.kind !== 'income' : c.kind !== 'expense'))
    .map((c) => ({ value: c.id, label: c.name }));

  const submit = handleSubmit((f) =>
    create.mutate(
      {
        amount: Number(f.amount),
        direction: f.direction,
        account_id: f.account_id,
        category_id: f.category_id || null,
        merchant: f.merchant || null,
        note: f.note || null,
        occurred_at: occurredAt(f.date),
        source: 'manual',
      },
      { onSuccess: () => router.back() },
    ),
  );

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={<BarButton title="Save" tone="ink" loading={create.isPending} onPress={submit} />}>
        <NavHeader title="Add transaction" />
        <View className="px-6 pt-6">
          <Label tone="mute">{direction === 'debit' ? 'Spent' : 'Received'}</Label>
          <View className="flex-row items-baseline">
            <Text className="font-num-medium text-[46px] text-mute">₹</Text>
            <TextInput
              value={amount.field.value}
              onChangeText={amount.field.onChange}
              onBlur={amount.field.onBlur}
              placeholder="0"
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
              autoFocus
              accessibilityLabel="Amount"
              className="flex-1 font-num-medium text-[46px] text-ink"
            />
          </View>
          {amount.fieldState.error ? (
            <Text className="font-display text-[12px] text-alert">{amount.fieldState.error.message}</Text>
          ) : null}
        </View>
        <Band tone="paper" className="pt-6">
          <ChipField
            control={control}
            name="direction"
            label="Type"
            options={[
              { value: 'debit', label: 'Spent' },
              { value: 'credit', label: 'Received' },
            ]}
          />
          <ChipField
            control={control}
            name="account_id"
            label="Account"
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
          <ChipField control={control} name="category_id" label="Category" options={catOptions} />
          <TextField control={control} name="merchant" label="Merchant / paid to" placeholder="Chai stall" />
          <TextField control={control} name="note" label="Note" />
          <TextField control={control} name="date" label="Date (YYYY-MM-DD)" keyboardType="numbers-and-punctuation" />
          {create.error ? <Text className="font-display text-[13px] text-alert">{create.error.message}</Text> : null}
        </Band>
      </Screen>
    </KeyboardAvoidingView>
  );
}
