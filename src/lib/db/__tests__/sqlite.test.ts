/**
 * Runs the real migrations and repo against Node's built-in SQLite (node:sqlite, Node 22+).
 * @jest-environment node
 */
import { BUILTIN_CATEGORIES, migrate, SCHEMA_VERSION } from '../migrations';
import { tableOn, type Db } from '../repo';
import { backupSchema, eraseUserRows, readSnapshot, restoreSnapshot } from '../snapshot';
import type { Param } from '../sql';

// No @types/node in this app, so the two Node built-ins used here are typed by hand.
type Stmt = { all(...p: Param[]): unknown[]; get(...p: Param[]): unknown; run(...p: Param[]): { changes: number | bigint } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => { exec(sql: string): void; prepare(sql: string): Stmt };
};

jest.mock('expo-crypto', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  randomUUID: () => require('node:crypto').randomUUID(),
}));

/** expo-sqlite-shaped adapter over a synchronous node:sqlite connection. */
function nodeDb(): Db {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const db: Db = {
    execAsync: async (sql) => void raw.exec(sql),
    getAllAsync: async <T,>(sql: string, params: Param[]) => raw.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: Param[]) => (raw.prepare(sql).get(...params) ?? null) as T | null,
    runAsync: async (sql, params) => ({ changes: Number(raw.prepare(sql).run(...params).changes) }),
    withExclusiveTransactionAsync: async (task) => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        await task(db);
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db;
}

async function freshDb() {
  const db = nodeDb();
  await migrate(db);
  return db;
}

it('migrates to the current version, seeds categories, and is idempotent', async () => {
  const db = await freshDb();
  await migrate(db);
  expect(await db.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: SCHEMA_VERSION });
  const cats = await tableOn(db, 'categories').list({ order: 'name' });
  expect(cats).toHaveLength(BUILTIN_CATEGORIES.length);
  expect(cats.every((c) => c.builtin === true)).toBe(true);
});

it('inserts with defaults, filters, updates and enforces constraints', async () => {
  const db = await freshDb();
  const accounts = tableOn(db, 'accounts');
  const bank = await accounts.insert({ name: 'HDFC', kind: 'bank', last4: '1234' });
  expect(bank).toMatchObject({ name: 'HDFC', balance: 0, archived: false });
  expect(bank.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(bank.created_at).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);

  await expect(accounts.insert({ name: 'Bad', kind: 'bank', last4: '12a4' })).rejects.toThrow(/CHECK/);
  await expect(accounts.insert({ name: 'Bad', kind: 'nope' as 'bank' })).rejects.toThrow(/CHECK/);

  const [updated] = await accounts.update(bank.id, { balance: 99.5, archived: true });
  expect(updated).toMatchObject({ balance: 99.5, archived: true });
  expect(await accounts.list({ where: { archived: false } })).toEqual([]);

  const txns = tableOn(db, 'transactions');
  await txns.insert({ amount: 10, direction: 'debit', merchant: 'Swiggy Order', account_id: bank.id });
  await txns.insert({ amount: 20, direction: 'debit', note: 'swiggy tip' });
  await txns.insert({ amount: 30, direction: 'credit', merchant: 'Salary' });
  const hits = await txns.list({ where: { $or: [{ merchant: { contains: 'SWIGGY' } }, { note: { contains: 'swiggy' } }] } });
  expect(hits.map((t) => t.amount).sort()).toEqual([10, 20]);

  // ON DELETE SET NULL keeps the transaction but unlinks the account.
  await accounts.remove(bank.id);
  expect((await txns.list({ where: { amount: 10 } }))[0].account_id).toBeNull();
});

it('skips duplicate SMS hashes and rolls back failed transactions', async () => {
  const db = await freshDb();
  const txns = tableOn(db, 'transactions');
  const row = { amount: 5, direction: 'debit' as const, source: 'sms' as const, sms_hash: 'h1' };
  expect(await txns.insertMany([row, row, { ...row, sms_hash: 'h2' }], { ignoreConflictOn: 'sms_hash' })).toHaveLength(2);
  expect(await txns.insertMany([row], { ignoreConflictOn: 'sms_hash' })).toHaveLength(0);

  await expect(
    db.withExclusiveTransactionAsync(async (t) => {
      await tableOn(t, 'transactions').insert({ amount: 1, direction: 'debit' });
      await tableOn(t, 'transactions').insert({ amount: -1, direction: 'debit' });
    }),
  ).rejects.toThrow();
  expect(await txns.list()).toHaveLength(2);
});

it('cascades dues when their subscription is deleted', async () => {
  const db = await freshDb();
  const sub = await tableOn(db, 'subscriptions').insert({ name: 'Netflix', amount: 649 });
  await tableOn(db, 'dues').insert({ title: 'Netflix', amount: 649, due_date: '2026-11-01', subscription_id: sub.id });
  await tableOn(db, 'subscriptions').remove(sub.id);
  expect(await tableOn(db, 'dues').list()).toEqual([]);
});

it('round-trips a backup, keeps built-in categories, and erases', async () => {
  const db = await freshDb();
  const bank = await tableOn(db, 'accounts').insert({ name: 'Bank', kind: 'bank' });
  // A debit card that references the bank: restore must cope with FK order.
  await tableOn(db, 'accounts').insert({ name: 'Card', kind: 'debit_card', linked_account_id: bank.id });
  await tableOn(db, 'categories').insert({ name: 'Pets' });
  await tableOn(db, 'transactions').insert({ amount: 1, direction: 'debit', category_id: 'cat-fuel' });

  const backup = JSON.parse(JSON.stringify(await readSnapshot(db)));
  expect(backupSchema.parse(backup).tables.categories).toHaveLength(1);

  const other = await freshDb();
  await tableOn(other, 'accounts').insert({ name: 'Stale', kind: 'cash' });
  expect(await restoreSnapshot(other, backup)).toBe(4);
  expect((await tableOn(other, 'accounts').list({ order: 'name' })).map((a) => a.name)).toEqual(['Bank', 'Card']);
  expect(await tableOn(other, 'categories').list()).toHaveLength(BUILTIN_CATEGORIES.length + 1);

  await eraseUserRows(other);
  expect(await tableOn(other, 'accounts').list()).toEqual([]);
  expect(await tableOn(other, 'categories').list()).toHaveLength(BUILTIN_CATEGORIES.length);
});

it('rejects foreign or newer backups', async () => {
  const db = await freshDb();
  const ok = { app: 'kosh', schemaVersion: 1, exportedAt: 'x', tables: { accounts: [], categories: [], subscriptions: [], holdings: [], transactions: [], dues: [] } };
  await expect(restoreSnapshot(db, { ...ok, app: 'other' })).rejects.toThrow();
  await expect(restoreSnapshot(db, { ...ok, schemaVersion: SCHEMA_VERSION + 1 })).rejects.toThrow(/newer/);
  await expect(restoreSnapshot(db, { ...ok, tables: { ...ok.tables, accounts: [{ name: 'no id' }] } })).rejects.toThrow();
  // A bad row fails the whole restore and leaves existing data alone.
  await tableOn(db, 'accounts').insert({ name: 'Keep', kind: 'cash' });
  await expect(
    restoreSnapshot(db, { ...ok, tables: { ...ok.tables, accounts: [{ id: 'a', name: 'X', kind: 'bogus' }] } }),
  ).rejects.toThrow();
  expect((await tableOn(db, 'accounts').list()).map((a) => a.name)).toEqual(['Keep']);
});
