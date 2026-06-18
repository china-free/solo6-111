import { ipcMain } from 'electron';
import { invoiceService } from '../services/invoiceService.js';
import { transactionService } from '../services/transactionService.js';

export function registerImportIpc() {
  ipcMain.handle('import:invoiceFiles', async (event, filePaths) => {
    return invoiceService.importInvoices(filePaths);
  });

  ipcMain.handle('import:transactions', async (event, filePath) => {
    return transactionService.importTransactions(filePath);
  });
}
