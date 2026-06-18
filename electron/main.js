import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './database/index.js';
import { registerDatabaseIpc } from './database/ipc.js';
import { registerOcrIpc } from './ocr/ipc.js';
import { registerImportIpc } from './import/ipc.js';
import { registerMatchIpc } from './match/ipc.js';
import { registerExportIpc } from './export/ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '财务对账助手',
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase();
  
  registerDatabaseIpc();
  registerOcrIpc();
  registerImportIpc();
  registerMatchIpc();
  registerExportIpc();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('dialog:openFiles', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    ...options,
    properties: ['openFile', 'multiSelections'],
  });
  return result;
});

ipcMain.handle('dialog:openDirectory', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    ...options,
    properties: ['openDirectory'],
  });
  return result;
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});
