import { getDb } from '../database/index.js';

const db = () => getDb();

export const transactionRepository = {
  findAll({ page = 1, pageSize = 20, status, startDate, endDate, keyword } = {}) {
    let whereClause = [];
    let queryParams = [];

    if (status) { whereClause.push('status = ?'); queryParams.push(status); }
    if (startDate) { whereClause.push('transaction_date >= ?'); queryParams.push(startDate); }
    if (endDate) { whereClause.push('transaction_date <= ?'); queryParams.push(endDate); }
    if (keyword) {
      whereClause.push('(counterparty_name LIKE ? OR summary LIKE ? OR remark LIKE ? OR serial_no LIKE ?)');
      const kw = `%${keyword}%`;
      queryParams.push(kw, kw, kw, kw);
    }

    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    const { total } = db().prepare(`SELECT COUNT(*) as total FROM transactions ${whereSql}`).get(...queryParams);

    const offset = (page - 1) * pageSize;
    const list = db().prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM matches m WHERE m.transaction_id = t.id AND m.status = 'confirmed') as match_count
      FROM transactions t
      ${whereSql}
      ORDER BY transaction_date DESC, transaction_time DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, pageSize, offset);

    return { list, total, page, pageSize };
  },

  findById(id) {
    return db().prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  },

  createMany(transactions) {
    const insert = db().prepare(`
      INSERT INTO transactions
      (bank_name, account_no, transaction_date, transaction_time, amount, balance,
       counterparty_name, counterparty_account, summary, remark, transaction_type, serial_no, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db().transaction((items) => {
      const ids = [];
      for (const t of items) {
        const result = insert.run(
          t.bank_name, t.account_no, t.transaction_date,
          t.transaction_time, t.amount, t.balance,
          t.counterparty_name, t.counterparty_account,
          t.summary, t.remark, t.transaction_type,
          t.serial_no, t.status || 'pending'
        );
        ids.push(result.lastInsertRowid);
      }
      return ids;
    });

    return insertMany(transactions);
  },

  update(id, fields) {
    const allowedFields = ['bank_name', 'account_no', 'transaction_date', 'transaction_time',
      'amount', 'balance', 'counterparty_name', 'counterparty_account', 'summary', 'remark',
      'transaction_type', 'serial_no', 'status'];

    const setClauses = [];
    const values = [];
    allowedFields.forEach(field => {
      if (fields[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(fields[field]);
      }
    });

    if (setClauses.length === 0) return 0;

    setClauses.push(`updated_at = datetime('now', 'localtime')`);
    values.push(id);

    const result = db().prepare(`UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return result.changes;
  },

  updateStatus(id, status) {
    return db().prepare(`UPDATE transactions SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(status, id);
  },

  delete(id) {
    return db().prepare('DELETE FROM transactions WHERE id = ?').run(id).changes;
  },

  findUnmatched() {
    return db().prepare(`
      SELECT * FROM transactions
      WHERE status IN ('pending', 'partial')
      AND amount != 0
      ORDER BY transaction_date ASC
    `).all();
  },

  getMatchedAmount(transactionId) {
    return db().prepare(`
      SELECT COALESCE(SUM(matched_amount), 0) as matched_amount, COUNT(*) as match_count
      FROM matches
      WHERE transaction_id = ? AND status = 'confirmed'
    `).get(transactionId);
  },

  getStats() {
    return db().prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN status = 'anomaly' THEN 1 ELSE 0 END) as anomaly,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as payment_total
      FROM transactions
    `).get();
  },

  findUnmatchedForExport() {
    return db().prepare(`
      SELECT * FROM transactions WHERE status IN ('pending', 'partial', 'anomaly')
      ORDER BY transaction_date DESC
    `).all();
  },

  findPendingByAmount() {
    return db().prepare(`
      SELECT amount, COUNT(*) as cnt
      FROM transactions
      WHERE status = 'pending'
      AND amount != 0
      GROUP BY amount
      HAVING cnt > 1
    `).all();
  },

  findByAmount(amount) {
    return db().prepare(`
      SELECT * FROM transactions
      WHERE amount = ? AND status = 'pending'
      ORDER BY transaction_date
    `).all(amount);
  },
};
