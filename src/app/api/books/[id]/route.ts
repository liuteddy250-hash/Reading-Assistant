import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOwnedBook } from '@/lib/access';
import { errorResponse } from '@/lib/errors';
import { deleteStoredFile } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const book = await getOwnedBook(id, user.uid);
    return Response.json({ book });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const book = await getOwnedBook(id, user.uid);
    await prisma.book.delete({ where: { id: book.id } });
    await deleteStoredFile(book.filePath);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
