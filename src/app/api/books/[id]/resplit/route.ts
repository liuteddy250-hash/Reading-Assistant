import { readFile } from 'node:fs/promises';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOwnedBook } from '@/lib/access';
import { HttpError, errorResponse } from '@/lib/errors';
import { parsePdf } from '@/lib/pdf';
import { splitByRanges, splitIntoChapters } from '@/lib/chapters';

export const runtime = 'nodejs';
export const maxDuration = 120;

type RangeInput = { title?: string; start?: number; end?: number };

/**
 * Re-builds the chapter list of a book.
 * body: { mode: "auto" } | { ranges: [{ title, start, end }] }   (pages are 1-based)
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const book = await getOwnedBook(id, user.uid);

    const body = (await request.json().catch(() => ({}))) as {
      mode?: 'auto' | 'manual';
      ranges?: RangeInput[];
    };

    let fileBytes: Uint8Array;
    try {
      fileBytes = new Uint8Array(await readFile(book.filePath));
    } catch {
      throw new HttpError(410, '原始 PDF 文件已丢失（可能被清理），请重新上传');
    }

    const parsed = await parsePdf(fileBytes);
    if (parsed.scanned) {
      throw new HttpError(
        422,
        '该 PDF 没有文字层，无法按页提取正文。请先做 OCR（如 ocrmypdf）后再上传。',
      );
    }

    let chapters;
    if (body.mode === 'manual') {
      const ranges = Array.isArray(body.ranges) ? body.ranges : [];
      if (ranges.length === 0) throw new HttpError(400, '请至少提供一个章节页码范围');
      if (ranges.length > 200) throw new HttpError(400, '章节数量过多（上限 200）');

      const normalized = ranges.map((range) => {
        const start = Number(range.start);
        const end = Number(range.end);
        if (!Number.isInteger(start) || !Number.isInteger(end)) {
          throw new HttpError(400, '页码必须是整数');
        }
        if (start < 1 || end < start || end > parsed.totalPages) {
          throw new HttpError(400, `页码范围无效：${start}-${end}（本书共 ${parsed.totalPages} 页）`);
        }
        return { title: range.title, start: start - 1, end: end - 1 };
      });

      chapters = splitByRanges(parsed.pages, normalized);
    } else {
      chapters = splitIntoChapters(parsed.pages);
    }

    if (chapters.length === 0) throw new HttpError(422, '未能划分出任何章节，请调整页码范围');

    await prisma.$transaction(async (tx) => {
      await tx.chapter.deleteMany({ where: { bookId: book.id } });
      for (const [index, chapter] of chapters.entries()) {
        await tx.chapter.create({
          data: {
            bookId: book.id,
            position: index,
            title: chapter.title,
            content: chapter.content,
            pageStart: chapter.pageStart,
            pageEnd: chapter.pageEnd,
            wordCount: chapter.wordCount,
          },
        });
      }
      await tx.book.update({
        where: { id: book.id },
        data: { status: 'ready', statusNote: null },
      });
    });

    return Response.json({ ok: true, chapters: chapters.length });
  } catch (error) {
    return errorResponse(error);
  }
}
