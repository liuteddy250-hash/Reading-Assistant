'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { normalizeWord, splitParagraphs, tokenizeWords } from '@/lib/text';

export type ReaderAnnotation = {
  id: string;
  kind: string;
  quote: string;
  paragraph: number;
  startInP: number;
  translation: string | null;
};

type HardIndex = Record<string, { level: number; meaning?: string }>;

type Props = {
  bookId: string;
  bookTitle: string;
  chapter: { id: string; title: string; content: string; wordCount: number };
  annotations: ReaderAnnotation[];
  hardIndex: HardIndex;
  studied: boolean;
  prevId: string | null;
  nextId: string | null;
};

type Anchor = { paragraph: number; start: number; end: number; text: string };
type Rect = { top: number; left: number; bottom: number; right: number };

type Panel = {
  kind: 'selection' | 'word' | 'annotation';
  rect: Rect;
  quote: string;
  anchor?: Anchor;
  word?: string;
  level?: number;
  meaning?: string;
  annotation?: ReaderAnnotation;
  translation?: string | null;
  loading?: boolean;
  note?: string;
};

type TranslateResponse = {
  mode: 'word' | 'sentence';
  translation?: string | null;
  meaning?: string;
  pos?: string;
  phonetic?: string;
  degraded?: boolean;
  message?: string;
  error?: string;
};

function elementOf(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement;
  return node as HTMLElement;
}

function rectOf(range: Range): Rect {
  const rect = range.getBoundingClientRect();
  return { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right };
}

