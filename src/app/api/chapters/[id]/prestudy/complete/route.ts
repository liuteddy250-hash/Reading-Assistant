import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOwnedChapter } from '@/lib/access';
import { errorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/** Marks the pre-study material of a chapter as studied, unlocking free reading. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await getOwnedChapter(id, user.uid);

    const record = await prisma.prestudy.upsert({
      where: { chapterId: id },
      create: {
        chapterId: id,
        payload: '{}',
        status: 'ready',
        source: 'offline',
        studiedAt: new Date(),
      },
      update: { studiedAt: new Date() },
    });

    return Response.json({ studiedAt: record.studiedAt });
  } catch (error) {
    return errorResponse(error);
  }
}
