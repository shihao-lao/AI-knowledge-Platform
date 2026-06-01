'use client';

import { App, Select, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Citation, Message } from '@/types';
import { currentUser } from '@/data/mock';
import { chatPath, knowledgePath } from '@/lib/paths';
import { createWelcomeMessage } from '@/lib/chat';
import { sendChatMessage } from '@/app/api/chat';
import { api, type ApiKnowledge, type ApiConversation } from '@/lib/api-client';
import ChatMessageList from './components/ChatMessageList';
import ChatInputArea from './components/ChatInputArea';
import ChatSidebar from './components/ChatSidebar';

export default function ChatConversationPage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;
  const conversationIdParam = typeof params.conversationId === 'string' ? params.conversationId : undefined;

  const { message, modal } = App.useApp();

  const [knowledgeBases, setKnowledgeBases] = useState<ApiKnowledge[]>([]);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const activeKbId =
    kbIdParam && knowledgeBases.some((kb) => kb.id === kbIdParam) ? kbIdParam : (knowledgeBases[0]?.id ?? '');
  const activeKb = knowledgeBases.find((item) => item.id === activeKbId) ?? knowledgeBases[0];
  const kbConversations = conversations.filter((c) => c.knowledgeId === activeKbId);
  const activeConversationId =
    conversationIdParam && conversations.some((chat) => chat.id === conversationIdParam)
      ? conversationIdParam
      : (kbConversations[0]?.id ?? '');

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [liveCitations, setLiveCitations] = useState<Citation[]>([]);

  // 获取知识库列表
  const fetchKnowledgeBases = async () => {
    try {
      const result = await api.listKnowledge();
      setKnowledgeBases(result.data);
    } catch (error) {
      console.error('获取知识库列表失败:', error);
    }
  };

  // 获取对话列表
  const fetchConversations = async (knowledgeId: string) => {
    try {
      const result = await api.listConversations(knowledgeId);
      setConversations(result.data);
    } catch (error) {
      console.error('获取对话列表失败:', error);
    }
  };

  // 获取消息列表
  const fetchMessages = async (conversationId: string) => {
    try {
      const result = await api.listMessages(conversationId);
      setMessages(
        result.data.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          citations: m.citations,
          createdAt: m.createdAt,
        })),
      );
    } catch (error) {
      console.error('获取消息失败:', error);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  useEffect(() => {
    if (activeKbId) {
      fetchConversations(activeKbId);
    }
  }, [activeKbId]);

  useEffect(() => {
    if (knowledgeBases.length === 0) return;
    if (kbIdParam && knowledgeBases.some((kb) => kb.id === kbIdParam)) return;
    if (knowledgeBases[0]) {
      router.replace(chatPath(knowledgeBases[0].id));
    }
  }, [kbIdParam, knowledgeBases, router]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  useEffect(() => {
    if (conversationIdParam && !conversations.some((chat) => chat.id === conversationIdParam)) {
      // 对话不存在，等待加载
      return;
    }
    if (!conversationIdParam && kbConversations[0]) {
      router.replace(chatPath(activeKbId, kbConversations[0].id));
    }
  }, [conversationIdParam, conversations, activeKbId, kbConversations, router]);

  const sendMessageToLLM = async (question: string) => {
    if (!activeConversationId) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };

    // 更新 UI
    setMessages((prev) => [...prev, userMessage]);
    setLiveCitations([]);

    // 保存用户消息到数据库
    await api.createMessage(activeConversationId, {
      role: 'user',
      content: question,
    });

    // 如果是第一条消息，更新对话标题
    if (messages.length === 0) {
      const title = question.length > 24 ? `${question.slice(0, 24)}…` : question;
      await api.updateConversation(activeConversationId, { title });
      setConversations((prev) => prev.map((c) => (c.id === activeConversationId ? { ...c, title } : c)));
    }

    // Step 1: RAG 检索
    let context = '';
    let citations: Citation[] = [];
    try {
      const searchResults = await api.search({
        query: question,
        knowledgeId: activeKbId,
        topK: 8,
        scoreThreshold: 0.1,
      });

      if (searchResults.chunks.length > 0) {
        context = searchResults.chunks
          .map((r, i) => `[${i + 1}] [来源: ${r.source}]\n${r.content}`)
          .join('\n\n');

        citations = searchResults.chunks.map((r, i) => ({
          documentId: r.documentId,
          documentTitle: r.source,
          chunkIndex: i,
          preview: r.content
            .replace(/^\[文档:.*?\]\n/, '')
            .substring(0, 100) + (r.content.length > 100 ? '...' : ''),
          confidenceScore: r.score,
          color: `hsl(${(i * 60) % 360}, 70%, 50%)`,
        }));

        setLiveCitations(citations);
      }
    } catch (err) {
      console.error('[RAG] 检索失败:', err);
    }

    // Step 2: 构建消息
    const chatMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

    if (context) {
      chatMessages.push({
        role: 'system',
        content: `你是一个知识库问答助手。请严格基于下方「参考资料」回答用户问题。

## 参考资料
${context}

## 回答规则
1. **只使用参考资料中的信息**回答，不要编造或推测参考资料未提及的内容
2. 回答时标注引用来源，格式：[1]、[2] 等，对应参考资料中的编号
3. 如果参考资料中没有相关信息，直接回答"根据现有知识库资料，未找到与此问题相关的内容"，不要尝试自行回答
4. 回答简洁准确，使用中文`,
      });
    }

    // 添加历史消息
    const historyMessages = messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
    chatMessages.push(...historyMessages);
    chatMessages.push({ role: 'user', content: question });

    // Step 3: 调用 LLM
    const assistantId = `msg_${Date.now()}_assistant`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        citations,
        createdAt: new Date().toISOString(),
        streaming: true,
      },
    ]);

    let fullContent = '';

    await sendChatMessage(
      { messages: chatMessages, stream: true },
      (content) => {
        fullContent = content;
        setMessages((prev) =>
          prev.map((item) => (item.id === assistantId ? { ...item, content, streaming: true } : item)),
        );
      },
      async (content) => {
        fullContent = content;
        setMessages((prev) =>
          prev.map((item) => (item.id === assistantId ? { ...item, content, streaming: false } : item)),
        );

        // 保存助手消息到数据库
        await api.createMessage(activeConversationId, {
          role: 'assistant',
          content,
          citations,
        });
      },
      (error) => {
        message.error(error);
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? { ...item, content: '抱歉，获取回答时出现错误，请稍后重试。', streaming: false }
              : item,
          ),
        );
      },
    );
  };

  const sendMessage = () => {
    const question = input.trim();
    if (!question || loading || sending) return;
    setInput('');
    setSending(true);
    sendMessageToLLM(question).finally(() => setSending(false));
  };

  const createNewConversation = async () => {
    if (!activeKbId) return;

    setLoading(true);
    try {
      const result = await api.createConversation(activeKbId, '新对话');
      const newConversation = result.data;

      // 添加欢迎消息
      const kbName = activeKb?.name ?? '当前知识库';
      const welcomeMsg = createWelcomeMessage(kbName);
      await api.createMessage(newConversation.id, {
        role: welcomeMsg.role,
        content: welcomeMsg.content,
      });

      // 刷新对话列表
      await fetchConversations(activeKbId);
      setMessages([
        {
          ...welcomeMsg,
          id: welcomeMsg.id,
        },
      ]);

      router.push(chatPath(activeKbId, newConversation.id));
      message.success('已开始新对话');
    } catch (error) {
      console.error('创建对话失败:', error);
      message.error('创建对话失败');
    } finally {
      setLoading(false);
    }
  };

  const openConversation = (conversationId: string) => {
    setLiveCitations([]);
    router.push(chatPath(activeKbId, conversationId));
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await api.deleteConversation(conversationId);
      const remaining = conversations.filter((c) => c.id !== conversationId);
      setConversations(remaining);

      // 如果删除的是当前对话，跳转到另一个对话或创建新对话
      if (conversationId === activeConversationId) {
        if (remaining.length > 0) {
          const next = remaining.find((c) => c.knowledgeId === activeKbId) || remaining[0];
          router.push(chatPath(activeKbId, next.id));
        } else {
          createNewConversation();
        }
      }
      message.success('对话已删除');
    } catch (err) {
      console.error('删除对话失败:', err);
      message.error('删除对话失败');
    }
  };

  const goToKnowledge = () => {
    router.push(knowledgePath(activeKbId));
  };

  return (
    <div className="hub-shell">
      <aside className="hub-sidebar">
        <div className="hub-brand">
          <span className="hub-brand__mark">知</span>
          <span>知识中枢</span>
        </div>

        <nav className="hub-nav">
          <button type="button" className="hub-nav__item" onClick={goToKnowledge}>
            <span>📚</span>
            <span>知识库</span>
          </button>
          <button type="button" className="hub-nav__item is-active">
            <span>💬</span>
            <span>AI 对话</span>
          </button>
        </nav>

        <div className="hub-side-section">
          <div className="hub-section-title">
            <span>历史记录</span>
            <span>{kbConversations.length}</span>
          </div>
          {kbConversations.length ? (
            kbConversations.map((chat) => (
              <div
                key={chat.id}
                className={`hub-chat-record ${activeConversationId === chat.id ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className="hub-chat-record__btn"
                  onClick={() => openConversation(chat.id)}
                >
                  <span>💬</span>
                  <span>
                    <strong>{chat.title}</strong>
                    <small>{chat.messageCount} 条消息 · 当前知识库</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="hub-chat-record__delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    modal.confirm({
                      title: '确定删除此对话？',
                      content: '删除后不可恢复',
                      okText: '删除',
                      cancelText: '取消',
                      okButtonProps: { danger: true },
                      onOk: () => deleteConversation(chat.id),
                    });
                  }}
                >
                  <DeleteOutlined />
                </button>
              </div>
            ))
          ) : (
            <span className="hub-empty-hint">当前知识库暂无对话</span>
          )}
        </div>

        <div className="hub-sidebar__bottom">
          <button type="button" className="hub-nav__item">
            <span>⚙️</span>
            <span>系统设置</span>
          </button>
          <button
            type="button"
            className="ant-btn ant-btn-primary ant-btn-block"
            onClick={createNewConversation}
            disabled={loading}
          >
            新建对话
          </button>
        </div>
      </aside>

      <main className="hub-main">
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
                  router.push(chatPath(kbId));
                }}
                options={knowledgeBases.map((kb) => ({ value: kb.id, label: kb.name }))}
              />
            </div>
            <ChatMessageList messages={messages} userAvatar={currentUser.avatar} />
            <ChatInputArea value={input} onChange={setInput} onSend={sendMessage} sending={sending} />
          </div>
          <ChatSidebar
            liveCitations={liveCitations}
            conversations={kbConversations.map((c) => ({
              id: c.id,
              knowledgeBaseId: c.knowledgeId,
              title: c.title,
              messageCount: c.messageCount,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            }))}
            activeConversationId={activeConversationId}
            onCitationOpen={goToKnowledge}
            onConversationSelect={openConversation}
            onConversationDelete={deleteConversation}
          />
        </section>
      </main>
    </div>
  );
}
