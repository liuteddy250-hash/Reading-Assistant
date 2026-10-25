import { cookies } from 'next/headers';
import { prisma } from './db';
import { HttpError } from './errors';
import {
  SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
  type SessionUser,
} from './jwt';

export type { SessionUser } from './jwt';
export { SESSION_COOKIE } from './jwt';

const MAX_AGE = 60 * 60 * 24 * 7;

/**
 * `multi` (default): email + password, per-user data isolation.
 * `single`: no login at all — every request runs as one local account.
 * Toggle with AUTH_MODE=single|multi (rebuild required, middleware inlines it).
 */
export function authMode(): 'single' | 'multi' {
  return (process.env.AUTH_MODE ?? '').trim().toLowerCase() === 'single' ? 'single' : 'multi';
}

export function authDisabled(): boolean {
  return authMode() === 'single';
}

let cachedLocalUser: SessionUser | null = null;

async function localUser(): Promise<SessionUser> {
  if (cachedLocalUser) return cachedLocalUser;

  const preferredEmail = (process.env.LOCAL_USER_EMAIL ?? '').trim();

  let user = preferredEmail
    ? await prisma.user.findUnique({ where: { email: preferredEmail } })
    : null;

  if (!user) {
    // Keep an existing library visible: pick the account that owns the most books.
    const [best] = await prisma.user.findMany({
      orderBy: { books: { _count: 'desc' } },
      take: 1,
    });
    user = best ?? null;
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: preferredEmail || 'local@readeasy.local',
        name: '本地用户',
        passwordHash: 'single-user-mode',
      },
    });
  }

  cachedLocalUser = { uid: user.id, email: user.email, name: user.name };
  return cachedLocalUser;
}

export async function setSession(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  if (authDisabled()) return localUser();

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Throws 401 when the visitor is not signed in (multi-user mode only). */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new HttpError(401, '请先登录');
  return session;
}
