import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../database/index.js';
import { parseInvoiceFields, detectInvoiceCategory } from '../ocr/parser.js';
import { runPaddleOcr } from '../ocr/paddleOcr.js';

export function registerImportIpc() {
  const db = getDb();

  ipcMain.handle('import:invoiceFiles', async (event, filePaths) => {
    const results = [];
    const duplicateCount = 0;
    
    for (const filePath of filePaths) {
      try {
        const result = await importSingleInvoice(filePath);
        results.push(result);
      } catch (error) {
        results.push({
          filePath,
          success: false,
          error: error.message,
        });
      }
    }
    
    const successCount = results.filter(r => r.success && !r.duplicate).length;
    const duplicateCountResult = results.filter(r => r.duplicate).length;
    const failCount = results.filter(r => !r.success).length;
    
    return {
      results,
      total: filePaths.length,
      success: successCount,
      duplicate: duplicateCountResult,
      failed: failCount,
    };
  });

  ipcMain.handle('import:transactions', async (event, filePath) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      
      let transactions = [];
      
      if (ext === '.xlsx' || ext === '.xls') {
        transactions = await parseExcelTransactions(filePath);
      } else if (ext === '.csv') {
        transactions = parseCsvTransactions(filePath);
      } else {
        return { success: false, error: '不支持的文件格式' };
      }
      
      if (transactions.length === 0) {
        return { success: false, error: '未解析到有效交易记录' };
      }
      
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
      
      return {
        success: true,
        count: transactions.length,
        ids,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  async function importSingleInvoice(filePath) {
    if (!fs.existsSync(filePath)) {
      return { filePath, success: false, error: '文件不存在' };
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.pdf'];
    
    if (!supportedFormats.includes(ext)) {
      return { filePath, success: false, error: '不支持的文件格式' };
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const fileStat = fs.statSync(filePath);
    
    const existingInvoice = db.prepare('SELECT * FROM invoices WHERE file_hash = ?').get(fileHash);
    if (existingInvoice) {
      return {
        filePath,
        success: true,
        duplicate: true,
        invoiceId: existingInvoice.id,
        message: '票据已存在，跳过导入',
      };
    }
    
    const ocrText = await runPaddleOcr(filePath);
    const fields = parseInvoiceFields(ocrText);
    const category = detectInvoiceCategory(ocrText, fields);
    
    const fileName = path.basename(filePath);
    const fileType = ext.slice(1);
    const fileSize = fileStat.size;
    
    let status = 'pending';
    if (fields.confidence < 30) {
      status = 'anomaly';
    }
    
    const stmt = db.prepare(`
      INSERT INTO invoices 
      (file_path, file_name, file_hash, file_type, file_size, ocr_text, 
       invoice_no, invoice_code, amount, tax_amount, total_amount, 
       invoice_date, seller_name, seller_tax_no, buyer_name, buyer_tax_no, 
       category, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      filePath, fileName, fileHash, fileType, fileSize, ocrText,
      fields.invoice_no, fields.invoice_code, fields.amount, fields.tax_amount,
      fields.total_amount, fields.invoice_date, fields.seller_name, fields.seller_tax_no,
      fields.buyer_name, fields.buyer_tax_no, category, status
    );
    
    const invoiceId = result.lastInsertRowid;
    
    if (status === 'anomaly') {
      db.prepare(`
        INSERT INTO anomalies (type, severity, invoice_id, description, detail)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'incomplete_ocr',
        'warning',
        invoiceId,
        'OCR识别结果不完整',
        `识别置信度：${fields.confidence}%，请人工核对关键信息`
      );
    }
    
    return {
      filePath,
      success: true,
      duplicate: false,
      invoiceId,
      fields,
      category,
      confidence: fields.confidence,
    };
  }

  async function parseExcelTransactions(filePath) {
    const { default: XLSX } = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    return parseTransactionRows(data);
  }

  function parseCsvTransactions(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const data = lines.map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
    
    return parseTransactionRows(data);
  }

  function parseTransactionRows(rows) {
    if (rows.length < 2) return [];
    
    const headerRow = rows[0].map(h => String(h || '').trim());
    
    const dateColIndex = findColumnIndex(headerRow, ['交易日期', '日期', '记账日期', 'Date']);
    const timeColIndex = findColumnIndex(headerRow, ['交易时间', '时间', 'Time']);
    const amountColIndex = findColumnIndex(headerRow, ['交易金额', '金额', 'Amount', '发生额']);
    const balanceColIndex = findColumnIndex(headerRow, ['余额', '账户余额', 'Balance']);
    const counterpartyColIndex = findColumnIndex(headerRow, ['对方户名', '交易对手', '对方名称', '收款人', '付款人', 'Counterparty']);
    const counterpartyAcctColIndex = findColumnIndex(headerRow, ['对方账号', '对方账户', 'Counterparty Account']);
    const summaryColIndex = findColumnIndex(headerRow, ['摘要', '交易摘要', '用途', 'Description', 'Summary']);
    const remarkColIndex = findColumnIndex(headerRow, ['备注', '附言', 'Remark', 'Note']);
    const typeColIndex = findColumnIndex(headerRow, ['交易类型', '类型', 'Type']);
    const serialColIndex = findColumnIndex(headerRow, ['流水号', '交易流水号', '凭证号', 'Serial No', 'Reference']);
    
    const transactions = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const dateStr = dateColIndex >= 0 ? String(row[dateColIndex] || '') : '';
      const formattedDate = formatDate(dateStr);
      
      if (!formattedDate) continue;
      
      let amount = amountColIndex >= 0 ? parseAmount(row[amountColIndex]) : 0;
      
      if (amount === 0) continue;
      
      const transaction = {
        bank_name: '',
        account_no: '',
        transaction_date: formattedDate,
        transaction_time: timeColIndex >= 0 ? String(row[timeColIndex] || '') : '',
        amount: amount,
        balance: balanceColIndex >= 0 ? parseAmount(row[balanceColIndex]) : null,
        counterparty_name: counterpartyColIndex >= 0 ? String(row[counterpartyColIndex] || '').trim() : '',
        counterparty_account: counterpartyAcctColIndex >= 0 ? String(row[counterpartyAcctColIndex] || '').trim() : '',
        summary: summaryColIndex >= 0 ? String(row[summaryColIndex] || '').trim() : '',
        remark: remarkColIndex >= 0 ? String(row[remarkColIndex] || '').trim() : '',
        transaction_type: typeColIndex >= 0 ? String(row[typeColIndex] || '').trim() : '',
        serial_no: serialColIndex >= 0 ? String(row[serialColIndex] || '').trim() : '',
        status: 'pending',
      };
      
      transactions.push(transaction);
    }
    
    return transactions;
  }

  function findColumnIndex(headers, keywords) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      for (const keyword of keywords) {
        if (header.includes(keyword)) {
          return i;
        }
      }
    }
    return -1;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    
    dateStr = String(dateStr).trim();
    
    const patterns = [
      /^(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/,
      /^(\d{4})(\d{2})(\d{2})/,
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
    ];
    
    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        let year, month, day;
        
        if (pattern === patterns[2]) {
          month = match[1];
          day = match[2];
          year = match[3];
        } else {
          year = match[1];
          month = match[2];
          day = match[3];
        }
        
        year = year.padStart(4, '20');
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        
        return `${year}-${month}-${day}`;
      }
    }
    
    const num = Number(dateStr);
    if (!isNaN(num) && num > 40000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return '';
  }

  function parseAmount(value) {
    if (value === null || value === undefined || value === '') return 0;
    
    if (typeof value === 'number') return value;
    
    let str = String(value).trim();
    
    str = str.replace(/[,，\s]/g, '');
    str = str.replace(/[¥￥$]/g, '');
    
    if (str.startsWith('(') && str.endsWith(')')) {
      str = '-' + str.slice(1, -1);
    }
    
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }
}
