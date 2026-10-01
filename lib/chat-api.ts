/**
 * Chat API 客户端 - 处理与后端的 SSE 流式通信
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Token 存储 key
const TOKEN_KEY = 'auth_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export interface ChatRequest {
  conversationId: string;
  question: string;
  enableSearch?: boolean;
  mode?: 'question' | 'interview';
}

export interface ChatCallbacks {
  onDelta: (content: string) => void;
  onCompleted: (
    content: string,
    citations: Array<{
      documentId: string;
      documentTitle: string;
      chunkIndex: number;
      preview: string;
      confidenceScore: number;
    }>,
  ) => void;
  onError: (error: string) => void;
}

/**
 * 发送聊天消息（SSE 流式）
 */
export async function sendChatMessage(request: ChatRequest, callbacks: ChatCallbacks): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversation_id: request.conversationId,
        question: request.question,
        enable_search: request.enableSearch ?? true,
        mode: request.mode ?? 'question',
      }),
    });

    if (!response.ok) {
      // 401 未授权：token 过期，清除并跳转登录
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
          const currentPath = window.location.pathname;
          window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
        }
        callbacks.onError('登录已过期，请重新登录');
        return;
      }

      const body = await response.json().catch(() => ({}));
      let error: string;
      if (typeof body === 'object' && body !== null) {
        if (typeof body.detail === 'string') {
          error = body.detail;
        } else if (Array.isArray(body.detail)) {
          error = body.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ');
        } else if (typeof body.error === 'string') {
          error = body.error;
        } else {
          error = `HTTP ${response.status}`;
        }
      } else {
        error = `HTTP ${response.status}`;
      }
      callbacks.onError(error);
      return;
    }

    // 处理 SSE 流
    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('无法读取响应流');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let citations: Array<{
      documentId: string;
      documentTitle: string;
      chunkIndex: number;
      preview: string;
      confidenceScore: number;
    }> = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          callbacks.onError('回答中断：连接已结束，但未收到完成确认。可以重试此问题。');
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        // Dispatch only fully framed SSE events; preserve partial UTF-8 and CRLF across reads.
        let boundary: RegExpExecArray | null;
        while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
          const event = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary[0].length);
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).replace(/^ /, ''))
            .join('\n');
          if (!data) continue;
          if (data.trim() === '[DONE]') {
            callbacks.onCompleted(fullContent, citations);
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            callbacks.onError('回答中断：收到无法解析的响应，请重试此问题。');
            return;
          }
          if (parsed?.type === 'delta' && typeof parsed.content === 'string') {
            fullContent += parsed.content;
            callbacks.onDelta(fullContent);
          } else if (parsed?.type === 'citations' && Array.isArray(parsed.citations)) {
            citations = parsed.citations;
          } else if (parsed?.type === 'error') {
            callbacks.onError(parsed.message || '聊天出错');
            return;
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } catch (error) {
    callbacks.onError(`回答中断：${error instanceof Error ? error.message : '网络错误'}。请重试此问题。`);
  }
}
