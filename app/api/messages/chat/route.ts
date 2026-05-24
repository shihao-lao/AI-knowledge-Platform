import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { performRAGRetrieval, type RAGResult } from '@/lib/rag';
import { processDocumentForRAG } from '@/lib/chunker';
import type { Message, Citation } from '@/types';

const SYSTEM_PROMPT = `你是一个基于知识库的AI助手。你的任务是：
1. 仔细阅读提供的知识库文档片段
2. 基于这些文档内容回答用户的问题
3. 回答必须准确、有据可查
4. 如果文档中没有相关信息，明确告知用户
5. 引用来源时使用 [文档片段 X] 的格式

回答格式要求：
- 使用 Markdown 格式
- 分点列出关键信息
- 在相关内容后标注引用来源
- 保持专业、友好的语气`;

function generateRAGResponse(query: string, ragResult: RAGResult): string {
  if (!ragResult.context || ragResult.retrievedChunks.length === 0) {
    return `抱歉，我在当前知识库中没有找到与「${query}」直接相关的信息。

这可能是因为：
1. 知识库中还没有上传相关的文档
2. 您的问题超出了现有文档的覆盖范围

建议您：
- 尝试使用不同的关键词提问
- 检查知识库中是否有相关主题的文档
- 联系管理员添加更多相关知识资料`;
  }

  const relevantContent = ragResult.retrievedChunks
    .map((chunk, i) => {
      return `[来源${i + 1}: ${chunk.documentTitle} (相似度: ${(chunk.similarity * 100).toFixed(0)}%)]\n${chunk.content}`;
    })
    .join('\n\n');

  let response = '';

  if (ragResult.retrievedChunks.some((c) => c.similarity > 0.7)) {
    response = `根据知识库中的资料，我找到了以下相关信息：\n\n`;

    const mainChunk = ragResult.retrievedChunks[0];
    response += extractKeyInformation(mainChunk.content, query);

    if (ragResult.retrievedChunks.length > 1) {
      response += `\n\n**补充信息**：\n`;
      for (let i = 1; i < ragResult.retrievedChunks.length; i++) {
        const chunk = ragResult.retrievedChunks[i];
        if (chunk.similarity > 0.3) {
          response += `- ${generatePreview(chunk.content)} [来源${i + 1}]\n`;
        }
      }
    }

    response += `\n\n---\n**信息来源**：\n`;
    ragResult.citations.forEach((citation, index) => {
      response += `${index + 1}. ${citation.documentTitle} (置信度: ${(citation.confidenceScore * 100).toFixed(0)}%)\n`;
    });
  } else {
    response = `我在知识库中搜索了相关内容，找到一些可能有关的信息，但匹配度不是很高：\n\n`;

    ragResult.retrievedChunks.forEach((chunk, index) => {
      response += `${index + 1}. **${chunk.documentTitle}** (相似度: ${(chunk.similarity * 100).toFixed(0)}%)\n`;
      response += `   ${generatePreview(chunk.content)}\n\n`;
    });

    response += `\n建议您尝试更具体的关键词，或确认知识库中是否有更相关的文档。`;
  }

  return response;
}

function extractKeyInformation(content: string, query: string): string {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const sentences = content.split(/[。！？.!?]/);
  const relevantSentences = sentences.filter((sentence) => {
    const lowerSentence = sentence.toLowerCase();
    return queryTerms.some((term) => lowerSentence.includes(term)) && sentence.trim().length > 10;
  });

  if (relevantSentences.length > 0) {
    return relevantSentences.slice(0, 3).join('。\n') + '。';
  }

  return content.slice(0, 500) + (content.length > 500 ? '...' : '');
}

function generatePreview(content: string, maxLength: number = 150): string {
  const cleaned = content.replace(/\n+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + '...';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, content, stream = true } = body;

    if (!conversationId || !content) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return Response.json({ error: '对话不存在' }, { status: 404 });
    }

    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content,
      },
    });

    let chunksExist = await prisma.documentChunk.count({
      where: { knowledgeBaseId: conversation.knowledgeBaseId },
    });

    if (chunksExist === 0) {
      console.log('No chunks found, processing documents for RAG...');
      const documents = await prisma.document.findMany({
        where: { knowledgeBaseId: conversation.knowledgeBaseId },
      });

      for (const doc of documents) {
        try {
          await processDocumentForRAG(doc.id);
          chunksExist++;
        } catch (error) {
          console.error(`Failed to process document ${doc.id}:`, error);
        }
      }
    }

    const ragResult = await performRAGRetrieval(content, conversation.knowledgeBaseId);
    const aiResponse = generateRAGResponse(content, ragResult);

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: aiResponse,
        citations: JSON.stringify(ragResult.citations),
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    await prisma.knowledgeBase.update({
      where: { id: conversation.knowledgeBaseId },
      data: {
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      },
    });

    if (stream) {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'user_message', message: userMessage })}\n\n`)
          );

          await new Promise((resolve) => setTimeout(resolve, 100));

          const words = aiResponse.split('');
          let currentContent = '';
          const chunkSize = Math.max(1, Math.floor(words.length / 50));

          for (let i = 0; i < words.length; i++) {
            currentContent += words[i];

            if (i % chunkSize === 0 || i === words.length - 1) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'assistant_chunk',
                    content: currentContent,
                    messageId: assistantMessage.id,
                    done: false,
                  })}\n\n`
                )
              );
              await new Promise((resolve) => setTimeout(resolve, 15));
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'assistant_complete',
                message: assistantMessage,
                citations: ragResult.citations,
                done: true,
              })}\n\n`
            )
          );

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      return Response.json({
        message: assistantMessage,
        citations: ragResult.citations,
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
