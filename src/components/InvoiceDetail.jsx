import React, { useState, useEffect } from 'react';
import '../styles/invoice-detail.css';

function InvoiceDetail({ invoice, onClose, onUpdate }) {
  const [detail, setDetail] = useState(invoice);
  const [matches, setMatches] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadDetail();
    loadMatches();
  }, [invoice.id]);

  const loadDetail = async () => {
    try {
      if (window.electronAPI?.database) {
        const data = await window.electronAPI.database.getInvoiceById(invoice.id);
        if (data) setDetail(data);
      }
    } catch (e) {
      console.error('加载票据详情失败:', e);
    }
  };

  const loadMatches = async () => {
    try {
      if (window.electronAPI?.database) {
        const data = await window.electronAPI.database.getMatchesByInvoiceId(invoice.id);
        setMatches(data || []);
      }
    } catch (e) {
      console.error('加载匹配记录失败:', e);
    }
  };

  const handleEdit = () => {
    setEditData({
      invoice_no: detail.invoice_no || '',
      invoice_code: detail.invoice_code || '',
      invoice_date: detail.invoice_date || '',
      amount: detail.amount || '',
      tax_amount: detail.tax_amount || '',
      total_amount: detail.total_amount || '',
      seller_name: detail.seller_name || '',
      seller_tax_no: detail.seller_tax_no || '',
      buyer_name: detail.buyer_name || '',
      buyer_tax_no: detail.buyer_tax_no || '',
      category: detail.category || '',
      notes: detail.notes || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.database.updateInvoice(detail.id, editData);
      setEditing(false);
      loadDetail();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('保存失败:', e);
    }
  };

  const handleUnmatch = async (matchId) => {
    if (!confirm('确定要取消这条匹配吗？')) return;
    
    try {
      await window.electronAPI.match.unmatch(matchId);
      loadMatches();
      loadDetail();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('取消匹配失败:', e);
    }
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

  const matchedAmount = matches.reduce((sum, m) => sum + (m.matched_amount || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal invoice-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">票据详情</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-header">
            <div className="file-info">
              <div className="file-icon">📄</div>
              <div>
                <div className="file-name">{detail.file_name}</div>
                <div className="file-meta">
                  {detail.file_type?.toUpperCase()} · {(detail.file_size / 1024).toFixed(1)} KB
                </div>
              </div>
            </div>
            <div className="status-section">
              <span className={`status-badge ${detail.status}`}>
                {getStatusText(detail.status)}
              </span>
              <span className="category-tag">{detail.category || '未分类'}</span>
            </div>
          </div>

          <div className="detail-tabs">
            <button className="tab-btn active">基本信息</button>
            <button className="tab-btn">匹配记录 ({matches.length})</button>
            <button className="tab-btn">OCR原文</button>
          </div>

          {!editing ? (
            <div className="detail-content">
              <div className="detail-section">
                <h4>发票信息</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>发票号码</label>
                    <value>{detail.invoice_no || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>发票代码</label>
                    <value>{detail.invoice_code || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>开票日期</label>
                    <value>{detail.invoice_date || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>类别</label>
                    <value>{detail.category || '-'}</value>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>金额信息</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>金额</label>
                    <value>¥ {detail.amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>税额</label>
                    <value>¥ {detail.tax_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '-'}</value>
                  </div>
                  <div className="detail-item highlight">
                    <label>价税合计</label>
                    <value className="amount-large">
                      ¥ {detail.total_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '-'}
                    </value>
                  </div>
                  <div className="detail-item">
                    <label>已匹配金额</label>
                    <value className={matchedAmount > 0 ? 'success' : ''}>
                      ¥ {matchedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </value>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>销售方信息</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>名称</label>
                    <value>{detail.seller_name || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>纳税人识别号</label>
                    <value>{detail.seller_tax_no || '-'}</value>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>购买方信息</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>名称</label>
                    <value>{detail.buyer_name || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>纳税人识别号</label>
                    <value>{detail.buyer_tax_no || '-'}</value>
                  </div>
                </div>
              </div>

              {detail.notes && (
                <div className="detail-section">
                  <h4>备注</h4>
                  <p>{detail.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label>发票号码</label>
                  <input
                    type="text"
                    value={editData.invoice_no}
                    onChange={(e) => setEditData(p => ({ ...p, invoice_no: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>发票代码</label>
                  <input
                    type="text"
                    value={editData.invoice_code}
                    onChange={(e) => setEditData(p => ({ ...p, invoice_code: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>开票日期</label>
                  <input
                    type="date"
                    value={editData.invoice_date}
                    onChange={(e) => setEditData(p => ({ ...p, invoice_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>类别</label>
                  <select
                    value={editData.category}
                    onChange={(e) => setEditData(p => ({ ...p, category: e.target.value }))}
                  >
                    <option value="办公费用">办公费用</option>
                    <option value="差旅费用">差旅费用</option>
                    <option value="餐饮费用">餐饮费用</option>
                    <option value="交通费用">交通费用</option>
                    <option value="采购费用">采购费用</option>
                    <option value="其他费用">其他费用</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>金额</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editData.amount}
                    onChange={(e) => setEditData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="form-group">
                  <label>税额</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editData.tax_amount}
                    onChange={(e) => setEditData(p => ({ ...p, tax_amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="form-group">
                  <label>价税合计</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editData.total_amount}
                    onChange={(e) => setEditData(p => ({ ...p, total_amount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>销售方名称</label>
                <input
                  type="text"
                  value={editData.seller_name}
                  onChange={(e) => setEditData(p => ({ ...p, seller_name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>销售方税号</label>
                <input
                  type="text"
                  value={editData.seller_tax_no}
                  onChange={(e) => setEditData(p => ({ ...p, seller_tax_no: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>购买方名称</label>
                <input
                  type="text"
                  value={editData.buyer_name}
                  onChange={(e) => setEditData(p => ({ ...p, buyer_name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>购买方税号</label>
                <input
                  type="text"
                  value={editData.buyer_tax_no}
                  onChange={(e) => setEditData(p => ({ ...p, buyer_tax_no: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>备注</label>
                <textarea
                  rows="3"
                  value={editData.notes}
                  onChange={(e) => setEditData(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
          )}

          {matches.length > 0 && (
            <div className="matches-section">
              <h4>匹配记录</h4>
              <div className="matches-list">
                {matches.map((match) => (
                  <div key={match.id} className="match-item">
                    <div className="match-info">
                      <div className="match-date">{match.transaction_date}</div>
                      <div className="match-counterparty">{match.counterparty_name || '-'}</div>
                      <div className="match-summary">{match.summary || ''}</div>
                    </div>
                    <div className="match-amount">
                      <div className="amount">¥ {match.matched_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>
                      <div className="match-type">{match.match_type === 'auto' ? '自动匹配' : '人工匹配'}</div>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => handleUnmatch(match.id)}>
                      取消匹配
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {!editing ? (
            <>
              <button className="btn btn-secondary" onClick={onClose}>关闭</button>
              <button className="btn btn-primary" onClick={handleEdit}>编辑</button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave}>保存</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default InvoiceDetail;
