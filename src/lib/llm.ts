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

export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const content = await request(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    true,
    0.2,
    1600,
  );
  return JSON.parse(extractJson(content)) as T;
}
