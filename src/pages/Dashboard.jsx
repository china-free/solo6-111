import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

function Dashboard({ stats, onRefresh }) {
  const navigate = useNavigate();

  const statCards = [
    {
      title: '票据总数',
      value: stats?.invoices?.total || 0,
      icon: '🧾',
      color: 'primary',
      subtext: `待匹配 ${stats?.invoices?.pending || 0} 张`,
      path: '/invoices',
    },
    {
      title: '流水总数',
      value: stats?.transactions?.total || 0,
      icon: '💳',
      color: 'success',
      subtext: `待匹配 ${stats?.transactions?.pending || 0} 笔`,
      path: '/transactions',
    },
    {
      title: '已匹配',
      value: stats?.matches?.total || 0,
      icon: '🔗',
      color: 'info',
      subtext: `自动匹配 ${stats?.matches?.auto_count || 0} 笔`,
      path: '/match',
    },
    {
      title: '待处理异常',
      value: stats?.anomalies?.open || 0,
      icon: '⚠️',
      color: 'warning',
      subtext: `共 ${stats?.anomalies?.total || 0} 条异常记录`,
      path: '/anomalies',
    },
  ];

  const quickActions = [
    { icon: '📥', label: '导入票据', action: () => navigate('/invoices') },
    { icon: '📊', label: '导入流水', action: () => navigate('/transactions') },
    { icon: '🔗', label: '智能匹配', action: () => navigate('/match') },
    { icon: '📤', label: '导出报表', action: () => navigate('/export') },
  ];

  return (
    <div className="dashboard">
      <div className="stat-grid">
        {statCards.map((card, index) => (
          <div
            key={index}
            className={`stat-card ${card.color}`}
            onClick={() => navigate(card.path)}
          >
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-info">
              <div className="stat-title">{card.title}</div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-subtext">{card.subtext}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">快捷操作</h2>
        <div className="quick-actions">
          {quickActions.map((action, index) => (
            <button key={index} className="quick-action-btn" onClick={action.action}>
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-row">
        <div className="dashboard-col">
          <div className="card">
            <div className="card-header">
              <span className="card-title">匹配进度概览</span>
            </div>
            <div className="card-body">
              <div className="progress-section">
                <div className="progress-label">
                  <span>票据匹配率</span>
                  <span className="progress-value">
                    {stats?.invoices?.total > 0
                      ? ((stats.invoices.matched / stats.invoices.total) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill primary"
                    style={{
                      width: `${stats?.invoices?.total > 0
                        ? (stats.invoices.matched / stats.invoices.total) * 100
                        : 0}%`,
                    }}
                  />
                </div>
                <div className="progress-stats">
                  <span>已匹配: {stats?.invoices?.matched || 0}</span>
                  <span>待匹配: {stats?.invoices?.pending || 0}</span>
                  <span>部分匹配: {stats?.invoices?.partial || 0}</span>
                </div>
              </div>

              <div className="progress-section">
                <div className="progress-label">
                  <span>流水匹配率</span>
                  <span className="progress-value">
                    {stats?.transactions?.total > 0
                      ? ((stats.transactions.matched / stats.transactions.total) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill success"
                    style={{
                      width: `${stats?.transactions?.total > 0
                        ? (stats.transactions.matched / stats.transactions.total) * 100
                        : 0}%`,
                    }}
                  />
                </div>
                <div className="progress-stats">
                  <span>已匹配: {stats?.transactions?.matched || 0}</span>
                  <span>待匹配: {stats?.transactions?.pending || 0}</span>
                  <span>部分匹配: {stats?.transactions?.partial || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-col">
          <div className="card">
            <div className="card-header">
              <span className="card-title">金额统计</span>
            </div>
            <div className="card-body">
              <div className="amount-stat">
                <div className="amount-label">票据总金额</div>
                <div className="amount-value">
                  ¥ {(stats?.invoices?.total_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="amount-stat">
                <div className="amount-label">流水支出总额</div>
                <div className="amount-value">
                  ¥ {(stats?.transactions?.total_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="amount-stat">
                <div className="amount-label">已匹配金额</div>
                <div className="amount-value matched">
                  ¥ {(stats?.matches?.total_matched_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">使用说明</span>
          </div>
          <div className="card-body">
            <div className="tips-grid">
              <div className="tip-item">
                <div className="tip-icon">1️⃣</div>
                <div className="tip-content">
                  <h4>导入票据</h4>
                  <p>在票据管理中批量导入发票图片或PDF，系统自动进行OCR识别并提取关键字段</p>
                </div>
              </div>
              <div className="tip-item">
                <div className="tip-icon">2️⃣</div>
                <div className="tip-content">
                  <h4>导入流水</h4>
                  <p>在流水管理中导入银行流水Excel/CSV文件，支持多家银行格式自动识别</p>
                </div>
              </div>
              <div className="tip-item">
                <div className="tip-icon">3️⃣</div>
                <div className="tip-content">
                  <h4>智能匹配</h4>
                  <p>系统根据金额、日期、交易方等信息自动匹配票据与流水，支持人工调整</p>
                </div>
              </div>
              <div className="tip-item">
                <div className="tip-icon">4️⃣</div>
                <div className="tip-content">
                  <h4>处理异常</h4>
                  <p>异常处理模块集中展示重复票据、金额不匹配、OCR识别不完整等问题</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
