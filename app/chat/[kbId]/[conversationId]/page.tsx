'use client';

import { App, Select, Space, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Message } from '@/types';
import { chatPath, knowledgePath, statisticsPath, questionsPath, resumesPath } from '@/lib/paths';
import HubShell from '@/components/hub-shell';
import { createWelcomeMessage } from '@/lib/chat';
import { sendChatMessage } from '@/lib/chat-api';
import { api, type ApiKnowledge, type ApiConversation, type ApiUser } from '@/lib/api-client';
import ChatMessageList from './components/ChatMessageList';
import ChatInputArea from './components/ChatInputArea';

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
  const [me, setMe] = useState<ApiUser | null>(null);

  const activeKbId =
    kbIdParam && knowledgeBases.some((kb) => kb.id === kbIdParam) ? kbIdParam : (knowledgeBases[0]?.id ?? '');
  const activeKb = knowledgeBases.find((item) => item.id === activeKbId) ?? knowledgeBases[0];
  const kbConversations = conversations.filter((c) => c.knowledgeId === activeKbId);
  const activeConversationId =
    conversationIdParam && conversations.some((chat) => chat.id === conversationIdParam)
      ? conversationIdParam
      : (kbConversations[0]?.id ?? '');
  const activeConversation = kbConversations.find((chat) => chat.id === activeConversationId);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatMode, setChatMode] = useState<'question' | 'interview'>('question');

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
    api.me().then(setMe);
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
    setMessages((prev) => [...prev, userMessage]);

    const assistantId = `msg_${Date.now()}_assistant`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        citations: [],
        createdAt: new Date().toISOString(),
        streaming: true,
      },
    ]);

    // 服务端完成：RAG 检索、历史管理、引用校验、消息落库、标题生成
    await sendChatMessage(
      { conversationId: activeConversationId, question, enableSearch: true, mode: chatMode },
      {
        onDelta: (content) => {
          setMessages((prev) =>
            prev.map((item) => (item.id === assistantId ? { ...item, content, streaming: true } : item)),
          );
        },
        onCompleted: (content, citations) => {
          setMessages((prev) =>
            prev.map((item) => (item.id === assistantId ? { ...item, content, citations, streaming: false } : item)),
          );
          // 服务端已更新标题/消息数，刷新会话列表
          fetchConversations(activeKbId);
        },
        onError: (error) => {
          message.error(typeof error === 'string' ? error : '发生未知错误');
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId ? { ...item, error, retryQuestion: question, streaming: false } : item,
            ),
          );
        },
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

  const retryMessage = (failedMessage: Message) => {
    if (!failedMessage.retryQuestion || loading || sending) return;
    // Send a new turn, keeping the interrupted attempt visible for comparison.
    setSending(true);
    sendMessageToLLM(failedMessage.retryQuestion).finally(() => setSending(false));
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

  const goToStatistics = () => {
    router.push(statisticsPath(activeKbId));
  };

  return (
    <HubShell>
      <aside className="hub-sidebar" id="app-sidebar">
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
          <button type="button" className="hub-nav__item" onClick={goToStatistics}>
            <span>📊</span>
            <span>引用统计</span>
          </button>
          <button type="button" className="hub-nav__item" onClick={() => router.push(questionsPath(activeKbId))}>
            <span>❓</span>
            <span>面试题库</span>
          </button>
          <button type="button" className="hub-nav__item" onClick={() => router.push(resumesPath())}>
            <span>📄</span>
            <span>简历分析</span>
          </button>
        </nav>

        <div className="hub-side-section">
          <div className="hub-section-title">
            <span>历史记录</span>
            <span>{kbConversations.length}</span>
          </div>
          {kbConversations.length ? (
            kbConversations.map((chat) => (
              <div key={chat.id} className={`hub-chat-record ${activeConversationId === chat.id ? 'is-active' : ''}`}>
                <button type="button" className="hub-chat-record__btn" onClick={() => openConversation(chat.id)}>
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
                <Typography.Title level={2}>{activeConversation?.title || 'AI 对话'}</Typography.Title>
                <Typography.Text type="secondary">当前问答范围：{activeKb?.name}</Typography.Text>
              </div>
              <Space wrap>
                <Select
                  value={chatMode}
                  onChange={(m) => setChatMode(m)}
                  style={{ width: 130 }}
                  options={[
                    { value: 'question', label: '💬 知识问答' },
                    { value: 'interview', label: '🎤 模拟面试' },
                  ]}
                />
                <Select
                  value={activeKbId}
                  onChange={(kbId) => {
                    router.push(chatPath(kbId));
                  }}
                  options={knowledgeBases.map((kb) => ({ value: kb.id, label: kb.name }))}
                />
              </Space>
            </div>
            <ChatMessageList
              messages={messages}
              userAvatar={me?.avatar}
              onCitationOpen={goToKnowledge}
              onRetry={retryMessage}
              retryDisabled={loading || sending}
            />
            <ChatInputArea value={input} onChange={setInput} onSend={sendMessage} sending={sending} />
          </div>
        </section>
      </main>
    </HubShell>
  );
}
