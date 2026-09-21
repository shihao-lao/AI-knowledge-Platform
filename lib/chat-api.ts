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
  onCompleted: (content: string, citations: Array<{
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    preview: string;
    confidenceScore: number;
  }>) => void;
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
        messages: [{ role: 'user', content: request.question }],
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 处理 SSE 事件
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            callbacks.onCompleted(fullContent, citations);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'delta' && parsed.content) {
              fullContent += parsed.content;
              callbacks.onDelta(fullContent);
            } else if (parsed.type === 'citations' && parsed.citations) {
              citations = parsed.citations;
            } else if (parsed.type === 'error') {
              callbacks.onError(parsed.message || '聊天出错');
              return;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    // 流结束
    callbacks.onCompleted(fullContent, citations);
  } catch (error) {
    callbacks.onError(error instanceof Error ? error.message : '网络错误');
  }
}
