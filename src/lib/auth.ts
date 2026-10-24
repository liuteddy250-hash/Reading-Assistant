import { cookies } from 'next/headers';
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
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Throws 401 when the visitor is not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new HttpError(401, '请先登录');
  return session;
}
