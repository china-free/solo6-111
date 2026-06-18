import { getDb } from '../database/index.js';

const db = () => getDb();

export const matchRepository = {
  findAll({ page = 1, pageSize = 20, status, matchType, startDate, endDate } = {}) {
    let whereClause = [];
    let queryParams = [];

    if (status) { whereClause.push('m.status = ?'); queryParams.push(status); }
    if (matchType) { whereClause.push('m.match_type = ?'); queryParams.push(matchType); }

    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    const { total } = db().prepare(`SELECT COUNT(*) as total FROM matches m ${whereSql}`).get(...queryParams);

    const offset = (page - 1) * pageSize;
    const list = db().prepare(`
      SELECT m.*,
        i.file_name as invoice_file, i.total_amount as invoice_amount, i.invoice_date, i.seller_name,
        t.transaction_date, t.amount as transaction_amount, t.counterparty_name, t.summary
      FROM matches m
      LEFT JOIN invoices i ON m.invoice_id = i.id
      LEFT JOIN transactions t ON m.transaction_id = t.id
      ${whereSql}
      ORDER BY m.matched_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, pageSize, offset);

    return { list, total, page, pageSize };
  },

  findById(id) {
    return db().prepare('SELECT * FROM matches WHERE id = ?').get(id);
  },

  create(match) {
    const result = db().prepare(`
      INSERT INTO matches (invoice_id, transaction_id, matched_amount, match_type, match_score, status, matched_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      match.invoice_id, match.transaction_id, match.matched_amount,
      match.match_type || 'manual', match.match_score,
      match.status || 'confirmed', match.matched_by, match.notes
    );
    return result.lastInsertRowid;
  },

  update(id, fields) {
    const allowedFields = ['matched_amount', 'match_type', 'match_score', 'status', 'notes'];

    const setClauses = [];
    const values = [];
    allowedFields.forEach(field => {
      if (fields[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(fields[field]);
      }
    });

    if (setClauses.length === 0) return 0;

    values.push(id);
    const result = db().prepare(`UPDATE matches SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return result.changes;
  },

  delete(id) {
    return db().prepare('DELETE FROM matches WHERE id = ?').run(id).changes;
  },

  findByInvoiceId(invoiceId) {
    return db().prepare(`
      SELECT m.*, t.transaction_date, t.amount as transaction_amount, t.counterparty_name, t.summary
      FROM matches m
      LEFT JOIN transactions t ON m.transaction_id = t.id
      WHERE m.invoice_id = ?
      ORDER BY m.matched_at DESC
    `).all(invoiceId);
  },

  findByTransactionId(transactionId) {
    return db().prepare(`
      SELECT m.*, i.file_name as invoice_file, i.total_amount as invoice_amount, i.invoice_date, i.seller_name
      FROM matches m
      LEFT JOIN invoices i ON m.invoice_id = i.id
      WHERE m.transaction_id = ?
      ORDER BY m.matched_at DESC
    `).all(transactionId);
  },

  findConfirmedByInvoiceId(invoiceId) {
    return db().prepare(`
      SELECT * FROM matches WHERE invoice_id = ? AND status = 'confirmed'
    `).all(invoiceId);
  },

  getStats() {
    return db().prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN match_type = 'auto' THEN 1 ELSE 0 END) as auto_count,
        SUM(CASE WHEN match_type = 'manual' THEN 1 ELSE 0 END) as manual_count,
        COALESCE(SUM(matched_amount), 0) as total_matched_amount
      FROM matches
      WHERE status = 'confirmed'
    `).get();
  },

  findForExport() {
    return db().prepare(`
      SELECT
        m.id as match_id,
        m.matched_amount,
        m.match_type,
        m.match_score,
        m.matched_at,
        m.notes as match_notes,

        i.id as invoice_id,
        i.file_name,
        i.invoice_no,
        i.invoice_code,
        i.invoice_date,
        i.amount as invoice_amount,
        i.tax_amount as invoice_tax,
        i.total_amount as invoice_total,
        i.seller_name,
        i.buyer_name,
        i.category,
        i.status as invoice_status,

        t.id as transaction_id,
        t.transaction_date,
        t.transaction_time,
        t.amount as transaction_amount,
        t.balance,
        t.counterparty_name,
        t.counterparty_account,
        t.summary,
        t.remark,
        t.serial_no,
        t.bank_name,
        t.status as transaction_status
      FROM matches m
      LEFT JOIN invoices i ON m.invoice_id = i.id
      LEFT JOIN transactions t ON m.transaction_id = t.id
      WHERE m.status = 'confirmed'
      ORDER BY m.matched_at DESC
    `).all();
  },
};
