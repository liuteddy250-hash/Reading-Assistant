'use client';

import { useMemo, useState } from 'react';

export type VocabRow = {
  id: string;
  term: string;
  surface: string;
  meaning: string | null;
  context: string | null;
  pos: string | null;
  phonetic: string | null;
  createdAt: string;
  chapterTitle?: string | null;
  bookTitle?: string | null;
  bookId?: string | null;
};

export function VocabTable({ initialWords }: { initialWords: VocabRow[] }) {
  const [words, setWords] = useState(initialWords);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return words;
    return words.filter((word) =>
      [word.term, word.surface, word.meaning ?? '', word.context ?? '', word.bookTitle ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [words, query]);

  async function remove(id: string) {
    if (!window.confirm('从生词本删除该条目？')) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/vocabulary/${id}`, { method: 'DELETE' });
      if (response.ok) setWords((prev) => prev.filter((word) => word.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const header = ['word', 'meaning', 'pos', 'book', 'chapter', 'context', 'createdAt'];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [header.join(',')].concat(
      words.map((word) =>
        [
          word.term,
          word.meaning ?? '',
          word.pos ?? '',
          word.bookTitle ?? '',
          word.chapterTitle ?? '',
          word.context ?? '',
          word.createdAt,
        ]
          .map((value) => escape(String(value)))
          .join(','),
      ),
    );
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vocabulary.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="vocab-toolbar">
        <input
          className="input"
          placeholder="搜索单词、释义或书名…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="btn ghost sm" onClick={exportCsv} disabled={words.length === 0}>
          导出 CSV
        </button>
        <span className="muted tiny" style={{ alignSelf: 'center' }}>
          共 {words.length} 条{query ? `，筛选出 ${filtered.length} 条` : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          {words.length === 0
            ? '生词本还是空的。阅读时双击单词，或在弹出菜单中选择「加入生词本」。'
            : '没有匹配的条目。'}
        </div>
      ) : (
        <table className="vocab-table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>单词</th>
              <th>释义</th>
              <th style={{ width: 220 }}>来源 / 语境</th>
              <th style={{ width: 90 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((word) => (
              <tr key={word.id}>
                <td>
                  <div className="vocab-term">{word.surface}</div>
                  <div className="muted tiny">
                    {word.phonetic ? `${word.phonetic} ` : ''}
                    {word.pos ?? ''}
                  </div>
                </td>
                <td>
                  <div>{word.meaning ?? <span className="muted">—</span>}</div>
                  {word.context ? (
                    <div className="muted tiny" style={{ marginTop: 4, fontFamily: 'var(--font-read)' }}>
                      {word.context.slice(0, 140)}
                    </div>
                  ) : null}
                </td>
                <td className="tiny muted">
                  {word.bookTitle ? (
                    <a href={`/books/${word.bookId}`} style={{ color: 'var(--brand)' }}>
                      {word.bookTitle}
                    </a>
                  ) : (
                    '—'
                  )}
                  <div>{word.chapterTitle ?? ''}</div>
                  <div>{new Date(word.createdAt).toLocaleDateString('zh-CN')}</div>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn danger sm"
                    disabled={busyId === word.id}
                    onClick={() => remove(word.id)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
