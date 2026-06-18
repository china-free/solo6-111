import dayjs from 'dayjs';
import { matchRepository } from '../repositories/matchRepository.js';
import { invoiceRepository } from '../repositories/invoiceRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { statusService } from './statusService.js';
import { anomalyService } from './anomalyService.js';
import { MATCH_SCORE, AMOUNT_TOLERANCE } from '../constants/index.js';

function normalizeName(name) {
  return name ? name.replace(/[（(].*?[)）]/g, '').substring(0, 8) : '';
}

function calculateScore(invoice, transaction) {
  const invoiceAmount = invoice.total_amount || 0;
  const transAmount = Math.abs(transaction.amount);

  if (transAmount <= 0) return 0;

  const amountRatio = invoiceAmount > 0 && transAmount > 0
    ? Math.min(invoiceAmount, transAmount) / Math.max(invoiceAmount, transAmount)
    : 0;

  const daysDiff = invoice.invoice_date && transaction.transaction_date
    ? Math.abs(dayjs(invoice.invoice_date).diff(dayjs(transaction.transaction_date), 'day'))
    : 999;

  let score = 0;

  if (amountRatio > 0.99) score += MATCH_SCORE.AMOUNT_EXACT;
  else if (amountRatio > 0.95) score += MATCH_SCORE.AMOUNT_CLOSE;
  else if (amountRatio > 0.8) score += MATCH_SCORE.AMOUNT_ROUGH;

  if (daysDiff <= 3) score += MATCH_SCORE.DATE_CLOSE;
  else if (daysDiff <= 7) score += MATCH_SCORE.DATE_NEAR;
  else if (daysDiff <= 15) score += MATCH_SCORE.DATE_FAR;
  else if (daysDiff <= 30) score += MATCH_SCORE.DATE_DISTANT;

  if (invoice.seller_name && transaction.counterparty_name) {
    const sellerShort = normalizeName(invoice.seller_name);
    const counterpartyShort = normalizeName(transaction.counterparty_name);
    if (sellerShort && counterpartyShort &&
        (sellerShort.includes(counterpartyShort) || counterpartyShort.includes(sellerShort))) {
      score += MATCH_SCORE.COUNTERPARTY_MATCH;
    }
  }

  return { score, amountDiff: Math.abs(invoiceAmount - transAmount), daysDiff };
}

export const matchService = {
  runAutoMatch() {
    const unmatchedInvoices = invoiceRepository.findUnmatched();
    const unmatchedTransactions = transactionRepository.findUnmatched();

    let matchCount = 0;
    let anomalyCount = 0;
    const matchedPairs = [];
    const usedTransactions = new Set();

    for (const invoice of unmatchedInvoices) {
      let bestMatch = null;
      let bestScore = 0;
      let bestResult = null;

      for (const transaction of unmatchedTransactions) {
        if (usedTransactions.has(transaction.id)) continue;

        const result = calculateScore(invoice, transaction);

        if (result.score > bestScore && result.score >= MATCH_SCORE.CANDIDATE_THRESHOLD) {
          bestScore = result.score;
          bestMatch = transaction;
          bestResult = result;
        }
      }

      if (bestMatch && bestScore >= MATCH_SCORE.MIN_THRESHOLD) {
        const matchAmount = Math.min(invoice.total_amount, Math.abs(bestMatch.amount));
        const matchId = this.createMatch(invoice.id, bestMatch.id, matchAmount, 'auto', bestScore);

        if (matchId) {
          usedTransactions.add(bestMatch.id);
          matchCount++;
          matchedPairs.push({
            invoiceId: invoice.id,
            transactionId: bestMatch.id,
            amount: matchAmount,
            score: bestScore,
          });

          const diff = Math.abs(invoice.total_amount - Math.abs(bestMatch.amount));
          if (diff > AMOUNT_TOLERANCE) {
            anomalyService.checkAmountMismatch(
              invoice.id, bestMatch.id, matchId,
              invoice.total_amount, Math.abs(bestMatch.amount)
            );
            anomalyCount++;
          }
        }
      }
    }

    anomalyService.checkDuplicateAmounts();

    return {
      success: true,
      matchCount,
      anomalyCount,
      matchedPairs,
      totalInvoices: unmatchedInvoices.length,
      totalTransactions: unmatchedTransactions.length,
    };
  },

  getInvoiceCandidates(invoiceId) {
    const invoice = invoiceRepository.findById(invoiceId);
    if (!invoice) return [];

    const transactions = transactionRepository.findUnmatched();

    const candidates = transactions.map(t => {
      const result = calculateScore(invoice, t);
      return { ...t, matchScore: result.score, amountDiff: result.amountDiff, daysDiff: result.daysDiff };
    });

    candidates.sort((a, b) => b.matchScore - a.matchScore);
    return candidates.slice(0, 20);
  },

  getTransactionCandidates(transactionId) {
    const transaction = transactionRepository.findById(transactionId);
    if (!transaction) return [];

    const invoices = invoiceRepository.findUnmatched();

    const candidates = invoices.map(inv => {
      const result = calculateScore(inv, transaction);
      return { ...inv, matchScore: result.score, amountDiff: result.amountDiff, daysDiff: result.daysDiff };
    });

    candidates.sort((a, b) => b.matchScore - a.matchScore);
    return candidates.slice(0, 20);
  },

  createMatch(invoiceId, transactionId, amount, type = 'manual', score = 0) {
    const matchId = matchRepository.create({
      invoice_id: invoiceId,
      transaction_id: transactionId,
      matched_amount: amount,
      match_type: type,
      match_score: score,
      status: 'confirmed',
    });

    statusService.recalculateInvoiceStatus(invoiceId);
    statusService.recalculateTransactionStatus(transactionId);

    anomalyService.checkSplitReconciliation(invoiceId);

    return matchId;
  },

  unmatch(matchId) {
    const match = matchRepository.findById(matchId);
    if (!match) return { success: false, error: '匹配记录不存在' };

    matchRepository.delete(matchId);

    statusService.recalculateInvoiceStatus(match.invoice_id);
    statusService.recalculateTransactionStatus(match.transaction_id);

    return { success: true };
  },

  findAll(params) {
    return matchRepository.findAll(params);
  },

  findByInvoiceId(invoiceId) {
    return matchRepository.findByInvoiceId(invoiceId);
  },

  findByTransactionId(transactionId) {
    return matchRepository.findByTransactionId(transactionId);
  },

  getStats() {
    return matchRepository.getStats();
  },
};
