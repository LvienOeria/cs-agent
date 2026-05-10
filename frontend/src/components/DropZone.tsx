import { useState, useRef, type DragEvent } from 'react';

interface Props {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`drop-zone${dragOver ? ' drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className="dz-icon">📎</div>
      <p>拖拽文件到此处，或<strong>点击上传</strong></p>
      <p style={{ fontSize: 11, marginTop: 4 }}>支持 PDF · DOCX · TXT · Markdown（最大 10MB）</p>
      <input ref={inputRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.text,.markdown"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}
