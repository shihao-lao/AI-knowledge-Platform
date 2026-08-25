'use client';

import { FileTextOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Collapse, Progress, Space, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
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

function confidenceColor(score: number) {
  if (score >= 0.8) return '#10b981';
  if (score >= 0.6) return '#f59e0b';
  return '#ef4444';
}

function confidenceLabel(score: number) {
  if (score >= 0.8) return '高置信';
  if (score >= 0.6) return '中置信';
  return '低置信';
}

function isQuestionsDoc(title: string) {
  return title.startsWith('题目:');
}

/** 单条引用卡片（展开显示详情） */
function CitationCard({
  citation,
  index,
  onOpen,
}: {
  citation: Citation;
  index: number;
  onOpen?: (c: Citation) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isQuestion = isQuestionsDoc(citation.documentTitle);
  const score = Math.round(citation.confidenceScore * 100);

  return (
    <div className={`citation-chip ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="citation-chip__btn"
        onClick={() => setExpanded(!expanded)}
      >
        <Tag
          icon={isQuestion ? undefined : <FileTextOutlined />}
          color={isQuestion ? 'blue' : undefined}
          className="citation-chip__tag"
        >
          [{index + 1}] {citation.documentTitle}
        </Tag>
        <Progress
          type="circle"
          percent={score}
          size={24}
          strokeColor={confidenceColor(citation.confidenceScore)}
          format={() => ''}
          className="citation-chip__score"
        />
      </button>
      {expanded && (
        <div className="citation-chip__detail">
          <div className="citation-chip__meta">
            <Space size={8}>
              <Tag color={isQuestion ? 'blue' : 'default'}>{isQuestion ? '题目' : '文档'}</Tag>
              <span style={{ color: confidenceColor(citation.confidenceScore), fontWeight: 600, fontSize: 12 }}>
                {confidenceLabel(citation.confidenceScore)} · {score}%
              </span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                片段 #{citation.chunkIndex + 1}
              </Typography.Text>
            </Space>
          </div>
          {citation.preview && (
            <Typography.Paragraph
              type="secondary"
              ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
              className="citation-chip__preview"
            >
              {citation.preview}
            </Typography.Paragraph>
          )}
          <button type="button" className="citation-chip__link" onClick={() => onOpen?.(citation)}>
            查看完整来源 →
          </button>
        </div>
      )}
    </div>
  );
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
                <div className="chat-msg__citations">
                  {item.citations.map((c, i) => (
                    <CitationCard
                      key={`${c.documentId}-${c.chunkIndex}-${i}`}
                      citation={c}
                      index={i}
                      onOpen={onCitationOpen}
                    />
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
