import { NextRequest } from 'next/server';
import { addMessage, getMessages, getDocuments, getKnowledgeBaseById, getUsers } from '@/lib/store';
import type { Citation, Message } from '@/types';

const mockResponses: Record<string, string[]> = {
  default: [
    '根据知识库中的资料，这个问题可以从以下几个方面来理解：\n\n首先，从技术实现角度来看，这涉及到核心架构的设计理念。系统采用了模块化的设计思路，使得各个组件能够独立运行和扩展。\n\n其次，在实际应用场景中，这种方案已经被证明是有效的，能够满足大多数业务需求。\n\n最后，建议您参考相关文档获取更详细的信息。',
    '这是一个很好的问题！基于当前知识库的内容，我可以为您提供以下解答：\n\n根据已上传的文档资料，这个问题的答案需要结合具体的使用场景来分析。不同的应用场景可能会有不同的最佳实践。\n\n如果您需要更详细的信息，可以查阅相关的技术文档或联系技术支持团队。',
  ],
  vite: [
    'Vite 在开发环境启动快的主要原因有以下几点：\n\n**1. 原生 ES Modules 支持**\nVite 利用浏览器原生的 ES Modules 能力，在开发环境中无需预先打包整个应用。浏览器可以直接按需加载模块，大大减少了启动时间。\n\n**2. 依赖预构建**\n对于第三方依赖（node_modules），Vite 使用 esbuild 进行预构建。esbuild 是用 Go 编写的，比 JavaScript 编写的打包器快 10-100 倍。\n\n**3. 按需编译**\n源码只在被请求时才进行转换，而不是一次性处理所有文件。这意味着你只会编译当前页面实际需要的代码。\n\n**4. 高效的热更新（HMR）**\n当文件修改时，Vite 只更新受影响的模块，而不需要重新加载整个页面。这使得热更新非常快速。\n\n这些特性使得 Vite 的冷启动速度比传统的 Webpack 等工具快一个数量级。',
  ],
  rag: [
    '检索增强生成（RAG）是一种将检索系统与大语言模型结合的技术方案。其工作流程如下：\n\n**1. 文档预处理**\n- 上传文档后进行解析、切片\n- 将文本片段转换为向量表示\n- 存入向量数据库以便后续检索\n\n**2. 检索阶段**\n- 用户提问时，将问题转换为向量\n- 在向量数据库中进行相似度搜索\n- 召回最相关的文档片段\n\n**3. 生成阶段**\n- 将检索到的文档片段作为上下文\n- 连同用户问题一起发送给大模型\n- 生成带有引用来源的回答\n\n**优势**：\n- 回答基于真实文档，减少幻觉\n- 可以追溯信息来源，便于验证\n- 知识更新只需更新文档库',
  ],
};

function generateMockResponse(question: string): { content: string; citations: Citation[] } {
  const lowerQuestion = question.toLowerCase();

  let responseText: string;
  if (lowerQuestion.includes('vite') || lowerQuestion.includes('启动')) {
    responseText = mockResponses.vite[Math.floor(Math.random() * mockResponses.vite.length)];
  } else if (lowerQuestion.includes('rag') || lowerQuestion.includes('检索') || lowerQuestion.includes('增强')) {
    responseText = mockResponses.rag[Math.floor(Math.random() * mockResponses.rag.length)];
  } else {
    responseText = mockResponses.default[Math.floor(Math.random() * mockResponses.default.length)];
  }

  const citations: Citation[] = [];
  if (Math.random() > 0.3) {
    citations.push({
      documentId: 'doc_vite',
      documentTitle: 'Vite 原理分析.md',
      chunkIndex: Math.floor(Math.random() * 40),
      preview: 'Vite 利用浏览器原生模块能力，开发环境无需先打包整个应用。',
      confidenceScore: 0.9 + Math.random() * 0.1,
      color: '#1677ff',
    });
  }

  if (Math.random() > 0.5) {
    citations.push({
      documentId: 'doc_rag',
      documentTitle: '检索增强生成实践.pdf',
      chunkIndex: Math.floor(Math.random() * 100),
      preview: '检索增强生成会把相关文档片段拼入上下文，回答需要保留来源信息。',
      confidenceScore: 0.85 + Math.random() * 0.15,
      color: '#faad14',
    });
  }

  return { content: responseText, citations };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, content, stream = true } = body;

    if (!conversationId || !content) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const users = getUsers();
    const currentUser = users[0];

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    addMessage(conversationId, userMessage);

    const { content: aiContent, citations } = generateMockResponse(content);

    const assistantMessage: Message = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: aiContent,
      citations,
      createdAt: new Date().toISOString(),
    };

    if (stream) {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'user_message', message: userMessage })}\n\n`)
          );

          await new Promise((resolve) => setTimeout(resolve, 100));

          const words = aiContent.split('');
          let currentContent = '';

          for (let i = 0; i < words.length; i++) {
            currentContent += words[i];

            if (i % 3 === 0 || i === words.length - 1) {
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
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'assistant_complete',
                message: { ...assistantMessage, content: aiContent },
                citations,
                done: true,
              })}\n\n`
            )
          );

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

          addMessage(conversationId, assistantMessage);
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
      addMessage(conversationId, assistantMessage);

      return Response.json({
        message: assistantMessage,
        citations,
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
