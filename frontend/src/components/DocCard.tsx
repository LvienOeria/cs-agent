interface Doc {
  id: string;
  content: string;
  metadata?: Record<string, string>;
}

interface Props {
  doc: Doc;
  onDelete: (id: string) => void;
}

export function DocCard({ doc, onDelete }: Props) {
  return (
    <div className="card doc-card">
      <div className="doc-header">
        <span className="doc-id">{doc.id}</span>
        {doc.metadata?.category && <span className="badge">{doc.metadata.category}</span>}
      </div>
      <div className="doc-content">{doc.content}</div>
      <div className="doc-footer">
        <span style={{ fontSize: 11, color: 'var(--ink-48)' }}>
          {doc.metadata?.chunkIndex !== undefined ? `分块 ${+doc.metadata.chunkIndex + 1}/${doc.metadata.totalChunks}` : ''}
        </span>
        <button className="btn-danger" onClick={() => onDelete(doc.id)}>删除</button>
      </div>
    </div>
  );
}
