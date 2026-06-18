export const ANOMALY_TYPES = {
  OCR_FAILED: {
    key: 'ocr_failed',
    label: 'OCR识别失败',
    icon: '❌',
    color: 'error',
    defaultSeverity: 'error',
  },
  DUPLICATE_INVOICE: {
    key: 'duplicate_invoice',
    label: '重复票据',
    icon: '📋',
    color: 'warning',
    defaultSeverity: 'warning',
  },
  INCOMPLETE_OCR: {
    key: 'incomplete_ocr',
    label: 'OCR识别不完整',
    icon: '🔍',
    color: 'warning',
    defaultSeverity: 'warning',
  },
  AMOUNT_MISMATCH: {
    key: 'amount_mismatch',
    label: '金额不匹配',
    icon: '💰',
    color: 'error',
    defaultSeverity: 'warning',
  },
  DUPLICATE_AMOUNT: {
    key: 'duplicate_amount',
    label: '同金额多笔流水',
    icon: '💳',
    color: 'warning',
    defaultSeverity: 'warning',
  },
  SPLIT_PAYMENT: {
    key: 'split_payment',
    label: '拆分报销',
    icon: '📊',
    color: 'info',
    defaultSeverity: 'info',
  },
  OVER_PAYMENT: {
    key: 'over_payment',
    label: '超额匹配',
    icon: '⚠️',
    color: 'error',
    defaultSeverity: 'error',
  },
};

export const INVOICE_STATUS = {
  PENDING: { key: 'pending', label: '待匹配' },
  MATCHED: { key: 'matched', label: '已匹配' },
  PARTIAL: { key: 'partial', label: '部分匹配' },
  ANOMALY: { key: 'anomaly', label: '异常' },
};

export const TRANSACTION_STATUS = {
  PENDING: { key: 'pending', label: '待匹配' },
  MATCHED: { key: 'matched', label: '已匹配' },
  PARTIAL: { key: 'partial', label: '部分匹配' },
  ANOMALY: { key: 'anomaly', label: '异常' },
};

export const SEVERITY = {
  ERROR: { key: 'error', label: '严重' },
  WARNING: { key: 'warning', label: '警告' },
  INFO: { key: 'info', label: '提示' },
};

export const MATCH_TYPE = {
  AUTO: { key: 'auto', label: '自动匹配' },
  MANUAL: { key: 'manual', label: '人工匹配' },
};

export const ANOMALY_STATUS = {
  OPEN: { key: 'open', label: '待处理' },
  RESOLVED: { key: 'resolved', label: '已处理' },
};

export function getAnomalyTypeInfo(typeKey) {
  const entry = Object.values(ANOMALY_TYPES).find(t => t.key === typeKey);
  return entry || { key: typeKey, label: typeKey, icon: '❓', color: 'info', defaultSeverity: 'info' };
}

export function getStatusLabel(status) {
  const all = { ...INVOICE_STATUS, ...TRANSACTION_STATUS };
  const entry = Object.values(all).find(s => s.key === status);
  return entry ? entry.label : status;
}

export function getSeverityLabel(severity) {
  const entry = Object.values(SEVERITY).find(s => s.key === severity);
  return entry ? entry.label : severity;
}

export function getMatchTypeLabel(type) {
  const entry = Object.values(MATCH_TYPE).find(t => t.key === type);
  return entry ? entry.label : type;
}

export function getAnomalyStatusLabel(status) {
  const entry = Object.values(ANOMALY_STATUS).find(s => s.key === status);
  return entry ? entry.label : status;
}

export const CONFIDENCE_THRESHOLD = {
  INCOMPLETE: 30,
};

export const MATCH_SCORE = {
  AMOUNT_EXACT: 50,
  AMOUNT_CLOSE: 30,
  AMOUNT_ROUGH: 15,
  DATE_CLOSE: 30,
  DATE_NEAR: 20,
  DATE_FAR: 10,
  DATE_DISTANT: 5,
  COUNTERPARTY_MATCH: 20,
  MIN_THRESHOLD: 50,
  CANDIDATE_THRESHOLD: 40,
};

export const AMOUNT_TOLERANCE = 0.01;

export const SUPPORTED_INVOICE_FORMATS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.pdf'];
