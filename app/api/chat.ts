// Coze API 配置
const COZE_API_BASE = process.env.NEXT_PUBLIC_COZE_API_BASE || 'https://api.coze.cn';
const COZE_CHAT_TOKEN = process.env.NEXT_PUBLIC_COZE_CHAT_TOKEN!;
const DEFAULT_BOT_ID = process.env.NEXT_PUBLIC_COZE_BOT_ID!;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CozeMessage {
  role: 'user' | 'assistant';
  type: 'question' | 'answer';
  content_type: 'text';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  botId?: string;
  userId?: string;
  stream?: boolean;
}

export async function sendChatMessage(
  params: ChatRequest,
  onDelta?: (content: string) => void,
  onCompleted?: (content: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    const { messages, botId, userId = 'test_user_id_123', stream = true } = params;

    const botIdToUse = botId || DEFAULT_BOT_ID;

    console.log('[Coze Chat] bot_id:', botIdToUse);
    console.log('[Coze Chat] user_id:', userId);
    console.log('[Coze Chat] messages count:', messages.length);

    // 构建 Coze 请求格式
    const additionalMessages: CozeMessage[] = messages.map(m => ({
      role: m.role,
      type: m.role === 'user' ? 'question' : 'answer',
      content_type: 'text',
      content: m.content,
    }));

    const requestData = {
      bot_id: botIdToUse,
      user_id: userId,
      stream: stream,
      additional_messages: additionalMessages,
    };

    console.log('[Coze Chat] requesting Coze API...');

    const response = await fetch(`${COZE_API_BASE}/v3/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_CHAT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log('[Coze Chat] response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Coze Chat] API error:', response.status, errorText);
      if (onError) onError(`API 错误 ${response.status}: ${errorText}`);
      return;
    }

    // 处理流式响应
    if (stream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === '') continue;

          // Coze SSE 格式
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);

              // 处理不同类型的事件
              if (data.event === 'conversation.message.delta') {
                // 增量消息
                if (data.content) {
                  fullContent += data.content;
                  console.log('[Coze Chat] delta, total length:', fullContent.length);
                  if (onDelta) onDelta(fullContent);
                }
              } else if (data.event === 'conversation.message.completed') {
                // 消息完成
                if (data.content) {
                  fullContent = data.content;
                  console.log('[Coze Chat] completed, total length:', fullContent.length);
                  if (onCompleted) onCompleted(fullContent);
                }
              } else if (data.event === 'conversation.chat.completed') {
                // 聊天完成
                console.log('[Coze Chat] chat completed');
                if (onCompleted) onCompleted(fullContent);
              } else if (data.event === 'conversation.chat.failed') {
                // 聊天失败
                const errorMsg = data.last_error?.msg || '聊天失败';
                console.error('[Coze Chat] chat failed:', errorMsg);
                if (onError) onError(errorMsg);
                return;
              }

              // 兼容直接返回内容的格式
              if (data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                if (choice.delta?.content) {
                  fullContent += choice.delta.content;
                  if (onDelta) onDelta(fullContent);
                }
                if (choice.finish_reason === 'stop') {
                  if (onCompleted) onCompleted(fullContent);
                }
              }

              // 处理直接返回内容的格式
              if (data.content && !data.event) {
                fullContent += data.content;
                console.log('[Coze Chat] content:', fullContent.length);
                if (onDelta) onDelta(fullContent);
              }

              // 处理完成状态
              if (data.done || data.status === 'completed') {
                console.log('[Coze Chat] completed, total length:', fullContent.length);
                if (onCompleted) onCompleted(fullContent);
              }
            } catch (e) {
              console.warn('[Coze Chat] parse error:', e, dataStr.slice(0, 100));
            }
          }
        }
      }

      // 确保完成回调被调用
      if (fullContent && onCompleted) {
        onCompleted(fullContent);
      }
    } else {
      // 非流式响应
      const responseData = await response.json();
      console.log('[Coze Chat] non-stream response:', responseData);

      let content = '';

      // 处理 Coze 响应格式
      if (responseData.code !== 0) {
        const errorMsg = responseData.msg || '请求失败';
        if (onError) onError(errorMsg);
        return;
      }

      // 从 data 中获取内容
      if (responseData.data) {
        if (responseData.data.content) {
          content = responseData.data.content;
        }
      }

      // 兼容其他格式
      if (!content && responseData.choices && responseData.choices.length > 0) {
        content = responseData.choices[0].message?.content || '';
      }

      if (content) {
        if (onDelta) onDelta(content);
        if (onCompleted) onCompleted(content);
      }
    }
  } catch (error) {
    console.error('[Coze Chat] fetch error:', error);
    if (onError) onError('发送消息失败，请检查网络连接');
  }
}
