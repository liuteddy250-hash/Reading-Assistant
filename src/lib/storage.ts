import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function storageDir(): string {
  return path.resolve(process.cwd(), process.env.STORAGE_DIR || './data/uploads');
}

export async function saveBookFile(bookId: string, data: Uint8Array): Promise<string> {
  const dir = storageDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${bookId}.pdf`);
  await writeFile(filePath, data);
  return filePath;
}

export async function deleteStoredFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // file may already be gone; nothing to do
  }
}
