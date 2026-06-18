import React, { useState, useEffect } from 'react';
import InvoiceDetail from '../components/InvoiceDetail.jsx';
import '../styles/invoices.css';
import { getStatusLabel } from '../constants/index.js';

function Invoices({ onUpdate }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    startDate: '',
    endDate: '',
    keyword: '',
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, [pagination.page, pagination.pageSize, filters]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.database) {
        const result = await window.electronAPI.database.getInvoices({
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...filters,
        });
        setInvoices(result.list || []);
        setPagination(prev => ({ ...prev, total: result.total || 0 }));
      }
    } catch (e) {
      console.error('加载票据列表失败:', e);
    }
    setLoading(false);
  };

  const handleImport = async () => {
    try {
      const result = await window.electronAPI?.dialog?.openFiles({
        title: '选择票据文件',
        filters: [
          { name: '图片和PDF', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'pdf'] },
        ],
      });

      if (!result?.canceled && result?.filePaths?.length > 0) {
        setImporting(true);
        setImportResult(null);

        const importResult = await window.electronAPI.import.importInvoiceFiles(result.filePaths);
        setImportResult(importResult);
        
        loadInvoices();
        if (onUpdate) onUpdate();
      }
    } catch (e) {
      console.error('导入票据失败:', e);
    }
    setImporting(false);
  };

  const handleViewDetail = (invoice) => {
    setSelectedInvoice(invoice);
  };

  const handleCloseDetail = () => {
    setSelectedInvoice(null);
    loadInvoices();
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条票据记录吗？')) return;
    
    try {
      await window.electronAPI.database.deleteInvoice(id);
      loadInvoices();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('删除票据失败:', e);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="invoices-page">
      <div className="page-header">
        <div className="header-left">
          <h2>票据管理</h2>
          <p>共 {pagination.total} 张票据</p>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? '导入中...' : '📥 批量导入'}
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`import-alert ${importResult.failed > 0 ? 'error' : 'success'}`}>
          <span>
            导入完成：成功 {importResult.success} 张，
            重复 {importResult.duplicate} 张，
            失败 {importResult.failed} 张
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
          <label>类别</label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">全部</option>
            <option value="办公费用">办公费用</option>
            <option value="差旅费用">差旅费用</option>
            <option value="餐饮费用">餐饮费用</option>
            <option value="交通费用">交通费用</option>
            <option value="采购费用">采购费用</option>
            <option value="其他费用">其他费用</option>
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
            placeholder="发票号/销售方/文件名"
            value={filters.keyword}
            onChange={(e) => handleFilterChange('keyword', e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading">加载中...</div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🧾</div>
              <div className="text">暂无票据记录</div>
              <div className="subtext">点击"批量导入"添加票据文件</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>发票号码</th>
                  <th>开票日期</th>
                  <th className="amount">金额</th>
                  <th>销售方</th>
                  <th>类别</th>
                  <th>匹配状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} onClick={() => handleViewDetail(invoice)}>
                    <td>
                      <div className="file-name" title={invoice.file_name}>
                        📄 {invoice.file_name}
                      </div>
                    </td>
                    <td>{invoice.invoice_no || '-'}</td>
                    <td>{invoice.invoice_date || '-'}</td>
                    <td className="amount">
                      ¥ {invoice.total_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td>
                      <div className="seller-name" title={invoice.seller_name}>
                        {invoice.seller_name || '-'}
                      </div>
                    </td>
                    <td>{invoice.category || '-'}</td>
                    <td>
                      <span className={`status-badge ${invoice.status}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleViewDetail(invoice)}>
                        详情
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(invoice.id)} style={{ marginLeft: 4 }}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {invoices.length > 0 && (
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

      {selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          onClose={handleCloseDetail}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

export default Invoices;
