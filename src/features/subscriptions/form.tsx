import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { ChipField, SmallButton, TextField } from '@/components/ui';
import type { Subscription, SubscriptionInsert } from '@/types/db';

import { useAccountOptions } from './api';
import { AppPickerField } from './app-picker';
import { suggestServices } from './known-services';
import { CYCLE_LABEL } from './logic';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const subscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Name it'),
  amount: z
    .string()
    .trim()
    .refine((v) => Number(v.replace(/,/g, '')) > 0, 'Enter an amount'),
  billing_cycle: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  next_charge_date: z
    .string()
    .trim()
    .refine((v) => v === '' || (isoDate.test(v) && !Number.isNaN(Date.parse(v))), 'Use YYYY-MM-DD'),
  account_id: z.string(),
  android_package: z.string().nullable(),
  merchant_pattern: z.string().trim(),
  status: z.enum(['active', 'paused', 'cancelled']),
});
export type SubscriptionForm = z.infer<typeof subscriptionSchema>;

export function toForm(s?: Partial<Subscription>): SubscriptionForm {
  return {
    name: s?.name ?? '',
    amount: s?.amount != null ? String(s.amount) : '',
    billing_cycle: s?.billing_cycle ?? 'monthly',
    next_charge_date: s?.next_charge_date ?? '',
    account_id: s?.account_id ?? '',
    android_package: s?.android_package ?? null,
    merchant_pattern: s?.merchant_pattern ?? '',
    status: s?.status ?? 'active',
  };
}

export function toRow(f: SubscriptionForm): SubscriptionInsert {
  return {
    name: f.name.trim(),
    amount: Number(f.amount.replace(/,/g, '')),
    billing_cycle: f.billing_cycle,
    next_charge_date: f.next_charge_date || null,
    account_id: f.account_id || null,
    android_package: f.android_package || null,
    merchant_pattern: f.merchant_pattern.trim() || null,
    status: f.status,
  };
}

export function useSubscriptionForm(initial?: Partial<Subscription>) {
  return useForm<SubscriptionForm>({ resolver: zodResolver(subscriptionSchema), defaultValues: toForm(initial) });
}

const cycleOptions = Object.entries(CYCLE_LABEL).map(([value, label]) => ({ value, label }));
const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function SubscriptionFields({ form }: { form: ReturnType<typeof useSubscriptionForm> }) {
  const { control, setValue } = form;
  const accounts = useAccountOptions();
  const name = useWatch({ control, name: 'name' });
  const [picked, setPicked] = useState<string | null>(null);
  const suggestions = picked === name ? [] : suggestServices(name).filter((s) => s.name !== name);

  const accountOptions = [
    { value: '', label: 'None' },
    ...(accounts.data ?? []).filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <View>
      <TextField control={control} name="name" label="Name" placeholder="Netflix" autoCapitalize="words" />
      {suggestions.length ? (
        <View className="-mt-3 mb-5 flex-row flex-wrap gap-2">
          {suggestions.map((s) => (
            <SmallButton
              key={s.name}
              title={s.name}
              onPress={() => {
                setPicked(s.name);
                setValue('name', s.name, { shouldValidate: true });
                setValue('billing_cycle', s.cycle);
                setValue('android_package', s.androidPackage);
                setValue('merchant_pattern', s.merchantPattern);
              }}
            />
          ))}
        </View>
      ) : null}
      <TextField control={control} name="amount" label="Amount (₹)" keyboardType="decimal-pad" placeholder="649" />
      <ChipField control={control} name="billing_cycle" label="Billing cycle" options={cycleOptions} />
      <TextField
        control={control}
        name="next_charge_date"
        label="Next charge date (YYYY-MM-DD)"
        placeholder="2026-11-05"
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <ChipField control={control} name="account_id" label="Paid from" options={accountOptions} />
      <AppPickerField control={control} name="android_package" />
      <TextField
        control={control}
        name="merchant_pattern"
        label="Merchant text in bank SMS"
        placeholder="netflix"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ChipField control={control} name="status" label="Status" options={statusOptions} />
    </View>
  );
}
