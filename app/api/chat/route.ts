import { NextRequest } from 'next/server';
import { appendMessages, getMessages } from '@/lib/server/storage';
import type { Message } from '@/types';

const BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://token-plan-cn.xiaomimimo.com/v1';
const API_KEY = process.env.OPENAI_API_KEY ?? '';
const MODEL = process.env.LLM_MODEL ?? 'mimo-v2.5';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { conversationId, content } = body as { conversationId: string; content: string };

  if (!conversationId || !content?.trim()) {
    return new Response(JSON.stringify({ error: 'conversationId and content are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load conversation history from storage
  const history = getMessages(conversationId);
  const apiMessages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
  apiMessages.push({ role: 'user', content: content.trim() });

  const upstream = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages: apiMessages, stream: true }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(JSON.stringify({ error: text }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Stream to client while collecting the full response for persistence
  const userMessage: Message = {
    id: crypto.randomUUID(),
    role: 'user',
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
  const assistantId = crypto.randomUUID();
  let assistantContent = '';

  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        // Persist messages after stream completes
        const assistantMessage: Message = {
          id: assistantId,
          role: 'assistant',
          content: assistantContent,
          createdAt: new Date().toISOString(),
        };
        appendMessages(conversationId, [userMessage, assistantMessage]);
        controller.close();
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) {
          controller.enqueue(new TextEncoder().encode(line + '\n'));
          continue;
        }
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          controller.enqueue(new TextEncoder().encode(line + '\n'));
          continue;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) assistantContent += delta;
        } catch {
          // skip
        }
        controller.enqueue(new TextEncoder().encode(line + '\n'));
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
