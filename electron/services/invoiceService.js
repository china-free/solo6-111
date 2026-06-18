import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { invoiceRepository } from '../repositories/invoiceRepository.js';
import { anomalyService } from './anomalyService.js';
import { statusService } from './statusService.js';
import { runPaddleOcr } from '../ocr/paddleOcr.js';
import { parseInvoiceFields, detectInvoiceCategory } from '../ocr/parser.js';
import { CONFIDENCE_THRESHOLD, SUPPORTED_INVOICE_FORMATS } from '../constants/index.js';

function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

export const invoiceService = {
  async importInvoices(filePaths) {
    const results = [];
    for (const filePath of filePaths) {
      try {
        const result = await this.importSingleInvoice(filePath);
        results.push(result);
      } catch (error) {
        results.push({ filePath, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success && !r.duplicate).length;
    const duplicateCount = results.filter(r => r.duplicate).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      results,
      total: filePaths.length,
      success: successCount,
      duplicate: duplicateCount,
      failed: failCount,
    };
  },

  async importSingleInvoice(filePath) {
    const validation = this.validateFile(filePath);
    if (!validation.valid) {
      return { filePath, success: false, error: validation.error };
    }

    const fileHash = calculateFileHash(filePath);
    const existing = this.checkDuplicate(fileHash);
    if (existing) {
      return {
        filePath,
        success: true,
        duplicate: true,
        invoiceId: existing.id,
        message: '票据已存在，跳过导入',
      };
    }

    const ocrResult = await runPaddleOcr(filePath);
    const ocrText = ocrResult.text || '';

    const evaluation = this.evaluateOcrResult(ocrResult, ocrText);

    const fileName = path.basename(filePath);
    const fileType = path.extname(filePath).toLowerCase().slice(1);
    const fileSize = fs.statSync(filePath).size;

    const invoiceId = invoiceRepository.create({
      file_path: filePath,
      file_name: fileName,
      file_hash: fileHash,
      file_type: fileType,
      file_size: fileSize,
      ocr_text: ocrText,
      invoice_no: evaluation.fields.invoice_no,
      invoice_code: evaluation.fields.invoice_code,
      amount: evaluation.fields.amount,
      tax_amount: evaluation.fields.tax_amount,
      total_amount: evaluation.fields.total_amount,
      invoice_date: evaluation.fields.invoice_date,
      seller_name: evaluation.fields.seller_name,
      seller_tax_no: evaluation.fields.seller_tax_no,
      buyer_name: evaluation.fields.buyer_name,
      buyer_tax_no: evaluation.fields.buyer_tax_no,
      category: evaluation.category,
      status: evaluation.status,
    });

    if (evaluation.anomaly) {
      anomalyService.create({
        typeKey: evaluation.anomaly.typeKey,
        invoiceId,
        description: evaluation.anomaly.description,
        detail: evaluation.anomaly.detail,
        severity: evaluation.anomaly.severity,
      });
    }

    return {
      filePath,
      success: true,
      duplicate: false,
      ocrFailed: evaluation.isOcrFailed,
      ocrEngineAvailable: ocrResult.ocrEngineAvailable,
      usedMock: ocrResult.usedMock,
      invoiceId,
      fields: evaluation.fields,
      category: evaluation.category,
      confidence: evaluation.fields.confidence,
      status: evaluation.status,
      anomaly: evaluation.anomaly ? { type: evaluation.anomaly.typeKey, severity: evaluation.anomaly.severity } : null,
    };
  },

  validateFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: '文件不存在' };
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_INVOICE_FORMATS.includes(ext)) {
      return { valid: false, error: '不支持的文件格式' };
    }
    return { valid: true };
  },

  checkDuplicate(fileHash) {
    return invoiceRepository.findByFileHash(fileHash);
  },

  evaluateOcrResult(ocrResult, ocrText) {
    const fields = parseInvoiceFields(ocrText);
    const category = detectInvoiceCategory(ocrText, fields);

    const isOcrFailed = !ocrResult.success;
    const isMissingKeyFields = !fields.total_amount || fields.total_amount <= 0 || !fields.invoice_date;
    const isOcrIncomplete = fields.confidence < CONFIDENCE_THRESHOLD.INCOMPLETE;

    let status = 'pending';
    let anomaly = null;

    if (isOcrFailed) {
      status = 'anomaly';
      let detail = ocrResult.error || 'OCR服务不可用或识别失败，请人工录入票据信息';
      if (ocrResult.usedMock) {
        detail += '（当前使用演示数据占位，非正式识别结果）';
      }
      anomaly = {
        typeKey: 'OCR_FAILED',
        severity: 'error',
        description: 'OCR识别失败',
        detail,
      };
    } else if (isMissingKeyFields) {
      status = 'anomaly';
      const missingFields = [];
      if (!fields.total_amount || fields.total_amount <= 0) missingFields.push('金额');
      if (!fields.invoice_date) missingFields.push('开票日期');
      anomaly = {
        typeKey: 'INCOMPLETE_OCR',
        severity: 'error',
        description: 'OCR结果缺少关键字段',
        detail: `缺少关键字段：${missingFields.join('、')}，识别置信度：${fields.confidence}%，请人工核对并补全信息`,
      };
    } else if (isOcrIncomplete) {
      status = 'anomaly';
      anomaly = {
        typeKey: 'INCOMPLETE_OCR',
        severity: 'warning',
        description: 'OCR识别结果置信度较低',
        detail: `识别置信度：${fields.confidence}%，建议人工核对关键信息`,
      };
    }

    return { fields, category, status, anomaly, isOcrFailed };
  },

  findAll(params) {
    return invoiceRepository.findAll(params);
  },

  findById(id) {
    return invoiceRepository.findById(id);
  },

  update(id, fields) {
    const changes = invoiceRepository.update(id, fields);

    const keyFieldsChanged =
      fields.total_amount !== undefined ||
      fields.invoice_date !== undefined;

    if (keyFieldsChanged) {
      const invoice = invoiceRepository.findById(id);
      if (invoice && invoice.status === 'anomaly' &&
          invoice.total_amount > 0 && invoice.invoice_date) {
        statusService.recalculateInvoiceStatus(id);
      }
    }

    return changes;
  },

  delete(id) {
    return invoiceRepository.delete(id);
  },

  getStats() {
    return invoiceRepository.getStats();
  },
};
