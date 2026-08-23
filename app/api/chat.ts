import type { Citation } from '@/types';

interface SendChatParams {
  conversationId: string;
  question: string;
  enableSearch?: boolean;
}

interface ChatHandlers {
  /** 流式增量（content 为累计全文） */
  onDelta?: (content: string) => void;
  /** 流式结束（content 为全文，citations 为服务端校验后的引用） */
  onCompleted?: (content: string, citations: Citation[]) => void;
  onError?: (error: string) => void;
}

/**
 * 发送聊天消息到服务端 /api/chat（服务端完成 RAG 检索、历史管理、引用校验与落库）
 */
export async function sendChatMessage(
  params: SendChatParams,
  handlers: ChatHandlers = {},
): Promise<void> {
  const { conversationId, question, enableSearch = false } = params;
  const { onDelta, onCompleted, onError } = handlers;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, question, enableSearch }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: '请求失败' }));
      console.error('[Chat] API error:', response.status, errData);
      onError?.(errData.error || `请求失败: ${response.status}`);
      return;
    }

    if (!response.body) {
      onError?.('服务端未返回流式响应');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let completed = false;

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
        if (dataStr === '[DONE]') {
          completed = true;
          continue;
        }

        try {
          const data = JSON.parse(dataStr);

          if (data.type === 'answer' && typeof data.content === 'string') {
            fullContent += data.content;
            onDelta?.(fullContent);
            continue;
          }

          if (data.type === 'done') {
            completed = true;
            onCompleted?.(fullContent, data.citations ?? []);
            continue;
          }

          if (data.type === 'error') {
            console.error('[Chat] server error:', data.message);
            onError?.(data.message || '对话失败');
            return;
          }
        } catch {
          // 忽略非 JSON 行
        }
      }
    }

    // 兜底：流未正常结束但已有内容
    if (fullContent && !completed) {
      onCompleted?.(fullContent, []);
    }
  } catch (error) {
    console.error('[Chat] fetch error:', error);
    onError?.('发送消息失败，请检查网络连接');
  }
}
