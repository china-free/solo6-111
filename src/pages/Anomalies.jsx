import React, { useState, useEffect } from 'react';
import '../styles/anomalies.css';

function Anomalies({ onUpdate }) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: 'open',
    type: '',
    severity: '',
  });
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [resolutionText, setResolutionText] = useState('');

  useEffect(() => {
    loadAnomalies();
  }, [pagination.page, pagination.pageSize, filters]);

  const loadAnomalies = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.database) {
        const result = await window.electronAPI.database.getAnomalies({
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...filters,
        });
        setAnomalies(result.list || []);
        setPagination(prev => ({ ...prev, total: result.total || 0 }));
      }
    } catch (e) {
      console.error('加载异常列表失败:', e);
    }
    setLoading(false);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleResolve = (anomaly) => {
    setSelectedAnomaly(anomaly);
    setResolutionText('');
  };

  const submitResolve = async () => {
    if (!selectedAnomaly) return;
    
    try {
      await window.electronAPI.database.resolveAnomaly(
        selectedAnomaly.id,
        resolutionText || '已处理'
      );
      setSelectedAnomaly(null);
      setResolutionText('');
      loadAnomalies();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('处理异常失败:', e);
    }
  };

  const getTypeInfo = (type) => {
    const typeMap = {
      'duplicate_invoice': { label: '重复票据', icon: '📋', color: 'warning' },
      'incomplete_ocr': { label: 'OCR识别不完整', icon: '🔍', color: 'warning' },
      'amount_mismatch': { label: '金额不匹配', icon: '💰', color: 'error' },
      'duplicate_amount': { label: '同金额多笔流水', icon: '💳', color: 'warning' },
      'split_payment': { label: '拆分报销', icon: '📊', color: 'info' },
      'over_payment': { label: '超额匹配', icon: '⚠️', color: 'error' },
    };
    return typeMap[type] || { label: type, icon: '❓', color: 'info' };
  };

  const getSeverityInfo = (severity) => {
    const severityMap = {
      'error': { label: '严重', class: 'severity-error' },
      'warning': { label: '警告', class: 'severity-warning' },
      'info': { label: '提示', class: 'severity-info' },
    };
    return severityMap[severity] || { label: severity, class: 'severity-info' };
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const stats = [
    { label: '待处理', value: anomalies.filter(a => a.status === 'open').length, type: 'open' },
    { label: '已处理', value: anomalies.filter(a => a.status === 'resolved').length, type: 'resolved' },
  ];

  return (
    <div className="anomalies-page">
      <div className="page-header">
        <div className="header-left">
          <h2>异常处理</h2>
          <p>集中管理对账过程中的异常情况</p>
        </div>
      </div>

      <div className="anomaly-stats">
        <div className="stat-card open">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-number">{pagination.total}</div>
            <div className="stat-label">待处理异常</div>
          </div>
        </div>
        <div className="stat-card resolved">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-number">0</div>
            <div className="stat-label">已处理</div>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-item">
          <label>状态</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">全部</option>
            <option value="open">待处理</option>
            <option value="resolved">已处理</option>
          </select>
        </div>
        <div className="filter-item">
          <label>类型</label>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
          >
            <option value="">全部类型</option>
            <option value="duplicate_invoice">重复票据</option>
            <option value="incomplete_ocr">OCR识别不完整</option>
            <option value="amount_mismatch">金额不匹配</option>
            <option value="duplicate_amount">同金额多笔流水</option>
            <option value="split_payment">拆分报销</option>
          </select>
        </div>
        <div className="filter-item">
          <label>严重程度</label>
          <select
            value={filters.severity}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
          >
            <option value="">全部</option>
            <option value="error">严重</option>
            <option value="warning">警告</option>
            <option value="info">提示</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">加载中...</div>
          ) : anomalies.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🎉</div>
              <div className="text">暂无异常记录</div>
              <div className="subtext">所有数据都正常，继续保持！</div>
            </div>
          ) : (
            <div className="anomaly-list">
              {anomalies.map((anomaly) => {
                const typeInfo = getTypeInfo(anomaly.type);
                const severityInfo = getSeverityInfo(anomaly.severity);
                
                return (
                  <div
                    key={anomaly.id}
                    className={`anomaly-item ${anomaly.status === 'resolved' ? 'resolved' : ''}`}
                  >
                    <div className="anomaly-icon">{typeInfo.icon}</div>
                    <div className="anomaly-content">
                      <div className="anomaly-header">
                        <span className="anomaly-type">{typeInfo.label}</span>
                        <span className={`severity-badge ${severityInfo.class}`}>
                          {severityInfo.label}
                        </span>
                        <span className={`status-badge ${anomaly.status}`}>
                          {anomaly.status === 'open' ? '待处理' : '已处理'}
                        </span>
                      </div>
                      <div className="anomaly-description">{anomaly.description}</div>
                      {anomaly.detail && (
                        <div className="anomaly-detail">{anomaly.detail}</div>
                      )}
                      <div className="anomaly-meta">
                        <span>创建时间：{anomaly.created_at}</span>
                        {anomaly.resolved_at && (
                          <span>处理时间：{anomaly.resolved_at}</span>
                        )}
                        {anomaly.resolution && (
                          <span>处理结果：{anomaly.resolution}</span>
                        )}
                      </div>
                    </div>
                    <div className="anomaly-actions">
                      {anomaly.status === 'open' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleResolve(anomaly)}
                        >
                          处理
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {anomalies.length > 0 && (
          <div className="pagination" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)' }}>
            <div className="pagination-info">
              第 {pagination.page} / {totalPages} 页，共 {pagination.total} 条
            </div>
            <div className="pagination-controls">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                上一页
              </button>
              <span className="page-info">{pagination.page}</span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedAnomaly && (
        <div className="modal-overlay" onClick={() => setSelectedAnomaly(null)}>
          <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">处理异常</span>
              <button className="modal-close" onClick={() => setSelectedAnomaly(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="resolve-form">
                <div className="anomaly-preview">
                  <div className="preview-label">异常描述</div>
                  <div className="preview-text">{selectedAnomaly.description}</div>
                  {selectedAnomaly.detail && (
                    <div className="preview-detail">{selectedAnomaly.detail}</div>
                  )}
                </div>
                <div className="form-group">
                  <label>处理结果</label>
                  <textarea
                    rows={4}
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="请输入处理说明..."
                  />
                </div>
                <div className="quick-resolutions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setResolutionText('已人工核对确认，数据正确')}
                  >
                    已核对正确
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setResolutionText('已调整匹配关系')}
                  >
                    已调整匹配
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setResolutionText('误报，忽略')}
                  >
                    忽略
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedAnomaly(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={submitResolve}>
                确认处理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Anomalies;
