export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMError';
  }
}

const BASE_URL = (process.env.LLM_BASE_URL ?? '').trim().replace(/\/+$/, '');
const API_KEY = (process.env.LLM_API_KEY ?? '').trim();
const MODEL = (process.env.LLM_MODEL ?? '').trim() || 'deepseek-chat';

export function llmEnabled(): boolean {
  return Boolean(BASE_URL && API_KEY);
}

export function llmModel(): string {
  return MODEL;
}

type Message = { role: 'system' | 'user'; content: string };

function extractJson(raw: string): string {
  const withoutFence = raw.replace(/```(?:json)?/gi, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return withoutFence;
  return withoutFence.slice(start, end + 1);
}

async function request(
  messages: Message[],
  json: boolean,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 45000);
  const payload: Record<string, unknown> = { model: MODEL, messages, temperature, max_tokens: maxTokens };
  if (json) payload.response_format = { type: 'json_object' };

  const send = async (body: Record<string, unknown>) => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new LLMError(`LLM HTTP ${res.status}: ${detail}`);
    }
    return (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
  };

  let data;
  try {
    data = await send(payload);
  } catch (error) {
    // Some OpenAI-compatible providers reject `response_format`; retry without it.
    if (json && error instanceof LLMError && error.message.includes('400')) {
      data = await send({ model: MODEL, messages, temperature, max_tokens: maxTokens });
    } else {
      throw error;
    }
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LLMError('LLM returned an empty response');
  return content;
}

export async function chatText(system: string, user: string): Promise<string> {
  const content = await request(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    false,
    0.2,
    600,
  );
  return content.trim();
}

function looseParse(raw: string): unknown | null {
  const cleaned = extractJson(raw)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const content = await request(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    true,
    0.2,
    2400,
  );

  const parsed = looseParse(content);
  if (parsed) return parsed as T;

  // Small local models sometimes truncate or loop; ask for a shorter valid payload.
  const retry = await request(
    [
      {
        role: 'system',
        content: `${system}\n严格只输出一个合法 JSON 对象：不要解释、不要省略引号或括号、数组里不要多余逗号。`,
      },
      {
        role: 'user',
        content: `${user}\n\n上一次输出不合法或过长。请输出更短的一版：最多 4 个句子、10 个单词。`,
      },
    ],
    true,
    0.3,
    2400,
  );

  const retried = looseParse(retry);
  if (retried) return retried as T;
  throw new LLMError('LLM returned invalid JSON');
}
