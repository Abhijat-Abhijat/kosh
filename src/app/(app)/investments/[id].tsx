import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import {
  Amount,
  Band,
  BarButton,
  EmptyState,
  Headline,
  Label,
  LineBars,
  NavHeader,
  ProgressLines,
  RowLine,
  Screen,
} from '@/components/ui';
import { formatMoney, formatTime } from '@/lib/format';
import { colors } from '@/theme';
import type { Holding } from '@/types/db';
import { useCloseHolding, useDeleteHolding, useHolding } from '@/features/investments/api';
import {
  gainPct,
  holdingCost,
  holdingValue,
  licTotalOutlay,
  MARKET_KINDS,
  maturityValue,
  nextEvent,
  premiumsPaid,
  rdInstalmentsPaid,
  rdTotalInstalments,
  tenureProgress,
  todayISO,
  totalPremiums,
} from '@/features/investments/calc';
import { FREQ_OPTIONS, KIND_LABEL, KIND_SHORT } from '@/features/investments/form';
import { GOLD_ESTIMATE, useHistory } from '@/features/investments/prices';
import { fmtDay, Gain } from '@/features/investments/ui';

const freqLabel = (f: string | null) => FREQ_OPTIONS.find((o) => o.value === f)?.label ?? '—';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <RowLine label={label}>
      <Text className="font-num-medium text-[15px] text-ink">{value}</Text>
    </RowLine>
  );
}

function facts(h: Holding, asOf: string): [string, string][] {
  const out: [string, string][] = [];
  const add = (label: string, v: string | number | null | undefined, money = false) => {
    if (v == null || v === '') return;
    out.push([label, money && typeof v === 'number' ? formatMoney(v) : String(v)]);
  };
  add('Institution', h.institution);
  if (h.kind === 'stock' || h.kind === 'mutual_fund') add(h.kind === 'stock' ? 'Symbol' : 'Scheme code', h.symbol);
  if (h.units != null) add(h.kind === 'gold' ? 'Grams' : 'Units', h.units);
  if (h.kind === 'stock' && h.units) add('Avg buy price', h.invested_amount / h.units, true);
  if (h.current_price != null) add(h.kind === 'gold' ? 'Price / gram' : 'Current price', h.current_price, true);
  if (h.interest_rate != null) add('Interest rate', `${h.interest_rate}% p.a.`);
  if (h.kind === 'fd') add('Compounding', freqLabel(h.compounding ?? 'quarterly'));
  if (h.kind === 'rd' && h.installment_amount) {
    add('Monthly instalment', h.installment_amount, true);
    if (h.start_date && h.maturity_date) {
      add('Instalments paid', `${rdInstalmentsPaid(h.start_date, h.maturity_date, asOf, h.installment_day)} of ${rdTotalInstalments(h.start_date, h.maturity_date)}`);
    }
  }
  if (h.kind === 'lic' && h.installment_amount) {
    add('Premium', `${formatMoney(h.installment_amount)} ${freqLabel(h.premium_frequency).toLowerCase()}`);
    if (h.start_date && h.premium_frequency && h.maturity_date) {
      add('Premiums paid', `${premiumsPaid(h.start_date, h.premium_frequency, asOf, h.maturity_date)} of ${totalPremiums(h.start_date, h.premium_frequency, h.maturity_date)}`);
    }
    add('Total outlay', licTotalOutlay(h), true);
    add('Sum assured', h.sum_assured, true);
  }
  add('Start', h.start_date ? fmtDay(h.start_date) : null);
  add('Maturity', h.maturity_date ? fmtDay(h.maturity_date) : null);
  const ev = nextEvent(h, asOf);
  if (ev && ev.label !== 'Matures') add(`Next ${ev.label.toLowerCase()}`, fmtDay(ev.date));
  add('Notes', h.notes);
  return out;
}

