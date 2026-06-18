import fs from 'fs';
import path from 'path';
import { transactionRepository } from '../repositories/transactionRepository.js';

function findColumnIndex(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    for (const keyword of keywords) {
      if (header.includes(keyword)) return i;
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
        month = match[1]; day = match[2]; year = match[3];
      } else {
        year = match[1]; month = match[2]; day = match[3];
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

function parseTransactionRows(rows) {
  if (rows.length < 2) return [];

  const headerRow = rows[0].map(h => String(h || '').trim());

  const colMap = {
    date: findColumnIndex(headerRow, ['交易日期', '日期', '记账日期', 'Date']),
    time: findColumnIndex(headerRow, ['交易时间', '时间', 'Time']),
    amount: findColumnIndex(headerRow, ['交易金额', '金额', 'Amount', '发生额']),
    balance: findColumnIndex(headerRow, ['余额', '账户余额', 'Balance']),
    counterparty: findColumnIndex(headerRow, ['对方户名', '交易对手', '对方名称', '收款人', '付款人', 'Counterparty']),
    counterpartyAcct: findColumnIndex(headerRow, ['对方账号', '对方账户', 'Counterparty Account']),
    summary: findColumnIndex(headerRow, ['摘要', '交易摘要', '用途', 'Description', 'Summary']),
    remark: findColumnIndex(headerRow, ['备注', '附言', 'Remark', 'Note']),
    type: findColumnIndex(headerRow, ['交易类型', '类型', 'Type']),
    serial: findColumnIndex(headerRow, ['流水号', '交易流水号', '凭证号', 'Serial No', 'Reference']),
  };

  const transactions = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const dateStr = colMap.date >= 0 ? String(row[colMap.date] || '') : '';
    const formattedDate = formatDate(dateStr);
    if (!formattedDate) continue;

    const amount = colMap.amount >= 0 ? parseAmount(row[colMap.amount]) : 0;
    if (amount === 0) continue;

    transactions.push({
      bank_name: '',
      account_no: '',
      transaction_date: formattedDate,
      transaction_time: colMap.time >= 0 ? String(row[colMap.time] || '') : '',
      amount,
      balance: colMap.balance >= 0 ? parseAmount(row[colMap.balance]) : null,
      counterparty_name: colMap.counterparty >= 0 ? String(row[colMap.counterparty] || '').trim() : '',
      counterparty_account: colMap.counterpartyAcct >= 0 ? String(row[colMap.counterpartyAcct] || '').trim() : '',
      summary: colMap.summary >= 0 ? String(row[colMap.summary] || '').trim() : '',
      remark: colMap.remark >= 0 ? String(row[colMap.remark] || '').trim() : '',
      transaction_type: colMap.type >= 0 ? String(row[colMap.type] || '').trim() : '',
      serial_no: colMap.serial >= 0 ? String(row[colMap.serial] || '').trim() : '',
      status: 'pending',
    });
  }

  return transactions;
}

export const transactionService = {
  async importTransactions(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    let transactions = [];
    if (ext === '.xlsx' || ext === '.xls') {
      transactions = await this.parseExcel(filePath);
    } else if (ext === '.csv') {
      transactions = this.parseCsv(filePath);
    } else {
      return { success: false, error: '不支持的文件格式' };
    }

    if (transactions.length === 0) {
      return { success: false, error: '未解析到有效交易记录' };
    }

    const ids = transactionRepository.createMany(transactions);

    return { success: true, count: transactions.length, ids };
  },

  async parseExcel(filePath) {
    const { default: XLSX } = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    return parseTransactionRows(data);
  },

  parseCsv(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const data = lines.map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
    return parseTransactionRows(data);
  },

  findAll(params) {
    return transactionRepository.findAll(params);
  },

  findById(id) {
    return transactionRepository.findById(id);
  },

  update(id, fields) {
    return transactionRepository.update(id, fields);
  },

  delete(id) {
    return transactionRepository.delete(id);
  },

  getStats() {
    return transactionRepository.getStats();
  },
};
