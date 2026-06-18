import React, { useState, useEffect } from 'react';
import TransactionDetail from '../components/TransactionDetail.jsx';
import '../styles/transactions.css';

function Transactions({ onUpdate }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    keyword: '',
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    loadTransactions();
  }, [pagination.page, pagination.pageSize, filters]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.database) {
        const result = await window.electronAPI.database.getTransactions({
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...filters,
        });
        setTransactions(result.list || []);
        setPagination(prev => ({ ...prev, total: result.total || 0 }));
      }
    } catch (e) {
      console.error('加载流水列表失败:', e);
    }
    setLoading(false);
  };

  const handleImport = async () => {
    try {
      const result = await window.electronAPI?.dialog?.openFiles({
        title: '选择流水文件',
        filters: [
          { name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] },
        ],
      });

      if (!result?.canceled && result?.filePaths?.length > 0) {
        setImporting(true);
        setImportResult(null);

        const importPromises = result.filePaths.map(fp => 
          window.electronAPI.import.importTransactions(fp)
        );
        
        const results = await Promise.all(importPromises);
        const totalCount = results.reduce((sum, r) => sum + (r.count || 0), 0);
        const failedCount = results.filter(r => !r.success).length;
        
        setImportResult({
          success: totalCount,
          failed: failedCount,
          total: result.filePaths.length,
        });
        
        loadTransactions();
        if (onUpdate) onUpdate();
      }
    } catch (e) {
      console.error('导入流水失败:', e);
    }
    setImporting(false);
  };

  const handleViewDetail = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleCloseDetail = () => {
    setSelectedTransaction(null);
    loadTransactions();
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条流水记录吗？')) return;
    
    try {
      await window.electronAPI.database.deleteTransaction(id);
      loadTransactions();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('删除流水失败:', e);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getStatusText = (status) => {
    const map = {
      pending: '待匹配',
      matched: '已匹配',
      partial: '部分匹配',
      anomaly: '异常',
    };
    return map[status] || status;
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="transactions-page">
      <div className="page-header">
        <div className="header-left">
          <h2>流水管理</h2>
          <p>共 {pagination.total} 条流水记录</p>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? '导入中...' : '📊 导入流水'}
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`import-alert ${importResult.failed > 0 ? 'error' : 'success'}`}>
          <span>
            导入完成：成功 {importResult.success} 条记录，
            失败 {importResult.failed} 个文件
          </span>
          <button className="close-btn" onClick={() => setImportResult(null)}>×</button>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-item">
          <label>状态</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">全部</option>
            <option value="pending">待匹配</option>
            <option value="matched">已匹配</option>
            <option value="partial">部分匹配</option>
            <option value="anomaly">异常</option>
          </select>
        </div>
        <div className="filter-item">
          <label>开始日期</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>
        <div className="filter-item">
          <label>结束日期</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>
        <div className="filter-item">
          <label>搜索</label>
          <input
            type="text"
            placeholder="交易对手/摘要/备注"
            value={filters.keyword}
            onChange={(e) => handleFilterChange('keyword', e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">加载中...</div>
          ) : transactions.length === 0 ? (
            <div className="empty-state">
              <div className="icon">💳</div>
              <div className="text">暂无流水记录</div>
              <div className="subtext">点击"导入流水"添加银行流水文件</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>交易日期</th>
                  <th>交易时间</th>
                  <th className="amount">金额</th>
                  <th>交易对手</th>
                  <th>摘要</th>
                  <th>备注</th>
                  <th>匹配状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} onClick={() => handleViewDetail(t)}>
                    <td>{t.transaction_date || '-'}</td>
                    <td>{t.transaction_time || '-'}</td>
                    <td className={`amount ${t.amount >= 0 ? 'positive' : 'negative'}`}>
                      {t.amount >= 0 ? '+' : ''}
                      ¥ {Math.abs(t.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <div className="counterparty-name" title={t.counterparty_name}>
                        {t.counterparty_name || '-'}
                      </div>
                    </td>
                    <td>
                      <div className="summary-text" title={t.summary}>
                        {t.summary || '-'}
                      </div>
                    </td>
                    <td>
                      <div className="remark-text" title={t.remark}>
                        {t.remark || '-'}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${t.status}`}>
                        {getStatusText(t.status)}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleViewDetail(t)}>
                        详情
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)} style={{ marginLeft: 4 }}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {transactions.length > 0 && (
          <div className="pagination" style={{ padding: '12px 20px' }}>
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

      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={handleCloseDetail}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

export default Transactions;
