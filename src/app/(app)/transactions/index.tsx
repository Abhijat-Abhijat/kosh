import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarButton, Chips, EmptyState, Headline, NavHeader, Screen } from '@/components/ui';
import { useAccounts } from '@/features/accounts/api';
import { useCategories, useTransactions } from '@/features/transactions/api';
import { TxnRow } from '@/features/transactions/txn-row';
import { colors } from '@/theme';

export default function Transactions() {
  const insets = useSafeAreaInsets();
  const [accountId, setAccountId] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const accounts = useAccounts().data ?? [];
  const categories = useCategories().data;
  const cats = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const txns = useTransactions({ accountId: accountId || undefined, search: search || undefined });
  const rows = txns.data?.pages.flat() ?? [];

  return (
    <Screen scroll={false}>
      <NavHeader title="Transactions" />
      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        renderItem={({ item, index }) => (
          <TxnRow txn={item} index={index} category={item.category_id ? cats.get(item.category_id) : undefined} />
        )}
        onEndReached={() => {
          if (txns.hasNextPage && !txns.isFetchingNextPage) txns.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={txns.isRefetching} onRefresh={() => void txns.refetch()} tintColor={colors.ink} />
        }
        ListHeaderComponent={
          <View className="px-6 pb-4 pt-2">
            <Headline lead="All Recent" title="Transactions" />
            <View className="mt-6">
              <Chips
                value={accountId}
                onChange={setAccountId}
                options={[{ value: '', label: 'All' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
              />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search merchant or note"
              placeholderTextColor={colors.faint}
              className="mt-4 border-b border-ink/40 py-2 font-display text-[16px] text-ink"
            />
          </View>
        }
        ListEmptyComponent={
          txns.isLoading ? (
            <ActivityIndicator className="py-12" color={colors.ink} />
          ) : (
            <EmptyState
              title={txns.error ? "Couldn't load transactions" : 'Nothing here yet'}
              hint={txns.error?.message ?? 'Bank SMS and cash expenses you add show up here.'}
            />
          )
        }
        ListFooterComponent={txns.isFetchingNextPage ? <ActivityIndicator className="py-6" color={colors.ink} /> : undefined}
      />
      <BarButton title="Add cash expense" tone="ink" onPress={() => router.push('/transactions/new' as Href)} />
      <View className="bg-ink" style={{ height: insets.bottom }} />
    </Screen>
  );
}
