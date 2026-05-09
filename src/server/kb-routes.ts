import { Router, type Request, type Response } from 'express';
import { unlink } from 'node:fs/promises';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { knowledgeBase } from '../rag/knowledge-base.js';
import { logger } from '../observability/logger.js';
import { ingestFile } from '../rag/pipeline.js';
import type { Chunk } from '../rag/types.js';

function queryString(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return String(val[0]) || undefined;
  return undefined;
}

const addDocSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, '内容不能为空').max(8000, '内容过长'),
  metadata: z.record(z.string(), z.string()).optional(),
  tenantId: z.string().optional(),
});

const upload = multer({
  storage: multer.diskStorage({
    destination: 'data/uploads/_tmp',
    filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export function createKbRouter(): Router {
  const router = Router();

  // List all documents
  router.get('/documents', async (req: Request, res: Response) => {
    try {
      const tenantId = queryString(req.query.tenantId);
      const docs = await knowledgeBase.listDocuments(tenantId);
      res.json({ count: docs.length, documents: docs });
    } catch (err) {
      logger.error({ err }, 'Failed to list documents');
      res.status(500).json({ error: '获取文档列表失败' });
    }
  });

  // Add a document
  router.post('/documents', async (req: Request, res: Response) => {
    const parsed = addDocSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? '参数错误' });
      return;
    }

    const { id, content, metadata, tenantId } = parsed.data;
    const chunkId = id ?? uuidv4();
    const chunk: Chunk = {
      id: chunkId,
      content,
      metadata: { ...metadata, documentId: chunkId },
    };

    try {
      await knowledgeBase.addDocuments([chunk], tenantId);
      logger.info({ docId: chunk.id, tenantId }, 'Document added via API');
      res.status(201).json({ id: chunk.id, message: '文档添加成功' });
    } catch (err) {
      logger.error({ err }, 'Failed to add document');
      res.status(500).json({ error: '添加文档失败' });
    }
  });

  // Delete a document
  router.delete('/documents/:id', async (req: Request, res: Response) => {
    const id = queryString(req.params.id);
    if (!id) { res.status(400).json({ error: '缺少文档ID' }); return; }
    const tenantId = queryString(req.query.tenantId);

    try {
      await knowledgeBase.removeDocument(id, tenantId);
      logger.info({ docId: id, tenantId }, 'Document removed via API');
      res.json({ id, message: '文档删除成功' });
    } catch (err) {
      logger.error({ err }, 'Failed to remove document');
      res.status(500).json({ error: '删除文档失败' });
    }
  });

  // File upload
  router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: '请选择要上传的文件' });
      return;
    }

    const tenantId = (req.body?.tenantId as string) || undefined;
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    try {
      const chunks = await ingestFile(filePath, mimeType, { tenantId });
      res.status(201).json({
        message: '文件上传并处理成功',
        fileName: req.file.originalname,
        documentId: chunks[0]?.metadata?.documentId,
        chunks: chunks.length,
      });
    } catch (err) {
      logger.error({ err, filePath, mimeType }, 'File ingestion failed');
      res.status(500).json({ error: '文件处理失败' });
    } finally {
      // Clean temp file
      try { await unlink(filePath); } catch { /* ignore */ }
    }
  });

  // Stats
  router.get('/stats', async (_req: Request, res: Response) => {
    const allDocs = await knowledgeBase.listDocuments();
    const categories = new Map<string, number>();
    for (const doc of allDocs) {
      const cat = doc.metadata?.category ?? '未分类';
      categories.set(cat, (categories.get(cat) ?? 0) + 1);
    }

    res.json({
      documentCount: allDocs.length,
      categories: Object.fromEntries(categories),
    });
  });

  return router;
}
