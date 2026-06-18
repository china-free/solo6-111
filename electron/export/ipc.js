import { ipcMain } from 'electron';
import { getDb } from '../database/index.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

export function registerExportIpc() {
  const db = getDb();

  ipcMain.handle('export:reconciliation', async (event, filePath, options = {}) => {
    try {
      const data = getReconciliationData(options);
      
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.xlsx' || ext === '.xls') {
        exportToExcel(filePath, data);
      } else if (ext === '.csv') {
        exportToCsv(filePath, data);
      } else {
        return { success: false, error: '不支持的导出格式' };
      }
      
      return { success: true, filePath, count: data.matches.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  function getReconciliationData(options) {
    const { includeUnmatched = true, includeAnomalies = true } = options;
    
    const matches = db.prepare(`
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
    
    const unmatchedInvoices = includeUnmatched ? db.prepare(`
      SELECT * FROM invoices WHERE status IN ('pending', 'partial', 'anomaly')
      ORDER BY imported_at DESC
    `).all() : [];
    
    const unmatchedTransactions = includeUnmatched ? db.prepare(`
      SELECT * FROM transactions WHERE status IN ('pending', 'partial', 'anomaly')
      ORDER BY transaction_date DESC
    `).all() : [];
    
    const anomalies = includeAnomalies ? db.prepare(`
      SELECT * FROM anomalies ORDER BY created_at DESC
    `).all() : [];
    
    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM invoices) as invoice_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices) as invoice_total,
        (SELECT COUNT(*) FROM transactions) as transaction_count,
        (SELECT COALESCE(SUM(ABS(amount)), 0) FROM transactions WHERE amount < 0) as transaction_total,
        (SELECT COUNT(*) FROM matches WHERE status = 'confirmed') as match_count,
        (SELECT COALESCE(SUM(matched_amount), 0) FROM matches WHERE status = 'confirmed') as match_total,
        (SELECT COUNT(*) FROM anomalies WHERE status = 'open') as open_anomalies
    `).get();
    
    return {
      matches,
      unmatchedInvoices,
      unmatchedTransactions,
      anomalies,
      stats,
    };
  }

  function exportToExcel(filePath, data) {
    const wb = XLSX.utils.book_new();
    
    const summaryData = [
      ['对账汇总'],
      [],
      ['统计项', '数量', '金额'],
      ['票据总数', data.stats.invoice_count, data.stats.invoice_total],
      ['流水总数', data.stats.transaction_count, data.stats.transaction_total],
      ['已匹配', data.stats.match_count, data.stats.match_total],
      ['待处理异常', data.stats.open_anomalies, ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, '汇总');
    
    if (data.matches.length > 0) {
      const matchHeaders = [
        '匹配ID', '匹配时间', '匹配类型', '匹配金额', '匹配分数',
        '票据文件名', '发票号码', '发票日期', '票据金额', '销售方',
        '流水日期', '流水金额', '交易对手', '摘要', '备注'
      ];
      
      const matchRows = data.matches.map(m => [
        m.match_id,
        m.matched_at,
        m.match_type === 'auto' ? '自动匹配' : '人工匹配',
        m.matched_amount,
        m.match_score,
        m.file_name,
        m.invoice_no,
        m.invoice_date,
        m.invoice_total,
        m.seller_name,
        m.transaction_date,
        m.transaction_amount,
        m.counterparty_name,
        m.summary,
        m.remark,
      ]);
      
      const ws2 = XLSX.utils.aoa_to_sheet([matchHeaders, ...matchRows]);
      ws2['!cols'] = Array(15).fill({ wch: 15 });
      XLSX.utils.book_append_sheet(wb, ws2, '已匹配记录');
    }
    
    if (data.unmatchedInvoices.length > 0) {
      const invoiceHeaders = ['ID', '文件名', '发票号码', '开票日期', '金额', '销售方', '状态', '类别'];
      const invoiceRows = data.unmatchedInvoices.map(i => [
        i.id, i.file_name, i.invoice_no, i.invoice_date, 
        i.total_amount, i.seller_name, getStatusText(i.status), i.category
      ]);
      
      const ws3 = XLSX.utils.aoa_to_sheet([invoiceHeaders, ...invoiceRows]);
      ws3['!cols'] = Array(8).fill({ wch: 18 });
      XLSX.utils.book_append_sheet(wb, ws3, '未匹配票据');
    }
    
    if (data.unmatchedTransactions.length > 0) {
      const transHeaders = ['ID', '日期', '金额', '交易对手', '摘要', '备注', '状态'];
      const transRows = data.unmatchedTransactions.map(t => [
        t.id, t.transaction_date, t.amount, 
        t.counterparty_name, t.summary, t.remark, getStatusText(t.status)
      ]);
      
      const ws4 = XLSX.utils.aoa_to_sheet([transHeaders, ...transRows]);
      ws4['!cols'] = Array(7).fill({ wch: 18 });
      XLSX.utils.book_append_sheet(wb, ws4, '未匹配流水');
    }
    
    if (data.anomalies.length > 0) {
      const anomalyHeaders = ['ID', '类型', '严重程度', '描述', '详情', '状态', '创建时间'];
      const anomalyRows = data.anomalies.map(a => [
        a.id, getAnomalyTypeText(a.type), getSeverityText(a.severity),
        a.description, a.detail, a.status === 'open' ? '未处理' : '已解决',
        a.created_at
      ]);
      
      const ws5 = XLSX.utils.aoa_to_sheet([anomalyHeaders, ...anomalyRows]);
      ws5['!cols'] = Array(7).fill({ wch: 20 });
      XLSX.utils.book_append_sheet(wb, ws5, '异常记录');
    }
    
    XLSX.writeFile(wb, filePath);
  }

  function exportToCsv(filePath, data) {
    if (data.matches.length > 0) {
      const headers = [
        '匹配ID', '匹配时间', '匹配类型', '匹配金额',
        '票据文件名', '发票号码', '发票日期', '票据金额', '销售方',
        '流水日期', '流水金额', '交易对手', '摘要'
      ];
      
      const rows = data.matches.map(m => [
        m.match_id, m.matched_at, m.match_type === 'auto' ? '自动匹配' : '人工匹配',
        m.matched_amount, m.file_name, m.invoice_no, m.invoice_date,
        m.invoice_total, m.seller_name, m.transaction_date,
        m.transaction_amount, m.counterparty_name, m.summary
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
      ].join('\n');
      
      fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8');
    }
  }

  function getStatusText(status) {
    const statusMap = {
      'pending': '待匹配',
      'matched': '已匹配',
      'partial': '部分匹配',
      'anomaly': '异常',
    };
    return statusMap[status] || status;
  }

  function getAnomalyTypeText(type) {
    const typeMap = {
      'ocr_failed': 'OCR识别失败',
      'duplicate_invoice': '重复票据',
      'incomplete_ocr': 'OCR识别不完整',
      'amount_mismatch': '金额不匹配',
      'duplicate_amount': '同金额多笔',
      'split_payment': '拆分报销',
      'over_payment': '超额匹配',
    };
    return typeMap[type] || type;
  }

  function getSeverityText(severity) {
    const severityMap = {
      'error': '错误',
      'warning': '警告',
      'info': '提示',
    };
    return severityMap[severity] || severity;
  }
}
