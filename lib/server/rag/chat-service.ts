import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { getEmbeddingProvider } from '@/lib/embedding';
import { ensureTable } from '@/lib/lancedb/client';
import { searchKnowledge, type SearchResult } from '@/lib/lancedb/search';
import { documentRepo } from '@/lib/db/knowledge-repository';
import { llmChatStream, type LlmMessage } from '@/lib/server/llm/client';
import { loadChatHistory } from './history';
import {
  buildRagSystemPrompt,
  buildNoContextSystemPrompt,
  buildWebSearchBlock,
  buildInterviewSystemPrompt,
} from './prompts';
import { webSearch, formatSearchResults } from '@/lib/search/web-search';
import { questionRepo } from '@/lib/db/question-repository';
import type { Citation } from '@/types';

export class ChatNotFoundError extends Error {}

export interface ChatRequest {
  conversationId: string;
  question: string;
  userId: string;
  enableSearch?: boolean;
  /** question=知识问答（默认）；interview=模拟面试模式 */
  mode?: 'question' | 'interview';
}

const TOP_K = 8;
const MAX_TOKENS = 2048;

// ==================== 引用处理 ====================

function toCitation(r: SearchResult): Citation {
  const preview = r.content.replace(/^\[(文档|题目):.*?\]\r?\n?/, '').slice(0, 100);
  return {
    documentId: r.documentId,
    documentTitle: r.filename,
    chunkIndex: r.chunkIndex,
    preview: preview + (r.content.length > 100 ? '...' : ''),
    confidenceScore: r.score,
  };
}

/** 从模型输出中提取实际被引用的编号，并映射回检索结果 */
export function extractCitations(content: string, chunks: SearchResult[]): Citation[] {
  const cited = new Set<number>();
  const re = /\[(\d{1,2})\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= chunks.length) {
      cited.add(n);
    }
  }
  return [...cited].sort((a, b) => a - b).map((i) => toCitation(chunks[i - 1]));
}

// ==================== 持久化 ====================

function newMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persistMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  citations: Citation[],
) {
  await prisma.message.create({
    data: {
      id: newMessageId(),
      conversationId,
      role,
      content,
      citations: JSON.stringify(citations),
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { messageCount: { increment: 1 }, updatedAt: new Date() },
  });
}

// ==================== 检索 ====================

async function retrieveChunks(kbId: string, userId: string, query: string): Promise<SearchResult[]> {
  try {
    const embeddings = await getEmbeddingProvider();
    await ensureTable();
    const docs = await documentRepo.list(kbId);
    const excludeDocumentIds = docs.filter((d) => !d.enabled).map((d) => d.id);
    return searchKnowledge(embeddings, {
      query,
      userId,
      knowledgeId: kbId,
      topK: TOP_K,
      excludeDocumentIds,
    });
  } catch (err) {
    // 检索失败不阻塞对话（降级为通用回答）
    console.error('[ChatService] RAG search failed, falling back to generic answer:', err);
    return [];
  }
}

// ==================== 主流程 ====================

/**
 * 服务端 RAG 编排：
 * 归属校验 → 加载历史（滑动窗口+摘要） → 检索 → 联网搜索（可选）
 * → 构建消息 → LLM 流式 → 引用提取 → 持久化 → SSE 输出
 */
export async function handleChat(req: ChatRequest): Promise<ReadableStream<Uint8Array>> {
  const { conversationId, question, userId, enableSearch = false } = req;

  // 1. 归属校验：对话必须属于当前用户
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, knowledge: { userId } },
    select: { id: true, knowledgeId: true, title: true },
  });
  if (!conversation) {
    throw new ChatNotFoundError('对话不存在');
  }

  // 2. 加载历史（在写入新消息之前，避免重复包含本次提问）
  const { summary, recent } = await loadChatHistory(conversationId);

  // 3. 持久化用户消息
  await persistMessage(conversationId, 'user', question, []);

  // 4. 首条用户消息时自动生成对话标题
  const userMessageCount = await prisma.message.count({
    where: { conversationId, role: 'user' },
  });
  if (userMessageCount === 1 && conversation.title === '新对话') {
    const title = question.length > 24 ? `${question.slice(0, 24)}…` : question;
    await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
  }

  // 5. 检索 / 题库：interview 模式用题库出题，question 模式走 RAG
  let chunks: SearchResult[] = [];
  let interviewQuestions: Array<{ question: string; answer: string }> = [];
  if (req.mode === 'interview') {
    const all = await questionRepo.list({ knowledgeId: conversation.knowledgeId });
    // 随机取最多 6 道题
    interviewQuestions = [...all]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map((q) => ({ question: q.question, answer: q.answer }));
  } else {
    chunks = await retrieveChunks(conversation.knowledgeId, userId, question);
  }

  // 6. 联网搜索（可选）
  let webContext = '';
  if (enableSearch) {
    try {
      const results = await webSearch(question, 5);
      webContext = formatSearchResults(results);
    } catch (err) {
      console.error('[ChatService] web search failed:', err);
    }
  }

  // 7. 构建 LLM 消息
  const messages: LlmMessage[] = [];
  if (req.mode === 'interview') {
    // 面试模式：题库即上下文；无题可出时提示
    if (interviewQuestions.length === 0) {
      messages.push({
        role: 'system',
        content:
          '你是一位面试官。当前知识库还没有题目，请先向候选人说明并引导其到「面试题库」导入题目，然后基于通用知识提 3 个问题完成模拟面试。',
      });
    } else {
      let systemContent = buildInterviewSystemPrompt(interviewQuestions);
      if (summary) systemContent += `\n\n## 此前对话要点\n${summary}`;
      messages.push({ role: 'system', content: systemContent });
    }
  } else if (chunks.length > 0) {
    const context = chunks.map((r, i) => `[${i + 1}] [来源: ${r.filename}]\n${r.content}`).join('\n\n');
    let systemContent = buildRagSystemPrompt(context, summary ?? undefined);
    if (webContext) systemContent += buildWebSearchBlock(webContext);
    messages.push({ role: 'system', content: systemContent });
  } else {
    let systemContent = buildNoContextSystemPrompt(summary ?? undefined);
    if (webContext) systemContent += buildWebSearchBlock(webContext);
    messages.push({ role: 'system', content: systemContent });
  }
  messages.push(...recent);
  messages.push({ role: 'user', content: question });

  // 8. 流式输出 + 完成时持久化
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullContent = '';
      try {
        for await (const delta of llmChatStream(messages, { temperature: 0.7, maxTokens: MAX_TOKENS })) {
          fullContent += delta;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'answer', content: delta })}\n\n`),
          );
        }

        const citations = extractCitations(fullContent, chunks);
        if (fullContent.trim().length > 0) {
          await persistMessage(conversationId, 'assistant', fullContent, citations);
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', citations })}\n\n`),
        );
      } catch (err) {
        console.error('[ChatService] stream error:', err);
        // 已产生部分内容时也尽力落库
        if (fullContent.trim().length > 0) {
          try {
            await persistMessage(conversationId, 'assistant', fullContent, extractCitations(fullContent, chunks));
          } catch (persistErr) {
            console.error('[ChatService] failed to persist partial answer:', persistErr);
          }
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : '生成回答失败' })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}
