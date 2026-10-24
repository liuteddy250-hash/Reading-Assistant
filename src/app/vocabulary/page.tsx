import { redirect } from 'next/navigation';
import { VocabTable, type VocabRow } from '@/components/VocabTable';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function VocabularyPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const words = await prisma.word.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: 'desc' },
    include: {
      chapter: {
        select: { title: true, book: { select: { id: true, title: true } } },
      },
    },
  });

  const rows: VocabRow[] = words.map((word) => ({
    id: word.id,
    term: word.term,
    surface: word.surface,
    meaning: word.meaning,
    context: word.context,
    pos: word.pos,
    phonetic: word.phonetic,
    createdAt: word.createdAt.toISOString(),
    chapterTitle: word.chapter?.title ?? null,
    bookTitle: word.chapter?.book.title ?? null,
    bookId: word.chapter?.book.id ?? null,
  }));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">生词本</h1>
          <p className="page-sub">阅读时双击单词或选中片段加入，支持搜索与导出。</p>
        </div>
      </div>
      <VocabTable initialWords={rows} />
    </div>
  );
}
