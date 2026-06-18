import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Invoices from './pages/Invoices.jsx';
import Transactions from './pages/Transactions.jsx';
import MatchWorkbench from './pages/MatchWorkbench.jsx';
import Anomalies from './pages/Anomalies.jsx';
import Export from './pages/Export.jsx';
import './styles/layout.css';

const navItems = [
  { path: '/', label: '仪表盘', icon: '📊' },
  { path: '/invoices', label: '票据管理', icon: '🧾' },
  { path: '/transactions', label: '流水管理', icon: '💳' },
  { path: '/match', label: '匹配工作台', icon: '🔗' },
  { path: '/anomalies', label: '异常处理', icon: '⚠️' },
  { path: '/export', label: '导出报表', icon: '📤' },
];

function App() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      if (window.electronAPI?.database) {
        const data = await window.electronAPI.database.getStats();
        setStats(data);
      }
    } catch (e) {
      console.error('加载统计数据失败:', e);
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">💰</div>
          <div className="app-name">财务对账助手</div>
        </div>
        
        <nav className="nav-menu">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.path === '/anomalies' && stats?.anomalies?.open > 0 && (
                <span className="nav-badge">{stats.anomalies.open}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-info">
            <div className="status-row">
              <span className="status-label">票据总数</span>
              <span className="status-value">{stats?.invoices?.total || 0}</span>
            </div>
            <div className="status-row">
              <span className="status-label">流水总数</span>
              <span className="status-value">{stats?.transactions?.total || 0}</span>
            </div>
            <div className="status-row">
              <span className="status-label">已匹配</span>
              <span className="status-value success">{stats?.matches?.total || 0}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            <h1>财务对账助手</h1>
            <p>本地数据安全存储，智能匹配高效对账</p>
          </div>
          <div className="top-actions">
            <button className="btn btn-primary" onClick={() => navigate('/match')}>
              🔗 开始匹配
            </button>
          </div>
        </header>
        
        <div className="content-area">
          <Routes>
            <Route path="/" element={<Dashboard stats={stats} onRefresh={loadStats} />} />
            <Route path="/invoices" element={<Invoices onUpdate={loadStats} />} />
            <Route path="/transactions" element={<Transactions onUpdate={loadStats} />} />
            <Route path="/match" element={<MatchWorkbench onUpdate={loadStats} />} />
            <Route path="/anomalies" element={<Anomalies onUpdate={loadStats} />} />
            <Route path="/export" element={<Export />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
