import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOwnedChapter } from '@/lib/access';
import { HttpError, errorResponse } from '@/lib/errors';
import { offlineMeaning } from '@/lib/glossary';
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

    // Fill in meaning/phonetic automatically when the reader only sends a term
    // (double-click flow), using the offline dictionary as a hint.
    const isSingleWord = /^[A-Za-z][A-Za-z'’-]*$/.test(surface);
    const hint = isSingleWord ? offlineMeaning(surface) : null;
    const autoMeaning = hint?.found ? truncate(hint.zh, 500) : null;
    const autoPhonetic = hint?.found && hint.phonetic ? truncate(hint.phonetic, 100) : null;
    const autoPos = hint?.found && hint.pos ? truncate(hint.pos, 20) : null;

    const meaning = body.meaning ? truncate(String(body.meaning), 500) : autoMeaning;
    const phonetic = body.phonetic ? truncate(String(body.phonetic), 100) : autoPhonetic;
    const pos = body.pos ? truncate(String(body.pos), 20) : autoPos;

    const word = await prisma.word.upsert({
      where: { userId_term: { userId: user.uid, term } },
      create: {
        userId: user.uid,
        chapterId,
        term,
        surface,
        context: body.context ? truncate(String(body.context), 500) : null,
        meaning,
        phonetic,
        pos,
      },
      update: {
        surface,
        chapterId: chapterId ?? undefined,
        context: body.context ? truncate(String(body.context), 500) : undefined,
        meaning: meaning ?? undefined,
        phonetic: phonetic ?? undefined,
        pos: pos ?? undefined,
      },
    });

    return Response.json({ word }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
