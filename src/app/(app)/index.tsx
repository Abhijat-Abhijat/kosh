import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  Amount,
  Band,
  BarButton,
  Body,
  Headline,
  Label,
  LineBars,
  RowLine,
  Screen,
  TopBar,
} from '@/components/ui';
import { useAccounts } from '@/features/accounts/api';
import { useAutoSmsSync } from '@/features/sms/hooks';
import { useHomeSummary } from '@/features/summary/api';
import type { HomeSummary } from '@/features/summary/compute';
import { formatDate, formatMoney } from '@/lib/format';
import { qk } from '@/lib/query-client';
import { colors } from '@/theme';

function Bands({ s }: { s: HomeSummary }) {
  const now = new Date();
  const month = now.toLocaleDateString('en-IN', { month: 'long' }).toUpperCase();
  const gain = s.invested - s.investedCost;
  const gainPct = s.investedCost > 0 ? (gain / s.investedCost) * 100 : 0;
  const alert = s.dueSoon.count > 0 || s.unusedSubs.count > 0;

  return (
    <View>
      <Band tone="sage" onPress={() => router.push('/transactions' as Href)}>
        <Label tone="onDark" className="pr-14">Spent in {month}</Label>
        <Amount value={s.monthSpent} size="lg" tone="onDark" className="mt-1" />
        <View className="mt-4">
          <LineBars values={s.dailySpend} color={colors.onDark} height={40} dimAfter={now.getDate()} />
        </View>
      </Band>
      <Band tone="deep" onPress={() => router.push('/investments' as Href)}>
        <Label tone="onDark" className="pr-14">Invested · FD, RD, Stocks, Gold, LIC</Label>
        <View className="mt-1 flex-row items-baseline gap-3">
          <Amount value={s.invested} size="lg" tone="onDark" />
          {s.investedCost > 0 ? (
            <Text className="font-num-medium text-[15px]" style={{ color: gain >= 0 ? colors.gain : colors.loss }}>
              {gain >= 0 ? '+' : '−'}
              {Math.abs(gainPct).toFixed(1)}%
            </Text>
          ) : null}
        </View>
      </Band>
      {alert ? (
        <Band tone="alert" onPress={() => router.push('/dues' as Href)}>
          <Label tone="alertInk" className="pr-14">
            ! {s.dueSoon.count} {s.dueSoon.count === 1 ? 'due' : 'dues'} this week · {s.unusedSubs.count} unused{' '}
            {s.unusedSubs.count === 1 ? 'sub' : 'subs'}
          </Label>
          <Amount value={s.dueSoon.total} size="lg" tone="alertInk" className="mt-1" />
          {s.unusedSubs.count > 0 ? (
            <Label tone="alertInk" className="mt-1 opacity-80">
              + {formatMoney(s.unusedSubs.monthlyWaste)}/mo on unused subscriptions
            </Label>
          ) : null}
        </Band>
      ) : (
        <Band tone="forest">
          <Label tone="onDark">Nothing due this week</Label>
          {s.cardOutstanding > 0 ? (
            <Body tone="onDark" className="mt-1 opacity-80">
              Card outstanding {formatMoney(s.cardOutstanding)}
            </Body>
          ) : null}
        </Band>
      )}
    </View>
  );
}

export default function Home() {
  useAutoSmsSync();
  const qc = useQueryClient();
  const summary = useHomeSummary();
  const accounts = useAccounts();
  const s = summary.data;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.summary });
    qc.invalidateQueries({ queryKey: qk.accounts });
  };

  if (!accounts.isLoading && accounts.data?.length === 0) {
    return (
      <Screen
        footer={<BarButton title="Add your first account" tone="ink" onPress={() => router.push('/accounts/new' as Href)} />}
      >
        <TopBar />
        <View className="px-6 pt-10">
          <Headline lead="Welcome to Kosh," title="Let's Count Your Money" />
          <Body tone="mute" className="mt-6">
            Add a bank account, card or the cash in your wallet. Kosh reads bank SMS to keep balances and spends up to date.
          </Body>
        </View>
      </Screen>
    );
  }

  const cashCount = s?.perAccount.filter((a) => a.kind === 'cash').length ?? 0;
  const otherCount = (s?.perAccount.length ?? 0) - cashCount;
  const since = s?.lastBalanceUpdate ? new Date(s.lastBalanceUpdate) : new Date();

  return (
    <Screen
      refreshing={summary.isRefetching}
      onRefresh={refresh}
      footer={s ? <Bands s={s} /> : null}
    >
      <TopBar />
      <View className="px-6 pb-6 pt-4">
        <Headline lead={`Since ${formatDate(since)},`} title="Here's Where You Stand" />
        {!s ? (
          <View className="py-12">
            {summary.error ? (
              <Body tone="mute">Couldn&apos;t load: {summary.error.message}</Body>
            ) : (
              <ActivityIndicator color={colors.ink} />
            )}
          </View>
        ) : (
          <>
            <Label tone="mute" className="mt-8">
              Liquid · {otherCount} {otherCount === 1 ? 'account' : 'accounts'}
              {cashCount ? ' + cash' : ''}
            </Label>
            <Amount value={s.liquid} size="xl" className="mt-1" />
            <View className="mt-4">
              {s.perAccount.map((a) => (
                <RowLine key={a.id} label={a.name}>
                  <Amount value={Number(a.balance)} size="xs" />
                </RowLine>
              ))}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
