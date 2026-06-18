import { anomalyRepository } from '../repositories/anomalyRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { matchRepository } from '../repositories/matchRepository.js';
import { invoiceRepository } from '../repositories/invoiceRepository.js';
import { statusService } from './statusService.js';
import { ANOMALY_TYPES } from '../constants/index.js';

export const anomalyService = {
  create(anomalyData) {
    const typeInfo = ANOMALY_TYPES[anomalyData.typeKey] || ANOMALY_TYPES.INCOMPLETE_OCR;

    if (anomalyData.invoiceId) {
      const existing = anomalyRepository.findOpenByTypeAndInvoice(typeInfo.key, anomalyData.invoiceId);
      if (existing) return existing.id;
    }

    if (anomalyData.transactionId) {
      const existing = anomalyRepository.findOpenByTypeAndTransaction(typeInfo.key, anomalyData.transactionId);
      if (existing) return existing.id;
    }

    return anomalyRepository.create({
      type: typeInfo.key,
      severity: anomalyData.severity || typeInfo.defaultSeverity,
      invoice_id: anomalyData.invoiceId,
      transaction_id: anomalyData.transactionId,
      match_id: anomalyData.matchId,
      description: anomalyData.description,
      detail: anomalyData.detail,
    });
  },

  createIfNotExists(typeKey, { invoiceId, transactionId, matchId, description, detail, severity }) {
    const typeInfo = ANOMALY_TYPES[typeKey];
    if (!typeInfo) return null;

    if (invoiceId) {
      const existing = anomalyRepository.findOpenByTypeAndInvoice(typeInfo.key, invoiceId);
      if (existing) return existing.id;
    }

    if (transactionId) {
      const existing = anomalyRepository.findOpenByTypeAndTransaction(typeInfo.key, transactionId);
      if (existing) return existing.id;
    }

    return anomalyRepository.create({
      type: typeInfo.key,
      severity: severity || typeInfo.defaultSeverity,
      invoice_id: invoiceId,
      transaction_id: transactionId,
      match_id: matchId,
      description,
      detail,
    });
  },

  resolve(id, resolution) {
    const anomaly = anomalyRepository.findById(id);
    if (!anomaly) return 0;

    const changes = anomalyRepository.resolve(id, resolution || '已处理');

    this.writebackAfterResolve(anomaly);

    return changes;
  },

  writebackAfterResolve(anomaly) {
    if (!anomaly.invoice_id) return;

    const ocrRelatedTypes = ['ocr_failed', 'incomplete_ocr'];
    if (!ocrRelatedTypes.includes(anomaly.type)) return;

    const invoice = invoiceRepository.findById(anomaly.invoice_id);
    if (!invoice || invoice.status !== 'anomaly') return;

    if (invoice.total_amount > 0 && invoice.invoice_date) {
      statusService.recalculateInvoiceStatus(anomaly.invoice_id);
    }
  },

  findAll(params) {
    return anomalyRepository.findAll(params);
  },

  getStats() {
    return anomalyRepository.getStats();
  },

  getOpenCount() {
    return anomalyRepository.getOpenCount();
  },

  checkDuplicateAmounts() {
    const duplicates = transactionRepository.findPendingByAmount();
    let count = 0;

    for (const dup of duplicates) {
      if (dup.cnt >= 2) {
        const sameAmountTrans = transactionRepository.findByAmount(dup.amount);
        for (const trans of sameAmountTrans) {
          const created = this.createIfNotExists('DUPLICATE_AMOUNT', {
            transactionId: trans.id,
            description: '同金额多笔流水',
            detail: `金额 ${dup.amount} 有 ${dup.cnt} 笔流水，可能造成匹配冲突，请人工确认`,
          });
          if (created) count++;
        }
      }
    }

    return count;
  },

  checkSplitReconciliation(invoiceId) {
    const matches = matchRepository.findConfirmedByInvoiceId(invoiceId);
    if (matches.length < 2) return null;

    return this.createIfNotExists('SPLIT_PAYMENT', {
      invoiceId,
      description: '一张票据对应多笔流水（拆分报销）',
      detail: `该票据已匹配 ${matches.length} 笔流水，请注意核对是否为拆分报销`,
    });
  },

  checkAmountMismatch(invoiceId, transactionId, matchId, invoiceAmount, transactionAmount) {
    const diff = Math.abs(invoiceAmount - transactionAmount);
    if (diff <= 0.01) return null;

    return this.createIfNotExists('AMOUNT_MISMATCH', {
      invoiceId,
      transactionId,
      matchId,
      description: '金额不完全匹配',
      detail: `票据金额：${invoiceAmount}，流水金额：${transactionAmount}，差额：${diff}`,
    });
  },
};
