// Coze API 配置
const COZE_API_BASE = process.env.NEXT_PUBLIC_COZE_API_BASE || 'https://api.coze.cn';
const COZE_CHAT_TOKEN = process.env.NEXT_PUBLIC_COZE_CHAT_TOKEN!;
const DEFAULT_BOT_ID = process.env.NEXT_PUBLIC_COZE_BOT_ID!;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
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

    // 构建 Coze 请求格式，过滤 system 消息并将其内容添加到第一条用户消息中
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const systemContent = systemMessages.map(m => m.content).join('\n\n');

    const additionalMessages: CozeMessage[] = nonSystemMessages.map((m, i) => {
      // 将 system 内容添加到第一条用户消息前面
      const content = i === 0 && systemContent
        ? `${systemContent}\n\n${m.content}`
        : m.content;
      return {
        role: m.role as 'user' | 'assistant',
        type: m.role === 'user' ? 'question' : 'answer',
        content_type: 'text',
        content,
      };
    });

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
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '') continue;
          if (!trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            completed = true;
            continue;
          }

          try {
            const data = JSON.parse(dataStr);

            // 知识库召回事件：跳过，不展示
            if (data.msg_type === 'knowledge_recall') {
              console.log('[Coze Chat] knowledge recall');
              continue;
            }

            // 回答完成事件
            if (data.msg_type === 'generate_answer_finish') {
              completed = true;
              console.log('[Coze Chat] answer finished, length:', fullContent.length);
              if (onCompleted) onCompleted(fullContent);
              continue;
            }

            // 错误事件
            if (data.msg_type === 'error' || data.msg_type === 'chat_failed') {
              const errorMsg = data.data?.msg || data.msg || '对话失败';
              console.error('[Coze Chat] error:', errorMsg);
              if (onError) onError(errorMsg);
              return;
            }

            // 回答内容（type: "answer" / role: "assistant"）
            if (data.type === 'answer' && data.role === 'assistant' && typeof data.content === 'string') {
              // 使用替换策略：当 content 比已累积内容更长时，直接替换（支持增量+完整两种模式）
              if (data.content.length > fullContent.length) {
                fullContent = data.content;
              } else {
                fullContent += data.content;
              }
              if (onDelta) onDelta(fullContent);
              continue;
            }

            // 兼容：带 msg_type 的 answer 事件
            if (data.msg_type === 'answer' && typeof data.content === 'string') {
              fullContent += data.content;
              if (onDelta) onDelta(fullContent);
              continue;
            }

            // 兼容 OpenAI / message-row  格式
            if (data.choices?.[0]?.delta?.content) {
              fullContent += data.choices[0].delta.content;
              if (onDelta) onDelta(fullContent);
              if (data.choices[0].finish_reason === 'stop') {
                if (onCompleted) onCompleted(fullContent);
                completed = true;
              }
              continue;
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
