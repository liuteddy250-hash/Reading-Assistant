import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOwnedChapter } from '@/lib/access';
import { HttpError, errorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/** Saves the reading position (0-100) of the current chapter. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      chapterId?: string;
      percent?: number;
      completed?: boolean;
    };

    const chapterId = String(body.chapterId ?? '');
    if (!chapterId) throw new HttpError(400, '缺少 chapterId');

    const percent = Number(body.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new HttpError(400, 'percent 需在 0-100 之间');
    }

    await getOwnedChapter(chapterId, user.uid);
    const completed = Boolean(body.completed) || percent >= 95;

    const record = await prisma.readingProgress.upsert({
      where: { userId_chapterId: { userId: user.uid, chapterId } },
      create: { userId: user.uid, chapterId, percent, completed },
      update: { percent, ...(completed ? { completed: true } : {}) },
    });

    return Response.json({
      percent: record.percent,
      completed: record.completed,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
