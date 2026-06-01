interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  botId?: string;
  userId?: string;
  stream?: boolean;
  enableSearch?: boolean;
}

/**
 * 发送聊天消息到服务端 /api/chat（含联网搜索）
 */
export async function sendChatMessage(
  params: ChatRequest,
  onDelta?: (content: string) => void,
  onCompleted?: (content: string) => void,
  onError?: (error: string) => void,
): Promise<void> {
  try {
    const { messages, stream = true, enableSearch = true } = params;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream, enableSearch }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: '请求失败' }));
      console.error('[Chat] API error:', response.status, errData);
      if (onError) onError(errData.error || `请求失败: ${response.status}`);
      return;
    }

    // 流式响应
    if (stream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
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
              if (onDelta) onDelta(fullContent);
              continue;
            }

            if (data.type === 'done') {
              completed = true;
              if (onCompleted) onCompleted(fullContent);
              continue;
            }

            if (data.type === 'error') {
              console.error('[Chat] server error:', data.message);
              if (onError) onError(data.message || '对话失败');
              return;
            }
          } catch {
            // 忽略非 JSON 行
          }
        }
      }

      // 确保完成回调被调用
      if (fullContent && !completed && onCompleted) {
        onCompleted(fullContent);
      }
    } else {
      // 非流式响应
      const data = await response.json();
      if (data.error) {
        if (onError) onError(data.error);
        return;
      }
      const content = data.content || '';
      if (content) {
        if (onDelta) onDelta(content);
        if (onCompleted) onCompleted(content);
      }
    }
  } catch (error) {
    console.error('[Chat] fetch error:', error);
    if (onError) onError('发送消息失败，请检查网络连接');
  }
}
