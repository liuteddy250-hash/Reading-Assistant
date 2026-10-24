import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOwnedChapter } from '@/lib/access';
import { HttpError, errorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const chapterId = new URL(request.url).searchParams.get('chapterId');
    if (!chapterId) throw new HttpError(400, '缺少 chapterId');

    const annotations = await prisma.annotation.findMany({
      where: { userId: user.uid, chapterId },
      orderBy: { createdAt: 'asc' },
    });
    return Response.json({ annotations });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      chapterId?: string;
      kind?: string;
      quote?: string;
      paragraph?: number;
      startInP?: number;
      translation?: string | null;
    };

    const chapterId = String(body.chapterId ?? '');
    if (!chapterId) throw new HttpError(400, '缺少 chapterId');
    await getOwnedChapter(chapterId, user.uid);

    const quote = String(body.quote ?? '').trim();
    if (!quote) throw new HttpError(400, '选中内容为空');
    if (quote.length > 2000) throw new HttpError(413, '选中内容过长');

    const paragraph = Number(body.paragraph);
    const startInP = Number(body.startInP);
    if (!Number.isInteger(paragraph) || paragraph < 0) throw new HttpError(400, '段落定位无效');
    if (!Number.isInteger(startInP) || startInP < 0) throw new HttpError(400, '文本定位无效');

    const kind = body.kind === 'translation' ? 'translation' : 'underline';

    const annotation = await prisma.annotation.create({
      data: {
        userId: user.uid,
        chapterId,
        kind,
        quote,
        paragraph,
        startInP,
        translation: body.translation ? String(body.translation).slice(0, 2000) : null,
      },
    });

    return Response.json({ annotation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
