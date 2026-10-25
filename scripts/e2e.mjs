/**
 * End-to-end acceptance test for the core flow:
 *   register -> upload PDF -> chapter list -> pre-study -> read (highlight)
 *   -> translate -> underline -> vocabulary
 *
 * Usage: node scripts/e2e.mjs   (BASE_URL defaults to http://127.0.0.1:3000)
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const results = [];
let cookie = '';

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${BASE}${urlPath}`, { ...options, headers, redirect: 'manual' });
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const raw of setCookies) {
    const pair = raw.split(';')[0];
    if (pair.includes('=')) cookie = pair;
  }
  return response;
}

function json(response) {
  return response.json();
}

const started = Date.now();
const mode = (await (await request('/api/auth/mode')).json()).mode;
console.log(`auth mode: ${mode}`);

// 1) Access check: multi-user redirects to login, single-user opens directly.
{
  const response = await request('/library');
  const location = response.headers.get('location') || '';
  if (mode === 'single') {
    check('单用户模式直接进入书库', response.status === 200, `${response.status}`);
  } else {
    check('未登录访问 /library 跳转登录', response.status === 307 && location.includes('/login'), `${response.status} ${location}`);
  }
}

// 2) Login page renders (multi) or is closed (single).
{
  const response = await request('/login');
  if (mode === 'single') {
    const location = response.headers.get('location') || '';
    check('单用户模式登录页已关闭', response.status === 307 && location.includes('/library'), `${response.status} ${location}`);
  } else {
    const html = await response.text();
    check('登录页可访问', response.status === 200 && html.includes('欢迎回来'));
  }
}

// 3) Register a fresh account.
const email = `e2e-${Date.now()}@example.com`;
const password = 'Passw0rd!2024';
if (mode === 'multi') {
  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'E2E' }),
  });
  const data = await json(response);
  check('邮箱注册成功', response.status === 201, data?.user?.email ?? JSON.stringify(data));
} else {
  check('单用户模式跳过注册', true);
}

// 4) Library page works with the session cookie.
{
  const response = await request('/library');
  const html = await response.text();
  check('登录后进入书库', response.status === 200 && html.includes('我的书库'));
}

// 5) Upload the sample PDF.
const pdfPath = path.join(process.cwd(), 'samples', 'sample-book.pdf');
const pdfBytes = readFileSync(pdfPath);
let bookId = '';
let chapters = [];
{
  const form = new FormData();
  form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'sample-book.pdf');
  form.append('title', 'Sample Book');

  const response = await request('/api/books', { method: 'POST', body: form });
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  bookId = data?.book?.id ?? '';
  check(
    '上传 PDF 并自动划分章节',
    response.status === 201 && Boolean(bookId) && (data?.book?._count?.chapters ?? 0) >= 2,
    `status=${response.status} chapters=${data?.book?._count?.chapters ?? 0} ${data.raw ?? data.error ?? ''}`,
  );
  if (!bookId) {
    console.log('\nAborting: upload failed, remaining checks need a book.');
    process.exit(1);
  }
}

// 6) Book detail page lists chapters.
{
  const response = await request(`/books/${bookId}`);
  const html = await response.text();
  check(
    '书籍详情页显示章节',
    response.status === 200 && html.includes('Chapter One') && html.includes('开始预习'),
  );
}

// 7) Read a chapter from the API to know ids/content.
{
  const response = await request(`/api/books/${bookId}`);
  const data = await json(response);
  chapters = data?.book?.chapters ?? [];
  check('章节接口返回正文', chapters.length > 0 && chapters[0].content.length > 100);
}

const first = chapters[0];
const second = chapters[1] ?? chapters[0];

// 8) Reading is gated on pre-study.
{
  const response = await request(`/books/${bookId}/read/${first.id}`);
  const location = response.headers.get('location') || '';
  check('未预习直接阅读被拦截', response.status === 307 && location.includes('/prestudy/'), `${response.status} ${location}`);
}

// 9) Generate pre-study (offline rules or a configured LLM), then verify the page.
{
  const generate = await request(`/api/chapters/${first.id}/prestudy`, { method: 'POST' });
  check('预习材料生成接口可用', generate.status === 200, `status=${generate.status}`);

  const response = await request(`/books/${bookId}/prestudy/${first.id}`);
  const html = await response.text();
  const ok = response.status === 200 && html.includes('长难句精讲') && html.includes('重点难词');
  check('预习页生成长难句与难词', ok, `status=${response.status} length=${html.length}`);
}

// 10) Pre-study payload structure via API.
{
  const response = await request(`/api/chapters/${first.id}/prestudy`);
  const data = await json(response);
  const payload = data?.prestudy;
  const ok =
    response.status === 200 &&
    Array.isArray(payload?.sentences) &&
    payload.sentences.length > 0 &&
    Array.isArray(payload?.words) &&
    payload.words.length > 0 &&
    typeof payload?.summary === 'string';
  check('预习数据包含 sentences/words/summary', Boolean(ok), `sentences=${payload?.sentences?.length} words=${payload?.words?.length}`);
}

// 11) Mark pre-study as studied.
{
  const response = await request(`/api/chapters/${first.id}/prestudy/complete`, { method: 'POST' });
  check('标记预习完成', response.status === 200);
}

// 12) Reader page renders with hard-word highlights and reader chrome.
{
  const response = await request(`/books/${bookId}/read/${first.id}`);
  const html = await response.text();
  const ok =
    response.status === 200 &&
    html.includes('hard-word') &&
    html.includes('ubiquitous');
  check('阅读页渲染正文并高亮难词', ok, `status=${response.status} length=${html.length}`);
}

// 13) Translation falls back to the offline dictionary.
{
  const response = await request('/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'ubiquitous', mode: 'word' }),
  });
  const data = await json(response);
  const meaning = String(data?.meaning ?? data?.translation ?? '');
  check(
    '划词翻译（离线词典降级）',
    response.status === 200 && data?.provider === 'offline' && meaning.length > 0,
    `${data?.provider} ${meaning.slice(0, 50)}`,
  );
}

// 13b) Optional: ECDICT coverage. CI has no data/ directory, so this is skipped there.
{
  if (existsSync(path.join(process.cwd(), 'data', 'ecdict.db'))) {
    const response = await request('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'serendipity', mode: 'word' }),
    });
    const data = await json(response);
    const meaning = String(data?.meaning ?? '');
    check('ECDICT 词典命中（内置词表没有的词）', response.status === 200 && meaning.includes('运气'), meaning.slice(0, 60));
  } else {
    console.log('SKIP  ECDICT 词典未安装（npm run dict:import 后可启用该断言）');
  }
}

// 13c) Any word can be looked up (Kindle-style click), with phonetic + exam tags.
//      Requires the ECDICT database; CI runs without it and skips this assertion.
{
  if (existsSync(path.join(process.cwd(), 'data', 'ecdict.db'))) {
    const response = await request('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'architecture', mode: 'word' }),
    });
    const data = await json(response);
    check(
      '任意词查词返回音标与考试标签',
      response.status === 200 &&
        Boolean(data?.phonetic) &&
        Array.isArray(data?.tags) &&
        data.tags.length > 0,
      `${data?.phonetic ?? '-'} ${(data?.tags ?? []).join(',')}`,
    );
  } else {
    console.log('SKIP  任意词查词（无 ECDICT 词典，回退内置词表）');
  }
}

// 14) Add a vocabulary entry (double-click behaviour) and auto-fill its meaning.
{
  const response = await request('/api/vocabulary', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ term: 'ubiquitous', chapterId: first.id, context: 'access to information almost ubiquitous' }),
  });
  const data = await json(response);
  check(
    '加入生词本并自动带释义',
    response.status === 201 && Boolean(data?.word?.meaning),
    String(data?.word?.meaning ?? '').slice(0, 40),
  );
}

// 15) Create an underline + translation annotation aligned with paragraph 1.
{
  const paragraphs = String(second.content)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const paragraphIndex = paragraphs.length > 1 ? 1 : 0;
  const quote = paragraphs[paragraphIndex].slice(0, 24);

  const response = await request('/api/annotations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chapterId: second.id,
      kind: 'translation',
      quote,
      paragraph: paragraphIndex,
      startInP: 0,
      translation: '这是测试译文',
    }),
  });
  const data = await json(response);
  check('创建划线 + 译文', response.status === 201 && Boolean(data?.annotation?.id), quote);
}

// 16) The reader shows the saved annotation.
{
  const response = await request(`/books/${bookId}/read/${second.id}?skip=1`);
  const html = await response.text();
  check('阅读页显示划线标记', response.status === 200 && html.includes('ann-mark'));
}

// 16b) Reading progress is persisted and surfaced in the book/library pages.
{
  const response = await request('/api/progress', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chapterId: first.id, percent: 42 }),
  });
  const data = await json(response);
  check(
    '保存阅读进度',
    response.status === 200 && Math.round(Number(data?.percent)) === 42,
    `percent=${data?.percent}`,
  );

  const page = await request(`/books/${bookId}`);
  const html = await page.text();
  check('书籍页显示已读进度与继续阅读', html.includes('已读 42%') && html.includes('继续阅读'));

  const library = await request('/library');
  const libraryHtml = await library.text();
  check('书库页显示上次阅读入口', library.status === 200 && libraryHtml.includes('上次读到'));
}

// 17) Vocabulary page lists the saved word.
{
  const response = await request('/vocabulary');
  const html = await response.text();
  check('生词本页面显示单词', response.status === 200 && html.includes('ubiquitous'));
}

// 18) API auth behaviour depends on the mode.
{
  if (mode === 'single') {
    const response = await request('/api/books');
    check('单用户模式 API 无需登录', response.status === 200, `${response.status}`);
  } else {
    const saved = cookie;
    cookie = '';
    const response = await request('/api/books');
    check('未登录调用 API 返回 401', response.status === 401);

    const progressResponse = await request('/api/progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chapterId: first.id, percent: 10 }),
    });
    check('未登录保存进度返回 401', progressResponse.status === 401);
    cookie = saved;
  }
}

// 19) PDF text extraction sanity: chapter text is clean English, no PDF syntax.
{
  const ok = chapters.every((chapter) => !chapter.content.includes('endobj') && !chapter.content.includes('stream'));
  check('PDF 文本提取干净', ok);
}

// 20) Front matter (title page, publisher notes, TOC, preface) is skipped.
{
  const frontBytes = readFileSync(path.join(process.cwd(), 'samples', 'sample-frontmatter.pdf'));
  const form = new FormData();
  form.append('file', new Blob([frontBytes], { type: 'application/pdf' }), 'sample-frontmatter.pdf');
  form.append('title', 'Front Matter Sample');

  const upload = await request('/api/books', { method: 'POST', body: form });
  const created = await upload.json();
  const frontBookId = created?.book?.id ?? '';

  const detail = await request(`/api/books/${frontBookId}`);
  const detailJson = await detail.json();
  const frontChapters = detailJson?.book?.chapters ?? [];
  const firstChapter = frontChapters[0] ?? { title: '', content: '' };

  check(
    '自动跳过文前内容（标题页/目录/前言）',
    upload.status === 201 &&
      frontChapters.length >= 2 &&
      String(firstChapter.title).includes('Chapter One') &&
      !String(firstChapter.content).includes('Table of Contents') &&
      !String(firstChapter.content).includes('Publisher Notes') &&
      !String(firstChapter.content).includes('This preface') &&
      String(firstChapter.content).includes('Reading in a second language'),
    `chapters=${frontChapters.length} first=${firstChapter.title} status=${upload.status}`,
  );
}

const passed = results.filter((item) => item.ok).length;
console.log(`\n${passed}/${results.length} checks passed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (passed !== results.length) {
  console.log('FAILED:', results.filter((item) => !item.ok).map((item) => item.name).join(', '));
  process.exitCode = 1;
}
