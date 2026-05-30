import { conversations as mockConversations, initialMessages, knowledgeBases } from '@/data/mock';
import type { Message } from '@/types';

export function createWelcomeMessage(kbName: string): Message {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: `你好，我已准备好基于「${kbName}」中的资料回答问题。开始输入你的问题吧，我会尽量附上可验证的引用来源。`,
    citations: [],
    createdAt: new Date().toISOString(),
  };
}

export function buildInitialMessagesMap(): Record<string, Message[]> {
  const map: Record<string, Message[]> = {};
  mockConversations.forEach((chat) => {
    const kbName = knowledgeBases.find((kb) => kb.id === chat.knowledgeBaseId)?.name ?? '当前知识库';
    map[chat.id] = chat.id === 'chat_001' ? initialMessages : [createWelcomeMessage(kbName)];
  });
  return map;
}
