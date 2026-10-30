import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';

import {
  Amount,
  Band,
  Body,
  EmptyState,
  Headline,
  Label,
  ListRow,
  PlusButton,
  Screen,
  SmallButton,
  TopBar,
} from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import {
  useCheckIn,
  useRecurringCandidates,
  useRefreshUsage,
  useSubscriptions,
} from '@/features/subscriptions/api';
import { serviceIcon } from '@/features/subscriptions/known-services';
import {
  CYCLE_LABEL,
  CYCLE_SHORT,
  daysUnused,
  isUnused,
  monthlyCost,
  needsCheckIn,
  nextChargeDate,
  wastedSoFar,
} from '@/features/subscriptions/logic';
import { useUsageAccess } from '@/features/subscriptions/usage';
import type { Subscription } from '@/types/db';

export default function Subscriptions() {
  const subs = useSubscriptions();
  const candidates = useRecurringCandidates();
  const refreshUsage = useRefreshUsage();
  const checkIn = useCheckIn();
  const usage = useUsageAccess();
  const now = useMemo(() => new Date(), [subs.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => subs.data ?? [], [subs.data]);
  const active = list.filter((s) => s.status === 'active');
  const monthly = active.reduce((t, s) => t + monthlyCost(s.amount, s.billing_cycle), 0);
  const unused = active.filter((s) => isUnused(s, now));
  const unusedMonthly = unused.reduce((t, s) => t + monthlyCost(s.amount, s.billing_cycle), 0);
  const checkIns = active.filter((s) => needsCheckIn(s, now) && !isUnused(s, now));
  const hasLinked = active.some((s) => s.android_package);

  // Pull fresh usage stats once per load when access is granted.
  const refreshedFor = useRef<number>(0);
  const { mutate: refresh } = refreshUsage;
  useEffect(() => {
    if (usage.state === 'granted' && subs.data && refreshedFor.current !== subs.dataUpdatedAt) {
      refreshedFor.current = subs.dataUpdatedAt;
      refresh(subs.data);
    }
  }, [usage.state, subs.data, subs.dataUpdatedAt, refresh]);

  const answer = (s: Subscription, stillUsing: boolean) => checkIn.mutate({ id: s.id, stillUsing });

  return (
    <Screen
      refreshing={subs.isRefetching}
      onRefresh={() => {
        subs.refetch();
        candidates.refetch();
        usage.recheck();
      }}
    >
      <TopBar />
      <View className="px-6 pb-6 pt-6">
        <Headline lead="Your" title="Subscriptions" />
        <View className="mt-6">
          <Label tone="mute">Per month · {active.length} active</Label>
          <Amount value={monthly} size="xl" className="mt-1" />
          <Label tone="mute" className="mt-1">
            {formatMoney(monthly * 12)} a year
          </Label>
        </View>
      </View>

      {unused.length ? (
        <Band tone="alert">
          <Label tone="alertInk">Unused · {unused.length}</Label>
          <Text className="mt-1 font-display-medium text-[22px] text-alertInk">
            {formatMoney(unusedMonthly)}/mo on things you don’t use
          </Text>
          {unused.map((s) => (
            <View key={s.id} className="mt-4 border-t border-alertInk/30 pt-3">
              <Text
                onPress={() => router.push(`/subscriptions/${s.id}` as Href)}
                className="font-display-semibold text-[17px] text-alertInk"
              >
                {s.name}
              </Text>
              <Label tone="alertInk" className="mt-1 opacity-90">
                {formatMoney(monthlyCost(s.amount, s.billing_cycle))}/mo ·{' '}
                {s.android_package ? 'not opened' : 'no check-in'} in {daysUnused(s, now)} days ·{' '}
                {formatMoney(wastedSoFar(s, now))} wasted
              </Label>
              <View className="mt-3 flex-row gap-2">
                <SmallButton title="Still using" tone="alertInk" onPress={() => answer(s, true)} disabled={checkIn.isPending} />
                <SmallButton title="Cancelled it" tone="solidLight" onPress={() => answer(s, false)} disabled={checkIn.isPending} />
              </View>
            </View>
          ))}
        </Band>
      ) : null}

      {checkIns.length ? (
        <Band tone="sage">
          <Label tone="onDark">Check in · {checkIns.length}</Label>
          {checkIns.map((s) => (
            <View key={s.id} className="mt-3 flex-row items-center justify-between">
              <Text className="flex-1 pr-2 font-display-medium text-[16px] text-onDark">Still using {s.name}?</Text>
              <View className="flex-row gap-2">
                <SmallButton title="Yes" tone="onDark" onPress={() => answer(s, true)} />
                <SmallButton title="Cancelled" tone="onDark" onPress={() => answer(s, false)} />
              </View>
            </View>
          ))}
        </Band>
      ) : null}

      {usage.state === 'denied' && hasLinked ? (
        <Band tone="deep" onPress={usage.openSettings}>
          <Label tone="onDark">Usage access off</Label>
          <Body tone="onDark" className="mt-1 pr-14">
            Allow Kosh to see when you last opened linked apps, so it can flag subscriptions you pay for but never use.
          </Body>
        </Band>
      ) : null}
      {usage.state === 'unsupported' ? (
        <Band tone="deep">
          <Label tone="onDark">Manual check-ins</Label>
          <Body tone="onDark" className="mt-1">
            App usage can only be read in the Android build. Kosh will ask “Still using this?” every few weeks instead.
          </Body>
        </Band>
      ) : null}

      <View className="px-6 pb-2 pt-6">
        <Label tone="mute">All subscriptions</Label>
      </View>
      {list.length === 0 && !subs.isLoading ? (
        <EmptyState title="Nothing tracked yet" hint="Add Netflix, Spotify, a dating app… anything that renews." />
      ) : null}
      {list.map((s) => {
        const next = s.next_charge_date ? nextChargeDate(s.next_charge_date, s.billing_cycle, now) : null;
        return (
          <ListRow
            key={s.id}
            icon={serviceIcon(s)}
            title={s.name}
            caption={s.status === 'active' ? CYCLE_LABEL[s.billing_cycle] : `${CYCLE_LABEL[s.billing_cycle]} · ${s.status}`}
            amount={s.amount}
            meta={s.status === 'active' && next ? `next ${formatDate(next)}` : `/${CYCLE_SHORT[s.billing_cycle]}`}
            tileClass={s.status !== 'active' ? 'bg-faint' : isUnused(s, now) ? 'bg-alert' : 'bg-forest'}
            onPress={() => router.push(`/subscriptions/${s.id}` as Href)}
          />
        );
      })}

      {candidates.data?.length ? (
        <>
          <View className="px-6 pb-2 pt-8">
            <Label tone="mute">Detected from your transactions</Label>
          </View>
          {candidates.data.map((c) => (
            <ListRow
              key={c.key}
              icon="search-outline"
              tileClass="bg-sage"
              title={c.merchant}
              caption={`${CYCLE_LABEL[c.cycle]} · ${c.occurrences} charges · last ${formatDate(c.lastCharged)}`}
              right={
                <View className="items-end gap-2">
                  <Amount value={c.amount} size="sm" />
                  <SmallButton
                    title="Add"
                    onPress={() =>
                      router.push({
                        pathname: '/subscriptions/new',
                        params: {
                          name: c.merchant,
                          amount: String(c.amount),
                          cycle: c.cycle,
                          pattern: c.key,
                          next: nextChargeDate(c.lastCharged, c.cycle),
                        },
                      } as unknown as Href)
                    }
                  />
                </View>
              }
            />
          ))}
        </>
      ) : null}

      <PlusButton onPress={() => router.push('/subscriptions/new' as Href)} label="Add subscription" />
    </Screen>
  );
}
