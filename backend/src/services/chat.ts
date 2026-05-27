import * as convService from './conversations.js';
import * as kbService from './kb.js';
import * as cozeService from './coze.js';
import { config } from '../config/index.js';

export async function sendMessage(
  conversationId: string,
  content: string,
  onChunk: (chunk: string) => void,
  onDone: (fullContent: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  const conversation = await convService.getConversation(conversationId);
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { status: 404 });
  }

  const kb = await kbService.getKnowledgeBase(conversation.knowledgeBaseId);
  if (!kb) {
    throw Object.assign(new Error('Knowledge base not found'), { status: 404 });
  }

  const botId = kb.cozeBotId || cozeService.getDefaultBotId();
  if (!botId) {
    throw Object.assign(new Error('No bot ID configured'), { status: 500 });
  }

  await convService.addMessages(conversationId, [
    { role: 'user', content },
  ]);

  const messages = await convService.getMessages(conversationId);
  const history = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  let fullContent = '';

  await cozeService.streamChat(botId, config.defaultUserId, history, {
    onMessage: (chunk) => {
      fullContent += chunk;
      onChunk(chunk);
    },
    onDone: async () => {
      await convService.addMessages(conversationId, [
        { role: 'assistant', content: fullContent },
      ]);
      onDone(fullContent);
    },
    onError: (err) => {
      onError(err);
    },
  });
}
