// The one on-device database. All app data lives in kosh.db; nothing leaves the phone.
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrations';
import { createRepo, type Db } from './repo';
import type { Param } from './sql';

const DB_NAME = 'kosh.db';

// Pragmas are per connection, so every connection we open gets them.
const PRAGMAS = 'PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;';

/**
 * Like expo-sqlite's withExclusiveTransactionAsync (a separate connection, so unrelated
 * queries can't slip into the transaction), but with foreign keys enabled on that
 * connection and BEGIN IMMEDIATE so the write lock is taken up front.
 */
async function exclusive(task: (txn: Db) => Promise<void>): Promise<void> {
  const conn = await openDatabaseAsync(DB_NAME, { useNewConnection: true });
  try {
    await conn.execAsync(PRAGMAS);
    await conn.execAsync('BEGIN IMMEDIATE');
    try {
      await task(wrap(conn));
      await conn.execAsync('COMMIT');
    } catch (e) {
      await conn.execAsync('ROLLBACK').catch(() => undefined);
      throw e;
    }
  } finally {
    await conn.closeAsync();
  }
}

function wrap(conn: SQLiteDatabase): Db {
  return {
    execAsync: (sql) => conn.execAsync(sql),
    getAllAsync: <T>(sql: string, params: Param[]) => conn.getAllAsync<T>(sql, params),
    getFirstAsync: <T>(sql: string, params: Param[]) => conn.getFirstAsync<T>(sql, params),
    runAsync: (sql, params) => conn.runAsync(sql, params),
    withExclusiveTransactionAsync: exclusive,
  };
}

let opening: Promise<Db> | null = null;

/** Opens kosh.db once (WAL, foreign keys on) and brings the schema up to date. */
export function getDb(): Promise<Db> {
  opening ??= (async () => {
    const conn = await openDatabaseAsync(DB_NAME);
    await conn.execAsync(`PRAGMA journal_mode = WAL; ${PRAGMAS}`);
    const db = wrap(conn);
    await migrate(db);
    return db;
  })().catch((e) => {
    opening = null; // let the next call retry
    throw e;
  });
  return opening;
}

export const { table, transaction } = createRepo(getDb);
