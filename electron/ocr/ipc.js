import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseInvoiceFields } from '../ocr/parser.js';
import { runPaddleOcr } from '../ocr/paddleOcr.js';

async function recognizeSingleFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('文件不存在');
  }
  
  const ext = path.extname(filePath).toLowerCase();
  
  if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.pdf'].includes(ext)) {
    const text = await runPaddleOcr(filePath);
    const fields = parseInvoiceFields(text);
    
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    
    return {
      success: true,
      text,
      fields,
      fileHash,
    };
  }
  
  return {
    success: false,
    error: '不支持的文件格式',
  };
}

export function registerOcrIpc() {
  ipcMain.handle('ocr:recognizeFile', async (event, filePath) => {
    try {
      return await recognizeSingleFile(filePath);
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('ocr:recognizeFiles', async (event, filePaths) => {
    const results = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await recognizeSingleFile(filePath);
        results.push({ filePath, ...result });
      } catch (error) {
        results.push({ filePath, success: false, error: error.message });
      }
    }
    
    return results;
  });

  ipcMain.handle('ocr:parseInvoiceFields', async (event, text) => {
    try {
      const fields = parseInvoiceFields(text);
      return {
        success: true,
        fields,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });
}
