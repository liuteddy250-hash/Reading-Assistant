import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOwnedChapter } from '@/lib/access';
import { HttpError, errorResponse } from '@/lib/errors';
import { truncate } from '@/lib/text';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireUser();
    const words = await prisma.word.findMany({
      where: { userId: user.uid },
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: { select: { id: true, title: true, book: { select: { id: true, title: true } } } },
      },
    });
    return Response.json({ words });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      term?: string;
      context?: string;
      chapterId?: string;
      meaning?: string;
      phonetic?: string;
      pos?: string;
    };

    const surface = String(body.term ?? '').trim();
    if (!surface) throw new HttpError(400, '缺少要收藏的内容');
    if (surface.length > 300) throw new HttpError(413, '选中内容过长，请只收藏单词或短语');

    const term = surface.toLowerCase().replace(/\s+/g, ' ').slice(0, 300);

    let chapterId: string | null = null;
    if (body.chapterId) {
      await getOwnedChapter(body.chapterId, user.uid);
      chapterId = body.chapterId;
    }

    const word = await prisma.word.upsert({
      where: { userId_term: { userId: user.uid, term } },
      create: {
        userId: user.uid,
        chapterId,
        term,
        surface,
        context: body.context ? truncate(String(body.context), 500) : null,
        meaning: body.meaning ? truncate(String(body.meaning), 500) : null,
        phonetic: body.phonetic ? truncate(String(body.phonetic), 100) : null,
        pos: body.pos ? truncate(String(body.pos), 20) : null,
      },
      update: {
        surface,
        chapterId: chapterId ?? undefined,
        context: body.context ? truncate(String(body.context), 500) : undefined,
        meaning: body.meaning ? truncate(String(body.meaning), 500) : undefined,
        phonetic: body.phonetic ? truncate(String(body.phonetic), 100) : undefined,
        pos: body.pos ? truncate(String(body.pos), 20) : undefined,
      },
    });

    return Response.json({ word }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
