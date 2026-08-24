import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { llmChatStream } from '@/lib/server/llm/client';
import { parseFile, detectFormat } from '@/lib/parser';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'resumes');
const MAX_CONTENT_LENGTH = 8000;

async function ensureDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

const ANALYSIS_PROMPT = `你是一位资深的 HR 和职业顾问，擅长简历优化和面试准备。请对以下简历内容进行全面分析。

## 分析要求
请从以下几个维度进行深入分析，并按以下格式输出：

### 📊 整体评分
**X / 100**（一句话总评）

### ✅ 优势亮点
列出 3-5 个简历中做得好的方面。

### ⚠️ 问题与不足
按以下分类指出问题（每类 2-4 条，附具体例子）：
- **内容层面**：经历描述、技能展示、项目成果
- **格式排版**：结构布局、信息层次、视觉呈现
- **语言表达**：用词、量化、STAR 原则使用
- **岗位针对性**：与目标岗位的匹配度

### 💡 具体改进建议
针对每个问题给出可直接操作的改进建议（附修改前后对比示例）。

### 🎯 面试准备建议
基于简历内容，指出：
1. 面试官可能追问的 3-5 个问题
2. 简历中可能被质疑的薄弱点
3. 如何在面试中更好地展示亮点

请用中文回答，使用 Markdown 格式，语言专业但亲和。`;

function extractScore(analysis: string): number {
  // 尝试从 "X / 100" 或 "X/100" 中提取分数
  const match = analysis.match(/(\d{1,3})\s*\/\s*100/);
  if (match) {
    const score = Number.parseInt(match[1], 10);
    return Math.max(0, Math.min(100, score));
  }
  return 0;
}

export const resumeService = {
  async analyze(userId: string, file: File) {
    await ensureDir();

    const fileId = `resume_${crypto.randomUUID().slice(0, 8)}`;
    const filepath = path.join(UPLOAD_DIR, `${fileId}_${file.name}`);
    const format = detectFormat(file.name, file.type);

    // ① 写文件
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // ② 解析简历内容
    let content: string;
    try {
      const docs = await parseFile(filepath, format);
      content = docs.map((d) => d.pageContent).join('\n');
    } catch (err) {
      await unlink(filepath).catch(() => {});
      throw new Error(`简历解析失败：${err instanceof Error ? err.message : '未知错误'}`, { cause: err });
    }

    if (!content || content.trim().length === 0) {
      await unlink(filepath).catch(() => {});
      throw new Error('简历内容为空，请检查文件格式');
    }

    // ③ 截取前 8000 字符送 LLM
    const truncated = content.slice(0, MAX_CONTENT_LENGTH);

    // ④ LLM 流式分析（收集全文）
    let analysis = '';
    for await (const delta of llmChatStream(
      [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: `以下是候选人的简历内容：\n\n${truncated}` },
      ],
      { temperature: 0.4, maxTokens: 2000 },
    )) {
      analysis += delta;
    }

    if (!analysis.trim()) {
      throw new Error('AI 分析生成失败，请重试');
    }

    const score = extractScore(analysis);

    // ⑤ 落库
    const resume = await prisma.resume.create({
      data: {
        id: fileId,
        userId,
        filename: file.name,
        fileSize: file.size,
        content: truncated,
        analysis,
        score,
      },
    });

    // 清理临时文件
    await unlink(filepath).catch(() => {});

    return {
      id: resume.id,
      filename: resume.filename,
      fileSize: resume.fileSize,
      score: resume.score,
      analysis: resume.analysis,
      createdAt: resume.createdAt,
    };
  },

  async list(userId: string) {
    return prisma.resume.findMany({
      where: { userId },
      select: { id: true, filename: true, fileSize: true, score: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string, userId: string) {
    return prisma.resume.findFirst({
      where: { id, userId },
    });
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await prisma.resume.deleteMany({ where: { id, userId } });
    return result.count > 0;
  },
};
