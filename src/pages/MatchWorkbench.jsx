import React, { useState, useEffect } from 'react';
import '../styles/match-workbench.css';

function MatchWorkbench({ onUpdate }) {
  const [unmatchedInvoices, setUnmatchedInvoices] = useState([]);
  const [unmatchedTransactions, setUnmatchedTransactions] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [activeTab, setActiveTab] = useState('invoices');
  const [matchAmount, setMatchAmount] = useState('');

  useEffect(() => {
    loadUnmatchedData();
  }, []);

  const loadUnmatchedData = async () => {
    try {
      if (window.electronAPI?.database) {
        const [invResult, transResult] = await Promise.all([
          window.electronAPI.database.getInvoices({
            page: 1,
            pageSize: 50,
            status: 'pending',
          }),
          window.electronAPI.database.getTransactions({
            page: 1,
            pageSize: 50,
            status: 'pending',
          }),
        ]);
        
        setUnmatchedInvoices(invResult.list || []);
        setUnmatchedTransactions(transResult.list || []);
      }
    } catch (e) {
      console.error('加载数据失败:', e);
    }
  };

  const handleAutoMatch = async () => {
    if (!confirm('确定要开始自动匹配吗？系统将根据金额、日期、交易方等信息自动匹配票据和流水。')) {
      return;
    }
    
    setMatching(true);
    setMatchResult(null);
    
    try {
      const result = await window.electronAPI.match.autoMatch();
      setMatchResult(result);
      loadUnmatchedData();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error('自动匹配失败:', e);
    }
    
    setMatching(false);
  };

  const handleSelectInvoice = async (invoice) => {
    setSelectedInvoice(invoice);
    setSelectedTransaction(null);
    setActiveTab('transactions');
    setMatchAmount(invoice.total_amount?.toString() || '');
    
    try {
      const data = await window.electronAPI.match.getMatchCandidates('invoice', invoice.id);
      setCandidates(data || []);
    } catch (e) {
      console.error('加载候选匹配失败:', e);
    }
  };

  const handleSelectTransaction = async (transaction) => {
    setSelectedTransaction(transaction);
    setSelectedInvoice(null);
    setActiveTab('invoices');
    setMatchAmount(Math.abs(transaction.amount).toString() || '');
    
    try {
      const data = await window.electronAPI.match.getMatchCandidates('transaction', transaction.id);
      setCandidates(data || []);
    } catch (e) {
      console.error('加载候选匹配失败:', e);
    }
  };

  const handleManualMatch = async (invoice, transaction) => {
    const amount = parseFloat(matchAmount) || 0;
    if (amount <= 0) {
      alert('请输入有效的匹配金额');
      return;
    }
    
    try {
      const result = await window.electronAPI.match.manualMatch(
        invoice.id,
        transaction.id,
        amount
      );
      
      if (result?.success !== false) {
        alert('匹配成功！');
        loadUnmatchedData();
        setSelectedInvoice(null);
        setSelectedTransaction(null);
        setCandidates([]);
        if (onUpdate) onUpdate();
      } else {
        alert('匹配失败：' + (result.error || '未知错误'));
      }
    } catch (e) {
      console.error('手动匹配失败:', e);
      alert('匹配失败');
    }
  };

  const getScoreLevel = (score) => {
    if (score >= 70) return { text: '高', class: 'high' };
    if (score >= 50) return { text: '中', class: 'medium' };
    return { text: '低', class: 'low' };
  };

  return (
    <div className="match-workbench">
      <div className="workbench-header">
        <div className="header-left">
          <h2>匹配工作台</h2>
          <p>智能匹配 + 人工调整，高效完成对账</p>
        </div>
        <div className="header-right">
          <button 
            className="btn btn-primary btn-lg" 
            onClick={handleAutoMatch}
            disabled={matching}
          >
            {matching ? '匹配中...' : '⚡ 开始自动匹配'}
          </button>
        </div>
      </div>

      {matchResult && (
        <div className="match-result-card">
          <div className="result-item">
            <span className="result-label">自动匹配</span>
            <span className="result-value">{matchResult.matchCount} 笔</span>
          </div>
          <div className="result-item">
            <span className="result-label">新增异常</span>
            <span className="result-value warning">{matchResult.anomalyCount} 条</span>
          </div>
          <div className="result-item">
            <span className="result-label">待处理票据</span>
            <span className="result-value">{matchResult.totalInvoices - matchResult.matchCount} 张</span>
          </div>
          <button className="close-btn" onClick={() => setMatchResult(null)}>×</button>
        </div>
      )}

      <div className="workbench-content">
        <div className="panel invoice-panel">
          <div className="panel-header">
            <h3>待匹配票据</h3>
            <span className="count-badge">{unmatchedInvoices.length}</span>
          </div>
          <div className="panel-body">
            {unmatchedInvoices.length === 0 ? (
              <div className="empty-state">
                <div className="icon">✅</div>
                <div className="text">所有票据已匹配</div>
              </div>
            ) : (
              <div className="invoice-list">
                {unmatchedInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`invoice-item ${selectedInvoice?.id === invoice.id ? 'selected' : ''}`}
                    onClick={() => handleSelectInvoice(invoice)}
                  >
                    <div className="invoice-icon">🧾</div>
                    <div className="invoice-info">
                      <div className="invoice-name" title={invoice.file_name}>
                        {invoice.file_name}
                      </div>
                      <div className="invoice-meta">
                        <span>{invoice.invoice_date || '日期未知'}</span>
                        <span>{invoice.invoice_no || '无票号'}</span>
                      </div>
                      <div className="invoice-seller" title={invoice.seller_name}>
                        {invoice.seller_name || '未知销售方'}
                      </div>
                    </div>
                    <div className="invoice-amount">
                      ¥ {invoice.total_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '0.00'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel action-panel">
          <div className="panel-header">
            <h3>匹配操作</h3>
          </div>
          <div className="panel-body">
            <div className="match-action-area">
              {selectedInvoice ? (
                <div className="selected-item-card invoice">
                  <div className="card-label">选中票据</div>
                  <div className="card-title">{selectedInvoice.file_name}</div>
                  <div className="card-amount">
                    ¥ {selectedInvoice.total_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="card-meta">
                    <span>{selectedInvoice.invoice_date || '日期未知'}</span>
                    <span>{selectedInvoice.seller_name || '未知销售方'}</span>
                  </div>
                </div>
              ) : selectedTransaction ? (
                <div className="selected-item-card transaction">
                  <div className="card-label">选中流水</div>
                  <div className="card-title">{selectedTransaction.counterparty_name || '未知对手'}</div>
                  <div className="card-amount">
                    ¥ {Math.abs(selectedTransaction.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="card-meta">
                    <span>{selectedTransaction.transaction_date}</span>
                    <span>{selectedTransaction.summary || ''}</span>
                  </div>
                </div>
              ) : (
                <div className="select-hint">
                  <div className="hint-icon">👆</div>
                  <div className="hint-text">请从左侧选择票据或流水</div>
                  <div className="hint-subtext">系统将为您推荐匹配候选</div>
                </div>
              )}

              {(selectedInvoice || selectedTransaction) && (
                <div className="match-amount-input">
                  <label>匹配金额</label>
                  <input
                    type="number"
                    step="0.01"
                    value={matchAmount}
                    onChange={(e) => setMatchAmount(e.target.value)}
                    placeholder="输入匹配金额"
                  />
                </div>
              )}

              {selectedInvoice && candidates.length > 0 && (
                <div className="candidates-section">
                  <h4>推荐匹配流水</h4>
                  <div className="candidates-list">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="candidate-item"
                        onClick={() => handleManualMatch(selectedInvoice, candidate)}
                      >
                        <div className="candidate-info">
                          <div className="candidate-name">{candidate.counterparty_name || '未知对手'}</div>
                          <div className="candidate-meta">
                            <span>{candidate.transaction_date}</span>
                            <span>{candidate.summary || ''}</span>
                          </div>
                        </div>
                        <div className="candidate-amount">
                          ¥ {Math.abs(candidate.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className={`match-score ${getScoreLevel(candidate.matchScore).class}`}>
                          <span className="score-label">匹配度</span>
                          <span className="score-value">{getScoreLevel(candidate.matchScore).text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTransaction && candidates.length > 0 && (
                <div className="candidates-section">
                  <h4>推荐匹配票据</h4>
                  <div className="candidates-list">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="candidate-item invoice-candidate"
                        onClick={() => handleManualMatch(candidate, selectedTransaction)}
                      >
                        <div className="candidate-info">
                          <div className="candidate-name">{candidate.file_name || '未知票据'}</div>
                          <div className="candidate-meta">
                            <span>{candidate.invoice_date || '日期未知'}</span>
                            <span>{candidate.seller_name || ''}</span>
                          </div>
                        </div>
                        <div className="candidate-amount">
                          ¥ {candidate.total_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '0.00'}
                        </div>
                        <div className={`match-score ${getScoreLevel(candidate.matchScore).class}`}>
                          <span className="score-label">匹配度</span>
                          <span className="score-value">{getScoreLevel(candidate.matchScore).text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel transaction-panel">
          <div className="panel-header">
            <h3>待匹配流水</h3>
            <span className="count-badge">{unmatchedTransactions.length}</span>
          </div>
          <div className="panel-body">
            {unmatchedTransactions.length === 0 ? (
              <div className="empty-state">
                <div className="icon">✅</div>
                <div className="text">所有流水已匹配</div>
              </div>
            ) : (
              <div className="transaction-list">
                {unmatchedTransactions.map((t) => (
                  <div
                    key={t.id}
                    className={`transaction-item ${selectedTransaction?.id === t.id ? 'selected' : ''}`}
                    onClick={() => handleSelectTransaction(t)}
                  >
                    <div className="transaction-icon">{t.amount >= 0 ? '📈' : '📉'}</div>
                    <div className="transaction-info">
                      <div className="transaction-counterparty" title={t.counterparty_name}>
                        {t.counterparty_name || '未知对手'}
                      </div>
                      <div className="transaction-meta">
                        <span>{t.transaction_date}</span>
                        <span>{t.summary || '无摘要'}</span>
                      </div>
                      <div className="transaction-remark" title={t.remark}>
                        {t.remark || ''}
                      </div>
                    </div>
                    <div className={`transaction-amount ${t.amount >= 0 ? 'positive' : 'negative'}`}>
                      {t.amount >= 0 ? '+' : ''}
                      ¥ {Math.abs(t.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatchWorkbench;
