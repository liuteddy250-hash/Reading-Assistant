import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { LogoutButton } from './LogoutButton';

export async function Nav() {
  const session = await getSession();

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href={session ? '/library' : '/login'} className="brand">
          <span className="brand-mark">R</span>
          ReadEasy
        </Link>

        {session ? (
          <nav className="nav-links">
            <Link className="nav-link" href="/library">
              书库
            </Link>
            <Link className="nav-link" href="/vocabulary">
              生词本
            </Link>
          </nav>
        ) : null}

        <div className="nav-spacer" />

        {session ? (
          <div className="row" style={{ gap: 12 }}>
            <span className="nav-user" title={session.email}>
              {session.email}
            </span>
            <LogoutButton />
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn ghost sm" href="/login">
              登录
            </Link>
            <Link className="btn sm" href="/register">
              注册
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
