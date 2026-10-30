// Versioned schema, applied in order and tracked with PRAGMA user_version.
// Never edit a shipped migration: append a new one. Conventions:
// ids are UUID v4 TEXT (made in JS), money is REAL, booleans are INTEGER 0/1,
// timestamps are ISO-8601 TEXT in UTC, dates are 'YYYY-MM-DD' TEXT.

const now = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const oneOf = (column: string, values: string[]) =>
  `CHECK (${column} IN (${values.map((v) => `'${v}'`).join(', ')}))`;
const day = (column: string) => `CHECK (${column} BETWEEN 1 AND 31)`;
const freq = ['monthly', 'quarterly', 'half_yearly', 'yearly'];

/** Built-in categories. Ids are stable so backups and SMS categorisation can rely on them. */
export const BUILTIN_CATEGORIES: [id: string, name: string, icon: string, kind: string][] = [
  ['cat-food-dining', 'Food & Dining', 'restaurant-outline', 'expense'],
  ['cat-groceries', 'Groceries', 'basket-outline', 'expense'],
  ['cat-shopping', 'Shopping', 'bag-handle-outline', 'expense'],
  ['cat-transport', 'Transport', 'car-outline', 'expense'],
  ['cat-fuel', 'Fuel', 'speedometer-outline', 'expense'],
  ['cat-bills-utilities', 'Bills & Utilities', 'flash-outline', 'expense'],
  ['cat-rent', 'Rent', 'home-outline', 'expense'],
  ['cat-health', 'Health', 'heart-outline', 'expense'],
  ['cat-education', 'Education', 'briefcase-outline', 'expense'],
  ['cat-entertainment', 'Entertainment', 'game-controller-outline', 'expense'],
  ['cat-subscriptions', 'Subscriptions', 'repeat-outline', 'expense'],
  ['cat-travel', 'Travel', 'airplane-outline', 'expense'],
  ['cat-insurance', 'Insurance', 'shield-checkmark-outline', 'expense'],
  ['cat-investments', 'Investments', 'pie-chart-outline', 'transfer'],
  ['cat-transfer', 'Transfer', 'swap-horizontal-outline', 'transfer'],
  ['cat-cash-withdrawal', 'Cash Withdrawal', 'cash-outline', 'transfer'],
  ['cat-salary', 'Salary', 'wallet-outline', 'income'],
  ['cat-interest', 'Interest', 'trending-up-outline', 'income'],
  ['cat-refund', 'Refund', 'return-down-back-outline', 'income'],
  ['cat-other', 'Other', 'ellipse-outline', 'expense'],
];

const v1 = `
CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  kind TEXT NOT NULL ${oneOf('kind', ['bank', 'credit_card', 'debit_card', 'cash', 'wallet'])},
  institution TEXT,
  last4 TEXT CHECK (last4 GLOB '[0-9][0-9][0-9][0-9]'),
  balance REAL NOT NULL DEFAULT 0,
  credit_limit REAL,
  linked_account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  billing_day INTEGER ${day('billing_day')},
  due_day INTEGER ${day('due_day')},
  sms_sender_hint TEXT,
  balance_updated_at TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT ${now}
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  icon TEXT NOT NULL DEFAULT 'ellipse-outline',
  kind TEXT NOT NULL DEFAULT 'expense' ${oneOf('kind', ['expense', 'income', 'transfer'])},
  builtin INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT ${now}
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  amount REAL NOT NULL CHECK (amount >= 0),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' ${oneOf('billing_cycle', ['weekly', 'monthly', 'quarterly', 'yearly'])},
  next_charge_date TEXT,
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  android_package TEXT,
  merchant_pattern TEXT,
  status TEXT NOT NULL DEFAULT 'active' ${oneOf('status', ['active', 'paused', 'cancelled'])},
  last_used_at TEXT,
  last_checked_in_at TEXT,
  created_at TEXT NOT NULL DEFAULT ${now}
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  direction TEXT NOT NULL ${oneOf('direction', ['debit', 'credit'])},
  occurred_at TEXT NOT NULL DEFAULT ${now},
  merchant TEXT,
  category_id TEXT REFERENCES categories (id) ON DELETE SET NULL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual' ${oneOf('source', ['sms', 'manual', 'import'])},
  sms_hash TEXT UNIQUE,
  raw_sms TEXT,
  subscription_id TEXT REFERENCES subscriptions (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT ${now}
);
CREATE INDEX transactions_time_idx ON transactions (occurred_at DESC);
CREATE INDEX transactions_account_idx ON transactions (account_id);

CREATE TABLE holdings (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL ${oneOf('kind', ['fd', 'rd', 'stock', 'mutual_fund', 'gold', 'lic', 'ppf', 'other'])},
  name TEXT NOT NULL COLLATE NOCASE,
  institution TEXT,
  symbol TEXT,
  units REAL,
  invested_amount REAL NOT NULL DEFAULT 0,
  current_price REAL,
  current_value REAL,
  price_updated_at TEXT,
  interest_rate REAL,
  compounding TEXT ${oneOf('compounding', freq)},
  start_date TEXT,
  maturity_date TEXT,
  installment_amount REAL,
  installment_day INTEGER ${day('installment_day')},
  premium_frequency TEXT ${oneOf('premium_frequency', freq)},
  sum_assured REAL,
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  notes TEXT,
  closed INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT ${now}
);

CREATE TABLE dues (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL COLLATE NOCASE,
  amount REAL NOT NULL CHECK (amount >= 0),
  due_date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other' ${oneOf('kind', ['card_bill', 'premium', 'installment', 'subscription', 'loan', 'other'])},
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  holding_id TEXT REFERENCES holdings (id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES subscriptions (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' ${oneOf('status', ['pending', 'paid', 'skipped'])},
  paid_at TEXT,
  recurrence TEXT NOT NULL DEFAULT 'none' ${oneOf('recurrence', ['none', 'monthly', 'quarterly', 'half_yearly', 'yearly'])},
  notification_id TEXT,
  created_at TEXT NOT NULL DEFAULT ${now}
);
CREATE INDEX dues_status_date_idx ON dues (status, due_date);

INSERT INTO categories (id, name, icon, kind, builtin) VALUES
${BUILTIN_CATEGORIES.map(([id, name, icon, kind]) => `  ('${id}', '${name}', '${icon}', '${kind}', 1)`).join(',\n')};
`;

/** MIGRATIONS[i] upgrades the database from user_version i to i + 1. */
const MIGRATIONS: string[] = [v1];
export const SCHEMA_VERSION = MIGRATIONS.length;

/** The subset of a database connection that migrations need. */
export type MigratableDb = {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params: []): Promise<T | null>;
};

/** Applies pending migrations, each in its own transaction together with its version bump. */
export async function migrate(db: MigratableDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    try {
      await db.execAsync(`BEGIN;\n${MIGRATIONS[v]}\nPRAGMA user_version = ${v + 1};\nCOMMIT;`);
    } catch (e) {
      await db.execAsync('ROLLBACK;').catch(() => undefined);
      throw e;
    }
  }
}
