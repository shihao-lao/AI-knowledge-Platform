
import { prisma } from '../utils/prisma.js';
import { Conversation, Message } from '@prisma/client';

export async function listConversations(
  kbId?: string,
  limit = 20,
  offset = 0
): Promise<{ items: Conversation[]; total: number }> {
  const where = kbId ? { knowledgeBaseId: kbId } : {};
  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.conversation.count({ where }),
  ]);
  return { items, total };
}

export async function getConversation(id: string): Promise<(Conversation & { messages: Message[] }) | null> {
  return prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function createConversation(data: {
  knowledgeBaseId: string;
  title?: string;
}): Promise<Conversation> {
  return prisma.conversation.create({ data });
}

export async function deleteConversation(id: string): Promise<void> {
  await prisma.conversation.delete({ where: { id } });
}

export async function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, 'title' | 'messageCount'>>
): Promise<Conversation> {
  return prisma.conversation.update({ where: { id }, data });
}

export async function addMessages(
  conversationId: string,
  messages: Array<{ role: string; content: string; cozeMessageId?: string }>
): Promise<Message[]> {
  await prisma.message.createMany({
    data: messages.map((m) => ({ ...m, conversationId })),
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { messageCount: { increment: messages.length } },
  });

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}
