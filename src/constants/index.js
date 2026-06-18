export const ANOMALY_TYPES = {
  ocr_failed: { label: 'OCR识别失败', icon: '❌', color: 'error', severity: 'error' },
  duplicate_invoice: { label: '重复票据', icon: '📋', color: 'warning', severity: 'warning' },
  incomplete_ocr: { label: 'OCR识别不完整', icon: '🔍', color: 'warning', severity: 'warning' },
  amount_mismatch: { label: '金额不匹配', icon: '💰', color: 'error', severity: 'warning' },
  duplicate_amount: { label: '同金额多笔流水', icon: '💳', color: 'warning', severity: 'warning' },
  split_payment: { label: '拆分报销', icon: '📊', color: 'info', severity: 'info' },
  over_payment: { label: '超额匹配', icon: '⚠️', color: 'error', severity: 'error' },
};

export const STATUS_MAP = {
  pending: '待匹配',
  matched: '已匹配',
  partial: '部分匹配',
  anomaly: '异常',
};

export const SEVERITY_MAP = {
  error: { label: '严重', class: 'severity-error' },
  warning: { label: '警告', class: 'severity-warning' },
  info: { label: '提示', class: 'severity-info' },
};

export const MATCH_TYPE_MAP = {
  auto: '自动匹配',
  manual: '人工匹配',
};

export const ANOMALY_STATUS_MAP = {
  open: '待处理',
  resolved: '已处理',
};

export function getStatusLabel(status) {
  return STATUS_MAP[status] || status;
}

export function getAnomalyTypeInfo(type) {
  return ANOMALY_TYPES[type] || { label: type, icon: '❓', color: 'info', severity: 'info' };
}

export function getSeverityInfo(severity) {
  return SEVERITY_MAP[severity] || { label: severity, class: 'severity-info' };
}

export function getMatchTypeLabel(type) {
  return MATCH_TYPE_MAP[type] || type;
}

export function getAnomalyStatusLabel(status) {
  return ANOMALY_STATUS_MAP[status] || status;
}
