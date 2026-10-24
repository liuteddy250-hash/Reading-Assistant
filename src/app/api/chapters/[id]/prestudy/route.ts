import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOwnedChapter } from '@/lib/access';
import { errorResponse } from '@/lib/errors';
import { ensurePrestudy } from '@/lib/prestudy';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await getOwnedChapter(id, user.uid);

    const record = await prisma.prestudy.findUnique({ where: { chapterId: id } });
    if (!record) return Response.json({ prestudy: null });
    return Response.json({
      prestudy: JSON.parse(record.payload),
      source: record.source,
      studiedAt: record.studiedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await getOwnedChapter(id, user.uid);

    const force = new URL(request.url).searchParams.get('force') === '1';
    const record = await ensurePrestudy(id, force);
    return Response.json({
      prestudy: record.payload,
      source: record.source,
      studiedAt: record.studiedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
