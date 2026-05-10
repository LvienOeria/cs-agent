import { useEffect, useState } from 'react';
import { useKB } from '../hooks/useKB';
import { DropZone } from './DropZone';
import { DocCard } from './DocCard';
import { useSettings } from '../hooks/useSettings';

export function KbView() {
  const { docs, stats, loading, refresh, remove, upload } = useKB();
  const { settings } = useSettings();
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { refresh(); }, [refresh]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const r = await upload(file, settings.tenantId || undefined);
      setToast(`已添加: ${r.fileName} (${r.chunks} chunks)`);
    } catch { setToast('上传失败'); }
    finally { setUploading(false); }
    setTimeout(() => setToast(''), 3000);
  };

  const filteredDocs = filter ? docs.filter(d => d.content.includes(filter)) : docs;

  return (
    <div className="kb-view">
      <div className="kb-stats-bar">
        <div className="card" style={{ textAlign: 'center', minWidth: 100 }}>
          <div className="stat-num">{stats.documentCount}</div>
          <div className="stat-label">文档总数</div>
        </div>
        {Object.entries(stats.categories).map(([k, v]) => (
          <div key={k} className="card" style={{ textAlign: 'center', minWidth: 80 }}>
            <div className="stat-num">{v}</div>
            <div className="stat-label">{k}</div>
          </div>
        ))}
      </div>
      <DropZone onFile={handleFile} />
      {uploading && <div className="empty"><p>上传处理中…</p></div>}
      {toast && <div className="toast show">{toast}</div>}
      <input className="input" style={{ marginBottom: 12 }} placeholder="搜索文档…" value={filter} onChange={e => setFilter(e.target.value)} />
      {loading ? <div className="empty"><p>加载中…</p></div> :
        filteredDocs.length === 0 ? <div className="empty"><div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>📭</div><p>暂无文档</p></div> :
        <div className="doc-grid">
          {filteredDocs.map(d => <DocCard key={d.id} doc={d} onDelete={remove} />)}
        </div>
      }
    </div>
  );
}
