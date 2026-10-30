import { buildDelete, buildInsert, buildSelect, buildUpdate, buildWhere, decodeRow } from '../sql';

describe('buildWhere', () => {
  it('handles equality, null, booleans and skips undefined', () => {
    expect(buildWhere('accounts', { kind: 'bank', archived: false, last4: null, name: undefined })).toEqual({
      sql: 'kind = ? AND archived = ? AND last4 IS NULL',
      params: ['bank', 0],
    });
  });

  it('ANDs operators on one column and supports neq null, in and contains', () => {
    expect(
      buildWhere('transactions', {
        occurred_at: { gte: '2026-01-01', lte: '2026-01-31' },
        merchant: { neq: null },
        direction: { in: ['debit'] },
        note: { contains: '50%_off' },
      }),
    ).toEqual({
      sql: "occurred_at >= ? AND occurred_at <= ? AND merchant IS NOT NULL AND direction IN (?) AND note LIKE ? ESCAPE '\\'",
      params: ['2026-01-01', '2026-01-31', 'debit', '%50\\%\\_off%'],
    });
  });

  it('builds OR groups and an always-false empty IN', () => {
    expect(
      buildWhere('transactions', { $or: [{ merchant: { contains: 'a' } }, { note: { contains: 'a' } }], id: { in: [] } }),
    ).toEqual({ sql: '((merchant LIKE ? ESCAPE \'\\\') OR (note LIKE ? ESCAPE \'\\\')) AND 0', params: ['%a%', '%a%'] });
  });

  it('rejects unknown columns so identifiers can never be injected', () => {
    expect(() => buildWhere('accounts', { 'name; DROP TABLE accounts': 'x' })).toThrow('Unknown column');
    expect(() => buildSelect('accounts', { order: 'name; --' })).toThrow();
  });
});

describe('statement builders', () => {
  it('select with order, limit and offset', () => {
    expect(buildSelect('dues', { where: { status: 'pending' }, order: ['due_date', 'title desc'], limit: 5 })).toEqual({
      sql: 'SELECT * FROM dues WHERE status = ? ORDER BY due_date ASC, title DESC LIMIT ? OFFSET ?',
      params: ['pending', 5, 0],
    });
  });

  it('insert ignoring duplicates', () => {
    expect(buildInsert('transactions', { id: 't1', amount: 10, note: undefined }, { ignoreConflictOn: 'sms_hash' })).toEqual({
      sql: 'INSERT INTO transactions (id, amount) VALUES (?, ?) ON CONFLICT(sms_hash) DO NOTHING RETURNING *',
      params: ['t1', 10],
    });
  });

  it('update never touches id and refuses to run without a WHERE', () => {
    expect(buildUpdate('holdings', { id: 'h1' }, { id: 'x', closed: true })).toEqual({
      sql: 'UPDATE holdings SET closed = ? WHERE id = ? RETURNING *',
      params: [1, 'h1'],
    });
    expect(() => buildUpdate('holdings', {}, { closed: true })).toThrow('WHERE');
    expect(() => buildDelete('holdings', {})).toThrow('WHERE');
  });

  it('decodes 0/1 columns to booleans', () => {
    expect(decodeRow('accounts', { id: 'a', archived: 0, balance: 5 })).toEqual({ id: 'a', archived: false, balance: 5 });
    expect(decodeRow('dues', { id: 'd', amount: 1 })).toEqual({ id: 'd', amount: 1 });
  });
});
