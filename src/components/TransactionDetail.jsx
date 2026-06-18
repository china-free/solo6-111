import React, { useState, useEffect } from 'react';
import '../styles/transaction-detail.css';

function TransactionDetail({ transaction, onClose, onUpdate }) {
  const [detail, setDetail] = useState(transaction);
  const [matches, setMatches] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadDetail();
    loadMatches();
  }, [transaction.id]);

  const loadDetail = async () => {
    try {
      if (window.electronAPI?.database) {
        const data = await window.electronAPI.database.getTransactionById(transaction.id);
        if (data) setDetail(data);
      }
    } catch (e) {
      console.error('加载流水详情失败:', e);
    }
  };

  const loadMatches = async () => {
    try {
      if (window.electronAPI?.database) {
        const data = await window.electronAPI.database.getMatchesByTransactionId(transaction.id);
        setMatches(data || []);
      }
    } catch (e) {
      console.error('加载匹配记录失败:', e);
    }
  };

  const handleEdit = () => {
    setEditData({
      transaction_date: detail.transaction_date || '',
      transaction_time: detail.transaction_time || '',
      amount: detail.amount || 0,
      balance: detail.balance || '',
      counterparty_name: detail.counterparty_name || '',
      counterparty_account: detail.counterparty_account || '',
      summary: detail.summary || '',
      remark: detail.remark || '',
      transaction_type: detail.transaction_type || '',
      serial_no: detail.serial_no || '',
      bank_name: detail.bank_name || '',
      account_no: detail.account_no || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.database.updateTransaction(detail.id, editData);
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
      <div className="modal transaction-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">流水详情</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-header">
            <div className="transaction-main">
              <div className={`amount-large ${detail.amount >= 0 ? 'positive' : 'negative'}`}>
                {detail.amount >= 0 ? '+' : ''}
                ¥ {Math.abs(detail.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </div>
              <div className="transaction-date">
                {detail.transaction_date} {detail.transaction_time || ''}
              </div>
            </div>
            <div className="status-section">
              <span className={`status-badge ${detail.status}`}>
                {getStatusText(detail.status)}
              </span>
            </div>
          </div>

          {!editing ? (
            <div className="detail-content">
              <div className="detail-section">
                <h4>交易信息</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>交易日期</label>
                    <value>{detail.transaction_date || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>交易时间</label>
                    <value>{detail.transaction_time || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>交易类型</label>
                    <value>{detail.transaction_type || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>流水号</label>
                    <value>{detail.serial_no || '-'}</value>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>金额信息</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>交易金额</label>
                    <value className={detail.amount >= 0 ? 'positive' : 'negative'}>
                      {detail.amount >= 0 ? '+' : '-'}
                      ¥ {Math.abs(detail.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </value>
                  </div>
                  <div className="detail-item">
                    <label>账户余额</label>
                    <value>
                      ¥ {detail.balance?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '-'}
                    </value>
                  </div>
                  <div className="detail-item">
                    <label>已匹配金额</label>
                    <value className="success">
                      ¥ {matchedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </value>
                  </div>
                  <div className="detail-item">
                    <label>未匹配金额</label>
                    <value className={Math.abs(detail.amount) - matchedAmount > 0 ? 'warning' : ''}>
                      ¥ {(Math.abs(detail.amount) - matchedAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </value>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>交易对手</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>对方名称</label>
                    <value>{detail.counterparty_name || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>对方账号</label>
                    <value>{detail.counterparty_account || '-'}</value>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>账户信息</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>银行</label>
                    <value>{detail.bank_name || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>账户</label>
                    <value>{detail.account_no || '-'}</value>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>摘要和备注</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>摘要</label>
                    <value>{detail.summary || '-'}</value>
                  </div>
                  <div className="detail-item">
                    <label>备注</label>
                    <value>{detail.remark || '-'}</value>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label>交易日期</label>
                  <input
                    type="date"
                    value={editData.transaction_date}
                    onChange={(e) => setEditData(p => ({ ...p, transaction_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>交易时间</label>
                  <input
                    type="text"
                    value={editData.transaction_time}
                    onChange={(e) => setEditData(p => ({ ...p, transaction_time: e.target.value }))}
                    placeholder="HH:mm:ss"
                  />
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
                  <label>余额</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editData.balance}
                    onChange={(e) => setEditData(p => ({ ...p, balance: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>对方名称</label>
                <input
                  type="text"
                  value={editData.counterparty_name}
                  onChange={(e) => setEditData(p => ({ ...p, counterparty_name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>对方账号</label>
                <input
                  type="text"
                  value={editData.counterparty_account}
                  onChange={(e) => setEditData(p => ({ ...p, counterparty_account: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>摘要</label>
                  <input
                    type="text"
                    value={editData.summary}
                    onChange={(e) => setEditData(p => ({ ...p, summary: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>备注</label>
                  <input
                    type="text"
                    value={editData.remark}
                    onChange={(e) => setEditData(p => ({ ...p, remark: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>交易类型</label>
                  <input
                    type="text"
                    value={editData.transaction_type}
                    onChange={(e) => setEditData(p => ({ ...p, transaction_type: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>流水号</label>
                  <input
                    type="text"
                    value={editData.serial_no}
                    onChange={(e) => setEditData(p => ({ ...p, serial_no: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {matches.length > 0 && (
            <div className="matches-section">
              <h4>匹配的票据</h4>
              <div className="matches-list">
                {matches.map((match) => (
                  <div key={match.id} className="match-item">
                    <div className="match-info">
                      <div className="match-file">{match.invoice_file || '-'}</div>
                      <div className="match-date">开票日期：{match.invoice_date || '-'}</div>
                      <div className="match-seller">{match.seller_name || ''}</div>
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

export default TransactionDetail;
