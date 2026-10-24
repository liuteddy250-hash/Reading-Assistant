'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type Feedback = { type: 'error' | 'warn' | 'info'; text: string } | null;

export function UploadPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function pick(next: File | null) {
    if (!next) return;
    if (!next.name.toLowerCase().endsWith('.pdf')) {
      setFeedback({ type: 'error', text: '请选择 PDF 文件' });
      return;
    }
    setFile(next);
    setFeedback(null);
    if (!title) setTitle(next.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '));
  }

  async function upload() {
    if (!file) {
      setFeedback({ type: 'error', text: '请先选择一个 PDF 文件' });
      return;
    }
    setBusy(true);
    setFeedback(null);

    const body = new FormData();
    body.append('file', file);
    if (title.trim()) body.append('title', title.trim());

    try {
      const response = await fetch('/api/books', { method: 'POST', body });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        warning?: string;
        book?: { title: string; _count?: { chapters: number } };
      };

      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error || '上传失败' });
        return;
      }

      if (data.warning) {
        setFeedback({ type: 'warn', text: data.warning });
      } else {
        setFeedback({
          type: 'info',
          text: `已导入《${data.book?.title ?? ''}》，自动划分 ${data.book?._count?.chapters ?? 0} 个章节`,
        });
      }

      setFile(null);
      setTitle('');
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    } catch {
      setFeedback({ type: 'error', text: '网络异常，上传失败' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card upload">
      <div className="section-title">上传一本英文书</div>

      {feedback ? <div className={`alert ${feedback.type}`}>{feedback.text}</div> : null}

      <div
        className={`dropzone${dragging ? ' drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files?.[0] ?? null);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
      >
        <strong>{file ? file.name : '拖拽 PDF 到此处，或点击选择文件'}</strong>
        <span className="muted tiny">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB · 上传后会自动提取文本并划分章节`
            : '支持文本型 PDF（扫描件需先 OCR）'}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />

      <div className="upload-row">
        <input
          className="input"
          placeholder="书名（可选，默认取文件名）"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="button" className="btn" onClick={upload} disabled={busy || !file}>
          {busy ? <span className="spinner" /> : null}
          {busy ? '解析中…' : '上传并解析'}
        </button>
      </div>
    </section>
  );
}
