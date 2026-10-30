import { router, type Href } from 'expo-router';

import { Amount, ListRow, type IconName } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/format';
import type { Category, Transaction } from '@/types/db';

// Tiles step from forest to sage down the list, like the inspiration.
const TILES = ['bg-forest', 'bg-deep', 'bg-sage'];

export function TxnRow({ txn, category, index }: { txn: Transaction; category?: Category; index: number }) {
  return (
    <ListRow
      icon={(category?.icon ?? 'ellipse-outline') as IconName}
      tileClass={TILES[index % TILES.length]}
      title={txn.merchant || 'Unknown'}
      caption={category?.name ?? 'Uncategorised'}
      right={<Amount value={Number(txn.amount)} size="sm" signed={txn.direction === 'credit'} />}
      meta={`${formatDate(txn.occurred_at)}, ${formatTime(txn.occurred_at)}`}
      onPress={() => router.push(`/transactions/${txn.id}` as Href)}
    />
  );
}
