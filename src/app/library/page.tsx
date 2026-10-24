import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UploadPanel } from '@/components/UploadPanel';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const books = await prisma.book.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { chapters: true } } },
  });

  const totalChapters = books.reduce((sum, book) => sum + book._count.chapters, 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">我的书库</h1>
          <p className="page-sub">
            {books.length > 0
              ? `${books.length} 本书 · ${totalChapters} 个章节 · 按「预习 → 阅读」顺序使用`
              : '上传第一本 PDF，开始你的英语精读'}
          </p>
        </div>
      </div>

      <UploadPanel />

      {books.length === 0 ? (
        <div className="empty">
          书库还是空的。上传一本 PDF 英文书，系统会自动提取文本并按章节切分。
        </div>
      ) : (
        <div className="library-grid">
          {books.map((book) => {
            const status =
              book.status === 'ready'
                ? { cls: 'ok', label: '可阅读' }
                : book.status === 'no_text_layer'
                  ? { cls: 'warn', label: '需 OCR' }
                  : { cls: 'warn', label: '解析异常' };

            return (
              <Link key={book.id} href={`/books/${book.id}`} className="book-card">
                <div className="book-cover">{(book.title || '?').slice(0, 1).toUpperCase()}</div>
                <div className="book-title">{book.title}</div>
                <div className="book-meta">
                  <span>{book._count.chapters} 章</span>
                  <span>{book.pageCount} 页</span>
                  <span className={`badge ${status.cls}`}>{status.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
