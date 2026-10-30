import Storage from 'expo-sqlite/kv-store';

import { device, deviceCapabilities, type RawSms } from '@/lib/device';
import { table, transaction } from '@/lib/db/client';
import type { TransactionInsert } from '@/types/db';
import { categorize } from './categorize';
import { smsHash } from './hash';
import { balanceTarget, matchAccount, type MatchableAccount } from './match';
import { parseSms } from './parser';

export type SmsSyncResult = { read: number; parsed: number; inserted: number; unmatched: number };
export type StoredSyncResult = SmsSyncResult & { finishedAt: number };

const LAST_SYNC_KEY = 'sms.lastSyncMs';
const LAST_RESULT_KEY = 'sms.lastResult';
const DAY = 24 * 60 * 60 * 1000;
const FIRST_LOOKBACK_MS = 90 * DAY;
const BATCH = 200;
const MAX_BATCHES = 100; // 20k SMS per run is plenty; the next run continues from the cursor.

export async function getLastSyncMs(): Promise<number | null> {
  const v = await Storage.getItemAsync(LAST_SYNC_KEY);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function getLastSyncResult(): Promise<StoredSyncResult | null> {
  const v = await Storage.getItemAsync(LAST_RESULT_KEY);
  if (!v) return null;
  try {
    return JSON.parse(v) as StoredSyncResult;
  } catch {
    return null;
  }
}

let running: Promise<SmsSyncResult> | null = null;

/** Reads new inbox SMS, parses them on-device and upserts transactions. Concurrent calls share one run. */
export function syncSms(): Promise<SmsSyncResult> {
  if (!running) {
    running = runSync().finally(() => {
      running = null;
    });
  }
  return running;
}

async function runSync(): Promise<SmsSyncResult> {
  if (!deviceCapabilities.available) throw new Error('SMS reading needs the Android app build.');
  if (!(await device.hasSmsPermission())) throw new Error('SMS permission not granted.');
  const [accounts, categories]: [MatchableAccount[], { id: string; name: string; builtin: boolean }[]] =
    await Promise.all([table('accounts').list(), table('categories').list()]);

  // Built-in categories win over a user's same-named copy.
  const categoryId = new Map<string, string>();
  for (const c of [...categories].sort((a, b) => Number(a.builtin) - Number(b.builtin))) {
    categoryId.set(c.name, c.id);
  }

  const summary: SmsSyncResult = { read: 0, parsed: 0, inserted: 0, unmatched: 0 };
  const latestBalance = new Map<string, { balance: number; at: number }>();
  let cursor = (await getLastSyncMs()) ?? Date.now() - FIRST_LOOKBACK_MS;

  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch: RawSms[] = await device.readSmsSince(cursor, BATCH);
    if (!batch.length) break;
    summary.read += batch.length;

    const rows = new Map<string, TransactionInsert>();
    for (const sms of batch) {
      const p = parseSms(sms.body, sms.date);
      if (!p) continue;
      summary.parsed++;
      const account = matchAccount(accounts, p, sms.address);
      if (!account) summary.unmatched++;

      if (account && p.availableBalance !== undefined) {
        const target = balanceTarget(account, accounts);
        const prev = target ? latestBalance.get(target.id) : undefined;
        if (target && (!prev || prev.at < sms.date)) {
          latestBalance.set(target.id, { balance: p.availableBalance, at: sms.date });
        }
      }

      const category = categorize({ ...p, body: sms.body });
      const hash = smsHash(sms);
      rows.set(hash, {
        account_id: account?.id ?? null,
        amount: p.amount,
        direction: p.direction,
        occurred_at: new Date(p.occurredAt).toISOString(),
        merchant: p.merchant ?? null,
        category_id: category ? (categoryId.get(category) ?? null) : null,
        source: 'sms',
        sms_hash: hash,
        raw_sms: sms.body,
      });
    }

    if (rows.size) {
      // One transaction per page; SMS already imported (same hash) are skipped.
      const inserted = await transaction((t) =>
        t('transactions').insertMany([...rows.values()], { ignoreConflictOn: 'sms_hash' }),
      );
      summary.inserted += inserted.length;
    }

    // Advance only after the batch is safely stored.
    cursor = batch[batch.length - 1].date;
    await Storage.setItemAsync(LAST_SYNC_KEY, String(cursor));
    if (batch.length < BATCH) break;
  }

  await applyBalances(accounts, latestBalance);
  await Storage.setItemAsync(LAST_SYNC_KEY, String(cursor));
  await Storage.setItemAsync(LAST_RESULT_KEY, JSON.stringify({ ...summary, finishedAt: Date.now() }));
  return summary;
}

/** Writes the newest SMS balance per bank account, unless the stored one is already newer. */
async function applyBalances(accounts: MatchableAccount[], latest: Map<string, { balance: number; at: number }>) {
  await transaction(async (t) => {
    for (const [id, { balance, at }] of latest) {
      const account = accounts.find((a) => a.id === id);
      const storedAt = account?.balance_updated_at ? Date.parse(account.balance_updated_at) : 0;
      if (storedAt >= at) continue;
      await t('accounts').update(id, { balance, balance_updated_at: new Date(at).toISOString() });
    }
  });
}
