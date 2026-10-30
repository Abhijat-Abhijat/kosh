import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { EmptyState, Label } from '@/components/ui';
import { AccountForm } from '@/features/accounts/account-form';
import { useAccount, useArchiveAccount, useUpdateAccount } from '@/features/accounts/api';
import { useCategories, useTransactions } from '@/features/transactions/api';
import { TxnRow } from '@/features/transactions/txn-row';
import { colors } from '@/theme';

export default function EditAccount() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount(id);
  const update = useUpdateAccount();
  const archive = useArchiveAccount();
  const txns = useTransactions({ accountId: id });
  const cats = new Map((useCategories().data ?? []).map((c) => [c.id, c]));
  const recent = (txns.data?.pages[0] ?? []).slice(0, 10);

  if (!account.data) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        {account.error ? <EmptyState title="Account not found" /> : <ActivityIndicator color={colors.ink} />}
      </View>
    );
  }
  const a = account.data;

  const confirmArchive = () =>
    Alert.alert('Archive account?', 'It disappears from lists and totals. Transactions stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => archive.mutate(a.id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <AccountForm
      key={a.id}
      title="Edit account"
      lead={a.institution ?? 'Account,'}
      heading={a.name}
      initial={a}
      submitLabel="Save changes"
      submitting={update.isPending}
      error={update.error?.message ?? archive.error?.message}
      onSave={(row) =>
        update.mutate(
          {
            id: a.id,
            ...row,
            ...(Number(row.balance) !== Number(a.balance) ? { balance_updated_at: new Date().toISOString() } : {}),
          },
          { onSuccess: () => router.back() },
        )
      }
    >
      <View className="pt-6">
        <Label tone="mute" className="px-6 pb-2">
          Recent transactions
        </Label>
        {recent.length ? (
          recent.map((t, i) => (
            <TxnRow key={t.id} txn={t} index={i} category={t.category_id ? cats.get(t.category_id) : undefined} />
          ))
        ) : (
          <EmptyState title="No transactions yet" />
        )}
      </View>
      <Pressable onPress={confirmArchive} accessibilityRole="button" className="items-center py-8 active:opacity-70">
        <Label tone="mute">Archive account</Label>
      </Pressable>
    </AccountForm>
  );
}
