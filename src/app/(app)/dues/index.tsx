import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

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
  type IconName,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useDerivedDues, useDues, useGenerateDerivedDues, useMarkPaid } from '@/features/dues/api';
import { DUE_KIND_LABEL, RECURRENCE_LABEL, dueWhen, groupDues } from '@/features/dues/logic';
import { useNotificationsEnabled } from '@/features/dues/notifications';
import type { Due, DueKind } from '@/types/db';

const KIND_ICON: Record<DueKind, IconName> = {
  card_bill: 'card-outline',
  premium: 'shield-checkmark-outline',
  installment: 'calendar-outline',
  subscription: 'repeat-outline',
  loan: 'business-outline',
  other: 'ellipse-outline',
};

export default function Dues() {
  const dues = useDues();
  const derived = useDerivedDues();
  const accept = useGenerateDerivedDues();
  const markPaid = useMarkPaid();
  const notif = useNotificationsEnabled();
  const [showProposals, setShowProposals] = useState(false);
  const now = useMemo(() => new Date(), [dues.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => groupDues(dues.data ?? [], now), [dues.data, now]);
  const pending = [...groups.overdue, ...groups.thisWeek, ...groups.later];
  const total = pending.reduce((t, d) => t + d.amount, 0);
  const overdueTotal = groups.overdue.reduce((t, d) => t + d.amount, 0);
  const proposals = derived.data ?? [];

  const open = (d: Due) => router.push(`/dues/${d.id}` as Href);
  const onTap = (d: Due) =>
    Alert.alert(d.title, `Mark ${formatDate(d.due_date)} payment as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open', onPress: () => open(d) },
      { text: 'Mark paid', onPress: () => markPaid.mutate({ due: d }) },
    ]);

  const caption = (d: Due) =>
    d.recurrence === 'none' ? DUE_KIND_LABEL[d.kind] : `${DUE_KIND_LABEL[d.kind]} · ${RECURRENCE_LABEL[d.recurrence]}`;

  const section = (title: string, list: Due[]) =>
    list.length ? (
      <>
        <View className="px-6 pb-2 pt-6">
          <Label tone="mute">
            {title} · {list.length}
          </Label>
        </View>
        {list.map((d) => (
          <ListRow
            key={d.id}
            icon={KIND_ICON[d.kind]}
            title={d.title}
            caption={caption(d)}
            amount={d.amount}
            meta={`${formatDate(d.due_date)} · ${dueWhen(d.due_date, now)}`}
            onPress={() => onTap(d)}
          />
        ))}
      </>
    ) : null;

  return (
    <Screen
      refreshing={dues.isRefetching}
      onRefresh={() => {
        dues.refetch();
        derived.refetch();
      }}
    >
      <TopBar />
      <View className="px-6 pb-6 pt-6">
        <Headline lead="Pending" title="Payments" />
        <View className="mt-6">
          <Label tone="mute">To pay · {pending.length}</Label>
          <Amount value={total} size="xl" className="mt-1" />
        </View>
      </View>

      {notif.enabled === false ? (
        <Band tone="deep" onPress={notif.enable}>
          <Label tone="onDark">Reminders are off</Label>
          <Body tone="onDark" className="mt-1 pr-14">
            Turn on notifications so Kosh can nudge you 2 days before and on each due date.
          </Body>
        </Band>
      ) : null}

      {groups.overdue.length ? (
        <Band tone="alert">
          <Label tone="alertInk">Overdue · {groups.overdue.length}</Label>
          <Amount value={overdueTotal} size="lg" tone="alertInk" className="mt-1" />
          {groups.overdue.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => onTap(d)}
              onLongPress={() => open(d)}
              className="mt-3 flex-row items-center justify-between border-t border-alertInk/30 pt-3 active:opacity-80"
            >
              <View className="flex-1 pr-2">
                <Text numberOfLines={1} className="font-display-semibold text-[17px] text-alertInk">
                  {d.title}
                </Text>
                <Label tone="alertInk" className="mt-1 opacity-90">
                  {caption(d)} · {dueWhen(d.due_date, now)}
                </Label>
              </View>
              <Amount value={d.amount} size="sm" tone="alertInk" />
            </Pressable>
          ))}
        </Band>
      ) : null}

      {proposals.length ? (
        <Band tone="sage" onPress={showProposals ? undefined : () => setShowProposals(true)}>
          <Label tone="onDark">From cards, policies and subscriptions</Label>
          <Text className="mt-1 pr-14 font-display-medium text-[20px] text-onDark">
            We found {proposals.length} upcoming payment{proposals.length === 1 ? '' : 's'}
          </Text>
          {showProposals ? (
            <>
              {proposals.map((p) => (
                <View key={p.key} className="mt-3 flex-row items-center justify-between border-t border-onDark/30 pt-3">
                  <View className="flex-1 pr-2">
                    <Text numberOfLines={1} className="font-display-medium text-[16px] text-onDark">
                      {p.title}
                    </Text>
                    <Label tone="onDark" className="mt-1">
                      {DUE_KIND_LABEL[p.kind ?? 'other']} · {formatDate(p.due_date)}
                    </Label>
                  </View>
                  <Amount value={p.amount} size="sm" tone="onDark" />
                  <View className="ml-3">
                    <SmallButton title="Add" tone="onDark" disabled={accept.isPending} onPress={() => accept.mutate([p])} />
                  </View>
                </View>
              ))}
              <View className="mt-4 flex-row gap-2">
                <SmallButton title="Add all" tone="onDark" disabled={accept.isPending} onPress={() => accept.mutate(proposals)} />
                <SmallButton title="Hide" tone="onDark" onPress={() => setShowProposals(false)} />
              </View>
            </>
          ) : null}
        </Band>
      ) : null}

      {section('This week', groups.thisWeek)}
      {section('Later', groups.later)}

      {pending.length === 0 && !dues.isLoading ? (
        <EmptyState title="Nothing pending" hint="Add a bill, premium or EMI and Kosh will remind you before it’s due." />
      ) : null}

      <PlusButton onPress={() => router.push('/dues/new' as Href)} label="Add payment" />
    </Screen>
  );
}
