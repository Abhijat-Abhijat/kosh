import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { z } from 'zod';

import { Band, BarButton, ChipField, Headline, Label, NavHeader, Screen, TextField } from '@/components/ui';
import type { Account, AccountInsert } from '@/types/db';
import { accountKindLabel, useAccounts } from './api';

const day = /^([1-9]|[12]\d|3[01])?$/;

const schema = z.object({
  name: z.string().trim().min(1, 'Give it a name'),
  kind: z.enum(['bank', 'credit_card', 'debit_card', 'cash', 'wallet']),
  institution: z.string().trim(),
  last4: z.string().trim().regex(/^(\d{4})?$/, 'Exactly 4 digits'),
  balance: z.string().trim().regex(/^(-?\d+(\.\d{1,2})?)?$/, 'Enter an amount'),
  credit_limit: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, 'Enter an amount'),
  billing_day: z.string().trim().regex(day, 'Day 1–31'),
  due_day: z.string().trim().regex(day, 'Day 1–31'),
  linked_account_id: z.string(),
  sms_sender_hint: z.string().trim(),
});
type Form = z.infer<typeof schema>;

const str = (v: string | number | null | undefined) => (v == null ? '' : String(v));
const orNull = (v: string) => (v === '' ? null : v);
const numOrNull = (v: string) => (v === '' ? null : Number(v));

function toForm(a?: Account): Form {
  return {
    name: a?.name ?? '',
    kind: a?.kind ?? 'bank',
    institution: str(a?.institution),
    last4: str(a?.last4),
    balance: str(a?.balance ?? ''),
    credit_limit: str(a?.credit_limit),
    billing_day: str(a?.billing_day),
    due_day: str(a?.due_day),
    linked_account_id: str(a?.linked_account_id),
    sms_sender_hint: str(a?.sms_sender_hint),
  };
}

function toRow(f: Form): AccountInsert {
  const card = f.kind === 'credit_card';
  return {
    name: f.name,
    kind: f.kind,
    institution: orNull(f.institution),
    last4: orNull(f.last4),
    balance: f.kind === 'debit_card' ? 0 : Number(f.balance || 0),
    credit_limit: card ? numOrNull(f.credit_limit) : null,
    billing_day: card ? numOrNull(f.billing_day) : null,
    due_day: card ? numOrNull(f.due_day) : null,
    linked_account_id: f.kind === 'debit_card' ? orNull(f.linked_account_id) : null,
    sms_sender_hint: orNull(f.sms_sender_hint.toUpperCase()),
  };
}

const kinds = (Object.keys(accountKindLabel) as Account['kind'][]).map((k) => ({
  value: k,
  label: accountKindLabel[k],
}));

/** Create/edit form for an account. `children` render below the form (e.g. recent transactions). */
export function AccountForm({
  title,
  lead,
  heading,
  initial,
  submitLabel,
  submitting,
  error,
  onSave,
  children,
}: {
  title: string;
  lead: string;
  heading: string;
  initial?: Account;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSave: (row: AccountInsert) => void;
  children?: ReactNode;
}) {
  const banks = (useAccounts().data ?? []).filter((a) => a.kind === 'bank' && a.id !== initial?.id);
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: toForm(initial),
  });
  const kind = useWatch({ control, name: 'kind' });

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        footer={
          <BarButton
            title={submitLabel}
            tone="ink"
            loading={submitting}
            onPress={handleSubmit((f) => onSave(toRow(f)))}
          />
        }
      >
        <NavHeader title={title} />
        <View className="px-6 pt-4">
          <Headline lead={lead} title={heading} />
        </View>
        <Band tone="paper" className="pt-8">
          <TextField control={control} name="name" label="Name" placeholder="HDFC Savings" />
          <ChipField control={control} name="kind" label="Kind" options={kinds} />
          <TextField control={control} name="institution" label="Bank / issuer" placeholder="HDFC Bank" />
          <TextField control={control} name="last4" label="Last 4 digits" keyboardType="number-pad" maxLength={4} />
          <Label tone="faint" className="-mt-4 mb-5">
            Used to match bank SMS
          </Label>
          {kind !== 'debit_card' ? (
            <TextField
              control={control}
              name="balance"
              label={kind === 'credit_card' ? 'Outstanding now' : 'Current balance'}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          ) : null}
          {kind === 'credit_card' ? (
            <>
              <TextField control={control} name="credit_limit" label="Credit limit" keyboardType="decimal-pad" />
              <View className="flex-row gap-6">
                <View className="flex-1">
                  <TextField control={control} name="billing_day" label="Bill generated on (day)" keyboardType="number-pad" maxLength={2} />
                </View>
                <View className="flex-1">
                  <TextField control={control} name="due_day" label="Payment due (day)" keyboardType="number-pad" maxLength={2} />
                </View>
              </View>
            </>
          ) : null}
          {kind === 'debit_card' ? (
            banks.length ? (
              <ChipField
                control={control}
                name="linked_account_id"
                label="Linked bank account"
                options={[{ value: '', label: 'None' }, ...banks.map((b) => ({ value: b.id, label: b.name }))]}
              />
            ) : (
              <Label tone="mute" className="mb-5">
                Add the bank account first to link this card
              </Label>
            )
          ) : null}
          <TextField
            control={control}
            name="sms_sender_hint"
            label="SMS sender"
            placeholder="HDFCBK"
            autoCapitalize="characters"
          />
          {error ? <Text className="font-display text-[13px] text-alert">{error}</Text> : null}
        </Band>
        {children}
      </Screen>
    </KeyboardAvoidingView>
  );
}
