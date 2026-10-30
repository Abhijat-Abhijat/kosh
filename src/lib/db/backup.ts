// Backup to a JSON file the user keeps wherever they like, restore from one, or wipe everything.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Storage from 'expo-sqlite/kv-store';

import { queryClient } from '@/lib/query-client';
import { syncAllReminders } from '@/features/dues/notifications';

import { getDb } from './client';
import { eraseUserRows, readSnapshot, restoreSnapshot } from './snapshot';

/** kv-store keys that describe imported data (SMS sync cursor and last result). */
const DATA_KV_KEYS = ['sms.lastSyncMs', 'sms.lastResult'];

async function afterDataChange() {
  await queryClient.invalidateQueries();
  // Reschedules reminders for the new dues and cancels ones whose dues are gone.
  await syncAllReminders().catch((e) => console.warn('[reminders] sync failed', e));
}

/** Writes kosh-backup-YYYY-MM-DD.json to the cache folder and opens the share sheet. */
export async function exportBackup(): Promise<{ uri: string }> {
  const snapshot = await readSnapshot(await getDb());
  const file = new File(Paths.cache, `kosh-backup-${snapshot.exportedAt.slice(0, 10)}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(snapshot));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Kosh backup' });
  }
  return { uri: file.uri };
}

/** Picks a backup file and replaces all data with it. Returns null if the user cancels. */
export async function importBackup(): Promise<{ restored: number } | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets[0]) return null;
  let data: unknown;
  try {
    data = JSON.parse(await new File(picked.assets[0].uri).text());
  } catch {
    throw new Error('That file is not a Kosh backup (invalid JSON).');
  }
  const restored = await restoreSnapshot(await getDb(), data);
  // The SMS cursor belonged to the old data; the next sync re-reads and dedupes by hash.
  await Storage.multiRemove(DATA_KV_KEYS);
  await afterDataChange();
  return { restored };
}

/** Deletes every account, transaction, holding, subscription and due. Built-in categories stay. */
export async function eraseAllData(): Promise<void> {
  await eraseUserRows(await getDb());
  await Storage.multiRemove(DATA_KV_KEYS);
  await afterDataChange();
}
