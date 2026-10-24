import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { HttpError, errorResponse } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    if (!email || !password) throw new HttpError(400, '请输入邮箱和密码');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(401, '邮箱或密码不正确');

    const ok = await compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, '邮箱或密码不正确');

    await setSession({ uid: user.id, email: user.email, name: user.name });
    return Response.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    return errorResponse(error);
  }
}
