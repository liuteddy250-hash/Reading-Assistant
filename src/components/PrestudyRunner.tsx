'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Props = {
  bookId: string;
  chapterId: string;
  title: string;
};

/**
 * Generates pre-study material on the client when an LLM is configured, so the
 * page renders immediately instead of blocking the server render for ~45s.
 * Offline generation is fast and still happens inline on the server.
 */
export function PrestudyRunner({ bookId, chapterId, title }: Props) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSeconds(0);

    fetch(`/api/chapters/${chapterId}/prestudy`, { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || '生成失败');
        }
        if (!cancelled) router.refresh();
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message || '生成失败');
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, attempt, router]);

  return (
    <div className="prestudy-shell">
      <section className="prestudy-hero">
        <div className="tiny muted" style={{ marginBottom: 8 }}>
          课前预习
        </div>
        <h1>{title}</h1>
        <p>
          {error
            ? '生成失败，可以重试，或跳过预习直接阅读。'
            : '正在用大模型生成长难句讲解与难词表，通常需要 10–40 秒，请保持页面打开。'}
        </p>

        <div className="row" style={{ marginTop: 14 }}>
          {error ? (
            <>
              <div className="alert error" style={{ marginBottom: 0 }}>
                {error}
              </div>
              <button type="button" className="btn sm" onClick={() => setAttempt((value) => value + 1)}>
                重试
              </button>
            </>
          ) : (
            <>
              <span className="spinner dark" />
              <span className="muted tiny">已等待 {seconds}s</span>
            </>
          )}
          <Link className="link-btn" href={`/books/${bookId}/read/${chapterId}?skip=1`}>
            跳过预习，直接阅读
          </Link>
        </div>
      </section>
    </div>
  );
}
