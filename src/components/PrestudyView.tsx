'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PrestudyPayload } from '@/lib/types';

type Props = {
  bookId: string;
  chapter: { id: string; title: string; wordCount: number };
  payload: PrestudyPayload;
  studied: boolean;
  source: string;
};

export function PrestudyView({ bookId, chapter, payload, studied, source }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<'generate' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy('generate');
    setError(null);
    try {
      const response = await fetch(`/api/chapters/${chapter.id}/prestudy?force=1`, { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || '生成失败，请稍后重试');
        return;
      }
      router.refresh();
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setBusy(null);
    }
  }

  async function startReading() {
    setBusy('complete');
    setError(null);
    try {
      if (!studied) {
        const response = await fetch(`/api/chapters/${chapter.id}/prestudy/complete`, {
          method: 'POST',
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setError(data.error || '操作失败');
          return;
        }
      }
      router.push(`/books/${bookId}/read/${chapter.id}`);
      router.refresh();
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="prestudy-shell">
      <section className="prestudy-hero">
        <div className="row tiny muted" style={{ marginBottom: 8 }}>
          <Link href={`/books/${bookId}`} className="link-btn">
            ← 返回章节列表
          </Link>
          <span>·</span>
          <span>第 {chapter.wordCount.toLocaleString()} 词</span>
        </div>
        <h1>{chapter.title}</h1>
        <div className="row" style={{ marginBottom: 12 }}>
          <span className={`badge ${source === 'llm' ? 'ok' : 'warn'}`}>
            {source === 'llm' ? 'AI 生成' : '离线规则分析'}
          </span>
          <span className="badge">{payload.sentences.length} 个长难句</span>
          <span className="badge">{payload.words.length} 个难词</span>
          {studied ? <span className="badge ok">已完成预习</span> : null}
        </div>
        <p>{payload.summary}</p>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      {source !== 'llm' ? (
        <div className="alert info">
          当前是<strong>离线分析模式</strong>（未配置或调用失败 <code>LLM_API_KEY</code>）。
          难词释义来自内置词库，长难句给出结构与意群拆解，但不含参考译文；
          配置大模型后可一键重新生成完整讲解。
        </div>
      ) : null}

      <section>
        <h2 className="section-title">一、长难句精讲</h2>
        {payload.sentences.length === 0 ? (
          <div className="empty">本章没有筛出特别长的句子，可以直接进入阅读。</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {payload.sentences.map((sentence, index) => (
              <article className="sentence-card" key={index}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="badge">长难句 {index + 1}</span>
                  <span className="muted tiny">
                    {sentence.text.split(/\s+/).filter(Boolean).length} 词
                  </span>
                </div>
                <p className="sentence-quote">{sentence.text}</p>

                {sentence.chunks && sentence.chunks.length > 0 ? (
                  <div className="sentence-block">
                    <div className="sentence-label">意群切分</div>
                    <div className="chunks">
                      {sentence.chunks.map((chunk, chunkIndex) => (
                        <span className="chunk" key={chunkIndex}>
                          {chunk}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {sentence.structure ? (
                  <div className="sentence-block">
                    <div className="sentence-label">结构拆解</div>
                    <div style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.75 }}>
                      {sentence.structure}
                    </div>
                  </div>
                ) : null}

                {sentence.translation ? (
                  <div className="sentence-block">
                    <div className="sentence-label">参考译文</div>
                    <div style={{ fontSize: 14.5, color: 'var(--brand-dark)', lineHeight: 1.75 }}>
                      {sentence.translation}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">二、重点难词</h2>
        {payload.words.length === 0 ? (
          <div className="empty">本章没有筛出高难度词汇。</div>
        ) : (
          <div className="word-grid">
            {payload.words.map((word) => (
              <div className="word-card" key={word.word}>
                <div className="word-head">
                  <span className="word-term">{word.word}</span>
                  {word.phonetic ? <span className="muted tiny">{word.phonetic}</span> : null}
                  {word.pos ? <span className="word-pos">{word.pos}</span> : null}
                </div>
                <div className="word-meaning">{word.meaning}</div>
                {word.example ? <div className="word-example">{word.example}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="prestudy-actions">
        <div className="row">
          <button
            type="button"
            className="btn ghost sm"
            onClick={regenerate}
            disabled={busy !== null}
          >
            {busy === 'generate' ? <span className="spinner dark" /> : null}
            {busy === 'generate' ? '生成中…' : '重新生成预习材料'}
          </button>
        </div>
        <div className="row">
          <Link className="link-btn" href={`/books/${bookId}/read/${chapter.id}?skip=1`}>
            跳过预习，直接阅读
          </Link>
          <button type="button" className="btn" onClick={startReading} disabled={busy !== null}>
            {busy === 'complete' ? <span className="spinner" /> : null}
            {studied ? '进入阅读' : '完成预习，开始阅读'}
          </button>
        </div>
      </div>
    </div>
  );
}
