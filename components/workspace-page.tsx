'use client';

import {
  BellOutlined,
  BookOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  ExportOutlined,
  FileMarkdownOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  ImportOutlined,
  MailOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { App, Avatar, Button, Empty, Input, Progress, Select, Space, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import CitationCard from '@/components/citation-card';
import CreateKnowledgeBaseModal, {
  type ManualKbValues,
} from '@/components/create-kb-modal';
import MarkdownMessage from '@/components/markdown-message';
import { citations, currentUser } from '@/data/mock';
import type { Citation, Conversation, DocumentStatus, FileType, KnowledgeDocument, Message, Visibility } from '@/types';
import { createWelcomeMessage } from '@/lib/chat';
import { chatPath, getWorkspaceMode, knowledgePath, type WorkspaceMode } from '@/lib/paths';
import { documentProcessingStages, fileTypeText, formatSize, parseUploadedFile } from '@/lib/document';
import {
  buildKnowledgeBase,
  useDocuments,
  useExpandedDocId,
  useKnowledgeBases,
  useKnowledgeStore,
} from '@/stores/knowledge-store';
import {
  useConversations,
  useConversationsByKb,
  useConversationMessages,
  useChatStore,
} from '@/stores/chat-store';

const statusMeta: Record<DocumentStatus, { label: string; color: string }> = {
  uploading: { label: '上传中', color: 'processing' },
  parsing: { label: '解析中', color: 'blue' },
  chunking: { label: '切片中', color: 'gold' },
  embedding: { label: '向量化中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
};

const fileIcon: Record<FileType, ReactNode> = {
  pdf: <FilePdfOutlined />,
  markdown: <FileMarkdownOutlined />,
  text: <FileTextOutlined />,
  word: <FileWordOutlined />,
  excel: <FileExcelOutlined />,
};

export default function WorkspacePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;
  const conversationIdParam = typeof params.conversationId === 'string' ? params.conversationId : undefined;
  const mode: WorkspaceMode = getWorkspaceMode(pathname);

  const kbList = useKnowledgeBases();
  const docRows = useDocuments();
  const expandedDocId = useExpandedDocId();
  const addKnowledgeBase = useKnowledgeStore((s) => s.addKnowledgeBase);
  const addDocument = useKnowledgeStore((s) => s.addDocument);
  const updateDocument = useKnowledgeStore((s) => s.updateDocument);
  const removeDocumentFromStore = useKnowledgeStore((s) => s.removeDocument);
  const setExpandedDocId = useKnowledgeStore((s) => s.setExpandedDocId);
  const resolveExpandedDocForKb = useKnowledgeStore((s) => s.resolveExpandedDocForKb);

  const conversationList = useConversations();
  const addConversation = useChatStore((s) => s.addConversation);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const ensureConversationMessages = useChatStore((s) => s.ensureConversationMessages);
  const setConversationMessages = useChatStore((s) => s.setConversationMessages);
  const syncConversationMeta = useChatStore((s) => s.syncConversationMeta);

  const { message } = App.useApp();

  const [input, setInput] = useState('');
  const [liveCitations, setLiveCitations] = useState<Citation[]>(citations);
  const [keyword, setKeyword] = useState('');
  const [kbModalOpen, setKbModalOpen] = useState(false);

  const activeKbId = kbIdParam && kbList.some((kb) => kb.id === kbIdParam) ? kbIdParam : kbList[0]?.id ?? '';
  const activeKb = kbList.find((item) => item.id === activeKbId) ?? kbList[0];
  const kbConversations = useConversationsByKb(activeKbId);
  const activeConversationId =
    conversationIdParam && conversationList.some((chat) => chat.id === conversationIdParam)
      ? conversationIdParam
      : (kbConversations[0]?.id ?? '');
  const messages = useConversationMessages(activeConversationId);

  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    if (!activeConversationId) return;
    setConversationMessages(activeConversationId, updater);
  };

  const goToKnowledge = (kbId: string = activeKbId) => {
    router.push(knowledgePath(kbId));
  };

  const goToChat = (kbId: string = activeKbId, conversationId?: string) => {
    router.push(chatPath(kbId, conversationId));
  };

  useEffect(() => {
    if (kbIdParam && !kbList.some((kb) => kb.id === kbIdParam)) {
      router.replace(mode === 'chat' ? chatPath(kbList[0].id) : knowledgePath(kbList[0].id));
    }
  }, [kbIdParam, kbList, mode, router]);

  useEffect(() => {
    resolveExpandedDocForKb(activeKbId);
  }, [activeKbId, resolveExpandedDocForKb]);

  useEffect(() => {
    if (mode !== 'chat') return;
    if (conversationIdParam && conversationList.some((chat) => chat.id === conversationIdParam)) {
      ensureConversationMessages(conversationIdParam, activeKb?.name ?? '当前知识库');
      return;
    }
    if (!conversationIdParam && kbConversations[0]) {
      router.replace(chatPath(activeKbId, kbConversations[0].id));
    }
  }, [mode, conversationIdParam, conversationList, activeKbId, activeKb?.name, kbConversations, router, ensureConversationMessages]);
  const activeDocs = useMemo(() => {
    return docRows.filter((doc) => {
      const inKb = doc.knowledgeBaseId === activeKbId;
      const matchKeyword = `${doc.title}${doc.fileName}${doc.content}`.includes(keyword.trim());
      return inKb && (!keyword.trim() || matchKeyword);
    });
  }, [activeKbId, docRows, keyword]);
  const expandedDoc = activeDocs.find((doc) => doc.id === expandedDocId) ?? activeDocs[0];

  const selectKb = (kbId: string) => {
    goToKnowledge(kbId);
  };

  const openConversation = (conversationId: string) => {
    setLiveCitations([]);
    ensureConversationMessages(conversationId, activeKb?.name ?? '当前知识库');
    goToChat(activeKbId, conversationId);
  };

  const createNewConversation = () => {
    const conversationId = `chat_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const kbName = activeKb?.name ?? '当前知识库';
    const newChat: Conversation = {
      id: conversationId,
      knowledgeBaseId: activeKbId,
      title: '新对话',
      messageCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    addConversation(newChat, [createWelcomeMessage(kbName)]);
    setInput('');
    setLiveCitations([]);
    goToChat(activeKbId, conversationId);
    message.success('已开始新对话');
  };

  const simulateAnswer = (question: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    const assistantId = crypto.randomUUID();
    const answer =
      '我已经在当前知识库中检索到相关资料。根据文档内容，这个平台需要把“知识合集”和“AI 对话”拆成两个清晰入口：知识库用于查看、导入、展开资料；AI 对话用于基于当前知识库进行问答。\n\n每次回答都应该同步展示引用来源，用户点击来源后可以回到对应文档段落，从而确认回答依据。';

    setMessages((prev) => {
      const next = [
        ...prev,
        userMessage,
        {
          id: assistantId,
          role: 'assistant' as const,
          content: '',
          citations: [],
          createdAt: new Date().toISOString(),
          streaming: true,
        },
      ];
      syncConversationMeta(activeConversationId, next);
      const chat = conversationList.find((item) => item.id === activeConversationId);
      if (chat?.title === '新对话') {
        updateConversation(activeConversationId, {
          title: question.length > 24 ? `${question.slice(0, 24)}…` : question,
        });
      }
      return next;
    });
    setLiveCitations([]);

    window.setTimeout(() => setLiveCitations([citations[0]]), 300);
    window.setTimeout(() => setLiveCitations(citations), 700);

    let cursor = 0;
    const timer = window.setInterval(() => {
      cursor += 8;
      setMessages((prev) => {
        const next = prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: answer.slice(0, cursor),
                citations: cursor > answer.length / 2 ? citations : [citations[0]],
                streaming: cursor < answer.length,
              }
            : item,
        );
        if (cursor >= answer.length) {
          syncConversationMeta(activeConversationId, next);
        }
        return next;
      });
      if (cursor >= answer.length) {
        window.clearInterval(timer);
      }
    }, 42);
  };

  const sendMessage = () => {
    const question = input.trim();
    if (!question) return;
    setInput('');
    if (mode !== 'chat') {
      goToChat(activeKbId, kbConversations[0]?.id ?? activeConversationId);
    }
    simulateAnswer(question);
  };

  const importFileToKb = async (file: File, kbId: string) => {
    const importKey = `import-${file.name}-${file.size}`;
    message.loading({ content: `正在读取《${file.name}》并提取关键点...`, key: importKey, duration: 0 });
    const { sourceTitle, content } = await parseUploadedFile(file);
    const newDoc: KnowledgeDocument = {
      id: crypto.randomUUID(),
      knowledgeBaseId: kbId,
      title: `${sourceTitle}关键点文档`,
      fileName: `${sourceTitle}-关键点.md`,
      fileType: 'markdown',
      fileSize: file.size,
      status: 'uploading',
      processingProgress: 8,
      chunkCount: 0,
      uploadedBy: currentUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content,
    };
    addDocument(newDoc);
    message.success({ content: `已生成《${sourceTitle}关键点文档》`, key: importKey });

    documentProcessingStages.forEach(([status, progress, delay]) => {
      window.setTimeout(() => {
        updateDocument(newDoc.id, {
          status,
          processingProgress: progress,
          chunkCount: status === 'completed' ? 24 : 12,
        });
      }, delay);
    });
    return newDoc;
  };

  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: false,
    accept: '.pdf,.md,.markdown,.txt,.csv,.xls,.xlsx,.doc,.docx',
    beforeUpload: async (file) => {
      await importFileToKb(file as File, activeKbId);
      return false;
    },
  };

  const addManualDocument = (kbId: string, title: string, content: string) => {
    const newDoc: KnowledgeDocument = {
      id: crypto.randomUUID(),
      knowledgeBaseId: kbId,
      title,
      fileName: `${title}.md`,
      fileType: 'markdown',
      fileSize: new Blob([content]).size,
      status: 'completed',
      processingProgress: 100,
      chunkCount: Math.max(1, Math.ceil(content.length / 500)),
      uploadedBy: currentUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content,
    };
    addDocument(newDoc);
    return newDoc;
  };

  const activateKnowledgeBase = (kbId: string) => {
    goToKnowledge(kbId);
  };

  const handleCreateManualKb = (values: ManualKbValues) => {
    const kb = buildKnowledgeBase(values);
    const hasContent = !!values.initialContent?.trim();
    if (hasContent) {
      addManualDocument(kb.id, `${values.name} · 首篇知识`, values.initialContent!.trim());
    }
    addKnowledgeBase({ ...kb, stats: { ...kb.stats, documentCount: hasContent ? 1 : 0 } });
    activateKnowledgeBase(kb.id);
    message.success(`知识库「${values.name}」已创建`);
  };

  const handleCreateImportKb = async (values: {
    name: string;
    description: string;
    visibility: Visibility;
    files: File[];
  }) => {
    const kb = buildKnowledgeBase({
      name: values.name,
      description: values.description || `通过导入 ${values.files.length} 个文件创建`,
      visibility: values.visibility,
    });
    addKnowledgeBase(kb);
    activateKnowledgeBase(kb.id);
    message.loading({ content: '正在导入文件并建库...', key: 'kb-import', duration: 0 });
    for (const file of values.files) {
      await importFileToKb(file, kb.id);
    }
    message.success({
      content: `知识库「${values.name}」已创建并导入 ${values.files.length} 个文件`,
      key: 'kb-import',
    });
  };

  const removeDocument = (documentId: string) => {
    removeDocumentFromStore(documentId, activeKbId);
    message.success('文档已从当前知识库移除');
  };

  return (
    <div className="hub-shell">
      <aside className="hub-sidebar">
        <div className="hub-brand">
          <span className="hub-brand__mark">知</span>
          <span>知识中枢</span>
        </div>

        <nav className="hub-nav">
          <button
            type="button"
            className={`hub-nav__item ${mode === 'knowledge' ? 'is-active' : ''}`}
            onClick={() => goToKnowledge()}
          >
            <BookOutlined />
            <span>知识库</span>
          </button>
          <button
            type="button"
            className={`hub-nav__item ${mode === 'chat' ? 'is-active' : ''}`}
            onClick={() => goToChat()}
          >
            <MessageOutlined />
            <span>AI 对话</span>
          </button>
        </nav>

        <div className="hub-side-section">
          {mode === 'knowledge' ? (
            <>
              <div className="hub-section-title">
                <Typography.Text>我的知识库</Typography.Text>
                <span>{kbList.length}</span>
              </div>
              {kbList.map((kb) => (
                <button
                  type="button"
                  key={kb.id}
                  className={`hub-kb ${activeKbId === kb.id ? 'is-active' : ''}`}
                  onClick={() => selectKb(kb.id)}
                >
                  <span>{kb.name}</span>
                  <small>
                    {kb.stats.documentCount} 份知识 · {kb.stats.conversationCount} 次问答
                  </small>
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="hub-section-title">
                <Typography.Text>历史记录</Typography.Text>
                <span>{kbConversations.length}</span>
              </div>
              {kbConversations.length ? (
                kbConversations.map((chat) => (
                  <button
                    type="button"
                    key={chat.id}
                    className={`hub-chat-record ${activeConversationId === chat.id ? 'is-active' : ''}`}
                    onClick={() => openConversation(chat.id)}
                  >
                    <MessageOutlined />
                    <span>
                      <strong>{chat.title}</strong>
                      <small>{chat.messageCount} 条消息 · 当前知识库</small>
                    </span>
                  </button>
                ))
              ) : (
                <Typography.Text type="secondary" className="hub-empty-hint">
                  当前知识库暂无对话
                </Typography.Text>
              )}
            </>
          )}
        </div>

        <div className="hub-sidebar__bottom">
          <button type="button" className="hub-nav__item">
            <SettingOutlined />
            <span>系统设置</span>
          </button>
          {mode === 'knowledge' ? (
            <Button icon={<PlusOutlined />} block onClick={() => setKbModalOpen(true)}>
              新建知识库
            </Button>
          ) : (
            <Button icon={<PlusOutlined />} block onClick={createNewConversation}>
              新建对话
            </Button>
          )}
        </div>
      </aside>

      <main className="hub-main">
        <header className="hub-topbar">
          <Input className="hub-global-search" prefix={<SearchOutlined />} placeholder="搜索知识、对话、文档内容..." />
          <Space size={16}>
            <MailOutlined />
            <BellOutlined />
            <SettingOutlined />
            <Avatar src={currentUser.avatar}>{currentUser.name.slice(0, 1)}</Avatar>
            <Typography.Text strong>{currentUser.name}</Typography.Text>
          </Space>
        </header>

        {mode === 'knowledge' ? (
          <section className="knowledge-workspace">
            <div className="knowledge-main">
              <div className="knowledge-head">
                <div>
                  <Typography.Title level={2}>我的知识合集</Typography.Title>
                  <Typography.Text type="secondary">{activeKb?.description}</Typography.Text>
                </div>
                <Space wrap>
                  <Upload {...uploadProps}>
                    <Button type="primary" icon={<ImportOutlined />}>
                      导入并提取关键点
                    </Button>
                  </Upload>
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="搜索当前知识库..."
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                  />
                </Space>
              </div>

              <div className="knowledge-list">
                {activeDocs.length ? (
                  activeDocs.map((doc) => {
                    const expanded = expandedDoc?.id === doc.id;
                    return (
                      <article key={doc.id} className={`knowledge-card ${expanded ? 'is-expanded' : ''}`}>
                        <div
                          className="knowledge-card__summary"
                          onClick={() => setExpandedDocId(doc.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setExpandedDocId(doc.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <span className={`file-icon file-icon--${doc.fileType}`}>{fileIcon[doc.fileType]}</span>
                          <span className="knowledge-card__title">
                            <strong>{doc.title}</strong>
                            <small>
                              创建于 2026-05-21 · 大小 {formatSize(doc.fileSize)} · {statusMeta[doc.status].label}
                            </small>
                          </span>
                          {doc.status !== 'completed' && (
                            <span className="knowledge-card__progress">
                              <Progress percent={doc.processingProgress} size="small" showInfo={false} />
                              <small>{doc.processingProgress}%</small>
                            </span>
                          )}
                          <span className="knowledge-card__actions">
                            <Button size="small" onClick={(event) => event.stopPropagation()}>
                              {expanded ? '收起详情' : '查看详情'}
                            </Button>
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeDocument(doc.id);
                              }}
                            >
                              删除
                            </Button>
                          </span>
                        </div>

                        {expanded && (
                          <div className="knowledge-detail">
                            <div className="knowledge-detail__toolbar">
                              <Typography.Title level={3}>{doc.title}：内容解析与知识摘要</Typography.Title>
                              <Space>
                                <Button icon={<ExportOutlined />}>导出</Button>
                                <Button type="primary">编辑</Button>
                              </Space>
                            </div>
                            <Typography.Paragraph>
                              当前内容已经被解析为可检索的知识片段，后续提问时系统会优先召回相关段落，并在回答中给出来源。
                            </Typography.Paragraph>
                            <div className="uploaded-content">
                              <div className="uploaded-content__head">
                                <strong>导入内容</strong>
                                <Tag color={statusMeta[doc.status].color}>{statusMeta[doc.status].label}</Tag>
                              </div>
                              {doc.status !== 'completed' && <Progress percent={doc.processingProgress} size="small" />}
                              <pre>{doc.content}</pre>
                            </div>
                            <Typography.Paragraph>重点摘要：</Typography.Paragraph>
                            <ul className="knowledge-points">
                              <li>资料会经历上传、读取、解析、切片、向量化四个阶段。</li>
                              <li>完成后的知识片段可被 AI 对话检索，并作为回答依据。</li>
                              <li>引用来源需要能回到原文段落，保证回答可验证。</li>
                            </ul>
                            <pre className="knowledge-code">
                              <button type="button">复制</button>
                              <code>{`知识片段示例：\n标题：${doc.title}\n状态：${statusMeta[doc.status].label}\n用途：用于当前知识库问答与引用溯源`}</code>
                            </pre>
                          </div>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <Empty description="当前知识库暂无匹配内容" />
                )}
              </div>
            </div>

            <aside className="insight-panel">
              <div className="insight-panel__head">
                <Typography.Title level={5}>文档属性与智能洞察</Typography.Title>
              </div>
              {expandedDoc ? (
                <>
                  <div className="property-list">
                    <div>
                      <span>文件编号</span>
                      <strong>{expandedDoc.title}编号</strong>
                    </div>
                    <div>
                      <span>文档类型</span>
                      <strong>{fileTypeText[expandedDoc.fileType]}</strong>
                    </div>
                    <div>
                      <span>文件大小</span>
                      <strong>{formatSize(expandedDoc.fileSize)}</strong>
                    </div>
                    <div>
                      <span>上传者</span>
                      <strong>{expandedDoc.uploadedBy.name}</strong>
                    </div>
                    <div>
                      <span>知识切片</span>
                      <strong>{expandedDoc.chunkCount || '处理中'} 段</strong>
                    </div>
                  </div>
                  <div className="tag-row">
                    <Tag color="blue">知识库</Tag>
                    <Tag color="green">可问答</Tag>
                    <Tag color="gold">中文资料</Tag>
                  </div>
                  <section className="ai-summary">
                    <div className="ai-summary__tabs">
                      <button type="button" className="is-active">
                        摘要
                      </button>
                      <button type="button">要点</button>
                      <button type="button">相关对话</button>
                    </div>
                    <Typography.Title level={5}>智能摘要</Typography.Title>
                    <Typography.Paragraph>
                      这份资料主要描述《{expandedDoc.title}》的关键内容，适合用于团队知识沉淀、问答检索和引用验证。
                    </Typography.Paragraph>
                    <Button type="primary" block onClick={() => goToChat()}>
                      基于此文档提问
                    </Button>
                  </section>
                </>
              ) : (
                <Empty description="点击左侧知识条目查看属性" />
              )}
            </aside>
          </section>
        ) : (
          <section className="chat-workspace">
            <div className="chat-main">
              <div className="chat-head">
                <div>
                  <Typography.Title level={2}>AI 对话</Typography.Title>
                  <Typography.Text type="secondary">当前问答范围：{activeKb?.name}</Typography.Text>
                </div>
                <Select
                  value={activeKbId}
                  onChange={(kbId) => {
                    const chatsForKb = conversationList.filter((chat) => chat.knowledgeBaseId === kbId);
                    const targetChat = chatsForKb.find((chat) => chat.id === activeConversationId) ?? chatsForKb[0];
                    goToChat(kbId, targetChat?.id);
                  }}
                  options={kbList.map((kb) => ({ value: kb.id, label: kb.name }))}
                />
              </div>
              <div className="message-list">
                {messages.map((item) => (
                  <article className={`message-row ${item.role === 'user' ? 'is-user' : ''}`} key={item.id}>
                    <Avatar src={item.role === 'user' ? currentUser.avatar : undefined}>
                      {item.role === 'user' ? '我' : 'AI'}
                    </Avatar>
                    <div className="message-bubble">
                      {item.streaming && !item.content ? (
                        <span className="thinking-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        <MarkdownMessage>{item.content}</MarkdownMessage>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <div className="composer">
                <Input.TextArea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={2000}
                  autoSize={{ minRows: 1, maxRows: 5 }}
                  placeholder="向当前知识库提问，按 Enter 发送"
                  onPressEnter={(event) => {
                    if (!event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} />
              </div>
            </div>
            <aside className="chat-side">
              <Typography.Title level={5}>引用来源</Typography.Title>
              <Typography.Text type="secondary">回答生成时实时同步</Typography.Text>
              <div className="chat-side__citations">
                {liveCitations.map((citation) => (
                  <CitationCard key={citation.documentId} citation={citation} onOpen={() => goToKnowledge()} />
                ))}
              </div>
              <div className="chat-history-panel">
                <Typography.Title level={5}>历史对话</Typography.Title>
                {kbConversations.map((chat) => (
                  <button
                    className={`chat-history ${activeConversationId === chat.id ? 'is-active' : ''}`}
                    type="button"
                    key={chat.id}
                    onClick={() => openConversation(chat.id)}
                  >
                    <MessageOutlined />
                    <span>{chat.title}</span>
                  </button>
                ))}
              </div>
            </aside>
          </section>
        )}
      </main>

      <CreateKnowledgeBaseModal
        open={kbModalOpen}
        onClose={() => setKbModalOpen(false)}
        onCreateManual={handleCreateManualKb}
        onCreateImport={handleCreateImportKb}
      />
    </div>
  );
}

