// Pure SQL building and row mapping. No native imports, so Jest can test it directly.
// Values always travel as bound parameters; identifiers are checked against COLUMNS.

export type Param = string | number | null;

/** Every user-visible column per table. Doubles as the identifier whitelist. */
const COLUMNS = {
  accounts: [
    'id', 'name', 'kind', 'institution', 'last4', 'balance', 'credit_limit', 'linked_account_id',
    'billing_day', 'due_day', 'sms_sender_hint', 'balance_updated_at', 'archived', 'created_at',
  ],
  categories: ['id', 'name', 'icon', 'kind', 'builtin', 'created_at'],
  subscriptions: [
    'id', 'name', 'amount', 'billing_cycle', 'next_charge_date', 'account_id', 'android_package',
    'merchant_pattern', 'status', 'last_used_at', 'last_checked_in_at', 'created_at',
  ],
  transactions: [
    'id', 'account_id', 'amount', 'direction', 'occurred_at', 'merchant', 'category_id', 'note',
    'source', 'sms_hash', 'raw_sms', 'subscription_id', 'created_at',
  ],
  holdings: [
    'id', 'kind', 'name', 'institution', 'symbol', 'units', 'invested_amount', 'current_price',
    'current_value', 'price_updated_at', 'interest_rate', 'compounding', 'start_date', 'maturity_date',
    'installment_amount', 'installment_day', 'premium_frequency', 'sum_assured', 'account_id', 'notes',
    'closed', 'created_at',
  ],
  dues: [
    'id', 'title', 'amount', 'due_date', 'kind', 'account_id', 'holding_id', 'subscription_id', 'status',
    'paid_at', 'recurrence', 'notification_id', 'created_at',
  ],
} as const;

export type TableName = keyof typeof COLUMNS;

/** SQLite has no boolean type; these INTEGER 0/1 columns become booleans on the way out. */
const BOOLEAN_COLUMNS: Partial<Record<TableName, string[]>> = {
  accounts: ['archived'],
  categories: ['builtin'],
  holdings: ['closed'],
};

type Scalar = string | number | boolean | null;

/**
 * One column condition. A bare value means equality (null means IS NULL).
 * An object ANDs its operators, e.g. { gte: from, lte: to }. { neq: null } means IS NOT NULL.
 * `contains` is a case-insensitive substring match (SQLite LIKE is case-insensitive for ASCII).
 */
type Cond =
  | Scalar
  | { neq?: Scalar; gt?: Scalar; gte?: Scalar; lt?: Scalar; lte?: Scalar; in?: Scalar[]; contains?: string };

export type Where = { [column: string]: Cond | Where[] | undefined; $or?: Where[] };

export type ListOptions = {
  where?: Where;
  /** e.g. 'name' or 'occurred_at desc'. */
  order?: string | string[];
  limit?: number;
  offset?: number;
};

function toParam(v: Scalar | undefined): Param {
  if (v === undefined) return null;
  return typeof v === 'boolean' ? (v ? 1 : 0) : v;
}

