import { getDb } from '../database/index.js';

const db = () => getDb();

export const anomalyRepository = {
  findAll({ page = 1, pageSize = 20, status, type, severity } = {}) {
    let whereClause = [];
    let queryParams = [];

    if (status) { whereClause.push('status = ?'); queryParams.push(status); }
    if (type) { whereClause.push('type = ?'); queryParams.push(type); }
    if (severity) { whereClause.push('severity = ?'); queryParams.push(severity); }

    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    const { total } = db().prepare(`SELECT COUNT(*) as total FROM anomalies ${whereSql}`).get(...queryParams);

    const offset = (page - 1) * pageSize;
    const list = db().prepare(`
      SELECT a.*
      FROM anomalies a
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, pageSize, offset);

    return { list, total, page, pageSize };
  },

  findById(id) {
    return db().prepare('SELECT * FROM anomalies WHERE id = ?').get(id);
  },

  create(anomaly) {
    const result = db().prepare(`
      INSERT INTO anomalies (type, severity, invoice_id, transaction_id, match_id, description, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      anomaly.type,
      anomaly.severity || 'warning',
      anomaly.invoice_id,
      anomaly.transaction_id,
      anomaly.match_id,
      anomaly.description,
      anomaly.detail
    );
    return result.lastInsertRowid;
  },

  update(id, fields) {
    const allowedFields = ['type', 'severity', 'description', 'detail', 'status'];

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
    const result = db().prepare(`UPDATE anomalies SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return result.changes;
  },

  resolve(id, resolution) {
    return db().prepare(`
      UPDATE anomalies
      SET status = 'resolved', resolution = ?, resolved_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(resolution, id).changes;
  },

  findOpenByTypeAndInvoice(type, invoiceId) {
    return db().prepare(`
      SELECT * FROM anomalies
      WHERE invoice_id = ? AND type = ? AND status = 'open'
    `).get(invoiceId, type);
  },

  findOpenByTypeAndTransaction(type, transactionId) {
    return db().prepare(`
      SELECT * FROM anomalies
      WHERE transaction_id = ? AND type = ? AND status = 'open'
    `).get(transactionId, type);
  },

  getStats() {
    return db().prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM anomalies
    `).get();
  },

  findForExport() {
    return db().prepare(`SELECT * FROM anomalies ORDER BY created_at DESC`).all();
  },

  getOpenCount() {
    return db().prepare(`SELECT COUNT(*) as count FROM anomalies WHERE status = 'open'`).get().count;
  },
};
