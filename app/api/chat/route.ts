import { NextRequest } from 'next/server';
import { requireUser, AuthError } from '@/lib/server/auth';
import { handleChat, ChatNotFoundError } from '@/lib/server/rag/chat-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const { conversationId, question, enableSearch = false } = body ?? {};

    if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'conversationId 不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (typeof question !== 'string' || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: '问题不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (question.length > 2000) {
      return new Response(JSON.stringify({ error: '问题过长' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = await handleChat({
      conversationId: conversationId.trim(),
      question: question.trim(),
      userId: user.id,
      enableSearch: !!enableSearch,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (err instanceof ChatNotFoundError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[Chat API] error:', err);
    return new Response(JSON.stringify({ error: '聊天请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