function col(table: TableName, name: string): string {
  if (!(COLUMNS[table] as readonly string[]).includes(name)) {
    throw new Error(`Unknown column ${table}.${name}`);
  }
  return name;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Builds a WHERE clause body ('' when empty). Conditions are ANDed; $or groups are ORed. */
export function buildWhere(table: TableName, where: Where = {}): { sql: string; params: Param[] } {
  const parts: string[] = [];
  const params: Param[] = [];
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === '$or') {
      const groups = (cond as Where[]).map((w) => buildWhere(table, w)).filter((g) => g.sql);
      if (!groups.length) continue;
      parts.push(`(${groups.map((g) => `(${g.sql})`).join(' OR ')})`);
      groups.forEach((g) => params.push(...g.params));
      continue;
    }
    const c = col(table, key);
    if (cond === null) parts.push(`${c} IS NULL`);
    else if (typeof cond !== 'object') {
      parts.push(`${c} = ?`);
      params.push(toParam(cond));
    } else {
      for (const [op, v] of Object.entries(cond)) {
        if (v === undefined) continue;
        if (op === 'in') {
          const list = v as Scalar[];
          parts.push(list.length ? `${c} IN (${list.map(() => '?').join(', ')})` : '0');
          params.push(...list.map(toParam));
        } else if (op === 'contains') {
          parts.push(`${c} LIKE ? ESCAPE '\\'`);
          params.push(`%${escapeLike(v as string)}%`);
        } else if (op === 'neq' && v === null) {
          parts.push(`${c} IS NOT NULL`);
        } else {
          const sym = ({ neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' } as Record<string, string>)[op];
          if (!sym) throw new Error(`Unknown operator ${op}`);
          parts.push(`${c} ${sym} ?`);
          params.push(toParam(v as Scalar));
        }
      }
    }
  }
  return { sql: parts.join(' AND '), params };
}

const whereClause = (w: { sql: string }) => (w.sql ? ` WHERE ${w.sql}` : '');

export function buildSelect(table: TableName, opts: ListOptions = {}): { sql: string; params: Param[] } {
  const w = buildWhere(table, opts.where);
  let sql = `SELECT * FROM ${table}${whereClause(w)}`;
  const order = typeof opts.order === 'string' ? [opts.order] : (opts.order ?? []);
  if (order.length) {
    sql += ` ORDER BY ${order
      .map((o) => {
        const [name, dir = 'asc'] = o.trim().split(/\s+/);
        if (dir !== 'asc' && dir !== 'desc') throw new Error(`Bad order direction ${dir}`);
        return `${col(table, name)} ${dir.toUpperCase()}`;
      })
      .join(', ')}`;
  }
  const params = [...w.params];
  if (opts.limit !== undefined || opts.offset !== undefined) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(opts.limit ?? -1, opts.offset ?? 0);
  }
  return { sql, params };
}

/** Keeps known columns with defined values; unknown keys are an error, not silently dropped. */
function entries(table: TableName, row: Record<string, unknown>): [string, Param][] {
  return Object.entries(row)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [col(table, k), toParam(v as Scalar)]);
}

export function buildInsert(
  table: TableName,
  row: Record<string, unknown>,
  opts: { ignoreConflictOn?: string } = {},
): { sql: string; params: Param[] } {
  const e = entries(table, row);
  const conflict = opts.ignoreConflictOn ? ` ON CONFLICT(${col(table, opts.ignoreConflictOn)}) DO NOTHING` : '';
  return {
    sql: `INSERT INTO ${table} (${e.map(([k]) => k).join(', ')}) VALUES (${e.map(() => '?').join(', ')})${conflict} RETURNING *`,
    params: e.map(([, v]) => v),
  };
}

export function buildUpdate(
  table: TableName,
  where: Where,
  patch: Record<string, unknown>,
): { sql: string; params: Param[] } {
  const e = entries(table, patch).filter(([k]) => k !== 'id' && k !== 'created_at');
  if (!e.length) throw new Error('Empty update');
  const w = buildWhere(table, where);
  if (!w.sql) throw new Error('Refusing to update without a WHERE clause');
  return {
    sql: `UPDATE ${table} SET ${e.map(([k]) => `${k} = ?`).join(', ')}${whereClause(w)} RETURNING *`,
    params: [...e.map(([, v]) => v), ...w.params],
  };
}

export function buildDelete(table: TableName, where: Where): { sql: string; params: Param[] } {
  const w = buildWhere(table, where);
  if (!w.sql) throw new Error('Refusing to delete without a WHERE clause');
  return { sql: `DELETE FROM ${table}${whereClause(w)}`, params: w.params };
}

/** SQLite row -> app row: 0/1 columns become booleans. Numbers and text pass through. */
export function decodeRow<T>(table: TableName, raw: Record<string, unknown>): T {
  const bools = BOOLEAN_COLUMNS[table];
  if (!bools) return raw as T;
  const row = { ...raw };
  for (const b of bools) if (b in row && row[b] !== null) row[b] = Boolean(row[b]);
  return row as T;
}
