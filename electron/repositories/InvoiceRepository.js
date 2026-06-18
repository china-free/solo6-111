import { getDb } from '../database/index.js';

const db = () => getDb();

export const invoiceRepository = {
  findAll({ page = 1, pageSize = 20, status, category, startDate, endDate, keyword } = {}) {
    let whereClause = [];
    let queryParams = [];

    if (status) { whereClause.push('status = ?'); queryParams.push(status); }
    if (category) { whereClause.push('category = ?'); queryParams.push(category); }
    if (startDate) { whereClause.push('invoice_date >= ?'); queryParams.push(startDate); }
    if (endDate) { whereClause.push('invoice_date <= ?'); queryParams.push(endDate); }
    if (keyword) {
      whereClause.push('(invoice_no LIKE ? OR seller_name LIKE ? OR buyer_name LIKE ? OR file_name LIKE ?)');
      const kw = `%${keyword}%`;
      queryParams.push(kw, kw, kw, kw);
    }

    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    const { total } = db().prepare(`SELECT COUNT(*) as total FROM invoices ${whereSql}`).get(...queryParams);

    const offset = (page - 1) * pageSize;
    const list = db().prepare(`
      SELECT i.*,
        (SELECT COUNT(*) FROM matches m WHERE m.invoice_id = i.id AND m.status = 'confirmed') as match_count
      FROM invoices i
      ${whereSql}
      ORDER BY imported_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, pageSize, offset);

    return { list, total, page, pageSize };
  },

  findById(id) {
    return db().prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  },

  findByFileHash(hash) {
    return db().prepare('SELECT * FROM invoices WHERE file_hash = ?').get(hash);
  },

  create(invoice) {
    const result = db().prepare(`
      INSERT INTO invoices
      (file_path, file_name, file_hash, file_type, file_size, ocr_text,
       invoice_no, invoice_code, amount, tax_amount, total_amount,
       invoice_date, seller_name, seller_tax_no, buyer_name, buyer_tax_no,
       category, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoice.file_path, invoice.file_name, invoice.file_hash, invoice.file_type, invoice.file_size,
      invoice.ocr_text, invoice.invoice_no, invoice.invoice_code, invoice.amount, invoice.tax_amount,
      invoice.total_amount, invoice.invoice_date, invoice.seller_name, invoice.seller_tax_no,
      invoice.buyer_name, invoice.buyer_tax_no, invoice.category || '其他费用',
      invoice.status || 'pending', invoice.notes
    );
    return result.lastInsertRowid;
  },

  update(id, fields) {
    const allowedFields = ['ocr_text', 'invoice_no', 'invoice_code', 'amount', 'tax_amount',
      'total_amount', 'invoice_date', 'seller_name', 'seller_tax_no', 'buyer_name',
      'buyer_tax_no', 'category', 'status', 'notes'];

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

    const result = db().prepare(`UPDATE invoices SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return result.changes;
  },

  updateStatus(id, status) {
    return db().prepare(`UPDATE invoices SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(status, id);
  },

  delete(id) {
    return db().prepare('DELETE FROM invoices WHERE id = ?').run(id).changes;
  },

  findUnmatched() {
    return db().prepare(`
      SELECT * FROM invoices
      WHERE status IN ('pending', 'partial')
      AND total_amount > 0
      AND invoice_date IS NOT NULL
      ORDER BY invoice_date ASC
    `).all();
  },

  getMatchedAmount(invoiceId) {
    return db().prepare(`
      SELECT COALESCE(SUM(matched_amount), 0) as matched_amount, COUNT(*) as match_count
      FROM matches
      WHERE invoice_id = ? AND status = 'confirmed'
    `).get(invoiceId);
  },

  getStats() {
    return db().prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN status = 'anomaly' THEN 1 ELSE 0 END) as anomaly,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM invoices
    `).get();
  },

  findUnmatchedForExport() {
    return db().prepare(`
      SELECT * FROM invoices WHERE status IN ('pending', 'partial', 'anomaly')
      ORDER BY imported_at DESC
    `).all();
  },
};
