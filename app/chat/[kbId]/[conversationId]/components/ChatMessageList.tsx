'use client';

import { FileTextOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Space, Tag, Typography } from 'antd';
import { useEffect, useRef } from 'react';
import type { Citation, Message } from '@/types';
import MarkdownMessage from '@/components/markdown-message';

interface ChatMessageListProps {
  messages: Message[];
  userAvatar?: string;
  onCitationOpen?: (citation: Citation) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessageList({ messages, userAvatar, onCitationOpen }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-msg-list">
      {messages.map((item) => {
        const isUser = item.role === 'user';
        return (
          <article className={`chat-msg ${isUser ? 'is-user' : 'is-ai'}`} key={item.id}>
            <Avatar
              className="chat-msg__avatar"
              src={isUser ? userAvatar : undefined}
              icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            />
            <div className="chat-msg__body">
              <div className="chat-msg__bubble">
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
              <div className="chat-msg__meta">
                <Typography.Text type="secondary" className="chat-msg__time">
                  {formatTime(item.createdAt)}
                </Typography.Text>
                {isUser && (
                  <Typography.Text type="secondary" className="chat-msg__role">
                    你
                  </Typography.Text>
                )}
              </div>
              {!isUser && item.citations && item.citations.length > 0 && (
                <Space size={[6, 6]} wrap className="chat-msg__citations">
                  {item.citations.map((c, i) => (
                    <Tag
                      key={`${c.documentId}-${c.chunkIndex}-${i}`}
                      icon={<FileTextOutlined />}
                      className="chat-citation"
                      onClick={() => onCitationOpen?.(c)}
                    >
                      {c.documentTitle}
                    </Tag>
                  ))}
                </Space>
              )}
            </div>
          </article>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
