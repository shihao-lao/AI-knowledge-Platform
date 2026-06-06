import { NextRequest } from 'next/server';
import { webSearch, formatSearchResults } from '@/lib/search/web-search';

const MIMO_BASE_URL = process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';
const MIMO_API_KEY = process.env.MIMO_API_KEY;
const MIMO_MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      stream = true,
      enableSearch = true,
    } = body as {
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

    if (!MIMO_API_KEY) {
      return new Response(JSON.stringify({ error: 'MiMo API 配置缺失' }), {
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
        const results = await webSearch(lastUserMsg.content, 5);
        if (results.length > 0) {
          searchContext = formatSearchResults(results);
        }
      } catch (err) {
        console.error('[Chat API] web search failed:', err);
      }
    }

    // 构建消息：将搜索结果注入系统消息
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const systemContent = systemMessages.map((m) => m.content).join('\n\n');

    let enrichedSystemContent = systemContent;
    if (searchContext) {
      enrichedSystemContent += `\n\n## 联网搜索结果\n以下是与用户问题相关的最新网络搜索结果，请参考这些信息来回答：\n\n${searchContext}`;
    }

    // 构建 OpenAI 兼容格式的消息列表
    const mimoMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

    if (enrichedSystemContent) {
      mimoMessages.push({ role: 'system', content: enrichedSystemContent });
    }

    for (const msg of nonSystemMessages) {
      mimoMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const requestData = {
      model: MIMO_MODEL,
      messages: mimoMessages,
      stream,
      max_completion_tokens: 2048,
    };

    const mimoResponse = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MIMO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!mimoResponse.ok) {
      const errorText = await mimoResponse.text();
      console.error('[Chat API] MiMo error:', mimoResponse.status, errorText);
      return new Response(JSON.stringify({ error: `MiMo API 错误: ${mimoResponse.status}` }), {
        status: mimoResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 流式响应：将 MiMo SSE 转发给客户端
    if (stream && mimoResponse.body) {
      const encoder = new TextEncoder();
      const reader = mimoResponse.body.getReader();
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
                if (!trimmed || !trimmed.startsWith('data:')) continue;

                const dataStr = trimmed.slice(5).trim();
                if (dataStr === '[DONE]') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                  continue;
                }

                try {
                  const data = JSON.parse(dataStr);
                  const delta = data.choices?.[0]?.delta;

                  // 跳过 reasoning_content，只转发 content
                  if (delta?.content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'answer', content: delta.content })}\n\n`),
                    );
                  }

                  // 检查是否结束
                  if (data.choices?.[0]?.finish_reason === 'stop') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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
    const responseData = await mimoResponse.json();
    const content = responseData.choices?.[0]?.message?.content ?? '';

    return Response.json({ content });
  } catch (err) {
    console.error('[Chat API] error:', err);
    return new Response(JSON.stringify({ error: '聊天请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
