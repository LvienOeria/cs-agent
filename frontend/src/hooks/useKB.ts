import { useState, useCallback } from 'react';
import { apiGet, apiDelete, apiUpload } from '../lib/api';

interface Doc {
  id: string;
  content: string;
  metadata?: Record<string, string>;
}

interface KBStats {
  documentCount: number;
  categories: Record<string, number>;
}

export function useKB() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<KBStats>({ documentCount: 0, categories: {} });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        apiGet<{ documents: Doc[] }>('/api/kb/documents'),
        apiGet<KBStats>('/api/kb/stats'),
      ]);
      setDocs(d.documents);
      setStats(s);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiDelete(`/api/kb/documents/${encodeURIComponent(id)}`);
    await refresh();
  }, [refresh]);

  const upload = useCallback(async (file: File, tenantId?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (tenantId) form.append('tenantId', tenantId);
    const result = await apiUpload('/api/kb/upload', form);
    await refresh();
    return result;
  }, [refresh]);

  return { docs, stats, loading, refresh, remove, upload };
}
