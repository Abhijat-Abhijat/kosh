import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { BarButton, ChipField, Headline, Label, NavHeader, Screen, TextField } from '@/components/ui';
import { qk } from '@/lib/query-client';
import { table } from '@/lib/db/client';
import type { HoldingKind } from '@/types/db';
import { useCreateHolding, useHolding, useUpdateHolding } from '@/features/investments/api';
import {
  emptyForm,
  FREQ_OPTIONS,
  fromHolding,
  holdingSchema,
  KIND_LABEL,
  KIND_SHORT,
  toInsert,
  type HoldingForm,
  type HoldingParsed,
} from '@/features/investments/form';

const KIND_OPTIONS = (Object.keys(KIND_SHORT) as HoldingKind[]).map((k) => ({ value: k, label: KIND_SHORT[k] }));
const DATE_HINT = 'YYYY-MM-DD';
const numeric = { keyboardType: 'decimal-pad' as const };

function useAccountOptions(enabled: boolean) {
  return useQuery({
    queryKey: [...qk.accounts, 'picker'],
    enabled,
    queryFn: () => table('accounts').list({ where: { archived: false }, order: 'name' }),
  });
}

export default function HoldingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = useHolding(id).data;
  const create = useCreateHolding();
  const update = useUpdateHolding();
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState } = useForm<HoldingForm>({
    resolver: zodResolver(holdingSchema) as unknown as Resolver<HoldingForm>,
    defaultValues: emptyForm(),
  });
  const kind = useWatch({ control, name: 'kind' });
  const priceSource = useWatch({ control, name: 'priceSource' });
  const accounts = useAccountOptions(kind === 'rd');

  // Load the holding once; later refetches must not wipe in-progress edits.
  const loaded = useRef(false);
  useEffect(() => {
    if (!editing || loaded.current) return;
    loaded.current = true;
    reset(fromHolding(editing));
  }, [editing, reset]);

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const row = toInsert(values as unknown as HoldingParsed);
      if (id) await update.mutateAsync({ id, ...row });
      else await create.mutateAsync(row);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  });

  const f = { control } as const;
  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={<BarButton title={id ? 'Save changes' : 'Add investment'} tone="ink" loading={formState.isSubmitting} onPress={submit} />}>
        <NavHeader title={id ? 'Edit investment' : 'Add investment'} />
        <View className="px-6 pt-4">
          <Headline lead={id ? 'Update' : 'Track a new'} title={KIND_LABEL[kind]} />
        </View>
        <View className="px-6 pt-8">
          {id ? null : <ChipField {...f} name="kind" label="Type" options={KIND_OPTIONS} />}

          {kind === 'fd' ? (
            <>
              <TextField {...f} name="institution" label="Bank" placeholder="SBI" />
              <TextField {...f} name="invested" label="Principal (₹)" {...numeric} />
              <TextField {...f} name="rate" label="Interest rate (% p.a.)" {...numeric} />
              <TextField {...f} name="start" label="Start date" placeholder={DATE_HINT} />
              <TextField {...f} name="maturity" label="Maturity date" placeholder={DATE_HINT} />
              <ChipField {...f} name="compounding" label="Compounding" options={FREQ_OPTIONS} />
            </>
          ) : null}

          {kind === 'rd' ? (
            <>
              <TextField {...f} name="institution" label="Bank" placeholder="HDFC Bank" />
              <TextField {...f} name="instalment" label="Monthly instalment (₹)" {...numeric} />
              <TextField {...f} name="rate" label="Interest rate (% p.a.)" {...numeric} />
              <TextField {...f} name="start" label="Start date (first instalment)" placeholder={DATE_HINT} />
              <TextField {...f} name="maturity" label="Maturity date" placeholder={DATE_HINT} />
              <TextField {...f} name="day" label="Instalment day of month (optional)" placeholder="5" keyboardType="number-pad" />
              {accounts.data?.length ? (
                <ChipField
                  {...f}
                  name="accountId"
                  label="Funding account (optional)"
                  options={[{ value: '', label: 'None' }, ...accounts.data.map((a) => ({ value: a.id, label: a.name }))]}
                />
              ) : null}
            </>
          ) : null}

          {kind === 'stock' ? (
            <>
              <TextField {...f} name="symbol" label="Symbol" placeholder="RELIANCE.NS" autoCapitalize="characters" autoCorrect={false} />
              <Text className="font-display text-[12px] text-mute -mt-3 mb-5">
                NSE symbols end with .NS, BSE with .BO (as on Yahoo Finance).
              </Text>
              <TextField {...f} name="name" label="Name (optional)" placeholder="Reliance Industries" />
              <TextField {...f} name="units" label="Shares" {...numeric} />
              <TextField {...f} name="price" label="Average buy price (₹)" {...numeric} />
            </>
          ) : null}

          {kind === 'mutual_fund' ? (
            <>
              <TextField {...f} name="name" label="Scheme name" placeholder="Parag Parikh Flexi Cap - Direct Growth" />
              <TextField {...f} name="symbol" label="Scheme code (mfapi.in)" placeholder="122639" keyboardType="number-pad" />
              <TextField {...f} name="units" label="Units" {...numeric} />
              <TextField {...f} name="invested" label="Amount invested (₹)" {...numeric} />
            </>
          ) : null}

          {kind === 'gold' ? (
            <>
              <TextField {...f} name="institution" label="Provider" placeholder="Paytm Gold" />
              <TextField {...f} name="name" label="Name (optional)" />
              <TextField {...f} name="units" label="Grams" {...numeric} />
              <TextField {...f} name="invested" label="Amount invested (₹)" {...numeric} />
              <ChipField
                {...f}
                name="priceSource"
                label="Price"
                options={[
                  { value: 'estimate', label: 'Estimate from market' },
                  { value: 'manual', label: 'Enter manually' },
                ]}
              />
              {priceSource === 'manual' ? (
                <TextField {...f} name="price" label="Price per gram (₹)" {...numeric} />
              ) : (
                <Text className="font-display text-[12px] text-mute -mt-3 mb-5">
                  Estimated from international gold (USD/oz) × USD/INR. Provider prices include GST and spread.
                </Text>
              )}
            </>
          ) : null}

          {kind === 'lic' ? (
            <>
              <TextField {...f} name="name" label="Policy name / number" placeholder="Jeevan Anand 123456789" />
              <TextField {...f} name="instalment" label="Premium (₹)" {...numeric} />
              <ChipField {...f} name="frequency" label="Premium frequency" options={FREQ_OPTIONS} />
              <TextField {...f} name="start" label="Policy start date" placeholder={DATE_HINT} />
              <TextField {...f} name="maturity" label="Maturity date" placeholder={DATE_HINT} />
              <TextField {...f} name="sumAssured" label="Sum assured (₹, optional)" {...numeric} />
              <TextField {...f} name="currentValue" label="Current / surrender value (₹, optional)" {...numeric} />
            </>
          ) : null}

          {kind === 'ppf' || kind === 'other' ? (
            <>
              <TextField {...f} name="name" label="Name" placeholder={kind === 'ppf' ? 'PPF - SBI' : 'NPS, bonds, chit…'} />
              <TextField {...f} name="invested" label="Amount invested (₹)" {...numeric} />
              <TextField {...f} name="currentValue" label="Current value (₹, optional)" {...numeric} />
              <TextField {...f} name="rate" label="Interest rate (% p.a., optional)" {...numeric} />
              <TextField {...f} name="start" label="Start date (optional)" placeholder={DATE_HINT} />
              <TextField {...f} name="maturity" label="Maturity date (optional)" placeholder={DATE_HINT} />
            </>
          ) : null}

          <TextField {...f} name="notes" label="Notes (optional)" multiline />
          {error ? <Text className="font-display text-[13px] text-alert">{error}</Text> : null}
          {Object.keys(formState.errors).length && !error ? (
            <Label tone="mute">Check the highlighted fields</Label>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
