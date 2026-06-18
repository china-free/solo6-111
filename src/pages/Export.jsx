import React, { useState, useEffect } from 'react';
import '../styles/export.css';

function Export() {
  const [stats, setStats] = useState(null);
  const [options, setOptions] = useState({
    includeUnmatched: true,
    includeAnomalies: true,
    format: 'xlsx',
  });
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
    try {
      const result = await window.electronAPI.dialog.saveFile({
        title: '导出对账结果',
        defaultPath: `对账报表_${new Date().toISOString().slice(0, 10)}.${options.format}`,
        filters: [
          { name: 'Excel 文件', extensions: ['xlsx'] },
          { name: 'CSV 文件', extensions: ['csv'] },
        ],
      });

      if (result?.canceled || !result?.filePath) {
        return;
      }

      setExporting(true);

      const exportResult = await window.electronAPI.export.exportReconciliation(
        result.filePath,
        {
          includeUnmatched: options.includeUnmatched,
          includeAnomalies: options.includeAnomalies,
        }
      );

      if (exportResult?.success) {
        alert(`导出成功！\n共导出 ${exportResult.count} 条匹配记录\n文件路径：${result.filePath}`);
      } else {
        alert(`导出失败：${exportResult?.error || '未知错误'}`);
      }
    } catch (e) {
      console.error('导出失败:', e);
      alert('导出失败：' + e.message);
    }
    setExporting(false);
  };

  return (
    <div className="export-page">
      <div className="page-header">
        <div className="header-left">
          <h2>导出报表</h2>
          <p>导出对账结果为 Excel 或 CSV 格式</p>
        </div>
      </div>

      <div className="export-content">
        <div className="export-preview">
          <div className="card">
            <div className="card-header">
              <span className="card-title">报表预览</span>
            </div>
            <div className="card-body">
              <div className="preview-stats">
                <div className="preview-stat">
                  <div className="stat-label">票据总数</div>
                  <div className="stat-value">{stats?.invoices?.total || 0}</div>
                </div>
                <div className="preview-stat">
                  <div className="stat-label">流水总数</div>
                  <div className="stat-value">{stats?.transactions?.total || 0}</div>
                </div>
                <div className="preview-stat">
                  <div className="stat-label">已匹配</div>
                  <div className="stat-value matched">{stats?.matches?.total || 0}</div>
                </div>
                <div className="preview-stat">
                  <div className="stat-label">待处理异常</div>
                  <div className="stat-value warning">{stats?.anomalies?.open || 0}</div>
                </div>
              </div>

              <div className="preview-sheets">
                <h4>包含的工作表</h4>
                <ul>
                  <li>📊 汇总 - 对账数据概览</li>
                  <li>🔗 已匹配记录 - {stats?.matches?.total || 0} 条</li>
                  {options.includeUnmatched && (
                    <>
                      <li>🧾 未匹配票据 - {stats?.invoices?.pending || 0} 条</li>
                      <li>💳 未匹配流水 - {stats?.transactions?.pending || 0} 条</li>
                    </>
                  )}
                  {options.includeAnomalies && (
                    <li>⚠️ 异常记录 - {stats?.anomalies?.total || 0} 条</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="export-settings">
          <div className="card">
            <div className="card-header">
              <span className="card-title">导出设置</span>
            </div>
            <div className="card-body">
              <div className="setting-group">
                <h4>文件格式</h4>
                <div className="format-options">
                  <label className="format-option">
                    <input
                      type="radio"
                      name="format"
                      value="xlsx"
                      checked={options.format === 'xlsx'}
                      onChange={(e) => setOptions(p => ({ ...p, format: e.target.value }))}
                    />
                    <div className="format-content">
                      <div className="format-icon">📗</div>
                      <div className="format-info">
                        <div className="format-name">Excel (.xlsx)</div>
                        <div className="format-desc">多工作表，格式丰富</div>
                      </div>
                    </div>
                  </label>
                  <label className="format-option">
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={options.format === 'csv'}
                      onChange={(e) => setOptions(p => ({ ...p, format: e.target.value }))}
                    />
                    <div className="format-content">
                      <div className="format-icon">📄</div>
                      <div className="format-info">
                        <div className="format-name">CSV (.csv)</div>
                        <div className="format-desc">纯文本，通用性强</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="setting-group">
                <h4>内容选项</h4>
                <div className="checkbox-options">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.includeUnmatched}
                      onChange={(e) => setOptions(p => ({ ...p, includeUnmatched: e.target.checked }))}
                    />
                    <span>包含未匹配记录</span>
                  </label>
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={options.includeAnomalies}
                      onChange={(e) => setOptions(p => ({ ...p, includeAnomalies: e.target.checked }))}
                    />
                    <span>包含异常记录</span>
                  </label>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg export-btn"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? '导出中...' : '📤 导出报表'}
              </button>
            </div>
          </div>

          <div className="card tips-card">
            <div className="card-header">
              <span className="card-title">💡 导出说明</span>
            </div>
            <div className="card-body">
              <ul className="tips-list">
                <li>导出文件包含对账汇总、已匹配记录、未匹配记录和异常记录等信息</li>
                <li>Excel 格式包含多个工作表，便于分类查看</li>
                <li>CSV 格式仅包含已匹配记录，适合导入其他系统</li>
                <li>所有数据均从本地数据库读取，不会上传到任何服务器</li>
                <li>建议定期导出对账结果进行备份</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Export;
