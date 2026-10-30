// A tiny typed table helper over any connection that looks like expo-sqlite's SQLiteDatabase.
// The app passes the real database (client.ts); tests pass node:sqlite through a thin adapter.
import { randomUUID } from 'expo-crypto';

import type { Tables } from '@/types/db';
import {
  buildDelete,
  buildInsert,
  buildSelect,
  buildUpdate,
  decodeRow,
  type ListOptions,
  type Param,
  type TableName,
  type Where,
} from './sql';

export type Db = {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, params: Param[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: Param[]): Promise<T | null>;
  runAsync(sql: string, params: Param[]): Promise<{ changes: number }>;
  /** Runs `task` with a connection nobody else can write through until it commits. */
  withExclusiveTransactionAsync(task: (txn: Db) => Promise<void>): Promise<void>;
};

type Row<K extends TableName> = Tables[K]['Row'];
type Insert<K extends TableName> = Tables[K]['Insert'] & { id?: string; created_at?: string };

/** `table(name)` bound to one connection. */
export function tableOn<K extends TableName>(db: Db, name: K) {
  const all = async (q: { sql: string; params: Param[] }) =>
    (await db.getAllAsync<Record<string, unknown>>(q.sql, q.params)).map((r) => decodeRow<Row<K>>(name, r));
  const byId = (idOrWhere: string | Where): Where => (typeof idOrWhere === 'string' ? { id: idOrWhere } : idOrWhere);

  return {
    list: (opts?: ListOptions) => all(buildSelect(name, opts)),

    /** The row with this id, or null. */
    get: async (id: string) => (await all(buildSelect(name, { where: { id } })))[0] ?? null,

    /** Inserts one row (id generated unless given) and returns it with defaults filled in. */
    insert: async (row: Insert<K>) => (await all(buildInsert(name, { id: randomUUID(), ...row })))[0],

    /** Inserts rows one by one; with ignoreConflictOn, duplicates are skipped. Returns the inserted rows. */
    insertMany: async (rows: Insert<K>[], opts: { ignoreConflictOn?: keyof Row<K> & string } = {}) => {
      const out: Row<K>[] = [];
      for (const row of rows) out.push(...(await all(buildInsert(name, { id: randomUUID(), ...row }, opts))));
      return out;
    },

    /** Patches the row with this id (or every row matching `where`) and returns the updated rows. */
    update: (idOrWhere: string | Where, patch: Partial<Row<K>>) =>
      all(buildUpdate(name, byId(idOrWhere), patch as Record<string, unknown>)),

    /** Deletes the row with this id (or every row matching `where`). Returns the number deleted. */
    remove: async (idOrWhere: string | Where) => {
      const q = buildDelete(name, byId(idOrWhere));
      return (await db.runAsync(q.sql, q.params)).changes;
    },
  };
}

type Table<K extends TableName> = ReturnType<typeof tableOn<K>>;
export type TableFn = <K extends TableName>(name: K) => Table<K>;

/**
 * Builds `table()` and `transaction()` over a lazily opened connection.
 * Inside `transaction(async (t) => ...)` use `t(name)` so every statement runs in that transaction.
 */
export function createRepo(getDb: () => Promise<Db>) {
  // Opens the database on first use, so importing a feature never blocks on disk.
  const lazy: Db = {
    execAsync: async (sql) => (await getDb()).execAsync(sql),
    getAllAsync: async <T>(sql: string, params: Param[]) => (await getDb()).getAllAsync<T>(sql, params),
    getFirstAsync: async <T>(sql: string, params: Param[]) => (await getDb()).getFirstAsync<T>(sql, params),
    runAsync: async (sql, params) => (await getDb()).runAsync(sql, params),
    withExclusiveTransactionAsync: async (task) => (await getDb()).withExclusiveTransactionAsync(task),
  };
  const table: TableFn = (name) => tableOn(lazy, name);

  async function transaction<T>(task: (t: TableFn, db: Db) => Promise<T>): Promise<T> {
    const db = await getDb();
    let result!: T;
    await db.withExclusiveTransactionAsync(async (txn) => {
      result = await task((name) => tableOn(txn, name), txn);
    });
    return result;
  }

  return { table, transaction };
}
