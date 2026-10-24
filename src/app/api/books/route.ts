import { randomUUID } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, errorResponse } from '@/lib/errors';
import { parsePdf } from '@/lib/pdf';
import { splitIntoChapters } from '@/lib/chapters';
import { saveBookFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 120;

function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB || 50);
  return (Number.isFinite(mb) && mb > 0 ? mb : 50) * 1024 * 1024;
}

export async function GET() {
  try {
    const user = await requireUser();
    const books = await prisma.book.findMany({
      where: { userId: user.uid },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chapters: true } } },
    });
    return Response.json({ books });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();

    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, '请选择要上传的 PDF 文件');
    if (!file.name.toLowerCase().endsWith('.pdf')) throw new HttpError(400, '目前仅支持 PDF 格式');
    if (file.size === 0) throw new HttpError(400, '文件为空');
    if (file.size > maxUploadBytes()) {
      throw new HttpError(413, `文件超过大小限制（${process.env.MAX_UPLOAD_MB || 50} MB）`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const magic = buffer.subarray(0, 5).toString('latin1');
    if (magic !== '%PDF-') throw new HttpError(400, '文件不是有效的 PDF');

    const requestedTitle = String(form.get('title') ?? '').trim();
    const fallbackTitle = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();

    let parsed;
    try {
      // pdf.js transfers (detaches) the buffer it receives, so hand it a copy.
      parsed = await parsePdf(new Uint8Array(buffer));
    } catch (error) {
      throw new HttpError(
        422,
        `PDF 解析失败：${(error as Error).message || '文件可能已损坏或加密'}。请尝试用其他工具导出为文本型 PDF 后再上传。`,
      );
    }

    if (parsed.totalPages === 0) throw new HttpError(422, 'PDF 中没有可读取的页面');

    const bookId = randomUUID();
    const filePath = await saveBookFile(bookId, buffer);

    if (parsed.scanned) {
      const book = await prisma.book.create({
        data: {
          id: bookId,
          userId: user.uid,
          title: requestedTitle || fallbackTitle || file.name,
          fileName: file.name,
          fileSize: file.size,
          filePath,
          pageCount: parsed.totalPages,
          status: 'no_text_layer',
          statusNote:
            '该 PDF 没有文字层（可能是扫描件），无法提取文本。请先用 OCR 处理（例如 Adobe Acrobat「识别文本」、ocrmypdf 或 ABBYY）后再上传。',
        },
      });
      return Response.json({ book, warning: book.statusNote }, { status: 201 });
    }

    const chapters = splitIntoChapters(parsed.pages);
    if (chapters.length === 0) {
      const book = await prisma.book.create({
        data: {
          id: bookId,
          userId: user.uid,
          title: requestedTitle || fallbackTitle || file.name,
          fileName: file.name,
          fileSize: file.size,
          filePath,
          pageCount: parsed.totalPages,
          status: 'error',
          statusNote: '未能从 PDF 中提取到正文文本，请确认文件是否包含文字层。',
        },
      });
      return Response.json(
        { book, warning: book.statusNote },
        { status: 201 },
      );
    }

    const book = await prisma.book.create({
      data: {
        id: bookId,
        userId: user.uid,
        title: requestedTitle || fallbackTitle || file.name,
        fileName: file.name,
        fileSize: file.size,
        filePath,
        pageCount: parsed.totalPages,
        status: 'ready',
        chapters: {
          create: chapters.map((chapter, index) => ({
            position: index,
            title: chapter.title,
            content: chapter.content,
            pageStart: chapter.pageStart,
            pageEnd: chapter.pageEnd,
            wordCount: chapter.wordCount,
          })),
        },
      },
      include: { _count: { select: { chapters: true } } },
    });

    return Response.json({ book }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
