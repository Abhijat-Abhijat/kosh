import { Text, View } from 'react-native';

import {
  Amount,
  Band,
  BarButton,
  Body,
  EmptyState,
  Headline,
  Label,
  ListRow,
  NavHeader,
  RowLine,
  Screen,
  bandText,
} from '@/components/ui';
import { device } from '@/lib/device';
import { formatDate, formatTime } from '@/lib/format';
import { useRequestSmsPermission, useSmsStatus, useSmsSync, useUnmatchedSmsTransactions } from '@/features/sms/hooks';

function when(ms: number | null | undefined) {
  if (!ms) return 'Never';
  const d = new Date(ms);
  return `${formatDate(d)}, ${formatTime(d)}`;
}

export default function SmsSyncScreen() {
  const status = useSmsStatus();
  const sync = useSmsSync();
  const grant = useRequestSmsPermission();
  const unmatched = useUnmatchedSmsTransactions();

  const s = status.data;
  const available = s?.available ?? false;
  const canSync = available && !!s?.smsPermission;
  const result = sync.data ?? s?.lastResult ?? null;
  const finishedAt = s?.lastResult?.finishedAt ?? s?.lastSyncMs;

  return (
    <Screen
      refreshing={status.isRefetching || unmatched.isRefetching}
      onRefresh={() => {
        status.refetch();
        unmatched.refetch();
      }}
      footer={
        <BarButton
          title="Sync now"
          tone="ink"
          loading={sync.isPending}
          disabled={!canSync}
          onPress={() => sync.mutate()}
        />
      }
    >
      <NavHeader title="SMS Sync" />
      <View className="px-6 pb-6 pt-6">
        <Headline lead="Bank messages" title="Captured on-device" />
        <Body tone="mute" className="mt-4">
          Kosh reads bank and card SMS from your inbox to log spends, credits and balances. Messages are parsed on this
          phone; only the resulting transaction and the matching SMS text are saved to your account. OTPs and promos are
          ignored.
        </Body>
      </View>

      {!status.isPending && !available ? (
        <Band tone="alert">
          <Label tone={bandText.alert}>Unavailable</Label>
          <Text className="mt-1 font-display-medium text-[17px] text-alertInk">
            SMS capture needs the Kosh Android build (not Expo Go, iOS or web).
          </Text>
        </Band>
      ) : (
        <>
          <Band tone="sage" onPress={s?.smsPermission ? undefined : () => grant.mutate()}>
            <Label tone={bandText.sage}>SMS access</Label>
            <Text className="mt-1 font-display-medium text-[20px] text-onDark">
              {s?.smsPermission ? 'Granted' : grant.isPending ? 'Asking…' : 'Tap to allow'}
            </Text>
            <Text className="mt-1 pr-14 font-display text-[13px] text-onDark/80">
              Read-only access to the SMS inbox, used to capture transactions.
            </Text>
          </Band>
          <Band tone="deep" onPress={s?.usageAccess ? undefined : () => device.openUsageAccessSettings()}>
            <Label tone={bandText.deep}>Usage access</Label>
            <Text className="mt-1 font-display-medium text-[20px] text-onDark">
              {s?.usageAccess ? 'Granted' : 'Open settings'}
            </Text>
            <Text className="mt-1 pr-14 font-display text-[13px] text-onDark/80">
              Optional. Shows when you last opened apps you pay a subscription for.
            </Text>
          </Band>
        </>
      )}

      {sync.error ? (
        <Band tone="alert">
          <Label tone={bandText.alert}>Sync failed</Label>
          <Text className="mt-1 font-display text-[15px] text-alertInk">{sync.error.message}</Text>
        </Band>
      ) : null}

      <View className="px-6 pt-8">
        <Label tone="mute" className="mb-2">
          Last sync
        </Label>
        <RowLine label="Finished">
          <Body>{when(finishedAt)}</Body>
        </RowLine>
        <RowLine label="SMS read">
          <Body>{result?.read ?? 0}</Body>
        </RowLine>
        <RowLine label="Transactions found">
          <Body>{result?.parsed ?? 0}</Body>
        </RowLine>
        <RowLine label="New">
          <Body>{result?.inserted ?? 0}</Body>
        </RowLine>
        <RowLine label="No account match">
          <Body>{result?.unmatched ?? 0}</Body>
        </RowLine>
      </View>

      <View className="pb-6 pt-10">
        <Label tone="mute" className="mb-1 px-6">
          Not matched to an account
        </Label>
        <Text className="mb-3 px-6 font-display text-[13px] text-mute">
          Add the card or account last 4 digits, or a sender hint, to an account so these match next time.
        </Text>
        {unmatched.data?.length ? (
          unmatched.data.map((t) => (
            <View key={t.id} className="border-b border-ink/15">
              <ListRow
                icon={t.direction === 'debit' ? 'arrow-up-outline' : 'arrow-down-outline'}
                tileClass={t.direction === 'debit' ? 'bg-forest' : 'bg-sage'}
                title={t.merchant ?? (t.direction === 'debit' ? 'Unknown payee' : 'Unknown sender')}
                caption={`${formatDate(t.occurred_at)} · ${formatTime(t.occurred_at)}`}
                right={<Amount value={t.direction === 'debit' ? -t.amount : t.amount} size="sm" signed />}
              />
            </View>
          ))
        ) : (
          <EmptyState title="Nothing missed" hint="Every captured SMS transaction is linked to an account." />
        )}
      </View>
    </Screen>
  );
}
