import { clearSession } from '@/lib/auth';
import { errorResponse } from '@/lib/errors';

export async function POST() {
  try {
    await clearSession();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
