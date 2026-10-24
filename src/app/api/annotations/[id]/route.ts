import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, errorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const annotation = await prisma.annotation.findFirst({ where: { id, userId: user.uid } });
    if (!annotation) throw new HttpError(404, '标记不存在');
    await prisma.annotation.delete({ where: { id: annotation.id } });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
