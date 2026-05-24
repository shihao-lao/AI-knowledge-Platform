import { prisma } from '../lib/prisma';

async function main() {
  console.log('🌱 开始初始化种子数据...');

  const user = await prisma.user.upsert({
    where: { email: 'lin@example.com' },
    update: {},
    create: {
      id: 'u_001',
      name: '林知夏',
      email: 'lin@example.com',
      role: 'admin',
      createdAt: new Date('2026-05-21T09:00:00.000Z'),
    },
  });
  console.log(`✅ 用户创建成功: ${user.name}`);

  const kb1 = await prisma.knowledgeBase.upsert({
    where: { id: 'kb_frontend' },
    update: {},
    create: {
      id: 'kb_frontend',
      name: '前端开发手册',
      description: '前端框架、构建工具、工程化、性能优化与组件规范。',
      visibility: 'private',
      documentCount: 3,
      conversationCount: 2,
      memberCount: 8,
      lastActiveAt: new Date('2026-05-21T12:20:00.000Z'),
      createdAt: new Date('2026-04-12T08:00:00.000Z'),
    },
  });

  const kb2 = await prisma.knowledgeBase.upsert({
    where: { id: 'kb_product' },
    update: {},
    create: {
      id: 'kb_product',
      name: '产品需求文档',
      description: '沉淀产品方案、验收标准、里程碑和调研材料。',
      visibility: 'private',
      documentCount: 0,
      conversationCount: 0,
      memberCount: 5,
      lastActiveAt: new Date('2026-05-21T10:10:00.000Z'),
      createdAt: new Date('2026-03-02T08:00:00.000Z'),
    },
  });

  const kb3 = await prisma.knowledgeBase.upsert({
    where: { id: 'kb_prompt' },
    update: {},
    create: {
      id: 'kb_prompt',
      name: '智能提示词模板库',
      description: '面向客服、运营、研发协作的可复用提示词。',
      visibility: 'public',
      documentCount: 0,
      conversationCount: 0,
      memberCount: 12,
      lastActiveAt: new Date('2026-05-20T17:35:00.000Z'),
      createdAt: new Date('2026-02-18T08:00:00.000Z'),
    },
  });
  console.log(`✅ 知识库创建成功: ${kb1.name}, ${kb2.name}, ${kb3.name}`);

  const doc1 = await prisma.document.create({
    data: {
      id: 'doc_vite',
      knowledgeBaseId: kb1.id,
      title: 'Vite 原理分析',
      fileName: 'Vite原理分析.md',
      fileType: 'markdown',
      fileSize: 124000,
      status: 'completed',
      processingProgress: 100,
      chunkCount: 42,
      embeddingModel: 'text-embedding-3-large',
      content:
        'Vite 在开发环境中利用浏览器原生模块能力，将源码按需提供给浏览器。依赖会被预构建，源码改动只需要让相关模块失效，因此冷启动和热更新都更快。\n\n## 核心原理\n\n### 1. 原生 ES Modules\nVite 利用浏览器原生的 ES Modules 支持，在开发环境中不需要将所有文件打包成一个 bundle。浏览器会根据 import 语句自动按需加载模块。\n\n### 2. 依赖预构建\n对于第三方依赖（node_modules），Vite 使用 esbuild 进行预构建。esbuild 是用 Go 编写的，比 JavaScript 编写的打包器快 10-100 倍。\n\n### 3. 按需编译\n源码只在被请求时才进行转换（transform），而不是一次性处理所有文件。这使得首次加载非常快速。\n\n### 4. 高效的 HMR\n当文件修改时，Vite 只更新受影响的模块，精确到模块级别，不需要重新加载整个页面。\n\n## 性能优势\n\n- 冷启动速度：相比 Webpack 快 10 倍以上\n- 热更新速度：毫秒级响应\n- 内存占用：只处理当前需要的文件\n\n## 适用场景\n\n适合中小型项目、原型开发和需要快速迭代的项目。对于大型企业级应用，可能需要额外的优化配置。',
      uploadedById: user.id,
      createdAt: new Date('2026-05-20T09:40:00.000Z'),
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      id: 'doc_rag',
      knowledgeBaseId: kb1.id,
      title: '检索增强生成实践',
      fileName: '检索增强生成实践.pdf',
      fileType: 'pdf',
      fileSize: 1940000,
      status: 'completed',
      processingProgress: 100,
      chunkCount: 108,
      embeddingModel: 'text-embedding-3-large',
      content:
        '检索增强生成的关键是把用户问题先转换为向量并召回最相关的文档片段，再将片段作为上下文提供给大模型。回答必须带上来源，方便用户验证事实。\n\n## RAG 工作流程\n\n### 第一阶段：文档处理\n1. **文档解析**：支持 PDF、Word、Markdown 等格式\n2. **文本切片**：将长文档切分成 500-1000 token 的片段\n3. **向量化**：使用 Embedding 模型将文本转为向量\n4. **存储**：将向量存入向量数据库\n\n### 第二阶段：查询处理\n1. **问题向量化**：将用户问题转为向量\n2. **相似度搜索**：在向量数据库中找最相似的文档片段\n3. **上下文组装**：将 Top-K 片段拼成 prompt 上下文\n\n### 第三阶段：生成回答\n1. **Prompt 构建**：系统指令 + 检索上下文 + 用户问题\n2. **LLM 调用**：发送给大语言模型\n3. **后处理**：提取引用来源，格式化输出\n\n## 关键技术点\n\n- 切片策略：按段落/语义边界切片，保持语义完整\n- 向量模型：推荐 text-embedding-3-large 或开源 BGE 系列\n- 相似度算法：余弦相似度是最常用的选择\n- 召回数量：通常取 Top 3-5 个片段作为上下文\n\n## 最佳实践\n\n- 文档质量决定 RAG 效果上限\n- 定期更新知识库内容\n- 监控召回准确率和用户满意度',
      uploadedById: user.id,
      createdAt: new Date('2026-05-19T15:28:00.000Z'),
    },
  });

  const doc3 = await prisma.document.create({
    data: {
      id: 'doc_upload',
      knowledgeBaseId: kb1.id,
      title: '文档上传与切片规范',
      fileName: '文档上传与切片规范.txt',
      fileType: 'text',
      fileSize: 68000,
      status: 'completed',
      processingProgress: 100,
      chunkCount: 31,
      embeddingModel: 'text-embedding-3-large',
      content:
        '上传链路包含上传、解析、切片、向量化四个阶段。每个阶段都应向前端返回进度，便于用户判断文档何时可用于问答。\n\n## 文件类型支持\n\n| 格式 | 扩展名 | 解析方式 |\n|------|--------|----------|\n| PDF | .pdf | PDF.js / PyPDF2 |\n| Word | .docx | mammoth / python-docx |\n| Markdown | .md | 直接读取 |\n| Excel | .xlsx | exceljs / pandas |\n| 文本 | .txt | 直接读取 |\n\n## 切片规范\n\n### 切片大小\n- 默认：500 tokens / 片段\n- 最大：1000 tokens / 片段\n- 最小：200 tokens / 片段\n\n### 切片策略\n1. **固定长度切片**：简单但可能切断句子\n2. **段落优先切片**：保持语义完整\n3. **递归切片**：先按章节，再按段落\n4. **语义切片**：使用 NLP 模型识别边界\n\n### 重叠设置\n- 推荐重叠率：10%-20%\n- 避免丢失边界信息\n- 保证上下文连贯性\n\n## 进度反馈\n\n每个阶段应返回进度百分比：\n- 上传完成：25%\n- 解析完成：50%\n- 切片完成：75%\n- 向量化完成：100%',
      uploadedById: user.id,
      createdAt: new Date('2026-05-21T11:08:00.000Z'),
    },
  });
  console.log(`✅ 文档创建成功: ${doc1.title}, ${doc2.title}, ${doc3.title}`);

  const conv1 = await prisma.conversation.create({
    data: {
      id: 'chat_001',
      knowledgeBaseId: kb1.id,
      title: 'Vite 为什么启动快？',
      messageCount: 4,
      createdAt: new Date('2026-05-21T09:30:00.000Z'),
    },
  });

  const conv2 = await prisma.conversation.create({
    data: {
      id: 'chat_002',
      knowledgeBaseId: kb1.id,
      title: '引用来源如何展示',
      messageCount: 7,
      createdAt: new Date('2026-05-20T14:20:00.000Z'),
    },
  });
  console.log(`✅ 对话创建成功: ${conv1.title}, ${conv2.title}`);

  await prisma.message.createMany({
    data: [
      {
        id: 'msg_welcome',
        conversationId: conv1.id,
        role: 'assistant',
        content:
          '你好，我已经学习了当前知识库中的文档。你可以询问工程方案、文档规范或引用策略，我会尽量基于已上传资料回答，并附上可验证来源。',
        createdAt: new Date('2026-05-21T09:29:00.000Z'),
      },
      {
        id: 'msg_user_1',
        conversationId: conv1.id,
        role: 'user',
        content: 'Vite 为什么在开发环境启动这么快？',
        createdAt: new Date('2026-05-21T09:30:00.000Z'),
      },
      {
        id: 'msg_ai_1',
        conversationId: conv1.id,
        role: 'assistant',
        content:
          '根据知识库资料，Vite 快的核心原因是开发阶段不做完整打包，而是让浏览器直接按需加载原生模块。依赖会提前预构建，源码变更时只更新相关模块，因此冷启动和热更新都更轻。\n\n同时，检索增强会把相关文档片段带入回答上下文，所以这里的结论来自已上传文档，而不是模型自由发挥。',
        citations: JSON.stringify([
          {
            documentId: 'doc_vite',
            documentTitle: 'Vite 原理分析.md',
            chunkIndex: 3,
            preview: 'Vite 利用浏览器原生模块能力，开发环境无需先打包整个应用。',
            confidenceScore: 0.95,
            color: '#1677ff',
          },
          {
            documentId: 'doc_rag',
            documentTitle: '检索增强生成实践.pdf',
            chunkIndex: 18,
            preview: '检索增强生成会把相关文档片段拼入上下文，回答需要保留来源信息。',
            confidenceScore: 0.91,
            color: '#faad14',
          },
        ]),
        createdAt: new Date('2026-05-21T09:30:18.000Z'),
      },
    ],
  });
  console.log('✅ 消息创建成功');

  console.log('\n🎉 种子数据初始化完成！');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
