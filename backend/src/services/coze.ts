import { CozeAPI, ChatEventType, RoleType } from '@coze/api';
import { config } from '../config/index.js';

let cozeClient: CozeAPI | null = null;

function getCozeClient(): CozeAPI {
  if (!cozeClient) {
    cozeClient = new CozeAPI({
      token: config.coze.apiKey,
      baseURL: config.coze.baseUrl,
    });
  }
  return cozeClient;
}

export interface CozeStreamCallbacks {
  onMessage: (content: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamChat(
  botId: string,
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  callbacks: CozeStreamCallbacks
): Promise<void> {
  const client = getCozeClient();

  try {
    const stream = client.chat.stream({
      bot_id: botId,
      user_id: userId,
      auto_save_history: true,
      additional_messages: messages.map((m) => ({
        role: m.role === 'user' ? RoleType.User : RoleType.Assistant,
        content: m.content,
        content_type: 'text' as const,
      })),
    });

    for await (const event of stream) {
      if (event.event === ChatEventType.CONVERSATION_MESSAGE_DELTA) {
        callbacks.onMessage(event.data.content);
      } else if (event.event === ChatEventType.CONVERSATION_CHAT_COMPLETED) {
        callbacks.onDone();
      }
    }
  } catch (err) {
    callbacks.onError(err as Error);
  }
}

export function getDefaultBotId(): string {
  return config.coze.defaultBotId;
}
