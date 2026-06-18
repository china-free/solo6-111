import { ipcMain } from 'electron';
import { exportService } from '../services/exportService.js';

export function registerExportIpc() {
  ipcMain.handle('export:reconciliation', async (event, filePath, options) => {
    return exportService.exportReconciliation(filePath, options);
  });
}
