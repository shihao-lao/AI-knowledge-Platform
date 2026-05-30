// 小米 mimo 大模型 API 配置
const MIMO_BASE_URL = process.env.NEXT_PUBLIC_MIMO_BASE_URL!;
const MIMO_API_KEY = process.env.NEXT_PUBLIC_MIMO_API_KEY!;
const MIMO_MODEL = process.env.NEXT_PUBLIC_MIMO_MODEL!;

// ==================== 类型定义 ====================

interface MimoMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MimoChatRequest {
  model: string;
  messages: MimoMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface MimoChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ==================== API 函数 ====================

/**
 * 调用 mimo 大模型进行对话
 *
 * @param messages - 消息列表
 * @param options - 可选参数
 * @returns 模型回复内容
 */
export async function mimoChat(
  messages: MimoMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  const requestData: MimoChatRequest = {
    model: MIMO_MODEL,
    messages,
    stream: false,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1024,
  };

  const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MIMO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`mimo API 错误 ${response.status}: ${errorText}`);
  }

  const data: MimoChatResponse = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * 对文档内容生成智能摘要
 *
 * @param title - 文档标题
 * @param content - 文档内容
 * @returns 摘要文本
 */
export async function generateDocSummary(title: string, content: string): Promise<string> {
  // 截取前 3000 字符避免超出 token 限制
  const truncatedContent = content.slice(0, 3000);

  return mimoChat(
    [
      {
        role: 'system',
        content: '你是一个专业的文档分析助手。请用简洁的中文对用户提供的文档进行摘要，提炼核心要点，输出 3-5 条关键结论。不要重复文档标题。',
      },
      {
        role: 'user',
        content: `文档标题：${title}\n\n文档内容：\n${truncatedContent}`,
      },
    ],
    { temperature: 0.5, maxTokens: 512 },
  );
}

/**
 * 根据文档内容生成专家 Skill（系统提示词）
 *
 * @param title - 文档标题
 * @param content - 文档内容
 * @returns 专家 Skill 文本
 */
export async function generateExpertSkill(title: string, content: string): Promise<string> {
  const truncatedContent = content.slice(0, 3000);

  return mimoChat(
    [
      {
        role: 'system',
        content: `你是一个 AI 提示词工程专家。根据用户提供的文档内容，生成一个专业的"专家 Skill"（即 System Prompt），要求：
1. 以"你是一位……"开头，定义 AI 的专家身份和背景
2. 明确列出该专家的核心能力（3-5 条）
3. 定义回答风格和输出格式要求
4. 包含与该领域相关的专业术语和知识范围限定
5. 整体控制在 300-500 字，结构清晰，可直接复制使用
不要输出任何解释，只输出 Skill 内容本身。`,
      },
      {
        role: 'user',
        content: `文档标题：${title}\n\n文档内容：\n${truncatedContent}\n\n请基于以上文档生成对应的专家 Skill。`,
      },
    ],
    { temperature: 0.6, maxTokens: 800 },
  );
}
