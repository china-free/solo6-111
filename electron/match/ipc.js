import { ipcMain } from 'electron';
import { getDb } from '../database/index.js';
import dayjs from 'dayjs';

export function registerMatchIpc() {
  const db = getDb();

  ipcMain.handle('match:auto', async () => {
    const result = runAutoMatch();
    return result;
  });

  ipcMain.handle('match:candidates', async (event, type, id) => {
    if (type === 'invoice') {
      return getInvoiceCandidates(id);
    } else {
      return getTransactionCandidates(id);
    }
  });

  ipcMain.handle('match:manual', async (event, invoiceId, transactionId, amount) => {
    const matchId = createMatch(invoiceId, transactionId, amount, 'manual');
    return { success: true, matchId };
  });

  ipcMain.handle('match:unmatch', async (event, matchId) => {
    const stmt = db.prepare('SELECT * FROM matches WHERE id = ?');
    const match = stmt.get(matchId);
    
    if (!match) {
      return { success: false, error: '匹配记录不存在' };
    }
    
    const deleteStmt = db.prepare('DELETE FROM matches WHERE id = ?');
    deleteStmt.run(matchId);
    
    updateInvoiceStatus(match.invoice_id);
    updateTransactionStatus(match.transaction_id);
    
    return { success: true };
  });

  function runAutoMatch() {
    const unmatchedInvoices = db.prepare(`
      SELECT * FROM invoices 
      WHERE status IN ('pending', 'partial') 
      AND total_amount > 0
      AND invoice_date IS NOT NULL
      ORDER BY invoice_date ASC
    `).all();
    
    const unmatchedTransactions = db.prepare(`
      SELECT * FROM transactions 
      WHERE status IN ('pending', 'partial')
      AND amount != 0
      ORDER BY transaction_date ASC
    `).all();
    
    let matchCount = 0;
    let anomalyCount = 0;
    const matchedPairs = [];
    
    const usedTransactions = new Set();
    
    for (const invoice of unmatchedInvoices) {
      const invoiceAmount = invoice.total_amount;
      const invoiceDate = invoice.invoice_date;
      
      let bestMatch = null;
      let bestScore = 0;
      
      for (const transaction of unmatchedTransactions) {
        if (usedTransactions.has(transaction.id)) continue;
        
        const transAmount = Math.abs(transaction.amount);
        const transDate = transaction.transaction_date;
        
        if (transAmount <= 0) continue;
        
        const amountDiff = Math.abs(invoiceAmount - transAmount);
        const amountRatio = Math.min(invoiceAmount, transAmount) / Math.max(invoiceAmount, transAmount);
        
        const daysDiff = Math.abs(dayjs(invoiceDate).diff(dayjs(transDate), 'day'));
        
        let score = 0;
        
        if (amountRatio > 0.99) {
          score += 50;
        } else if (amountRatio > 0.95) {
          score += 30;
        } else if (amountRatio > 0.8) {
          score += 15;
        }
        
        if (daysDiff <= 3) {
          score += 30;
        } else if (daysDiff <= 7) {
          score += 20;
        } else if (daysDiff <= 15) {
          score += 10;
        } else if (daysDiff <= 30) {
          score += 5;
        }
        
        if (invoice.seller_name && transaction.counterparty_name) {
          const sellerShort = invoice.seller_name.replace(/[（(].*?[)）]/g, '').substring(0, 8);
          const counterpartyShort = transaction.counterparty_name.replace(/[（(].*?[)）]/g, '').substring(0, 8);
          
          if (sellerShort && counterpartyShort && 
              (sellerShort.includes(counterpartyShort) || counterpartyShort.includes(sellerShort))) {
            score += 20;
          }
        }
        
        if (score > bestScore && score >= 40) {
          bestScore = score;
          bestMatch = transaction;
        }
      }
      
      if (bestMatch && bestScore >= 50) {
        const matchId = createMatch(invoice.id, bestMatch.id, Math.min(invoiceAmount, Math.abs(bestMatch.amount)), 'auto', bestScore);
        
        if (matchId) {
          usedTransactions.add(bestMatch.id);
          matchCount++;
          matchedPairs.push({
            invoiceId: invoice.id,
            transactionId: bestMatch.id,
            amount: Math.min(invoiceAmount, Math.abs(bestMatch.amount)),
            score: bestScore,
          });
          
          if (Math.abs(invoiceAmount - Math.abs(bestMatch.amount)) > 0.01) {
            db.prepare(`
              INSERT INTO anomalies (type, severity, invoice_id, transaction_id, match_id, description, detail)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              'amount_mismatch',
              'warning',
              invoice.id,
              bestMatch.id,
              matchId,
              '金额不完全匹配',
              `票据金额：${invoiceAmount}，流水金额：${Math.abs(bestMatch.amount)}，差额：${Math.abs(invoiceAmount - Math.abs(bestMatch.amount))}`
            );
            anomalyCount++;
          }
        }
      }
    }
    
    checkDuplicateAmounts();
    
    return {
      success: true,
      matchCount,
      anomalyCount,
      matchedPairs,
      totalInvoices: unmatchedInvoices.length,
      totalTransactions: unmatchedTransactions.length,
    };
  }

  function getInvoiceCandidates(invoiceId) {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    if (!invoice) return [];
    
    const invoiceAmount = invoice.total_amount || 0;
    const invoiceDate = invoice.invoice_date;
    
    const transactions = db.prepare(`
      SELECT * FROM transactions 
      WHERE status IN ('pending', 'partial')
      AND amount != 0
      ORDER BY transaction_date DESC
      LIMIT 50
    `).all();
    
    const candidates = transactions.map(t => {
      const transAmount = Math.abs(t.amount);
      const transDate = t.transaction_date;
      
      const amountDiff = Math.abs(invoiceAmount - transAmount);
      const amountRatio = invoiceAmount > 0 && transAmount > 0 
        ? Math.min(invoiceAmount, transAmount) / Math.max(invoiceAmount, transAmount)
        : 0;
      
      const daysDiff = invoiceDate && transDate
        ? Math.abs(dayjs(invoiceDate).diff(dayjs(transDate), 'day'))
        : 999;
      
      let score = 0;
      if (amountRatio > 0.99) score += 50;
      else if (amountRatio > 0.95) score += 30;
      else if (amountRatio > 0.8) score += 15;
      
      if (daysDiff <= 3) score += 30;
      else if (daysDiff <= 7) score += 20;
      else if (daysDiff <= 15) score += 10;
      
      if (invoice.seller_name && t.counterparty_name) {
        const sellerShort = invoice.seller_name.replace(/[（(].*?[)）]/g, '').substring(0, 8);
        const counterpartyShort = t.counterparty_name.replace(/[（(].*?[)）]/g, '').substring(0, 8);
        if (sellerShort && counterpartyShort && 
            (sellerShort.includes(counterpartyShort) || counterpartyShort.includes(sellerShort))) {
          score += 20;
        }
      }
      
      return {
        ...t,
        matchScore: score,
        amountDiff,
        daysDiff,
      };
    });
    
    candidates.sort((a, b) => b.matchScore - a.matchScore);
    
    return candidates.slice(0, 20);
  }

  function getTransactionCandidates(transactionId) {
    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
    if (!transaction) return [];
    
    const transAmount = Math.abs(transaction.amount);
    const transDate = transaction.transaction_date;
    
    const invoices = db.prepare(`
      SELECT * FROM invoices 
      WHERE status IN ('pending', 'partial')
      AND total_amount > 0
      ORDER BY invoice_date DESC
      LIMIT 50
    `).all();
    
    const candidates = invoices.map(inv => {
      const invoiceAmount = inv.total_amount || 0;
      const invoiceDate = inv.invoice_date;
      
      const amountDiff = Math.abs(invoiceAmount - transAmount);
      const amountRatio = invoiceAmount > 0 && transAmount > 0 
        ? Math.min(invoiceAmount, transAmount) / Math.max(invoiceAmount, transAmount)
        : 0;
      
      const daysDiff = invoiceDate && transDate
        ? Math.abs(dayjs(invoiceDate).diff(dayjs(transDate), 'day'))
        : 999;
      
      let score = 0;
      if (amountRatio > 0.99) score += 50;
      else if (amountRatio > 0.95) score += 30;
      else if (amountRatio > 0.8) score += 15;
      
      if (daysDiff <= 3) score += 30;
      else if (daysDiff <= 7) score += 20;
      else if (daysDiff <= 15) score += 10;
      
      if (inv.seller_name && transaction.counterparty_name) {
        const sellerShort = inv.seller_name.replace(/[（(].*?[)）]/g, '').substring(0, 8);
        const counterpartyShort = transaction.counterparty_name.replace(/[（(].*?[)）]/g, '').substring(0, 8);
        if (sellerShort && counterpartyShort && 
            (sellerShort.includes(counterpartyShort) || counterpartyShort.includes(sellerShort))) {
          score += 20;
        }
      }
      
      return {
        ...inv,
        matchScore: score,
        amountDiff,
        daysDiff,
      };
    });
    
    candidates.sort((a, b) => b.matchScore - a.matchScore);
    
    return candidates.slice(0, 20);
  }

  function createMatch(invoiceId, transactionId, amount, type = 'manual', score = 0) {
    const stmt = db.prepare(`
      INSERT INTO matches (invoice_id, transaction_id, matched_amount, match_type, match_score, status)
      VALUES (?, ?, ?, ?, ?, 'confirmed')
    `);
    
    const result = stmt.run(invoiceId, transactionId, amount, type, score);
    
    updateInvoiceStatus(invoiceId);
    updateTransactionStatus(transactionId);
    
    checkSplitReconciliation(invoiceId);
    
    return result.lastInsertRowid;
  }

  function updateInvoiceStatus(invoiceId) {
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
      if (invoice.total_amount && Math.abs(matched_amount - invoice.total_amount) < 0.01) {
        status = 'matched';
      } else if (matched_amount > 0) {
        status = 'partial';
      }
    }
    
    updateStmt.run(status, invoiceId);
  }

  function updateTransactionStatus(transactionId) {
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
    
    const absAmount = Math.abs(transaction.amount);
    let status = 'pending';
    if (match_count > 0) {
      if (Math.abs(matched_amount - absAmount) < 0.01) {
        status = 'matched';
      } else if (matched_amount > 0) {
        status = 'partial';
      }
    }
    
    updateStmt.run(status, transactionId);
  }

  function checkDuplicateAmounts() {
    const transactions = db.prepare(`
      SELECT amount, COUNT(*) as cnt
      FROM transactions
      WHERE status = 'pending'
      AND amount != 0
      GROUP BY amount
      HAVING cnt > 1
    `).all();
    
    for (const t of transactions) {
      if (t.cnt >= 2) {
        const sameAmountTrans = db.prepare(`
          SELECT * FROM transactions 
          WHERE amount = ? AND status = 'pending'
          ORDER BY transaction_date
        `).all(t.amount);
        
        for (const trans of sameAmountTrans) {
          const existingAnomaly = db.prepare(`
            SELECT * FROM anomalies 
            WHERE transaction_id = ? AND type = 'duplicate_amount' AND status = 'open'
          `).get(trans.id);
          
          if (!existingAnomaly) {
            db.prepare(`
              INSERT INTO anomalies (type, severity, transaction_id, description, detail)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              'duplicate_amount',
              'warning',
              trans.id,
              '同金额多笔流水',
              `金额 ${t.amount} 有 ${t.cnt} 笔流水，可能造成匹配冲突，请人工确认`
            );
          }
        }
      }
    }
  }

  function checkSplitReconciliation(invoiceId) {
    const matches = db.prepare(`
      SELECT * FROM matches WHERE invoice_id = ? AND status = 'confirmed'
    `).all(invoiceId);
    
    if (matches.length >= 2) {
      const existingAnomaly = db.prepare(`
        SELECT * FROM anomalies 
        WHERE invoice_id = ? AND type = 'split_payment' AND status = 'open'
      `).get(invoiceId);
      
      if (!existingAnomaly) {
        db.prepare(`
          INSERT INTO anomalies (type, severity, invoice_id, description, detail)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          'split_payment',
          'info',
          invoiceId,
          '一张票据对应多笔流水（拆分报销）',
          `该票据已匹配 ${matches.length} 笔流水，请注意核对是否为拆分报销`
        );
      }
    }
  }
}
