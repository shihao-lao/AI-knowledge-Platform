import { cozeFetch, cozeConfig } from './coze-api';
import type { Message, Citation, Conversation } from '@/types';

export interface CozeChatMessage {
  role: 'user' | 'assistant' | 'tool';
  type: string;
  content: string;
  content_type: string;
}

export interface ChatStreamEvent {
  event:
    | 'message'
    | 'message_end'
    | 'message_file'
    | 'conversation_message_completed'
    | 'done'
    | 'error'
    | 'citation'
    | 'thinking';
  data: string;
  chat_id?: string;
  conversation_id?: string;
}

export interface ChatParams {
  bot_id?: string;
  user_id?: string;
  conversation_id?: string;
  additional_messages?: CozeChatMessage[];
  stream?: boolean;
  custom_variables?: Record<string, string>;
  auto_save_history?: boolean;
}

export interface CreateConversationParams {
  bot_id?: string;
  user_id?: string;
}

export async function createConversation(
  params?: CreateConversationParams
): Promise<{ id: string }> {
  const botId = params?.bot_id || cozeConfig.getBotId();
  if (!botId) throw new Error('Bot ID is not configured');

  return cozeFetch<{ id: string }>('/v1/conversations', {
    method: 'POST',
 body: JSON.stringify({
    ...(params || {}),
    bot_id: botId,
    user_id: params?.user_id || 'default_user',
  }),
  });
}

export async function listConversations(): Promise<Conversation[]> {
  const botId = cozeConfig.getBotId();
  if (!botId) return [];

  const data = await cozeFetch<{
    conversations: Array<{
      id: string;
      created_at: number;
      updated_at: number;
      status: string;
    }>;
  }>(`/v1/conversations?bot_id=${botId}&page_num=1&page_size=50`);

  return (data.conversations || []).map((conv) => ({
    id: conv.id,
    knowledgeBaseId: '',
    title: `对话 ${conv.id.slice(0, 8)}`,
    messageCount: 0,
    createdAt: new Date(conv.created_at).toISOString(),
    updatedAt: new Date(conv.updated_at).toISOString(),
  }));
}

export async function deleteConversation(
  conversationId: string
): Promise<void> {
  await cozeFetch<void>(`/v1/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  await cozeFetch<void>(`/v1/conversations/${conversationId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: title }),
  });
}

export async function* chatStream(
  params: ChatParams
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const token = cozeConfig.getToken();
  if (!token) throw new Error('Coze access token is not configured');

  const botId = params.bot_id || cozeConfig.getBotId();
  if (!botId) throw new Error('Bot ID is not configured');

  const response = await fetch(`${cozeConfig.apiBase}/v3/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
      bot_id: botId,
      user_id: params.user_id || 'default_user',
      stream: true,
      auto_save_history: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const jsonStr = line.slice(5).trim();
          if (jsonStr === '[DONE]') {
            yield { event: 'done', data: '' };
            return;
          }
          const data = JSON.parse(jsonStr);
          yield parseStreamEvent(data);
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      }
    }
  }
}

function parseStreamEvent(data: Record<string, unknown>): ChatStreamEvent {
  const event = (data.event as ChatStreamEvent['event']) || 'message';

  if (event === 'message') {
    const message = data.message as Record<string, unknown>;
    const content = (message?.content as string) || '';
    const role = (message?.role as string) || 'assistant';

    return {
      event: role === 'assistant' ? 'message' : 'thinking',
      data: content,
      chat_id: data.chat_id as string,
      conversation_id: data.conversation_id as string,
    };
  }

  if (event === 'message_end') {
    return {
      event: 'done',
      data: '',
      chat_id: data.chat_id as string,
      conversation_id: data.conversation_id as string,
    };
  }

  return {
    event,
    data: typeof data.data === 'string' ? data.data : JSON.stringify(data.data),
  };
}

export async function sendMessage(
  params: Omit<ChatParams, 'stream'>
): Promise<Message[]> {
  const events: ChatStreamEvent[] = [];
  let fullContent = '';
  const citations: Citation[] = [];

  for await (const event of chatStream({ ...params, stream: true })) {
    events.push(event);

    if (event.event === 'message') {
      fullContent += event.data;
    }
  }

  return [
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: fullContent,
      citations,
      createdAt: new Date().toISOString(),
    },
  ];
}
