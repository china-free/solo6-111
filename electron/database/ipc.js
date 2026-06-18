import { ipcMain } from 'electron';
import { invoiceRepository } from '../repositories/invoiceRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { matchRepository } from '../repositories/matchRepository.js';
import { anomalyRepository } from '../repositories/anomalyRepository.js';
import { invoiceService } from '../services/invoiceService.js';
import { anomalyService } from '../services/anomalyService.js';
import { statusService } from '../services/statusService.js';

export function registerDatabaseIpc() {
  ipcMain.handle('db:getInvoices', async (event, params = {}) => {
    return invoiceRepository.findAll(params);
  });

  ipcMain.handle('db:getInvoiceById', async (event, id) => {
    return invoiceRepository.findById(id);
  });

  ipcMain.handle('db:addInvoice', async (event, invoice) => {
    const id = invoiceRepository.create(invoice);
    return { id };
  });

  ipcMain.handle('db:updateInvoice', async (event, id, fields) => {
    const changes = invoiceService.update(id, fields);
    return { changed: changes };
  });

  ipcMain.handle('db:deleteInvoice', async (event, id) => {
    const changes = invoiceRepository.delete(id);
    return { changed: changes };
  });

  ipcMain.handle('db:getInvoiceByFileHash', async (event, hash) => {
    return invoiceRepository.findByFileHash(hash);
  });

  ipcMain.handle('db:getTransactions', async (event, params = {}) => {
    return transactionRepository.findAll(params);
  });

  ipcMain.handle('db:getTransactionById', async (event, id) => {
    return transactionRepository.findById(id);
  });

  ipcMain.handle('db:addTransaction', async (event, transaction) => {
    const ids = transactionRepository.createMany([transaction]);
    return { id: ids[0] };
  });

  ipcMain.handle('db:addTransactions', async (event, transactions) => {
    const ids = transactionRepository.createMany(transactions);
    return { ids, count: ids.length };
  });

  ipcMain.handle('db:updateTransaction', async (event, id, fields) => {
    const changes = transactionRepository.update(id, fields);
    return { changed: changes };
  });

  ipcMain.handle('db:deleteTransaction', async (event, id) => {
    const changes = transactionRepository.delete(id);
    return { changed: changes };
  });

  ipcMain.handle('db:getMatches', async (event, params = {}) => {
    return matchRepository.findAll(params);
  });

  ipcMain.handle('db:addMatch', async (event, match) => {
    const matchId = matchRepository.create(match);
    statusService.recalculateInvoiceStatus(match.invoice_id);
    statusService.recalculateTransactionStatus(match.transaction_id);
    return { id: matchId };
  });

  ipcMain.handle('db:updateMatch', async (event, id, fields) => {
    const changes = matchRepository.update(id, fields);
    return { changed: changes };
  });

  ipcMain.handle('db:deleteMatch', async (event, id) => {
    const match = matchRepository.findById(id);
    const changes = matchRepository.delete(id);
    if (match) {
      statusService.recalculateInvoiceStatus(match.invoice_id);
      statusService.recalculateTransactionStatus(match.transaction_id);
    }
    return { changed: changes };
  });

  ipcMain.handle('db:getMatchesByInvoiceId', async (event, invoiceId) => {
    return matchRepository.findByInvoiceId(invoiceId);
  });

  ipcMain.handle('db:getMatchesByTransactionId', async (event, transactionId) => {
    return matchRepository.findByTransactionId(transactionId);
  });

  ipcMain.handle('db:getAnomalies', async (event, params = {}) => {
    return anomalyRepository.findAll(params);
  });

  ipcMain.handle('db:addAnomaly', async (event, anomaly) => {
    const id = anomalyRepository.create(anomaly);
    return { id };
  });

  ipcMain.handle('db:updateAnomaly', async (event, id, fields) => {
    const changes = anomalyRepository.update(id, fields);
    return { changed: changes };
  });

  ipcMain.handle('db:resolveAnomaly', async (event, id, resolution) => {
    const changes = anomalyService.resolve(id, resolution);
    return { changed: changes };
  });

  ipcMain.handle('db:getStats', async () => {
    return {
      invoices: invoiceRepository.getStats(),
      transactions: transactionRepository.getStats(),
      matches: matchRepository.getStats(),
      anomalies: anomalyRepository.getStats(),
    };
  });
}
