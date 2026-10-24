import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty">
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>404 · 找不到这个页面</div>
      <p style={{ marginTop: 0 }}>链接可能已失效，或者这本书不属于当前账号。</p>
      <Link className="btn ghost sm" href="/library">
        返回书库
      </Link>
    </div>
  );
}
