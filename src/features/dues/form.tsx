import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { ChipField, TextField } from '@/components/ui';
import { useAccountOptions } from '@/features/subscriptions/api';
import type { Due, DueInsert } from '@/types/db';

import { DUE_KIND_LABEL, RECURRENCE_LABEL } from './logic';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const dueSchema = z.object({
  title: z.string().trim().min(1, 'What is it for?'),
  amount: z
    .string()
    .trim()
    .refine((v) => Number(v.replace(/,/g, '')) >= 0 && v !== '', 'Enter an amount'),
  due_date: z
    .string()
    .trim()
    .refine((v) => isoDate.test(v) && !Number.isNaN(Date.parse(v)), 'Use YYYY-MM-DD'),
  kind: z.enum(['card_bill', 'premium', 'installment', 'subscription', 'loan', 'other']),
  recurrence: z.enum(['none', 'monthly', 'quarterly', 'half_yearly', 'yearly']),
  account_id: z.string(),
});
export type DueForm = z.infer<typeof dueSchema>;

export function toForm(d?: Partial<Due>): DueForm {
  return {
    title: d?.title ?? '',
    amount: d?.amount != null ? String(d.amount) : '',
    due_date: d?.due_date ?? '',
    kind: d?.kind ?? 'other',
    recurrence: d?.recurrence ?? 'none',
    account_id: d?.account_id ?? '',
  };
}

export function toRow(f: DueForm): DueInsert {
  return {
    title: f.title.trim(),
    amount: Number(f.amount.replace(/,/g, '')),
    due_date: f.due_date,
    kind: f.kind,
    recurrence: f.recurrence,
    account_id: f.account_id || null,
  };
}

export function useDueForm(initial?: Partial<Due>) {
  return useForm<DueForm>({ resolver: zodResolver(dueSchema), defaultValues: toForm(initial) });
}

const kindOptions = Object.entries(DUE_KIND_LABEL).map(([value, label]) => ({ value, label }));
const recurrenceOptions = Object.entries(RECURRENCE_LABEL).map(([value, label]) => ({ value, label }));

export function DueFields({ form }: { form: ReturnType<typeof useDueForm> }) {
  const { control } = form;
  const accounts = useAccountOptions();
  const accountOptions = [
    { value: '', label: 'None' },
    ...(accounts.data ?? []).filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name })),
  ];
  return (
    <View>
      <TextField control={control} name="title" label="Title" placeholder="HDFC card bill" autoCapitalize="sentences" />
      <TextField control={control} name="amount" label="Amount (₹)" keyboardType="decimal-pad" placeholder="12500" />
      <TextField
        control={control}
        name="due_date"
        label="Due date (YYYY-MM-DD)"
        placeholder="2026-11-07"
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <ChipField control={control} name="kind" label="Kind" options={kindOptions} />
      <ChipField control={control} name="recurrence" label="Repeats" options={recurrenceOptions} />
      <ChipField control={control} name="account_id" label="Pay from" options={accountOptions} />
    </View>
  );
}
