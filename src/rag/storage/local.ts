import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../observability/logger.js';

const UPLOAD_ROOT = 'data/uploads';

export async function saveFile(
  buffer: Buffer,
  filename: string,
  tenantId?: string
): Promise<string> {
  const dir = tenantId ? join(UPLOAD_ROOT, tenantId) : join(UPLOAD_ROOT, '_global');
  await mkdir(dir, { recursive: true });

  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  const storedName = `${uuidv4()}${ext}`;
  const filePath = join(dir, storedName);

  await writeFile(filePath, buffer);
  logger.info({ filePath, size: buffer.length, tenantId }, 'File saved');
  return filePath;
}
