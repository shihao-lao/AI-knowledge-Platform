import 'server-only';

const MIMO_BASE_URL = process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';
const MIMO_API_KEY = process.env.MIMO_API_KEY || '';
const MIMO_MODEL = process.env.MIMO_MODEL || 'mimo-v2.5';

/**
 * 开发/测试用模拟 LLM：设置 LLM_MOCK=1 时不调用外部 API，
 * 返回确定性回答（含 [1] 引用标记），用于验证 RAG 管线与离线开发。
 */
const LLM_MOCK = process.env.LLM_MOCK === '1';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export class LlmError extends Error {}

function mockResponse(messages: LlmMessage[]): string {
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '未知问题';
  return (
    `这是模拟回答（LLM_MOCK 模式）。\n` +
    `针对问题「${question}」，示例引用参见 [1]。\n` +
    `配置有效的 MIMO_API_KEY 并移除 LLM_MOCK=1 后可获得真实回答。`
  );
}

function buildRequest(messages: LlmMessage[], options: LlmOptions & { stream: boolean }) {
  return {
    model: MIMO_MODEL,
    messages,
    stream: options.stream,
    temperature: options.temperature ?? 0.7,
    max_completion_tokens: options.maxTokens ?? 1024,
  };
}

/** 非流式对话补全 */
export async function llmChat(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
  if (LLM_MOCK) return mockResponse(messages);

  const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MIMO_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequest(messages, { ...options, stream: false })),
    signal: options?.signal ?? AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new LlmError(`MiMo API 错误 ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * 流式对话补全：逐段产出 content delta。
 * 调用方通过 for await 消费；外层 signal 中断时会提前结束。
 */
export async function* llmChatStream(
  messages: LlmMessage[],
  options?: LlmOptions,
): AsyncGenerator<string> {
  if (LLM_MOCK) {
    const text = mockResponse(messages);
    for (let i = 0; i < text.length; i += 12) {
      yield text.slice(i, i + 12);
    }
    return;
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const signal = options?.signal;
  signal?.addEventListener('abort', onAbort);
  try {
    const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${MIMO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequest(messages, { ...options, stream: true })),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new LlmError(`MiMo API 错误 ${response.status}: ${text.slice(0, 300)}`);
    }
    if (!response.body) {
      throw new LlmError('MiMo 未返回流式响应体');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') return;
        try {
          const data = JSON.parse(dataStr) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = data.choices?.[0]?.delta;
          if (delta?.content) yield delta.content;
        } catch {
          // 忽略非 JSON 行
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
