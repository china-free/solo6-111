import fs from 'fs';
import path from 'path';
import { matchRepository } from '../repositories/matchRepository.js';
import { invoiceRepository } from '../repositories/invoiceRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { anomalyRepository } from '../repositories/anomalyRepository.js';
import {
  getStatusLabel,
  getAnomalyTypeInfo,
  getSeverityLabel,
  getMatchTypeLabel,
  getAnomalyStatusLabel,
} from '../constants/index.js';

export const exportService = {
  async exportReconciliation(filePath, options = {}) {
    const data = this.getReconciliationData(options);

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') {
      await this.exportToExcel(filePath, data);
    } else if (ext === '.csv') {
      this.exportToCsv(filePath, data);
    } else {
      return { success: false, error: '不支持的导出格式' };
    }

    return { success: true, filePath, count: data.matches.length };
  },

  getReconciliationData(options) {
    const { includeUnmatched = true, includeAnomalies = true } = options;

    const matches = matchRepository.findForExport();
    const unmatchedInvoices = includeUnmatched ? invoiceRepository.findUnmatchedForExport() : [];
    const unmatchedTransactions = includeUnmatched ? transactionRepository.findUnmatchedForExport() : [];
    const anomalies = includeAnomalies ? anomalyRepository.findForExport() : [];

    const invoiceStats = invoiceRepository.getStats();
    const transactionStats = transactionRepository.getStats();
    const matchStats = matchRepository.getStats();
    const anomalyStats = anomalyRepository.getStats();

    const stats = {
      invoice_count: invoiceStats.total,
      invoice_total: invoiceStats.total_amount,
      transaction_count: transactionStats.total,
      transaction_total: transactionStats.payment_total,
      match_count: matchStats.total,
      match_total: matchStats.total_matched_amount,
      open_anomalies: anomalyStats.open,
    };

    return { matches, unmatchedInvoices, unmatchedTransactions, anomalies, stats };
  },

  async exportToExcel(filePath, data) {
    const { default: XLSX } = await import('xlsx');
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
        getMatchTypeLabel(m.match_type),
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
        i.total_amount, i.seller_name, getStatusLabel(i.status), i.category
      ]);

      const ws3 = XLSX.utils.aoa_to_sheet([invoiceHeaders, ...invoiceRows]);
      ws3['!cols'] = Array(8).fill({ wch: 18 });
      XLSX.utils.book_append_sheet(wb, ws3, '未匹配票据');
    }

    if (data.unmatchedTransactions.length > 0) {
      const transHeaders = ['ID', '日期', '金额', '交易对手', '摘要', '备注', '状态'];
      const transRows = data.unmatchedTransactions.map(t => [
        t.id, t.transaction_date, t.amount,
        t.counterparty_name, t.summary, t.remark, getStatusLabel(t.status)
      ]);

      const ws4 = XLSX.utils.aoa_to_sheet([transHeaders, ...transRows]);
      ws4['!cols'] = Array(7).fill({ wch: 18 });
      XLSX.utils.book_append_sheet(wb, ws4, '未匹配流水');
    }

    if (data.anomalies.length > 0) {
      const anomalyHeaders = ['ID', '类型', '严重程度', '描述', '详情', '状态', '创建时间'];
      const anomalyRows = data.anomalies.map(a => [
        a.id, getAnomalyTypeInfo(a.type).label, getSeverityLabel(a.severity),
        a.description, a.detail, getAnomalyStatusLabel(a.status),
        a.created_at
      ]);

      const ws5 = XLSX.utils.aoa_to_sheet([anomalyHeaders, ...anomalyRows]);
      ws5['!cols'] = Array(7).fill({ wch: 20 });
      XLSX.utils.book_append_sheet(wb, ws5, '异常记录');
    }

    XLSX.writeFile(wb, filePath);
  },

  exportToCsv(filePath, data) {
    if (data.matches.length === 0) return;

    const headers = [
      '匹配ID', '匹配时间', '匹配类型', '匹配金额',
      '票据文件名', '发票号码', '发票日期', '票据金额', '销售方',
      '流水日期', '流水金额', '交易对手', '摘要'
    ];

    const rows = data.matches.map(m => [
      m.match_id, m.matched_at, getMatchTypeLabel(m.match_type),
      m.matched_amount, m.file_name, m.invoice_no, m.invoice_date,
      m.invoice_total, m.seller_name, m.transaction_date,
      m.transaction_amount, m.counterparty_name, m.summary
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');

    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8');
  },
};
