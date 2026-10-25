import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PrestudyRunner } from '@/components/PrestudyRunner';
import { PrestudyView } from '@/components/PrestudyView';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { llmEnabled } from '@/lib/llm';
import { ensurePrestudy } from '@/lib/prestudy';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export default async function PrestudyPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id, chapterId } = await params;
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId: id, book: { userId: session.uid } },
    include: { book: { select: { id: true, title: true } } },
  });

  if (!chapter) notFound();

  // With an LLM configured, generating takes tens of seconds: render a loading
  // shell and generate on the client instead of blocking the server render.
  const existing = await prisma.prestudy.findUnique({ where: { chapterId: chapter.id } });
  if (!existing && llmEnabled()) {
    return (
      <PrestudyRunner bookId={chapter.book.id} chapterId={chapter.id} title={chapter.title} />
    );
  }

  let record;
  try {
    record = await ensurePrestudy(chapter.id);
  } catch (error) {
    return (
      <div>
        <div className="alert error">
          预习材料生成失败：{(error as Error).message || '未知错误'}
        </div>
        <Link className="btn ghost" href={`/books/${id}`}>
          返回章节列表
        </Link>
      </div>
    );
  }

  return (
    <PrestudyView
      bookId={chapter.book.id}
      chapter={{ id: chapter.id, title: chapter.title, wordCount: chapter.wordCount }}
      payload={record.payload}
      studied={Boolean(record.studiedAt)}
      source={record.source}
      llmConfigured={llmEnabled()}
    />
  );
}
