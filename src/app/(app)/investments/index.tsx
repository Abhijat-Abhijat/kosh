import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  Amount,
  Band,
  bandText,
  EmptyState,
  Headline,
  Label,
  ListRow,
  NavHeader,
  PlusButton,
  RowLine,
  Screen,
} from '@/components/ui';
import { formatMoney, formatTime } from '@/lib/format';
import { colors } from '@/theme';
import type { HoldingKind } from '@/types/db';
import { useHoldings } from '@/features/investments/api';
import { gainPct, holdingCost, holdingValue, nextEvent, portfolioSummary, todayISO } from '@/features/investments/calc';
import { KIND_LABEL } from '@/features/investments/form';
import { isPriced, pricesStale, useRefreshPrices } from '@/features/investments/prices';
import { AllocationStrip, fmtDay, fmtPct, Gain, KIND_ICON, KIND_TILE, KIND_TONE } from '@/features/investments/ui';

export default function Investments() {
  const { data = [], isLoading, refetch, isRefetching, error } = useHoldings();
  const refresh = useRefreshPrices();
  const { mutate: runRefresh } = refresh;
  const [openKind, setOpenKind] = useState<HoldingKind | null>(null);
  const asOf = todayISO();
  const summary = useMemo(() => portfolioSummary(data, asOf), [data, asOf]);

  // Auto-refresh once per visit when any market price is older than 6 hours.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !data.length || !pricesStale(data)) return;
    autoRan.current = true;
    runRefresh();
  }, [data, runRefresh]);

  const lastUpdated = data
    .filter(isPriced)
    .map((h) => h.price_updated_at)
    .filter((d): d is string => !!d)
    .sort()
    .pop();
  const failed = refresh.data?.failed ?? [];
  const open = data.filter((h) => !h.closed);
  const closed = data.filter((h) => h.closed);
  const add = () => router.push('/investments/new' as Href);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch} footer={<PlusButton onPress={add} label="Add investment" />}>
      <NavHeader title="Investments" />
      <View className="px-6 pt-4">
        <Headline lead="Savings &" title="Investments" />
      </View>

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : error ? (
        <EmptyState title="Could not load holdings" hint={error.message} />
      ) : open.length === 0 ? (
        <EmptyState title="Nothing tracked yet" hint="Add an FD, RD, stock, mutual fund, gold or LIC policy with the plus below." />
      ) : (
        <>
          <View className="px-6 pt-8">
            <Label tone="mute">Total value</Label>
            <Amount value={summary.totalValue} size="xl" />
            <View className="mt-1 flex-row items-baseline justify-between">
              <Gain value={summary.gain} pct={summary.gainPct} />
              <Label tone="mute">Invested {formatMoney(summary.totalCost)}</Label>
            </View>
            <View className="mt-5">
              <AllocationStrip parts={summary.byKind} />
              <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
                {summary.byKind.map((k) => (
                  <View key={k.kind} className="flex-row items-center gap-1">
                    <View className="h-2 w-2" style={{ backgroundColor: colors[KIND_TONE[k.kind]] }} />
                    <Label tone="mute">
                      {KIND_LABEL[k.kind]} {summary.totalValue > 0 ? Math.round((k.value / summary.totalValue) * 100) : 0}%
                    </Label>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              onPress={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="mt-5 flex-row items-center gap-2 active:opacity-70"
              accessibilityRole="button"
            >
              {refresh.isPending ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <Ionicons name="refresh" size={16} color={colors.ink} />
              )}
              <Label>Refresh prices</Label>
              {lastUpdated ? <Label tone="mute">· updated {formatTime(lastUpdated)}</Label> : null}
            </Pressable>
            {failed.length ? (
              <Text className="mt-1 font-display text-[12px] text-alert">Could not update: {failed.join(', ')}</Text>
            ) : null}
          </View>

          {summary.upcomingMaturities.length ? (
            <View className="px-6 pt-6">
              <Label tone="mute" className="mb-1">
                Maturing in 90 days
              </Label>
              {summary.upcomingMaturities.map((m) => (
                <RowLine key={m.holding.id} label={`${m.holding.name} · ${fmtDay(m.date, false)}`}>
                  <Amount value={m.value} size="xs" hideFraction />
                </RowLine>
              ))}
            </View>
          ) : null}

          <View className="mt-8">
            {summary.byKind.map((k, i) => {
              const tone = KIND_TONE[k.kind];
              const txt = bandText[tone];
              const prevSame = i > 0 && KIND_TONE[summary.byKind[i - 1].kind] === tone;
              const expanded = openKind === k.kind;
              return (
                <View key={k.kind}>
                  <Band
                    tone={tone}
                    className={prevSame ? 'border-t border-ink/20' : ''}
                    onPress={() => setOpenKind(expanded ? null : k.kind)}
                  >
                    <Label tone={txt}>
                      {KIND_LABEL[k.kind]} · {k.count}
                    </Label>
                    <Amount value={k.value} size="lg" tone={txt} className="mt-2" />
                    <View className="mt-1 flex-row items-baseline justify-between">
                      <Gain value={k.gain} pct={k.gainPct} onDark={txt === 'onDark'} size={13} />
                      {k.next ? (
                        <Label tone={txt}>
                          {k.next.label} {fmtDay(k.next.date, false)}
                        </Label>
                      ) : null}
                    </View>
                  </Band>
                  {expanded
                    ? open
                        .filter((h) => h.kind === k.kind)
                        .map((h) => {
                          const v = holdingValue(h, asOf);
                          const c = holdingCost(h, asOf);
                          const ev = nextEvent(h, asOf);
                          return (
                            <ListRow
                              key={h.id}
                              icon={KIND_ICON[h.kind]}
                              tileClass={KIND_TILE[h.kind]}
                              title={h.name}
                              caption={ev ? `${ev.label} ${fmtDay(ev.date, false)}` : (h.institution ?? h.symbol ?? undefined)}
                              amount={v}
                              meta={fmtPct(gainPct(v - c, c))}
                              onPress={() => router.push(`/investments/${h.id}` as Href)}
                            />
                          );
                        })
                    : null}
                </View>
              );
            })}
          </View>

          {closed.length ? (
            <View className="px-6 pt-6">
              <Label tone="mute" className="mb-1">
                Closed
              </Label>
              {closed.map((h) => (
                <Pressable key={h.id} onPress={() => router.push(`/investments/${h.id}` as Href)}>
                  <RowLine label={h.name}>
                    <Label tone="mute">{KIND_LABEL[h.kind]}</Label>
                  </RowLine>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
