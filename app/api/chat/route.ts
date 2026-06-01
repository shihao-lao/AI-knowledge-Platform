import { NextRequest } from 'next/server';
import { webSearch, formatSearchResults } from '@/lib/search/web-search';

const COZE_API_BASE = process.env.COZE_BASE_URL || process.env.NEXT_PUBLIC_COZE_API_BASE || 'https://api.coze.cn';
const COZE_CHAT_TOKEN = process.env.COZE_API_KEY?.replace('Bearer ', '') || process.env.NEXT_PUBLIC_COZE_CHAT_TOKEN;
const DEFAULT_BOT_ID = process.env.COZE_BOT_ID || process.env.NEXT_PUBLIC_COZE_BOT_ID;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, stream = true, enableSearch = true } = body as {
      messages: ChatMessage[];
      stream?: boolean;
      enableSearch?: boolean;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '消息不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!COZE_CHAT_TOKEN || !DEFAULT_BOT_ID) {
      return new Response(JSON.stringify({ error: 'Coze API 配置缺失' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取最后一条用户消息用于搜索
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');

    // 联网搜索
    let searchContext = '';
    if (enableSearch && lastUserMsg) {
      try {
        console.log(`[Chat API] searching web for: ${lastUserMsg.content.slice(0, 50)}...`);
        const results = await webSearch(lastUserMsg.content, 5);
        if (results.length > 0) {
          searchContext = formatSearchResults(results);
          console.log(`[Chat API] found ${results.length} web results`);
        }
      } catch (err) {
        console.error('[Chat API] web search failed:', err);
      }
    }

    // 构建 Coze 请求
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const systemContent = systemMessages.map((m) => m.content).join('\n\n');

    // 将搜索结果注入到系统消息中
    let enrichedSystemContent = systemContent;
    if (searchContext) {
      enrichedSystemContent += `\n\n## 联网搜索结果\n以下是与用户问题相关的最新网络搜索结果，请参考这些信息来回答：\n\n${searchContext}`;
    }

    const additionalMessages = nonSystemMessages.map((m, i) => ({
      role: m.role as 'user' | 'assistant',
      type: m.role === 'user' ? 'question' : 'answer',
      content_type: 'text',
      content: i === 0 && enrichedSystemContent ? `${enrichedSystemContent}\n\n${m.content}` : m.content,
    }));

    const requestData = {
      bot_id: DEFAULT_BOT_ID,
      user_id: 'user_' + Date.now(),
      stream,
      additional_messages: additionalMessages,
    };

    console.log(`[Chat API] calling Coze API, bot=${DEFAULT_BOT_ID}, stream=${stream}`);

    const cozeResponse = await fetch(`${COZE_API_BASE}/v3/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${COZE_CHAT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!cozeResponse.ok) {
      const errorText = await cozeResponse.text();
      console.error('[Chat API] Coze error:', cozeResponse.status, errorText);
      return new Response(JSON.stringify({ error: `Coze API 错误: ${cozeResponse.status}` }), {
        status: cozeResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 流式响应：将 Coze SSE 转发给客户端
    if (stream && cozeResponse.body) {
      const encoder = new TextEncoder();
      const reader = cozeResponse.body.getReader();
      const decoder = new TextDecoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          let buffer = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                // Coze v3 SSE 格式：event:xxx 和 data:{json} 分行
                if (trimmed.startsWith('event:')) continue; // 跳过 event 行
                if (!trimmed.startsWith('data:')) continue;

                const dataStr = trimmed.slice(5).trim();
                if (dataStr === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  continue;
                }

                try {
                  const data = JSON.parse(dataStr);

                  // 知识库召回：type=verbose 包含 knowledge_recall
                  if (data.type === 'verbose') continue;

                  // 回答完成：conversation.chat.completed
                  if (data.status === 'completed') {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
                    );
                    continue;
                  }

                  // 错误
                  if (data.last_error?.code && data.last_error.code !== 0) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'error', message: data.last_error.msg || '对话失败' })}\n\n`,
                      ),
                    );
                    continue;
                  }

                  // 回答内容：type=answer 的 delta 事件
                  if (data.type === 'answer' && typeof data.content === 'string') {
                    // 只转发非空内容（Coze 可能发送空 content + reasoning_content）
                    if (data.content) {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'answer', content: data.content })}\n\n`),
                      );
                    }
                    continue;
                  }
                } catch {
                  // 忽略非 JSON 行
                }
              }
            }
          } catch (err) {
            console.error('[Chat API] stream error:', err);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 非流式响应
    const responseData = await cozeResponse.json();
    let content = '';
    if (responseData.code !== 0) {
      return new Response(JSON.stringify({ error: responseData.msg || '请求失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (responseData.data?.content) {
      content = responseData.data.content;
    } else if (responseData.choices?.[0]?.message?.content) {
      content = responseData.choices[0].message.content;
    }

    return Response.json({ content });
  } catch (err) {
    console.error('[Chat API] error:', err);
    return new Response(JSON.stringify({ error: '聊天请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
