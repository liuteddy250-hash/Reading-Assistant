import { notFound, redirect } from 'next/navigation';
import { Reader } from '@/components/Reader';
import { highlightIndexFor } from '@/lib/analyze';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; chapterId: string }>;
  searchParams: Promise<{ skip?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id, chapterId } = await params;
  const { skip } = await searchParams;

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId: id, book: { userId: session.uid } },
    include: {
      book: { select: { id: true, title: true } },
      prestudy: { select: { studiedAt: true } },
    },
  });

  if (!chapter) notFound();

  // Pre-study gate: reading a chapter requires having finished its pre-study.
  if (!chapter.prestudy?.studiedAt && skip !== '1') {
    redirect(`/books/${id}/prestudy/${chapterId}`);
  }

  const [annotations, neighbors, progress] = await Promise.all([
    prisma.annotation.findMany({
      where: { userId: session.uid, chapterId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.chapter.findMany({
      where: {
        bookId: id,
        position: { in: [chapter.position - 1, chapter.position + 1] },
      },
      select: { id: true, position: true },
    }),
    prisma.readingProgress.findUnique({
      where: { userId_chapterId: { userId: session.uid, chapterId } },
      select: { percent: true },
    }),
  ]);

  const prev = neighbors.find((item) => item.position === chapter.position - 1) ?? null;
  const next = neighbors.find((item) => item.position === chapter.position + 1) ?? null;

  return (
    <Reader
      bookId={chapter.book.id}
      bookTitle={chapter.book.title}
      chapter={{
        id: chapter.id,
        title: chapter.title,
        content: chapter.content,
        wordCount: chapter.wordCount,
      }}
      annotations={annotations.map((annotation) => ({
        id: annotation.id,
        kind: annotation.kind,
        quote: annotation.quote,
        paragraph: annotation.paragraph,
        startInP: annotation.startInP,
        translation: annotation.translation,
      }))}
      hardIndex={highlightIndexFor(chapter.id, chapter.content)}
      studied={Boolean(chapter.prestudy?.studiedAt)}
      prevId={prev?.id ?? null}
      nextId={next?.id ?? null}
      initialProgress={progress?.percent ?? 0}
    />
  );
}
