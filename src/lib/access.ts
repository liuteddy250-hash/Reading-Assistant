import { prisma } from './db';
import { HttpError } from './errors';

export async function getOwnedBook(bookId: string, userId: string) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    include: { chapters: { orderBy: { position: 'asc' } } },
  });
  if (!book) throw new HttpError(404, '书籍不存在或无权访问');
  return book;
}

export async function getOwnedChapter(chapterId: string, userId: string) {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, book: { userId } },
    include: { book: true },
  });
  if (!chapter) throw new HttpError(404, '章节不存在或无权访问');
  return chapter;
}
