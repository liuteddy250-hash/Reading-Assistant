'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type Props = {
  mode: 'login' | 'register';
  nextPath: string;
};

export function AuthForm({ mode, nextPath }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error || '操作失败，请稍后重试');
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError('网络异常，请检查连接后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>{isRegister ? '创建你的阅读账号' : '欢迎回来'}</h1>
      <p className="hint">
        {isRegister
          ? '注册后即可上传 PDF、生成预习材料并开始阅读。'
          : '登录后继续你的书库与生词本。'}
      </p>

      {error ? <div className="alert error">{error}</div> : null}

      <form onSubmit={onSubmit}>
        {isRegister ? (
          <div className="field">
            <label htmlFor="name">昵称（可选）</label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="怎么称呼你"
              autoComplete="nickname"
            />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            className="input"
            type="password"
            required
            minLength={isRegister ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isRegister ? '至少 8 位字符' : '输入密码'}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </div>

        <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
          {busy ? <span className="spinner" /> : null}
          {busy ? '处理中…' : isRegister ? '注册并进入书库' : '登录'}
        </button>
      </form>

      <div className="auth-footer">
        {isRegister ? (
          <>
            已有账号？<Link href="/login">直接登录</Link>
          </>
        ) : (
          <>
            还没有账号？<Link href="/register">免费注册</Link>
          </>
        )}
      </div>
    </div>
  );
}
