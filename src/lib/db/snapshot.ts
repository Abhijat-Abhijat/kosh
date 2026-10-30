// Whole-database snapshots for backup, restore and erase. Works on any Db connection,
// so the same code runs on the phone and against node:sqlite in tests.
import { z } from 'zod';

import { SCHEMA_VERSION } from './migrations';
import { tableOn, type Db } from './repo';
import { buildInsert, type TableName } from './sql';

/** Insert order respects foreign keys (restore also defers FK checks to commit). */
const USER_TABLES = ['accounts', 'categories', 'subscriptions', 'holdings', 'transactions', 'dues'] as const;

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const rows = z.array(
  z.record(z.string(), scalar).refine((r) => typeof r.id === 'string' && r.id.length > 0, 'every row needs an id'),
);

export const backupSchema = z.object({
  app: z.literal('kosh'),
  schemaVersion: z.number().int().min(1).max(SCHEMA_VERSION, 'Backup is from a newer version of Kosh'),
  exportedAt: z.string(),
  tables: z.object({
    accounts: rows,
    categories: rows,
    subscriptions: rows,
    holdings: rows,
    transactions: rows,
    dues: rows,
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export async function readSnapshot(db: Db): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const name of USER_TABLES) {
    const all = (await tableOn(db, name).list()) as Record<string, z.infer<typeof scalar>>[];
    // Built-in categories ship with the app; only user-made ones go in the backup.
    tables[name] = name === 'categories' ? all.filter((c) => !c.builtin) : all;
  }
  return { app: 'kosh', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
}

/** Deletes every user row; built-in categories stay. Call inside a transaction. */
async function deleteUserRows(txn: Db): Promise<void> {
  for (const name of [...USER_TABLES].reverse()) {
    await txn.runAsync(name === 'categories' ? 'DELETE FROM categories WHERE builtin = 0' : `DELETE FROM ${name}`, []);
  }
}

/** Replaces all user data with the backup, atomically. Returns the number of rows restored. */
export async function restoreSnapshot(db: Db, input: unknown): Promise<number> {
  const backup = backupSchema.parse(input);
  let restored = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Rows may reference rows inserted later (e.g. linked accounts); check FKs at commit.
    await txn.execAsync('PRAGMA defer_foreign_keys = ON');
    await deleteUserRows(txn);
    for (const name of USER_TABLES) {
      for (const row of backup.tables[name]) {
        if (name === 'categories' && row.builtin) continue;
        const q = buildInsert(name as TableName, row);
        await txn.getAllAsync(q.sql, q.params);
        restored++;
      }
    }
  });
  return restored;
}

export async function eraseUserRows(db: Db): Promise<void> {
  await db.withExclusiveTransactionAsync(deleteUserRows);
}
