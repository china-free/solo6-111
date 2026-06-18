import { ipcMain } from 'electron';
import { getDb } from './index.js';

export function registerDatabaseIpc() {
  const db = getDb();

  ipcMain.handle('db:getInvoices', async (event, params = {}) => {
    const { page = 1, pageSize = 20, status, category, startDate, endDate, keyword } = params;
    
    let whereClause = [];
    let queryParams = [];
    
    if (status) {
      whereClause.push('status = ?');
      queryParams.push(status);
    }
    if (category) {
      whereClause.push('category = ?');
      queryParams.push(category);
    }
    if (startDate) {
      whereClause.push('invoice_date >= ?');
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause.push('invoice_date <= ?');
      queryParams.push(endDate);
    }
    if (keyword) {
      whereClause.push('(invoice_no LIKE ? OR seller_name LIKE ? OR buyer_name LIKE ? OR file_name LIKE ?)');
      const kw = `%${keyword}%`;
      queryParams.push(kw, kw, kw, kw);
    }
    
    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM invoices ${whereSql}`);
    const { total } = countStmt.get(...queryParams);
    
    const offset = (page - 1) * pageSize;
    const stmt = db.prepare(`
      SELECT i.*, 
        (SELECT COUNT(*) FROM matches m WHERE m.invoice_id = i.id AND m.status = 'confirmed') as match_count
      FROM invoices i
      ${whereSql}
      ORDER BY imported_at DESC
      LIMIT ? OFFSET ?
    `);
    const list = stmt.all(...queryParams, pageSize, offset);
    
    return { list, total, page, pageSize };
  });

  ipcMain.handle('db:getInvoiceById', async (event, id) => {
    const stmt = db.prepare('SELECT * FROM invoices WHERE id = ?');
    return stmt.get(id);
  });

  ipcMain.handle('db:addInvoice', async (event, invoice) => {
    const stmt = db.prepare(`
      INSERT INTO invoices 
      (file_path, file_name, file_hash, file_type, file_size, ocr_text, 
       invoice_no, invoice_code, amount, tax_amount, total_amount, 
       invoice_date, seller_name, seller_tax_no, buyer_name, buyer_tax_no, 
       category, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      invoice.file_path, invoice.file_name, invoice.file_hash, invoice.file_type, invoice.file_size,
      invoice.ocr_text, invoice.invoice_no, invoice.invoice_code, invoice.amount, invoice.tax_amount,
      invoice.total_amount, invoice.invoice_date, invoice.seller_name, invoice.seller_tax_no,
      invoice.buyer_name, invoice.buyer_tax_no, invoice.category || '其他费用',
      invoice.status || 'pending', invoice.notes
    );
    
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('db:updateInvoice', async (event, id, invoice) => {
    const fields = [];
    const values = [];
    
    const allowedFields = ['ocr_text', 'invoice_no', 'invoice_code', 'amount', 'tax_amount', 
      'total_amount', 'invoice_date', 'seller_name', 'seller_tax_no', 'buyer_name', 
      'buyer_tax_no', 'category', 'status', 'notes'];
    
    allowedFields.forEach(field => {
      if (invoice[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(invoice[field]);
      }
    });
    
    if (fields.length === 0) return { changed: 0 };
    
    fields.push('updated_at = datetime(\'now\', \'localtime\')');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    
    return { changed: result.changes };
  });

  ipcMain.handle('db:deleteInvoice', async (event, id) => {
    const stmt = db.prepare('DELETE FROM invoices WHERE id = ?');
    const result = stmt.run(id);
    return { changed: result.changes };
  });

  ipcMain.handle('db:getInvoiceByFileHash', async (event, hash) => {
    const stmt = db.prepare('SELECT * FROM invoices WHERE file_hash = ?');
    return stmt.get(hash);
  });

  ipcMain.handle('db:getTransactions', async (event, params = {}) => {
    const { page = 1, pageSize = 20, status, startDate, endDate, keyword } = params;
    
    let whereClause = [];
    let queryParams = [];
    
    if (status) {
      whereClause.push('status = ?');
      queryParams.push(status);
    }
    if (startDate) {
      whereClause.push('transaction_date >= ?');
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause.push('transaction_date <= ?');
      queryParams.push(endDate);
    }
    if (keyword) {
      whereClause.push('(counterparty_name LIKE ? OR summary LIKE ? OR remark LIKE ? OR serial_no LIKE ?)');
      const kw = `%${keyword}%`;
      queryParams.push(kw, kw, kw, kw);
    }
    
    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM transactions ${whereSql}`);
    const { total } = countStmt.get(...queryParams);
    
    const offset = (page - 1) * pageSize;
    const stmt = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM matches m WHERE m.transaction_id = t.id AND m.status = 'confirmed') as match_count
      FROM transactions t
      ${whereSql}
      ORDER BY transaction_date DESC, transaction_time DESC
      LIMIT ? OFFSET ?
    `);
    const list = stmt.all(...queryParams, pageSize, offset);
    
    return { list, total, page, pageSize };
  });

  ipcMain.handle('db:getTransactionById', async (event, id) => {
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    return stmt.get(id);
  });

  ipcMain.handle('db:addTransaction', async (event, transaction) => {
    const stmt = db.prepare(`
      INSERT INTO transactions 
      (bank_name, account_no, transaction_date, transaction_time, amount, balance,
       counterparty_name, counterparty_account, summary, remark, transaction_type, serial_no, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      transaction.bank_name, transaction.account_no, transaction.transaction_date,
      transaction.transaction_time, transaction.amount, transaction.balance,
      transaction.counterparty_name, transaction.counterparty_account,
      transaction.summary, transaction.remark, transaction.transaction_type,
      transaction.serial_no, transaction.status || 'pending'
    );
    
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('db:addTransactions', async (event, transactions) => {
    const insert = db.prepare(`
      INSERT INTO transactions 
      (bank_name, account_no, transaction_date, transaction_time, amount, balance,
       counterparty_name, counterparty_account, summary, remark, transaction_type, serial_no, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((items) => {
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
    
    const ids = insertMany(transactions);
    return { ids, count: ids.length };
  });

  ipcMain.handle('db:updateTransaction', async (event, id, transaction) => {
    const fields = [];
    const values = [];
    
    const allowedFields = ['bank_name', 'account_no', 'transaction_date', 'transaction_time',
      'amount', 'balance', 'counterparty_name', 'counterparty_account', 'summary', 'remark',
      'transaction_type', 'serial_no', 'status'];
    
    allowedFields.forEach(field => {
      if (transaction[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(transaction[field]);
      }
    });
    
    if (fields.length === 0) return { changed: 0 };
    
    fields.push('updated_at = datetime(\'now\', \'localtime\')');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    
    return { changed: result.changes };
  });

  ipcMain.handle('db:deleteTransaction', async (event, id) => {
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    const result = stmt.run(id);
    return { changed: result.changes };
  });

  ipcMain.handle('db:getMatches', async (event, params = {}) => {
    const { page = 1, pageSize = 20, status, matchType, startDate, endDate } = params;
    
    let whereClause = [];
    let queryParams = [];
    
    if (status) {
      whereClause.push('m.status = ?');
      queryParams.push(status);
    }
    if (matchType) {
      whereClause.push('m.match_type = ?');
      queryParams.push(matchType);
    }
    
    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM matches m ${whereSql}`);
    const { total } = countStmt.get(...queryParams);
    
    const offset = (page - 1) * pageSize;
    const stmt = db.prepare(`
      SELECT m.*, 
        i.file_name as invoice_file, i.total_amount as invoice_amount, i.invoice_date, i.seller_name,
        t.transaction_date, t.amount as transaction_amount, t.counterparty_name, t.summary
      FROM matches m
      LEFT JOIN invoices i ON m.invoice_id = i.id
      LEFT JOIN transactions t ON m.transaction_id = t.id
      ${whereSql}
      ORDER BY m.matched_at DESC
      LIMIT ? OFFSET ?
    `);
    const list = stmt.all(...queryParams, pageSize, offset);
    
    return { list, total, page, pageSize };
  });

  ipcMain.handle('db:addMatch', async (event, match) => {
    const stmt = db.prepare(`
      INSERT INTO matches (invoice_id, transaction_id, matched_amount, match_type, match_score, status, matched_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      match.invoice_id, match.transaction_id, match.matched_amount,
      match.match_type || 'manual', match.match_score,
      match.status || 'confirmed', match.matched_by, match.notes
    );
    
    updateInvoiceStatus(match.invoice_id);
    updateTransactionStatus(match.transaction_id);
    
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('db:updateMatch', async (event, id, match) => {
    const fields = [];
    const values = [];
    
    const allowedFields = ['matched_amount', 'match_type', 'match_score', 'status', 'notes'];
    
    allowedFields.forEach(field => {
      if (match[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(match[field]);
      }
    });
    
    if (fields.length === 0) return { changed: 0 };
    
    values.push(id);
    
    const stmt = db.prepare(`UPDATE matches SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    
    return { changed: result.changes };
  });

  ipcMain.handle('db:deleteMatch', async (event, id) => {
    const matchStmt = db.prepare('SELECT * FROM matches WHERE id = ?');
    const match = matchStmt.get(id);
    
    const stmt = db.prepare('DELETE FROM matches WHERE id = ?');
    const result = stmt.run(id);
    
    if (match) {
      updateInvoiceStatus(match.invoice_id);
      updateTransactionStatus(match.transaction_id);
    }
    
    return { changed: result.changes };
  });

  ipcMain.handle('db:getMatchesByInvoiceId', async (event, invoiceId) => {
    const stmt = db.prepare(`
      SELECT m.*, t.transaction_date, t.amount as transaction_amount, t.counterparty_name, t.summary
      FROM matches m
      LEFT JOIN transactions t ON m.transaction_id = t.id
      WHERE m.invoice_id = ?
      ORDER BY m.matched_at DESC
    `);
    return stmt.all(invoiceId);
  });

  ipcMain.handle('db:getMatchesByTransactionId', async (event, transactionId) => {
    const stmt = db.prepare(`
      SELECT m.*, i.file_name as invoice_file, i.total_amount as invoice_amount, i.invoice_date, i.seller_name
      FROM matches m
      LEFT JOIN invoices i ON m.invoice_id = i.id
      WHERE m.transaction_id = ?
      ORDER BY m.matched_at DESC
    `);
    return stmt.all(transactionId);
  });

  ipcMain.handle('db:getAnomalies', async (event, params = {}) => {
    const { page = 1, pageSize = 20, status, type, severity } = params;
    
    let whereClause = [];
    let queryParams = [];
    
    if (status) {
      whereClause.push('status = ?');
      queryParams.push(status);
    }
    if (type) {
      whereClause.push('type = ?');
      queryParams.push(type);
    }
    if (severity) {
      whereClause.push('severity = ?');
      queryParams.push(severity);
    }
    
    const whereSql = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM anomalies ${whereSql}`);
    const { total } = countStmt.get(...queryParams);
    
    const offset = (page - 1) * pageSize;
    const stmt = db.prepare(`
      SELECT a.*
      FROM anomalies a
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const list = stmt.all(...queryParams, pageSize, offset);
    
    return { list, total, page, pageSize };
  });

  ipcMain.handle('db:addAnomaly', async (event, anomaly) => {
    const stmt = db.prepare(`
      INSERT INTO anomalies (type, severity, invoice_id, transaction_id, match_id, description, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      anomaly.type, anomaly.severity || 'warning',
      anomaly.invoice_id, anomaly.transaction_id, anomaly.match_id,
      anomaly.description, anomaly.detail
    );
    
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle('db:updateAnomaly', async (event, id, anomaly) => {
    const fields = [];
    const values = [];
    
    const allowedFields = ['type', 'severity', 'description', 'detail', 'status'];
    
    allowedFields.forEach(field => {
      if (anomaly[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(anomaly[field]);
      }
    });
    
    if (fields.length === 0) return { changed: 0 };
    
    values.push(id);
    
    const stmt = db.prepare(`UPDATE anomalies SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    
    return { changed: result.changes };
  });

  ipcMain.handle('db:resolveAnomaly', async (event, id, resolution) => {
    const stmt = db.prepare(`
      UPDATE anomalies 
      SET status = 'resolved', resolution = ?, resolved_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    
    const result = stmt.run(resolution, id);
    return { changed: result.changes };
  });

  ipcMain.handle('db:getStats', async () => {
    const invoiceStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN status = 'anomaly' THEN 1 ELSE 0 END) as anomaly,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM invoices
    `).get();
    
    const transactionStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN status = 'anomaly' THEN 1 ELSE 0 END) as anomaly,
        COALESCE(SUM(amount), 0) as total_amount
      FROM transactions
    `).get();
    
    const matchStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN match_type = 'auto' THEN 1 ELSE 0 END) as auto_count,
        SUM(CASE WHEN match_type = 'manual' THEN 1 ELSE 0 END) as manual_count,
        COALESCE(SUM(matched_amount), 0) as total_matched_amount
      FROM matches
      WHERE status = 'confirmed'
    `).get();
    
    const anomalyStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM anomalies
    `).get();
    
    return {
      invoices: invoiceStats,
      transactions: transactionStats,
      matches: matchStats,
      anomalies: anomalyStats,
    };
  });

  function updateInvoiceStatus(invoiceId) {
    const db = getDb();
    const matchStmt = db.prepare(`
      SELECT COALESCE(SUM(matched_amount), 0) as matched_amount, COUNT(*) as match_count
      FROM matches 
      WHERE invoice_id = ? AND status = 'confirmed'
    `);
    const invoiceStmt = db.prepare('SELECT total_amount FROM invoices WHERE id = ?');
    const updateStmt = db.prepare('UPDATE invoices SET status = ? WHERE id = ?');
    
    const { matched_amount, match_count } = matchStmt.get(invoiceId);
    const invoice = invoiceStmt.get(invoiceId);
    
    if (!invoice) return;
    
    let status = 'pending';
    if (match_count > 0) {
      if (Math.abs(matched_amount - invoice.total_amount) < 0.01) {
        status = 'matched';
      } else if (matched_amount > 0) {
        status = 'partial';
      }
    }
    
    updateStmt.run(status, invoiceId);
  }

  function updateTransactionStatus(transactionId) {
    const db = getDb();
    const matchStmt = db.prepare(`
      SELECT COALESCE(SUM(matched_amount), 0) as matched_amount, COUNT(*) as match_count
      FROM matches 
      WHERE transaction_id = ? AND status = 'confirmed'
    `);
    const transactionStmt = db.prepare('SELECT amount FROM transactions WHERE id = ?');
    const updateStmt = db.prepare('UPDATE transactions SET status = ? WHERE id = ?');
    
    const { matched_amount, match_count } = matchStmt.get(transactionId);
    const transaction = transactionStmt.get(transactionId);
    
    if (!transaction) return;
    
    let status = 'pending';
    if (match_count > 0) {
      if (Math.abs(matched_amount - Math.abs(transaction.amount)) < 0.01) {
        status = 'matched';
      } else if (matched_amount > 0) {
        status = 'partial';
      }
    }
    
    updateStmt.run(status, transactionId);
  }
}
