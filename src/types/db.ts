// Row types for the on-device SQLite schema in src/lib/db/migrations.ts. Keep the two in sync.

export type AccountKind = 'bank' | 'credit_card' | 'debit_card' | 'cash' | 'wallet';
export type TxnDirection = 'debit' | 'credit';
type TxnSource = 'sms' | 'manual' | 'import';
type CategoryKind = 'expense' | 'income' | 'transfer';
export type HoldingKind = 'fd' | 'rd' | 'stock' | 'mutual_fund' | 'gold' | 'lic' | 'ppf' | 'other';
export type PayFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type DueKind = 'card_bill' | 'premium' | 'installment' | 'subscription' | 'loan' | 'other';
type DueStatus = 'pending' | 'paid' | 'skipped';
export type Recurrence = 'none' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

/** Money and other numerics are stored as SQLite REAL. */
type Num = number;

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  institution: string | null;
  last4: string | null;
  balance: Num;
  credit_limit: Num | null;
  linked_account_id: string | null;
  billing_day: number | null;
  due_day: number | null;
  sms_sender_hint: string | null;
  balance_updated_at: string | null;
  archived: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  /** Seeded with the app; kept on erase and restore. */
  builtin: boolean;
  name: string;
  icon: string;
  kind: CategoryKind;
  created_at: string;
};

export type Transaction = {
  id: string;
  account_id: string | null;
  amount: Num;
  direction: TxnDirection;
  occurred_at: string;
  merchant: string | null;
  category_id: string | null;
  note: string | null;
  source: TxnSource;
  sms_hash: string | null;
  raw_sms: string | null;
  subscription_id: string | null;
  created_at: string;
};

export type Holding = {
  id: string;
  kind: HoldingKind;
  name: string;
  institution: string | null;
  symbol: string | null;
  units: Num | null;
  invested_amount: Num;
  current_price: Num | null;
  current_value: Num | null;
  price_updated_at: string | null;
  interest_rate: Num | null;
  compounding: PayFrequency | null;
  start_date: string | null;
  maturity_date: string | null;
  installment_amount: Num | null;
  installment_day: number | null;
  premium_frequency: PayFrequency | null;
  sum_assured: Num | null;
  account_id: string | null;
  notes: string | null;
  closed: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  name: string;
  amount: Num;
  billing_cycle: BillingCycle;
  next_charge_date: string | null;
  account_id: string | null;
  android_package: string | null;
  merchant_pattern: string | null;
  status: SubscriptionStatus;
  last_used_at: string | null;
  last_checked_in_at: string | null;
  created_at: string;
};

export type Due = {
  id: string;
  title: string;
  amount: Num;
  due_date: string;
  kind: DueKind;
  account_id: string | null;
  holding_id: string | null;
  subscription_id: string | null;
  status: DueStatus;
  paid_at: string | null;
  recurrence: Recurrence;
  notification_id: string | null;
  created_at: string;
};

/** Insert shape: the data layer fills id and created_at; other defaults optional. */
type Insertable<T, Required extends keyof T> = Pick<T, Required> &
  Partial<Omit<T, Required | 'id' | 'created_at'>>;

export type AccountInsert = Insertable<Account, 'name' | 'kind'>;
type CategoryInsert = Insertable<Category, 'name'>;
export type TransactionInsert = Insertable<Transaction, 'amount' | 'direction'>;
export type HoldingInsert = Insertable<Holding, 'kind' | 'name'>;
export type SubscriptionInsert = Insertable<Subscription, 'name' | 'amount'>;
export type DueInsert = Insertable<Due, 'title' | 'amount' | 'due_date'>;

export type Tables = {
  accounts: { Row: Account; Insert: AccountInsert };
  categories: { Row: Category; Insert: CategoryInsert };
  transactions: { Row: Transaction; Insert: TransactionInsert };
  holdings: { Row: Holding; Insert: HoldingInsert };
  subscriptions: { Row: Subscription; Insert: SubscriptionInsert };
  dues: { Row: Due; Insert: DueInsert };
};
