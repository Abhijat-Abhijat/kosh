import { router } from 'expo-router';

import { AccountForm } from '@/features/accounts/account-form';
import { useCreateAccount } from '@/features/accounts/api';

export default function NewAccount() {
  const create = useCreateAccount();
  return (
    <AccountForm
      title="Add account"
      lead="Where your money sits,"
      heading="New Account"
      submitLabel="Save account"
      submitting={create.isPending}
      error={create.error?.message}
      onSave={(row) => create.mutate(row, { onSuccess: () => router.back() })}
    />
  );
}
