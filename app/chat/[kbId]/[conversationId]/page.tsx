'use client';

import { App, Avatar, Select, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Citation, Conversation, Message } from '@/types';
import { citations, currentUser } from '@/data/mock';
import { chatPath, knowledgePath } from '@/lib/paths';
import { createWelcomeMessage } from '@/lib/chat';
import { sendChatMessage } from '@/app/api/chat';
import {
  useConversations,
  useConversationsByKb,
  useConversationMessages,
  useChatStore,
} from '@/stores/chat-store';
import { useKnowledgeBases } from '@/stores/knowledge-store';
import ChatMessageList from './components/ChatMessageList';
import ChatInputArea from './components/ChatInputArea';
import ChatSidebar from './components/ChatSidebar';

export default function ChatConversationPage() {
  const router = useRouter();
  const params = useParams();
  const kbIdParam = typeof params.kbId === 'string' ? params.kbId : undefined;
  const conversationIdParam = typeof params.conversationId === 'string' ? params.conversationId : undefined;

  const { message } = App.useApp();

  const kbList = useKnowledgeBases();
  const conversationList = useConversations();
  const addConversation = useChatStore((s) => s.addConversation);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const ensureConversationMessages = useChatStore((s) => s.ensureConversationMessages);
  const setConversationMessages = useChatStore((s) => s.setConversationMessages);
  const syncConversationMeta = useChatStore((s) => s.syncConversationMeta);

  const activeKbId = kbIdParam && kbList.some((kb) => kb.id === kbIdParam) ? kbIdParam : kbList[0]?.id ?? '';
  const activeKb = kbList.find((item) => item.id === activeKbId) ?? kbList[0];
  const kbConversations = useConversationsByKb(activeKbId);
  const activeConversationId =
    conversationIdParam && conversationList.some((chat) => chat.id === conversationIdParam)
      ? conversationIdParam
      : (kbConversations[0]?.id ?? '');
  const messages = useConversationMessages(activeConversationId);

  const [input, setInput] = useState('');
  const [liveCitations, setLiveCitations] = useState<Citation[]>(citations);

  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    if (!activeConversationId) return;
    setConversationMessages(activeConversationId, updater);
  };

  useEffect(() => {
    if (kbIdParam && !kbList.some((kb) => kb.id === kbIdParam)) {
      router.replace(chatPath(kbList[0].id));
    }
  }, [kbIdParam, kbList, router]);

  useEffect(() => {
    if (conversationIdParam && conversationList.some((chat) => chat.id === conversationIdParam)) {
      ensureConversationMessages(conversationIdParam, activeKb?.name ?? '当前知识库');
      return;
    }
    if (!conversationIdParam && kbConversations[0]) {
      router.replace(chatPath(activeKbId, kbConversations[0].id));
    }
  }, [conversationIdParam, conversationList, activeKbId, activeKb?.name, kbConversations, router, ensureConversationMessages]);

  const sendMessageToCoze = async (question: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };
    const assistantId = crypto.randomUUID();

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

    // 转换消息格式
    const chatMessages = messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
    chatMessages.push({ role: 'user', content: question });

    // 使用 sendChatMessage API 函数
    await sendChatMessage(
      { messages: chatMessages, stream: true },
      (content) => {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? { ...item, content: content, streaming: true }
              : item,
          ),
        );
      },
      (content) => {
        setMessages((prev) => {
          const final = prev.map((item) =>
            item.id === assistantId
              ? { ...item, content: content, streaming: false }
              : item,
          );
          syncConversationMeta(activeConversationId, final);
          return final;
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
      }
    );
  };

  const sendMessage = () => {
    const question = input.trim();
    if (!question) return;
    setInput('');
    sendMessageToCoze(question);
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
    router.push(chatPath(activeKbId, conversationId));
    message.success('已开始新对话');
  };

  const openConversation = (conversationId: string) => {
    setLiveCitations([]);
    ensureConversationMessages(conversationId, activeKb?.name ?? '当前知识库');
    router.push(chatPath(activeKbId, conversationId));
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
              <button
                type="button"
                key={chat.id}
                className={`hub-chat-record ${activeConversationId === chat.id ? 'is-active' : ''}`}
                onClick={() => openConversation(chat.id)}
              >
                <span>💬</span>
                <span>
                  <strong>{chat.title}</strong>
                  <small>{chat.messageCount} 条消息 · 当前知识库</small>
                </span>
              </button>
            ))
          ) : (
            <span className="hub-empty-hint">
              当前知识库暂无对话
            </span>
          )}
        </div>

        <div className="hub-sidebar__bottom">
          <button type="button" className="hub-nav__item">
            <span>⚙️</span>
            <span>系统设置</span>
          </button>
          <button type="button" className="ant-btn ant-btn-primary ant-btn-block" onClick={createNewConversation}>
            新建对话
          </button>
        </div>
      </aside>

      <main className="hub-main">
        <header className="hub-topbar">
          <input className="hub-global-search" placeholder="搜索知识、对话、文档内容..." />
          <Space size={16}>
            <Avatar src={currentUser.avatar}>{currentUser.name.slice(0, 1)}</Avatar>
            <span>{currentUser.name}</span>
          </Space>
        </header>

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
                  router.push(chatPath(kbId, targetChat?.id));
                }}
                options={kbList.map((kb) => ({ value: kb.id, label: kb.name }))}
              />
            </div>
            <ChatMessageList messages={messages} currentUser={currentUser} />
            <ChatInputArea value={input} onChange={setInput} onSend={sendMessage} />
          </div>
          <ChatSidebar
            liveCitations={liveCitations}
            conversations={kbConversations}
            activeConversationId={activeConversationId}
            onCitationOpen={goToKnowledge}
            onConversationSelect={openConversation}
          />
        </section>
      </main>
    </div>
  );
}
