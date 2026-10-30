import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import {
  Amount,
  EmptyState,
  Headline,
  Label,
  ListRow,
  NavHeader,
  PlusButton,
  ProgressLines,
  Screen,
  type IconName,
} from '@/components/ui';
import { useAccounts } from '@/features/accounts/api';
import { formatMoney } from '@/lib/format';
import { colors } from '@/theme';
import type { Account } from '@/types/db';

const icons: Record<Account['kind'], IconName> = {
  bank: 'business-outline',
  credit_card: 'card-outline',
  debit_card: 'card-outline',
  cash: 'cash-outline',
  wallet: 'wallet-outline',
};

const groups: { title: string; kinds: Account['kind'][] }[] = [
  { title: 'Bank accounts', kinds: ['bank'] },
  { title: 'Cards', kinds: ['credit_card', 'debit_card'] },
  { title: 'Cash & wallets', kinds: ['cash', 'wallet'] },
];

function AccountRow({ a, index }: { a: Account; index: number }) {
  const caption = [a.institution, a.last4 ? `•• ${a.last4}` : null].filter(Boolean).join('  ');
  const limit = Number(a.credit_limit ?? 0);
  return (
    <View>
      <ListRow
        icon={icons[a.kind]}
        tileClass={['bg-forest', 'bg-deep', 'bg-sage'][index % 3]}
        title={a.name}
        caption={caption || undefined}
        right={a.kind === 'debit_card' ? undefined : <Amount value={Number(a.balance)} size="sm" />}
        meta={a.kind === 'credit_card' ? 'Outstanding' : a.kind === 'debit_card' ? 'Debit card' : undefined}
        onPress={() => router.push(`/accounts/${a.id}` as Href)}
      />
      {a.kind === 'credit_card' && limit > 0 ? (
        <View className="px-6 pb-4 pt-2">
          <ProgressLines
            progress={Number(a.balance) / limit}
            height={28}
            fill={Number(a.balance) > limit * 0.8 ? colors.alert : colors.sage}
          />
          <View className="mt-2 flex-row justify-between">
            <Label tone="mute">{Math.round((Number(a.balance) / limit) * 100)}% used</Label>
            <Label tone="mute">Limit {formatMoney(limit)}</Label>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function Accounts() {
  const accounts = useAccounts();
  const list = accounts.data ?? [];
  return (
    <Screen
      refreshing={accounts.isRefetching}
      onRefresh={() => accounts.refetch()}
      footer={<PlusButton label="Add account" onPress={() => router.push('/accounts/new' as Href)} />}
    >
      <NavHeader title="Accounts" />
      <View className="px-6 pb-4 pt-4">
        <Headline lead="Your money," title="Accounts & Cards" />
      </View>
      {!accounts.isLoading && !list.length ? (
        <EmptyState title="No accounts yet" hint="Add your bank accounts, cards and cash to start tracking." />
      ) : null}
      {groups.map((g) => {
        const items = list.filter((a) => g.kinds.includes(a.kind));
        if (!items.length) return null;
        return (
          <View key={g.title} className="pt-4">
            <Label tone="mute" className="px-6 pb-2">
              {g.title}
            </Label>
            {items.map((a, i) => (
              <AccountRow key={a.id} a={a} index={i} />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}
