/**
 * Verifies the LLM-enabled code paths without spending tokens:
 *   1. pre-study page renders the client-generation shell (non-blocking render)
 *   2. generation falls back to offline when the LLM endpoint is unreachable
 *   3. word lookups stay on ECDICT (dictionary-first, no LLM call)
 *
 * Usage:
 *   # start the app with an unreachable LLM endpoint first, e.g.:
 *   #   LLM_API_KEY=test LLM_BASE_URL=http://127.0.0.1:9/v1 LLM_TIMEOUT_MS=2000 npm start
 *   BASE_URL=http://127.0.0.1:3001 node scripts/check-llm-fallback.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
let cookie = '';
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${BASE}${urlPath}`, { ...options, headers, redirect: 'manual' });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(';')[0];
    if (pair.includes('=')) cookie = pair;
  }
  return response;
}

const json = (response) => response.json();

const email = `llm-path-${Date.now()}@example.com`;
{
  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Passw0rd!2024' }),
  });
  check('注册测试账号', response.status === 201);
}

const pdf = readFileSync(path.join(process.cwd(), 'samples', 'sample-book.pdf'));
let bookId = '';
let chapterId = '';
{
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'sample-book.pdf');
  const response = await request('/api/books', { method: 'POST', body: form });
  const data = await json(response);
  bookId = data?.book?.id ?? '';
  check('上传样例书', response.status === 201 && Boolean(bookId));
}

{
  const response = await request(`/api/books/${bookId}`);
  const data = await json(response);
  chapterId = data?.book?.chapters?.[0]?.id ?? '';
  check('读取章节', Boolean(chapterId));
}

// 1) The page must return immediately with a loading shell, not block on the LLM.
{
  const response = await request(`/books/${bookId}/prestudy/${chapterId}`);
  const html = await response.text();
  check(
    '大模型模式下预习页不阻塞渲染',
    response.status === 200 && html.includes('正在用大模型生成'),
  );
}

// 2) The POST falls back to offline content when the model endpoint is down.
{
  const started = Date.now();
  const response = await request(`/api/chapters/${chapterId}/prestudy`, { method: 'POST' });
  const data = await json(response);
  check(
    '大模型不可用时回退离线预习',
    response.status === 200 && data?.source === 'offline' && (data?.prestudy?.words?.length ?? 0) > 0,
    `source=${data?.source} ${Math.round((Date.now() - started) / 1000)}s`,
  );
}

// 3) After generation the page renders the material.
{
  const response = await request(`/books/${bookId}/prestudy/${chapterId}`);
  const html = await response.text();
  check('生成后预习页正常显示', response.status === 200 && html.includes('长难句精讲'));
}

// 4) Word lookups must not hit the LLM: ECDICT answers instantly.
{
  const started = Date.now();
  const response = await request('/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'architecture', mode: 'word' }),
  });
  const data = await json(response);
  check(
    '单击查词走词典而非大模型',
    response.status === 200 && data?.provider === 'offline' && Boolean(data?.phonetic),
    `${data?.provider} ${Date.now() - started}ms`,
  );
}

const passed = results.filter((item) => item.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) process.exitCode = 1;
