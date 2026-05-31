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
