import { invoiceRepository } from '../repositories/invoiceRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { AMOUNT_TOLERANCE } from '../constants/index.js';

export const statusService = {
  recalculateInvoiceStatus(invoiceId) {
    const { matched_amount, match_count } = invoiceRepository.getMatchedAmount(invoiceId);
    const invoice = invoiceRepository.findById(invoiceId);
    if (!invoice) return;

    const status = this.determineInvoiceStatus(matched_amount, match_count, invoice.total_amount);
    invoiceRepository.updateStatus(invoiceId, status);
    return status;
  },

  recalculateTransactionStatus(transactionId) {
    const { matched_amount, match_count } = transactionRepository.getMatchedAmount(transactionId);
    const transaction = transactionRepository.findById(transactionId);
    if (!transaction) return;

    const absAmount = Math.abs(transaction.amount);
    const status = this.determineTransactionStatus(matched_amount, match_count, absAmount);
    transactionRepository.updateStatus(transactionId, status);
    return status;
  },

  determineInvoiceStatus(matchedAmount, matchCount, totalAmount) {
    if (matchCount === 0) return 'pending';

    if (totalAmount && Math.abs(matchedAmount - totalAmount) < AMOUNT_TOLERANCE) {
      return 'matched';
    }

    if (matchedAmount > 0) return 'partial';

    return 'pending';
  },

  determineTransactionStatus(matchedAmount, matchCount, absAmount) {
    if (matchCount === 0) return 'pending';

    if (Math.abs(matchedAmount - absAmount) < AMOUNT_TOLERANCE) {
      return 'matched';
    }

    if (matchedAmount > 0) return 'partial';

    return 'pending';
  },
};
