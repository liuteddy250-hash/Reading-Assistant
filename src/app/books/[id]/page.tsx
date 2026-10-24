import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BookTools } from '@/components/BookTools';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const book = await prisma.book.findFirst({
    where: { id, userId: session.uid },
    include: {
      chapters: {
        orderBy: { position: 'asc' },
        include: {
          prestudy: { select: { studiedAt: true, source: true, status: true } },
          progress: {
            where: { userId: session.uid },
            select: { percent: true, completed: true },
          },
        },
      },
    },
  });

  if (!book) notFound();

  const totalWords = book.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
  const finished = book.chapters.filter((chapter) => chapter.prestudy?.studiedAt).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row tiny muted" style={{ marginBottom: 6 }}>
            <Link href="/library" className="link-btn">
              ← 返回书库
            </Link>
          </div>
          <h1 className="page-title">{book.title}</h1>
          <p className="page-sub">
            {book.pageCount} 页 · {book.chapters.length} 章 · 约 {totalWords.toLocaleString()} 词 · 已学完{' '}
            {finished} 章
          </p>
        </div>
        <span className="badge info">{book.fileName}</span>
      </div>

      {book.status === 'no_text_layer' ? (
        <div className="alert warn">
          <strong>这本 PDF 没有文字层（可能是扫描件），暂时无法提取正文。</strong>
          <div style={{ marginTop: 6 }}>{book.statusNote}</div>
          <div style={{ marginTop: 6 }}>
            推荐处理方式：<code>ocrmypdf input.pdf output.pdf</code>，或使用 Adobe Acrobat / ABBYY
            的「识别文本」功能导出后再上传。
          </div>
        </div>
      ) : null}

      {book.status === 'error' ? (
        <div className="alert error">
          <strong>这本 PDF 解析异常。</strong>
          <div style={{ marginTop: 6 }}>{book.statusNote}</div>
        </div>
      ) : null}

      {book.status === 'ready' && book.chapters.length === 1 ? (
        <div className="alert info">
          只识别出 1 个章节，可能是标题格式不常见。可以用下方「手动按页划分」重新组织章节。
        </div>
      ) : null}

      <BookTools
        bookId={book.id}
        bookTitle={book.title}
        pageCount={book.pageCount}
        status={book.status}
      />

      <div className="divider" />

      {book.chapters.length === 0 ? (
        <div className="empty">这本书还没有章节。请重新上传，或在下方手动划分。</div>
      ) : (
        <div className="chapter-list">
          {book.chapters.map((chapter, index) => {
            const studied = Boolean(chapter.prestudy?.studiedAt);
            const hasPrestudy = Boolean(chapter.prestudy);
            const percent = Math.round(chapter.progress[0]?.percent ?? 0);
            const finishedChapter = Boolean(chapter.progress[0]?.completed);
            const badge = studied ? (
              <span className="badge ok">已学完</span>
            ) : hasPrestudy ? (
              <span className="badge info">已预习</span>
            ) : (
              <span className="badge">未预习</span>
            );

            return (
              <div className="chapter-row" key={chapter.id}>
                <div className="chapter-index">{index + 1}</div>
                <div className="chapter-main">
                  <div className="chapter-title">{chapter.title}</div>
                  <div className="chapter-meta">
                    {chapter.wordCount.toLocaleString()} 词 · 第 {chapter.pageStart + 1}–
                    {chapter.pageEnd + 1} 页
                    {percent > 0 ? ` · 已读 ${percent}%` : ''}
                    {finishedChapter ? ' · 已读完' : ''}
                  </div>
                </div>
                {badge}
                <div className="chapter-actions">
                  <Link
                    className={studied ? 'btn ghost sm' : 'btn subtle sm'}
                    href={`/books/${book.id}/prestudy/${chapter.id}`}
                  >
                    {studied ? '复习预习' : '开始预习'}
                  </Link>
                  {studied ? (
                    <Link className="btn sm" href={`/books/${book.id}/read/${chapter.id}`}>
                      {percent > 0 && !finishedChapter ? '继续阅读' : '阅读'}
                    </Link>
                  ) : (
                    <span className="btn ghost sm" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      阅读
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