export default function HoldingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: h, isLoading } = useHolding(id);
  const history = useHistory(h);
  const close = useCloseHolding();
  const del = useDeleteHolding();
  const asOf = todayISO();

  if (!h) {
    return (
      <Screen>
        <NavHeader title="Investment" />
        {isLoading ? <ActivityIndicator color={colors.ink} /> : <EmptyState title="Not found" />}
      </Screen>
    );
  }

  const value = holdingValue(h, asOf);
  const cost = holdingCost(h, asOf);
  const gain = value - cost;
  const progress = tenureProgress(h, asOf);
  const atMaturity = maturityValue(h);
  const market = MARKET_KINDS.includes(h.kind);
  const estimate = h.kind === 'gold' && h.symbol === GOLD_ESTIMATE;

  const confirmDelete = () =>
    Alert.alert('Delete investment?', `${h.name} and its history will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => del.mutate(h.id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <Screen
      footer={
        <BarButton
          title={h.closed ? 'Reopen' : 'Mark closed'}
          tone="ink"
          loading={close.isPending}
          onPress={() => close.mutate({ id: h.id, closed: !h.closed })}
        />
      }
    >
      <NavHeader
        title={KIND_SHORT[h.kind]}
        right={
          <Pressable
            onPress={() => router.push(`/investments/new?id=${h.id}` as Href)}
            accessibilityLabel="Edit"
            hitSlop={12}
          >
            <Ionicons name="create-outline" size={22} color={colors.ink} />
          </Pressable>
        }
      />
      <View className="px-6 pt-4">
        <Headline lead={h.institution ?? KIND_LABEL[h.kind]} title={h.name} />
        <Label tone="mute" className="mt-6">
          {h.closed ? 'Closed · last value' : estimate ? 'Current value · estimate' : 'Current value'}
        </Label>
        <Amount value={value} size="xl" />
        <Gain value={gain} pct={gainPct(gain, cost)} />
        {h.price_updated_at && market ? (
          <Label tone="mute" className="mt-1">
            Price {fmtDay(h.price_updated_at.slice(0, 10), false)} {formatTime(h.price_updated_at)}
          </Label>
        ) : null}
      </View>

      <View className="mt-8">
        {progress != null && !market ? (
          <Band tone="goal">
            <View className="flex-row justify-between">
              <View>
                <Label>Invested</Label>
                <Amount value={cost} size="sm" hideFraction />
              </View>
              <View className="items-end">
                <Label>{h.kind === 'lic' ? 'Sum assured' : 'At maturity'}</Label>
                <Amount value={(h.kind === 'lic' ? h.sum_assured : atMaturity) ?? value} size="sm" hideFraction />
              </View>
            </View>
            <View className="mt-4">
              <ProgressLines progress={progress} fill={colors.sage} line={colors.ink} />
            </View>
            <Label className="mt-3">
              Matures {fmtDay(h.maturity_date)}
              {atMaturity != null ? ` · ${formatMoney(atMaturity)}` : ''} · {Math.round(progress * 100)}% elapsed
            </Label>
          </Band>
        ) : null}

        {market ? (
          <Band tone="deep">
            <View className="flex-row justify-between">
              <View>
                <Label tone="onDark">Invested</Label>
                <Amount value={cost} size="sm" tone="onDark" hideFraction />
              </View>
              <View className="items-end">
                <Label tone="onDark">1 year{h.kind === 'gold' ? ' · gold USD/oz' : ''}</Label>
              </View>
            </View>
            <View className="mt-4">
              {history.isLoading ? (
                <ActivityIndicator color={colors.onDark} />
              ) : history.data?.length ? (
                <LineBars values={rescale(history.data)} height={64} color={colors.onDark} gap={2} />
              ) : (
                <Text className="font-display text-[12px] text-onDark">
                  {h.symbol ? 'Price history unavailable right now.' : 'Add a symbol or scheme code to see history.'}
                </Text>
              )}
            </View>
          </Band>
        ) : null}
      </View>

      <View className="px-6 pt-6">
        {facts(h, asOf).map(([label, v]) => (
          <Fact key={label} label={label} value={v} />
        ))}
        <Pressable onPress={confirmDelete} className="mt-6 self-start active:opacity-70" accessibilityRole="button">
          <Label tone="mute">Delete investment</Label>
        </Pressable>
      </View>
    </Screen>
  );
}

/** Stretch closes so small moves are visible: bars start at 20% of height at the series low. */
function rescale(v: number[]) {
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  return v.map((x) => 0.2 + (0.8 * (x - min)) / span);
}
