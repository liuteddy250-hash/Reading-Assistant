'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="card" style={{ padding: 28 }}>
      <h1 className="page-title" style={{ fontSize: 22 }}>
        页面出错了
      </h1>
      <p className="page-sub" style={{ marginBottom: 16 }}>
        {error.message || '未知错误'}
      </p>
      <div className="row">
        <button type="button" className="btn" onClick={reset}>
          重试
        </button>
        <Link className="btn ghost" href="/library">
          返回书库
        </Link>
      </div>
    </div>
  );
}