export function Reader({
  bookId,
  bookTitle,
  chapter,
  annotations,
  hardIndex,
  studied,
  prevId,
  nextId,
}: Props) {
  const paragraphs = useMemo(() => splitParagraphs(chapter.content), [chapter.content]);
  const [anns, setAnns] = useState<ReaderAnnotation[]>(annotations);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [showHard, setShowHard] = useState(true);
  const [fontSize, setFontSize] = useState(19);
  const [toast, setToast] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    if (!panel) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.popup')) return;
      if (target.closest('[data-reader]')) return;
      setPanel(null);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [panel]);

  const anchorFromRange = useCallback(
    (range: Range): Anchor | null => {
      const startPara = elementOf(range.startContainer)?.closest('[data-p]') as HTMLElement | null;
      if (!startPara) return null;
      const index = Number(startPara.dataset.p);
      const text = paragraphs[index] ?? '';
      if (!text) return null;

      const pre = document.createRange();
      pre.selectNodeContents(startPara);
      pre.setEnd(range.startContainer, range.startOffset);
      const rawStart = pre.toString().length;

      const endPara = elementOf(range.endContainer)?.closest('[data-p]') as HTMLElement | null;
      const rawEnd =
        endPara === startPara ? rawStart + range.toString().length : text.length;

      const slice = text.slice(rawStart, rawEnd);
      const trimmed = slice.trim();
      if (!trimmed) return null;
      const start = rawStart + (slice.length - slice.trimStart().length);
      return { paragraph: index, start, end: start + trimmed.length, text: trimmed };
    },
    [paragraphs],
  );

  async function addWord(term: string, context?: string) {
    const clean = term.trim();
    if (!clean) return;
    try {
      const response = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ term: clean, context, chapterId: chapter.id }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        notify(data.error || '加入生词本失败');
        return;
      }
      notify(`已加入生词本：${clean}`);
    } catch {
      notify('网络异常，加入生词本失败');
    }
  }

  function handleMouseUp(event: ReactMouseEvent) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!range) return;

    // Double click / double tap: send the word straight to the vocabulary book.
    if (event.detail >= 2) {
      const anchor = anchorFromRange(range);
      const word = (anchor?.text ?? '').replace(/[^A-Za-z'’-]/g, '');
      if (word) {
        const level = hardIndex[normalizeWord(word)]?.level;
        void addWord(word, anchor ? paragraphs[anchor.paragraph] : undefined);
        setPanel({
          kind: 'word',
          rect: rectOf(range),
          quote: word,
          word,
          level,
          meaning: hardIndex[normalizeWord(word)]?.meaning,
        });
      }
      return;
    }

    const anchor = anchorFromRange(range);
    if (!anchor) return;
    setPanel({ kind: 'selection', rect: rectOf(range), quote: anchor.text, anchor });
  }

  function handleArticleClick(event: ReactMouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const annotationEl = target.closest('[data-ann]');
    if (annotationEl) {
      const id = annotationEl.getAttribute('data-ann');
      const annotation = anns.find((item) => item.id === id);
      if (annotation) {
        setPanel({
          kind: 'annotation',
          rect: annotationEl.getBoundingClientRect(),
          quote: annotation.quote,
          annotation,
          translation: annotation.translation,
        });
        return;
      }
    }

    const wordEl = target.closest('[data-word]');
    if (wordEl) {
      const word = wordEl.getAttribute('data-word') ?? '';
      if (!word) return;
      const index = hardIndex[normalizeWord(word)];
      setPanel({
        kind: 'word',
        rect: wordEl.getBoundingClientRect(),
        quote: word,
        word,
        level: index?.level,
        meaning: index?.meaning,
      });
    }
  }

  async function translateText(text: string, context?: string): Promise<TranslateResponse> {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, context }),
    });
    const data = (await response.json().catch(() => ({}))) as TranslateResponse;
    if (!response.ok) throw new Error(data.error || '翻译失败');
    return data;
  }

  async function translateSelection() {
    if (!panel || panel.kind !== 'selection' || !panel.anchor) return;
    const anchor = panel.anchor;
    const current = panel;
    setPanel({ ...current, loading: true, note: undefined });

    try {
      const data = await translateText(anchor.text, paragraphs[anchor.paragraph]);
      const translation = (data.mode === 'word' ? data.meaning : data.translation) ?? '';
      let annotation: ReaderAnnotation | null = null;

      if (translation) {
        const saved = await fetch('/api/annotations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chapterId: chapter.id,
            kind: 'translation',
            quote: anchor.text,
            paragraph: anchor.paragraph,
            startInP: anchor.start,
            translation,
          }),
        });
        if (saved.ok) {
          const payload = (await saved.json()) as { annotation: ReaderAnnotation };
          annotation = payload.annotation;
          setAnns((prev) => [...prev, payload.annotation]);
        }
      }

      setPanel({
        ...current,
        translation: translation || null,
        loading: false,
        note: data.degraded ? data.message : undefined,
        annotation: annotation ?? undefined,
      });
    } catch (error) {
      setPanel({ ...current, loading: false, note: (error as Error).message });
    }
  }

  async function underlineSelection() {
    if (!panel || panel.kind !== 'selection' || !panel.anchor) return;
    const anchor = panel.anchor;
    try {
      const response = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chapterId: chapter.id,
          kind: 'underline',
          quote: anchor.text,
          paragraph: anchor.paragraph,
          startInP: anchor.start,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        annotation?: ReaderAnnotation;
        error?: string;
      };
      if (!response.ok || !data.annotation) {
        notify(data.error || '添加下划线失败');
        return;
      }
      setAnns((prev) => [...prev, data.annotation as ReaderAnnotation]);
      setPanel(null);
      notify('已添加下划线');
    } catch {
      notify('网络异常，请稍后重试');
    }
  }

  async function translateWordPanel() {
    if (!panel || panel.kind !== 'word' || !panel.word) return;
    const current = panel;
    const word = panel.word;
    setPanel({ ...current, loading: true, note: undefined });
    try {
      const data = await translateText(word, paragraphs[0]);
      setPanel({
        ...current,
        loading: false,
        meaning: data.meaning ?? data.translation ?? undefined,
        note: data.degraded ? data.message : undefined,
      });
    } catch (error) {
      setPanel({ ...current, loading: false, note: (error as Error).message });
    }
  }

  async function translateAnnotationPanel() {
    if (!panel || panel.kind !== 'annotation' || !panel.annotation) return;
    const current = panel;
    const annotation = panel.annotation;
    setPanel({ ...current, loading: true, note: undefined });
    try {
      const data = await translateText(annotation.quote);
      setPanel({
        ...current,
        loading: false,
        translation: (data.translation ?? data.meaning) || current.translation,
        note: data.degraded ? data.message : undefined,
      });
    } catch (error) {
      setPanel({ ...current, loading: false, note: (error as Error).message });
    }
  }

  async function deleteAnnotation(id: string) {
    if (!window.confirm('删除这条标记？')) return;
    const response = await fetch(`/api/annotations/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      notify('删除失败');
      return;
    }
    setAnns((prev) => prev.filter((item) => item.id !== id));
    setPanel(null);
    notify('已删除标记');
  }

  const renderedParagraphs = useMemo(() => {
    return paragraphs.map((text, index) => {
      const cuts = new Set<number>([0, text.length]);
      const tokens = showHard ? tokenizeWords(text) : [];

      if (showHard) {
        for (const token of tokens) {
          if (hardIndex[normalizeWord(token.text)]) {
            cuts.add(token.start);
            cuts.add(token.end);
          }
        }
      }

      const paraAnns = anns.filter((annotation) => annotation.paragraph === index);
      for (const annotation of paraAnns) {
        const start = Math.max(0, Math.min(annotation.startInP, text.length));
        const end = Math.max(start, Math.min(annotation.startInP + annotation.quote.length, text.length));
        cuts.add(start);
        cuts.add(end);
      }

      const points = Array.from(cuts).sort((a, b) => a - b);
      const nodes: ReactNode[] = [];

      for (let i = 0; i < points.length - 1; i += 1) {
        const start = points[i];
        const end = points[i + 1];
        if (start >= end) continue;

        const segment = text.slice(start, end);
        const annotation = paraAnns.find(
          (item) => start >= item.startInP && start < item.startInP + item.quote.length,
        );
        const token = showHard
          ? tokens.find((item) => start >= item.start && start < item.end)
          : undefined;
        const hard = token ? hardIndex[normalizeWord(token.text)] : undefined;

        if (!annotation && !hard) {
          nodes.push(<span key={i}>{segment}</span>);
          continue;
        }

        const classes = [];
        if (hard) classes.push('hard-word', `lv${hard.level}`);
        if (annotation) classes.push('ann-mark', annotation.translation ? 'has-translation' : '');

        nodes.push(
          <span
            key={i}
            className={classes.join(' ').trim()}
            data-ann={annotation?.id}
            data-word={hard ? token?.text : undefined}
            title={hard?.meaning}
          >
            {segment}
          </span>,
        );
      }

      return (
        <p key={index} data-p={index} className={index === 0 ? 'para-first' : undefined}>
          {nodes}
        </p>
      );
    });
  }, [paragraphs, anns, hardIndex, showHard]);

  const popupStyle: CSSProperties | undefined = useMemo(() => {
    if (!panel) return undefined;
    if (typeof window === 'undefined') return undefined;
    const width = 340;
    const left = Math.max(12, Math.min(panel.rect.left, window.innerWidth - width - 12));
    const top = Math.max(12, Math.min(panel.rect.bottom + 10, window.innerHeight - 300));
    return { top, left, width };
  }, [panel]);

  const sortedAnns = [...anns].sort(
    (a, b) => a.paragraph - b.paragraph || a.startInP - b.startInP,
  );

  return (
    <div className="reader-shell" data-reader>
      <div>
        <div className="reader-toolbar">
          <Link className="btn ghost sm" href={`/books/${bookId}`}>
            ← 章节
          </Link>
          <span className="muted tiny" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bookTitle}
          </span>
          <span className="separator" />
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setShowHard((value) => !value)}
          >
            {showHard ? '隐藏难词高亮' : '显示难词高亮'}
          </button>
          <span className="row" style={{ gap: 4 }}>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setFontSize((size) => Math.max(16, size - 1))}
            >
              A−
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setFontSize((size) => Math.min(26, size + 1))}
            >
              A+
            </button>
          </span>
          <span className="separator" />
          <Link className="link-btn" href={`/books/${bookId}/prestudy/${chapter.id}`}>
            预习材料
          </Link>
          <div style={{ flex: 1 }} />
          {prevId ? (
            <Link className="btn ghost sm" href={`/books/${bookId}/read/${prevId}`}>
              上一章
            </Link>
          ) : null}
          {nextId ? (
            <Link className="btn ghost sm" href={`/books/${bookId}/read/${nextId}`}>
              下一章
            </Link>
          ) : null}
        </div>

        <article
          className="reader-article"
          ref={articleRef}
          style={{ fontSize }}
          onMouseUp={handleMouseUp}
          onClick={handleArticleClick}
        >
          <header className="chapter-heading">
            <h1>{chapter.title}</h1>
            <div className="tiny muted" style={{ fontFamily: 'var(--font-ui)' }}>
              {chapter.wordCount.toLocaleString()} 词
              {studied ? ' · 预习已完成' : ' · 未完成预习'}
              {' · 选中文字可翻译 / 下划线；双击单词加入生词本'}
            </div>
          </header>
          {renderedParagraphs}
        </article>
      </div>

      <aside className="side-panel">
        <div className="side-card">
          <h3>本章标记 · {sortedAnns.length}</h3>
          {sortedAnns.length === 0 ? (
            <div className="tiny muted">
              选中正文任意片段，点击「翻译」或「下划线」，记录会出现在这里。
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {sortedAnns.map((annotation) => (
                <div className="ann-item" key={annotation.id}>
                  <div className="ann-quote">{annotation.quote}</div>
                  {annotation.translation ? (
                    <div className="ann-trans">{annotation.translation}</div>
                  ) : null}
                  <div className="row" style={{ gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => deleteAnnotation(annotation.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="side-card">
          <h3>图例</h3>
          <div className="legend">
            <span>
              <i className="swatch lv2" /> 较难词汇（点击查词）
            </span>
            <span>
              <i className="swatch lv3" /> 高难词汇
            </span>
            <span>
              <i className="swatch ann" /> 我的划线 / 译文
            </span>
          </div>
          <div className="divider" />
          <Link className="link-btn" href="/vocabulary">
            打开生词本 →
          </Link>
        </div>
      </aside>

      {panel ? (
        <div className="popup" style={popupStyle} onMouseDown={(event) => event.stopPropagation()}>
          <div className="popup-head">
            <span className="popup-title">
              {panel.kind === 'selection'
                ? '选中内容'
                : panel.kind === 'word'
                  ? '单词'
                  : '我的标记'}
            </span>
            <button type="button" className="popup-close" onClick={() => setPanel(null)}>
              ×
            </button>
          </div>

          <p className="popup-quote">{panel.quote}</p>

          {panel.kind === 'word' && panel.level ? (
            <div className="row" style={{ marginTop: 6 }}>
              <span className={`badge ${panel.level >= 3 ? 'warn' : 'info'}`}>
                难度 {panel.level}/3
              </span>
            </div>
          ) : null}

          {panel.meaning ? <div className="popup-translation">{panel.meaning}</div> : null}
          {panel.translation ? (
            <div className="popup-translation">{panel.translation}</div>
          ) : null}

          {panel.loading ? (
            <div className="popup-note">
              <span className="spinner dark" /> 正在翻译…
            </div>
          ) : null}
          {panel.note ? <div className="popup-note">{panel.note}</div> : null}

          <div className="popup-actions">
            {panel.kind === 'selection' ? (
              <>
                <button type="button" className="btn sm" onClick={translateSelection} disabled={panel.loading}>
                  翻译
                </button>
                <button type="button" className="btn ghost sm" onClick={underlineSelection}>
                  下划线
                </button>
                <button
                  type="button"
                  className="btn subtle sm"
                  onClick={() => {
                    void addWord(panel.quote, panel.anchor ? paragraphs[panel.anchor.paragraph] : undefined);
                  }}
                >
                  加入生词本
                </button>
              </>
            ) : null}

            {panel.kind === 'word' ? (
              <>
                {!panel.meaning ? (
                  <button type="button" className="btn sm" onClick={translateWordPanel} disabled={panel.loading}>
                    查询释义
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn subtle sm"
                  onClick={() => {
                    if (panel.word) void addWord(panel.word);
                  }}
                >
                  加入生词本
                </button>
              </>
            ) : null}

            {panel.kind === 'annotation' && panel.annotation ? (
              <>
                {!panel.translation ? (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={translateAnnotationPanel}
                    disabled={panel.loading}
                  >
                    翻译
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={() => deleteAnnotation(panel.annotation!.id)}
                >
                  删除标记
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
