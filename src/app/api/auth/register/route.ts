import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { HttpError, errorResponse } from '@/lib/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      name?: string;
    };

    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    const name = (body.name ?? '').trim() || null;

    if (!EMAIL_RE.test(email)) throw new HttpError(400, '请输入有效的邮箱地址');
    if (password.length < 8) throw new HttpError(400, '密码至少 8 位');
    if (password.length > 72) throw new HttpError(400, '密码过长');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, '该邮箱已注册，请直接登录');

    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hash(password, 10) },
    });

    await setSession({ uid: user.id, email: user.email, name: user.name });
    return Response.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
