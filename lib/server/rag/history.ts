import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { llmChat } from '@/lib/server/llm/client';
import { HISTORY_SUMMARY_SYSTEM_PROMPT } from './prompts';

/** 完整保留的最近消息条数（约 6 轮对话） */
export const HISTORY_WINDOW = 12;

/** 参与摘要的早期消息上限 */
const SUMMARY_MESSAGE_CAP = 20;
/** 摘要输入字符上限 */
const SUMMARY_CHAR_CAP = 12000;

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LoadedHistory {
  /** 超出窗口的早期对话摘要（缓存于 Conversation.summary），可能为 null */
  summary: string | null;
  /** 窗口内的最近消息 */
  recent: HistoryMessage[];
}

/**
 * 加载对话历史并做滑动窗口管理：
 * - 最近 HISTORY_WINDOW 条完整保留
 * - 更早的消息首次出现时用 LLM 总结一次并缓存（Conversation.summary），
 *   后续请求直接复用，避免重复消耗
 */
export async function loadChatHistory(conversationId: string): Promise<LoadedHistory> {
  const messages = (await prisma.message.findMany({
    where: { conversationId, role: { in: ['user', 'assistant'] } },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  })) as HistoryMessage[];

  const recent = messages.slice(-HISTORY_WINDOW);
  const old = messages.slice(0, Math.max(0, messages.length - HISTORY_WINDOW));

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { summary: true },
  });
  let summary = conversation?.summary ?? null;

  if (old.length > 0 && !summary) {
    summary = await summarizeMessages(old);
    await prisma.conversation
      .update({ where: { id: conversationId }, data: { summary } })
      .catch((err) => {
        // 摘要缓存失败不阻塞对话
        console.error('[ChatService] failed to cache conversation summary:', err);
      });
  }

  return { summary, recent };
}

async function summarizeMessages(messages: HistoryMessage[]): Promise<string> {
  const capped = messages.slice(-SUMMARY_MESSAGE_CAP);
  const text = capped
    .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
    .join('\n')
    .slice(0, SUMMARY_CHAR_CAP);

  return llmChat(
    [
      { role: 'system', content: HISTORY_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    { temperature: 0.3, maxTokens: 512 },
  );
}
