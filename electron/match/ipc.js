import { ipcMain } from 'electron';
import { matchService } from '../services/matchService.js';

export function registerMatchIpc() {
  ipcMain.handle('match:auto', async () => {
    return matchService.runAutoMatch();
  });

  ipcMain.handle('match:candidates', async (event, type, id) => {
    if (type === 'invoice') {
      return matchService.getInvoiceCandidates(id);
    } else {
      return matchService.getTransactionCandidates(id);
    }
  });

  ipcMain.handle('match:manual', async (event, invoiceId, transactionId, amount) => {
    const matchId = matchService.createMatch(invoiceId, transactionId, amount, 'manual');
    return { success: true, matchId };
  });

  ipcMain.handle('match:unmatch', async (event, matchId) => {
    return matchService.unmatch(matchId);
  });
}
