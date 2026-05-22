import type { Citation, Conversation, KnowledgeBase, KnowledgeDocument, Message, User } from '@/types/domain';

export const currentUser: User = {
  id: 'u_001',
  name: '林知夏',
  email: 'lin@example.com',
  avatar: undefined,
  role: 'admin',
  createdAt: '2026-05-21T09:00:00.000Z',
};

export const knowledgeBases: KnowledgeBase[] = [
  {
    id: 'kb_frontend',
    name: '前端开发手册',
    description: '前端框架、构建工具、工程化、性能优化与组件规范。',
    visibility: 'private',
    stats: { documentCount: 12, conversationCount: 36, memberCount: 8, lastActiveAt: '2026-05-21T12:20:00.000Z' },
    createdAt: '2026-04-12T08:00:00.000Z',
    updatedAt: '2026-05-21T12:20:00.000Z',
  },
  {
    id: 'kb_product',
    name: '产品需求文档',
    description: '沉淀产品方案、验收标准、里程碑和调研材料。',
    visibility: 'private',
    stats: { documentCount: 8, conversationCount: 19, memberCount: 5, lastActiveAt: '2026-05-21T10:10:00.000Z' },
    createdAt: '2026-03-02T08:00:00.000Z',
    updatedAt: '2026-05-21T10:10:00.000Z',
  },
  {
    id: 'kb_prompt',
    name: '智能提示词模板库',
    description: '面向客服、运营、研发协作的可复用提示词。',
    visibility: 'public',
    stats: { documentCount: 23, conversationCount: 44, memberCount: 12, lastActiveAt: '2026-05-20T17:35:00.000Z' },
    createdAt: '2026-02-18T08:00:00.000Z',
    updatedAt: '2026-05-20T17:35:00.000Z',
  },
];

export const documents: KnowledgeDocument[] = [
  {
    id: 'doc_vite',
    knowledgeBaseId: 'kb_frontend',
    title: 'Vite 原理分析',
    fileName: 'Vite原理分析.md',
    fileType: 'markdown',
    fileSize: 124000,
    status: 'completed',
    processingProgress: 100,
    chunkCount: 42,
    embeddingModel: 'text-embedding-3-large',
    uploadedBy: currentUser,
    createdAt: '2026-05-20T09:40:00.000Z',
    updatedAt: '2026-05-20T09:43:00.000Z',
    content:
      'Vite 在开发环境中利用浏览器原生模块能力，将源码按需提供给浏览器。依赖会被预构建，源码改动只需要让相关模块失效，因此冷启动和热更新都更快。',
  },
  {
    id: 'doc_rag',
    knowledgeBaseId: 'kb_frontend',
    title: '检索增强生成实践',
    fileName: '检索增强生成实践.pdf',
    fileType: 'pdf',
    fileSize: 1940000,
    status: 'completed',
    processingProgress: 100,
    chunkCount: 108,
    embeddingModel: 'text-embedding-3-large',
    uploadedBy: currentUser,
    createdAt: '2026-05-19T15:28:00.000Z',
    updatedAt: '2026-05-19T15:31:00.000Z',
    content:
      '检索增强生成的关键是把用户问题先转换为向量并召回最相关的文档片段，再将片段作为上下文提供给大模型。回答必须带上来源，方便用户验证事实。',
  },
  {
    id: 'doc_upload',
    knowledgeBaseId: 'kb_frontend',
    title: '文档上传与切片规范',
    fileName: '文档上传与切片规范.txt',
    fileType: 'text',
    fileSize: 68000,
    status: 'embedding',
    processingProgress: 72,
    chunkCount: 31,
    embeddingModel: 'text-embedding-3-large',
    uploadedBy: currentUser,
    createdAt: '2026-05-21T11:08:00.000Z',
    updatedAt: '2026-05-21T11:12:00.000Z',
    content:
      '上传链路包含上传、解析、切片、向量化四个阶段。每个阶段都应向前端返回进度，便于用户判断文档何时可用于问答。',
  },
];

export const citations: Citation[] = [
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
];

export const conversations: Conversation[] = [
  {
    id: 'chat_001',
    knowledgeBaseId: 'kb_frontend',
    title: 'Vite 为什么启动快？',
    messageCount: 4,
    createdAt: '2026-05-21T09:30:00.000Z',
    updatedAt: '2026-05-21T10:12:00.000Z',
  },
  {
    id: 'chat_002',
    knowledgeBaseId: 'kb_frontend',
    title: '引用来源如何展示',
    messageCount: 7,
    createdAt: '2026-05-20T14:20:00.000Z',
    updatedAt: '2026-05-20T15:01:00.000Z',
  },
];

export const initialMessages: Message[] = [
  {
    id: 'msg_welcome',
    role: 'assistant',
    content:
      '你好，我已经学习了当前知识库中的文档。你可以询问工程方案、文档规范或引用策略，我会尽量基于已上传资料回答，并附上可验证来源。',
    citations: [],
    createdAt: '2026-05-21T09:29:00.000Z',
  },
  {
    id: 'msg_user_1',
    role: 'user',
    content: 'Vite 为什么在开发环境启动这么快？',
    createdAt: '2026-05-21T09:30:00.000Z',
  },
  {
    id: 'msg_ai_1',
    role: 'assistant',
    content:
      '根据知识库资料，Vite 快的核心原因是开发阶段不做完整打包，而是让浏览器直接按需加载原生模块。依赖会提前预构建，源码变更时只更新相关模块，因此冷启动和热更新都更轻。\n\n同时，检索增强会把相关文档片段带入回答上下文，所以这里的结论来自已上传文档，而不是模型自由发挥。',
    citations,
    createdAt: '2026-05-21T09:30:18.000Z',
  },
];
