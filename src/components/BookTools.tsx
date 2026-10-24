'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type RangeRow = { title: string; start: string; end: string };

type Props = {
  bookId: string;
  bookTitle: string;
  pageCount: number;
  status: string;
};

export function BookTools({ bookId, bookTitle, pageCount, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [rows, setRows] = useState<RangeRow[]>([
    { title: '第一章', start: '1', end: String(Math.min(pageCount, 20)) },
  ]);

  async function resplit(mode: 'auto' | 'manual') {
    setBusy(true);
    setMessage(null);

    try {
      const payload =
        mode === 'auto'
          ? { mode: 'auto' as const }
          : {
              mode: 'manual' as const,
              ranges: rows.map((row) => ({
                title: row.title.trim() || undefined,
                start: Number(row.start),
                end: Number(row.end),
              })),
            };

      const response = await fetch(`/api/books/${bookId}/resplit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        chapters?: number;
      };

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || '划分失败' });
        return;
      }

      setMessage({ type: 'info', text: `已重新划分为 ${data.chapters ?? 0} 个章节` });
      setOpen(false);
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: '网络异常，请稍后重试' });
    } finally {
      setBusy(false);
    }
  }

  async function removeBook() {
    if (!window.confirm(`确认删除《${bookTitle}》？章节、预习材料、划线记录都会一并删除，且不可恢复。`)) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage({ type: 'error', text: data.error || '删除失败' });
        return;
      }
      router.push('/library');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      {message ? <div className={`alert ${message.type}`}>{message.text}</div> : null}

      <div className="row">
        <button
          type="button"
          className="btn ghost sm"
          disabled={busy || status === 'no_text_layer'}
          onClick={() => resplit('auto')}
        >
          重新自动划分章节
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setOpen((value) => !value)}>
          {open ? '收起手动划分' : '手动按页划分'}
        </button>
        <button type="button" className="btn danger sm" disabled={busy} onClick={removeBook}>
          删除这本书
        </button>
      </div>

      {open ? (
        <div className="card" style={{ padding: 18, marginTop: 12 }}>
          <p className="muted tiny" style={{ marginTop: 0 }}>
            本书共 <strong>{pageCount}</strong> 页。按 1 起始的页码范围手动划分；
            手动划分会<strong>覆盖</strong>现有章节及其预习材料。
          </p>

          <div className="split-form">
            {rows.map((row, index) => (
              <div className="split-row" key={index}>
                <input
                  className="input"
                  placeholder={`第 ${index + 1} 章标题`}
                  value={row.title}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { ...row, title: event.target.value };
                    setRows(next);
                  }}
                />
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={row.start}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { ...row, start: event.target.value };
                    setRows(next);
                  }}
                />
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={row.end}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { ...row, end: event.target.value };
                    setRows(next);
                  }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="删除该行"
                  onClick={() => setRows(rows.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn subtle sm"
              onClick={() => {
                const last = rows[rows.length - 1];
                const start = last ? Math.min(Number(last.end) + 1, pageCount) : 1;
                setRows([...rows, { title: '', start: String(start), end: String(pageCount) }]);
              }}
            >
              + 添加一章
            </button>
            <button
              type="button"
              className="btn sm"
              disabled={busy || rows.length === 0}
              onClick={() => resplit('manual')}
            >
              {busy ? <span className="spinner" /> : null}
              保存划分
            </button>
            <span className="muted tiny">起始页 / 结束页（含）</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
