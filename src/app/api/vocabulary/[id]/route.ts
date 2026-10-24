import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, errorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const word = await prisma.word.findFirst({ where: { id, userId: user.uid } });
    if (!word) throw new HttpError(404, '生词不存在');
    await prisma.word.delete({ where: { id: word.id } });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
